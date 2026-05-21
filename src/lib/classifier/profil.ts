// PROJ-16 — Persoenliche Stammdaten ("Mein Profil") als LLM-Kontext.
//
// Der Pipeline-Job laed das Profil EINMAL beim Start (via `holeProfil`) und
// reicht es als Teil des `PipelineKontext` an `klassifiziereBuchung` durch.
// Aus der Pipeline heraus wird der Prompt-Block via `formatiereProfilFuerLlm`
// vorformatiert (Klartext, datensparsam: NUR die Felder, die fuer die
// Klassifikation Mehrwert bringen).
//
// Zwei reine Pruefer-Funktionen (`istFamilienmitglied`, `istArbeitgeber`)
// erlauben der Pipeline, ohne LLM-Aufruf bereits an bestimmten Stellen die
// richtige Schlussfolgerung zu ziehen — z. B. Familien-Empfaenger NIE im
// Web nachschlagen (DSGVO), Arbeitgeber-Lohn als Privat erkennen.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface ProfilArbeitgeberEintrag {
  name: string;
  name_normalisiert: string;
  aktiv_von: string | null;
  aktiv_bis: string | null;
}

export type FamilienRolle = "ehepartner" | "kind" | "eltern" | "sonstige";

export interface ProfilFamilieEintrag {
  name: string;
  name_normalisiert: string;
  rolle: FamilienRolle;
  auch_geschaeftspartner: boolean;
}

export interface ProfilAdresse {
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
}

export interface ProfilEigenesKonto {
  id: string;
  bezeichnung: string;
  iban: string | null;
}

export interface MeinProfil {
  arbeitgeber: ProfilArbeitgeberEintrag[];
  familie: ProfilFamilieEintrag[];
  adresse: ProfilAdresse | null;
  eigene_konten: ProfilEigenesKonto[];
}

// ---------------------------------------------------------------------------
// DB-Loader
// ---------------------------------------------------------------------------

/**
 * Liest das gesamte Profil eines Owners in EINEM Aufruf (drei parallele
 * SELECTs). Wird vom Pipeline-Job genau einmal pro Lauf aufgerufen und in
 * den `PipelineKontext` gehaengt — keine Per-Buchung-DB-Last.
 *
 * Bei Fehlern in einzelnen Teil-Queries liefert die Funktion einen leeren
 * Teilbereich zurueck (z. B. `arbeitgeber: []`), damit die Klassifizierung
 * NICHT abbricht. Das Profil ist Kontext, nicht Pflicht.
 */
export async function holeProfil(
  supabase: SupabaseClient,
  owner_id: string,
): Promise<MeinProfil> {
  const [arbRes, famRes, adrRes, kontoRes] = await Promise.all([
    supabase
      .from("mein_profil_arbeitgeber")
      .select("name, name_normalisiert, aktiv_von, aktiv_bis")
      .eq("owner_id", owner_id)
      .order("name", { ascending: true })
      .limit(100),
    supabase
      .from("mein_profil_familie")
      .select("name, name_normalisiert, rolle, auch_geschaeftspartner")
      .eq("owner_id", owner_id)
      .order("name", { ascending: true })
      .limit(100),
    supabase
      .from("mein_profil_adresse")
      .select("strasse, plz, ort, land")
      .eq("owner_id", owner_id)
      .maybeSingle(),
    supabase
      .from("konto")
      .select("id, bezeichnung, mapping, ist_eigenes_konto")
      .eq("owner_id", owner_id)
      .eq("ist_eigenes_konto", true)
      .order("bezeichnung", { ascending: true })
      .limit(100),
  ]);

  const arbeitgeber = (
    arbRes.error || !arbRes.data ? [] : arbRes.data
  ) as ProfilArbeitgeberEintrag[];

  const familie = (
    famRes.error || !famRes.data ? [] : famRes.data
  ) as ProfilFamilieEintrag[];

  const adresse = adrRes.error || !adrRes.data
    ? null
    : ((adrRes.data as unknown) as ProfilAdresse);

  type KontoRow = {
    id: string;
    bezeichnung: string;
    mapping: { iban?: string | null } | null;
  };
  const eigene_konten: ProfilEigenesKonto[] = (kontoRes.error || !kontoRes.data
    ? []
    : (kontoRes.data as unknown as KontoRow[])
  ).map((k) => ({
    id: k.id,
    bezeichnung: k.bezeichnung,
    iban:
      typeof k.mapping?.iban === "string" && k.mapping.iban.length > 0
        ? k.mapping.iban
        : null,
  }));

  return { arbeitgeber, familie, adresse, eigene_konten };
}

// ---------------------------------------------------------------------------
// Reine Helper (testbar ohne DB)
// ---------------------------------------------------------------------------

/**
 * Liefert true, wenn das Profil mindestens einen Eintrag enthaelt, der das
 * LLM informieren wuerde. Wird im LLM-Prompt-Wiring verwendet, damit der
 * Block nur bei tatsaechlich vorhandenen Daten erscheint.
 */
export function profilHatInhalt(p: MeinProfil | null | undefined): boolean {
  if (!p) return false;
  if (p.arbeitgeber.length > 0) return true;
  if (p.familie.length > 0) return true;
  if (p.eigene_konten.length > 0) return true;
  if (
    p.adresse &&
    (p.adresse.plz || p.adresse.ort || p.adresse.strasse)
  )
    return true;
  return false;
}

/**
 * Formatiert das Profil als kompakten Klartext-Block fuer das LLM. Enthaelt
 * keine sensiblen Daten ueber den Buchungs-Datensatz hinaus — nur die
 * Stammdaten des Inhabers. Bei leerem Profil → leerer String (der Aufrufer
 * fuegt den Block dann gar nicht erst ins Prompt ein).
 */
export function formatiereProfilFuerLlm(
  p: MeinProfil | null | undefined,
): string {
  if (!profilHatInhalt(p)) return "";
  const profil = p as MeinProfil;

  const teile: string[] = ["Persönliche Stammdaten des Inhabers:"];

  if (profil.arbeitgeber.length > 0) {
    const namen = profil.arbeitgeber
      .map((a) => {
        const zeitraum = formatiereZeitraum(a.aktiv_von, a.aktiv_bis);
        return zeitraum ? `${a.name} (${zeitraum})` : a.name;
      })
      .join(", ");
    teile.push(`- Arbeitgeber: ${namen}`);
  }

  if (profil.adresse) {
    const wohnort = [
      profil.adresse.plz,
      profil.adresse.ort,
      profil.adresse.land && profil.adresse.land !== "DE"
        ? profil.adresse.land
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    if (wohnort) {
      teile.push(`- Wohnort: ${wohnort}`);
    }
  }

  if (profil.familie.length > 0) {
    const namen = profil.familie
      .map((f) => {
        const flag = f.auch_geschaeftspartner ? " [auch Geschäftspartner]" : "";
        return `${f.name} (${f.rolle})${flag}`;
      })
      .join(", ");
    teile.push(`- Familienmitglieder: ${namen}`);
  }

  if (profil.eigene_konten.length > 0) {
    const namen = profil.eigene_konten
      .map((k) => (k.iban ? `${k.bezeichnung} (${k.iban.slice(-4)})` : k.bezeichnung))
      .join(", ");
    teile.push(`- Eigene Bankkonten: ${namen}`);
  }

  teile.push("");
  teile.push("WICHTIGE Regeln für die Klassifikation:");
  teile.push(
    "- Eine Buchung VON einem Arbeitgeber mit Verwendungszweck 'Lohn'/'Gehalt'/'Bezüge' ist Privat-Gehalt (klassifikation 'privat', Privatentnahme-/Gehalt-Kategorie).",
  );
  teile.push(
    "- Eine Buchung AN oder VON einem Familienmitglied ist Privatentnahme/Privateinlage (klassifikation 'privat' oder 'neutral', keine USt).",
  );
  teile.push(
    "- Eine Buchung zwischen eigenen Bankkonten ist Geldtransit (klassifikation 'neutral').",
  );
  teile.push(
    "- Übereinstimmung mit Wohnort/PLZ in Empfänger oder Verwendungszweck ist ein starkes Privat-Signal (Wohnung, lokale Anbieter).",
  );

  return teile.join("\n");
}

function formatiereZeitraum(
  vonIso: string | null,
  bisIso: string | null,
): string | null {
  if (!vonIso && !bisIso) return null;
  const v = vonIso ?? "?";
  const b = bisIso ?? "heute";
  return `${v} – ${b}`;
}

/**
 * Prueft, ob der normalisierte Empfaenger einem Familienmitglied entspricht.
 * Exakter Match (case-insensitive — beide Seiten sind bereits normalisiert).
 * Trim & lower zur Sicherheit, falls der Empfaenger-Norm-Wert irgendwo nicht
 * normalisiert durchgereicht wurde.
 */
export function istFamilienmitglied(
  profil: MeinProfil | null | undefined,
  empfaenger_normalisiert: string | null | undefined,
): boolean {
  if (!profil) return false;
  const norm = (empfaenger_normalisiert ?? "").trim().toLowerCase();
  if (norm.length === 0) return false;
  return profil.familie.some(
    (f) => f.name_normalisiert.trim().toLowerCase() === norm,
  );
}

/**
 * Prueft, ob der normalisierte Empfaenger ein aktiver Arbeitgeber zum
 * angegebenen Datum ist. Ohne Datum → genuegt, dass irgendein Arbeitgeber-
 * Eintrag den Namen matcht (z. B. bei Re-Klassifizierung historischer
 * Buchungen ohne Datums-Filter).
 *
 * Aktive Zeit: aktiv_von <= datum <= aktiv_bis (jede Grenze optional).
 */
export function istArbeitgeber(
  profil: MeinProfil | null | undefined,
  empfaenger_normalisiert: string | null | undefined,
  datum?: string,
): boolean {
  if (!profil) return false;
  const norm = (empfaenger_normalisiert ?? "").trim().toLowerCase();
  if (norm.length === 0) return false;

  const treffer = profil.arbeitgeber.filter(
    (a) => a.name_normalisiert.trim().toLowerCase() === norm,
  );
  if (treffer.length === 0) return false;

  if (!datum) return true;
  return treffer.some((a) => {
    if (a.aktiv_von && datum < a.aktiv_von) return false;
    if (a.aktiv_bis && datum > a.aktiv_bis) return false;
    return true;
  });
}

/**
 * Hilfsfunktion fuer die API-Routen: erzeugt aus einem Roh-Namen den
 * Normalisierungs-Schluessel, der in `name_normalisiert` gespeichert wird.
 * Bewusst eigene Wrapper-Funktion, damit der Aufrufer nicht direkt aus
 * `normalize.ts` importieren muss (klare Schichtung).
 */
export function normalisiereProfilName(name: string): string {
  return normalisiereEmpfaenger(name);
}
