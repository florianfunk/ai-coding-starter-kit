// PROJ-22: Globaler Jahreswähler — zentrale Single Source of Truth.
//
// Ein "aktives Jahr" ist entweder eine Kalenderjahr-Zahl oder null ("Alle
// Jahre"). Daraus leiten alle Ansichten ihr Datumsfenster ab. Reine Helper
// (testbar) + DB-Loader (firmenprofil.aktives_jahr).

import type { SupabaseClient } from "@supabase/supabase-js";

/** number = bestimmtes Kalenderjahr · null = "Alle Jahre" (kein Filter). */
export type AktivesJahr = number | null;

/** Datumsfenster (inkl.) als ISO-Strings; null = keine Grenze. */
export interface Zeitfenster {
  von: string | null;
  bis: string | null;
}

/**
 * Übersetzt ein aktives Jahr in ein Kalenderjahr-Fenster.
 * null → unbegrenzt (Alle Jahre).
 */
export function jahrZuZeitraum(jahr: AktivesJahr): Zeitfenster {
  if (jahr == null) return { von: null, bis: null };
  return { von: `${jahr}-01-01`, bis: `${jahr}-12-31` };
}

/**
 * Klammert ein (evtl. vom Detail-Picker stammendes) Fenster auf das aktive
 * Jahr — die "harte Klammer". Bei "Alle Jahre" (null) bleibt das Fenster
 * unverändert. Liegt das übergebene Fenster komplett außerhalb des Jahres,
 * wird auf das ganze Jahr zurückgefallen (statt leerer Schnittmenge).
 */
export function clampZeitraum(fenster: Zeitfenster, jahr: AktivesJahr): Zeitfenster {
  if (jahr == null) return fenster;
  const jahrFenster = jahrZuZeitraum(jahr);
  const von = maxIso(fenster.von, jahrFenster.von);
  const bis = minIso(fenster.bis, jahrFenster.bis);
  // Leere/invertierte Schnittmenge → ganzes Jahr.
  if (von && bis && von > bis) return jahrFenster;
  return {
    von: von ?? jahrFenster.von,
    bis: bis ?? jahrFenster.bis,
  };
}

/** Größeres (= späteres) der beiden ISO-Daten; null zählt als "keine Grenze". */
function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Kleineres (= früheres) der beiden ISO-Daten; null zählt als "keine Grenze". */
function minIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/**
 * Baut die absteigende Liste wählbarer Jahre aus dem Datenbereich
 * (frühestes/spätestes Buchungsdatum) plus dem laufenden Kalenderjahr.
 * `minIsoDatum`/`maxIsoDatum` sind YYYY-MM-DD oder null (keine Buchungen).
 */
export function verfuegbareJahre(
  minIsoDatum: string | null,
  maxIsoDatum: string | null,
  aktuellesJahr: number,
): number[] {
  const minJ = minIsoDatum ? Number(minIsoDatum.slice(0, 4)) : aktuellesJahr;
  const maxJ = maxIsoDatum ? Number(maxIsoDatum.slice(0, 4)) : aktuellesJahr;
  const von = Math.min(minJ, aktuellesJahr);
  const bis = Math.max(maxJ, aktuellesJahr);
  const jahre: number[] = [];
  for (let j = bis; j >= von; j--) jahre.push(j);
  return jahre;
}

/** Parst einen Roh-Param (?jahr=) zu AktivesJahr. "alle"/leer → null. */
export function parseJahrParam(raw: string | null | undefined): AktivesJahr {
  if (raw == null) return null;
  const t = raw.trim().toLowerCase();
  if (t === "" || t === "alle") return null;
  if (!/^\d{4}$/.test(t)) return null;
  const n = Number(t);
  if (n < 2000 || n > 2100) return null;
  return n;
}

// ---------------------------------------------------------------------------
// DB-Loader
// ---------------------------------------------------------------------------

/** Liest das gespeicherte aktive Jahr (firmenprofil.aktives_jahr). */
export async function ladeAktivesJahr(
  supabase: SupabaseClient,
  userId: string,
): Promise<AktivesJahr> {
  const { data } = await supabase
    .from("firmenprofil")
    .select("aktives_jahr")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  const wert = (data as { aktives_jahr?: number | null } | null)?.aktives_jahr;
  return wert == null ? null : Number(wert);
}

export interface JahrKontext {
  aktivesJahr: AktivesJahr;
  verfuegbareJahre: number[];
}

/**
 * Lädt für das Layout: aktives Jahr + wählbare Jahre (aus dem Datenbereich).
 * Default beim ersten Mal (aktives_jahr ist NULL und es gibt Buchungen):
 * jüngstes Datenjahr — dies wird hier NICHT persistiert, nur als Vorschlag
 * zurückgegeben; gespeichert wird erst, wenn der Nutzer aktiv wählt.
 */
export async function ladeJahrKontext(
  supabase: SupabaseClient,
  userId: string,
  aktuellesJahr: number,
): Promise<JahrKontext> {
  const [profil, minRow, maxRow] = await Promise.all([
    supabase
      .from("firmenprofil")
      .select("aktives_jahr")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("buchung")
      .select("buchung_datum")
      .eq("owner_id", userId)
      .order("buchung_datum", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("buchung")
      .select("buchung_datum")
      .eq("owner_id", userId)
      .order("buchung_datum", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const minDatum =
    (minRow.data as { buchung_datum?: string } | null)?.buchung_datum ?? null;
  const maxDatum =
    (maxRow.data as { buchung_datum?: string } | null)?.buchung_datum ?? null;
  const jahre = verfuegbareJahre(minDatum, maxDatum, aktuellesJahr);

  const gespeichert =
    (profil.data as { aktives_jahr?: number | null } | null)?.aktives_jahr;
  const aktivesJahr = gespeichert == null ? null : Number(gespeichert);

  return { aktivesJahr, verfuegbareJahre: jahre };
}

/**
 * Auflösung des serverseitigen Datumsfensters für API-Routen/Server-Komponenten.
 *
 * Reihenfolge (höchste Priorität zuerst):
 *  1. expliziter ?jahr= (z. B. Steuer-Drilldown) → übersteuert das globale Jahr.
 *  2. globales aktives Jahr aus dem Profil.
 *
 * Sind explizite von/bis übergeben, werden sie bei einem bestimmten Jahr auf
 * dessen Fenster geklammert (harte Klammer); bei "Alle Jahre" unverändert
 * übernommen.
 */
export async function aktiverZeitraum(
  supabase: SupabaseClient,
  userId: string,
  explizit?: { von?: string | null; bis?: string | null; jahr?: AktivesJahr },
): Promise<Zeitfenster> {
  const effektivesJahr =
    explizit?.jahr !== undefined && explizit.jahr !== null
      ? explizit.jahr
      : await ladeAktivesJahr(supabase, userId);

  const explizitFenster: Zeitfenster = {
    von: explizit?.von ?? null,
    bis: explizit?.bis ?? null,
  };

  if (effektivesJahr == null) {
    // Alle Jahre: explizite Grenzen unverändert (oder unbegrenzt).
    return explizitFenster;
  }
  return clampZeitraum(explizitFenster, effektivesJahr);
}
