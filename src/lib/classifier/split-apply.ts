// PROJ-15 P1 — Wiederverwendbare Split-Anwendung.
//
// Extrahiert aus `src/app/api/pruefliste/entscheiden/route.ts` die Logik, eine
// Buchung in zwei Teilbuchungen aufzuteilen: zwei Kind-Buchungen mit
// `parent_buchung_id` + `split_anteil`, die Eltern-Buchung wird zur
// eingefrorenen „Klammer". Genutzt von:
//  - der manuellen Aufteilung in der Prüflisten-Route (unverändertes Verhalten),
//  - der automatischen Split-Aktion in der Klassifizierungs-Pipeline
//    (`aktion.split` einer Lernregel).
//
// `baueSplitKinder` ist eine REINE Funktion (kein IO, testbar ohne Supabase).
// `wendeSplitAn` führt die drei DB-Schritte aus (Kinder-Insert, Klammer-Update,
// Audit) und liefert ein Ergebnis-Objekt — wirft NICHT für Fachfehler.

import type { Klassifikation } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Eltern-/Klammerbuchung, deren Felder die Kinder erben. */
export interface SplitEltern {
  id: string;
  owner_id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  /**
   * Normalisierter Empfaenger der Klammer — die Kinder erben ihn 1:1, damit
   * Cache-/Historie-Lookups denselben Schlüssel sehen. Optional; ist er nicht
   * gesetzt, bleibt er bei den Kindern null.
   */
  empfaenger_normalisiert?: string | null;
  waehrung: string;
  duplikat_hash: string;
}

/**
 * Beschreibt die konkrete Aufteilung. Anteil A bezieht sich auf das erste
 * Kind; Anteil B ergibt sich aus `1 - anteil_a` (auf 4 Stellen gerundet,
 * exakt wie die bisherige Route). Klassifikation/Kategorie/USt je Seite.
 */
export interface SplitDefinition {
  anteil_a: number;
  klassifikation_a: Klassifikation;
  kategorie_id_a?: string | null;
  ust_satz_a?: number | null;
  klassifikation_b: Klassifikation;
  kategorie_id_b?: string | null;
  ust_satz_b?: number | null;
}

/** Eine fertige Kind-Buchungs-Zeile (Insert-Form). */
export interface SplitKind {
  owner_id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
  waehrung: string;
  duplikat_hash: string;
  import_quelle: "split";
  klassifikation: Klassifikation;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  ust_satz: number | null;
  begruendung: string;
  konfidenz: number;
  quelle: "manuell" | "regel";
  status: "manuell_bestaetigt";
  pruef_grund: null;
  parent_buchung_id: string;
  split_anteil: number;
}

function steuerrelevantAus(k: Klassifikation): boolean | null {
  if (k === "geschaeftlich") return true;
  if (k === "privat" || k === "neutral") return false;
  return null;
}

/**
 * REINE Funktion: baut die zwei Kind-Buchungen aus Eltern + Split-Definition.
 * Rundung exakt wie in der bisherigen Prüflisten-Route:
 *  - `anteil_b = round(1 - anteil_a, 4)`
 *  - `betrag_a = round(betrag * anteil_a, 2)`
 *  - `betrag_b = round(betrag - betrag_a, 2)` (Rest, damit Summe exakt stimmt)
 */
export function baueSplitKinder(
  eltern: SplitEltern,
  def: SplitDefinition,
  quelle: "manuell" | "regel" = "manuell",
  begruendung = "Teilbuchung aus Aufteilung.",
): [SplitKind, SplitKind] {
  const anteilA = def.anteil_a;
  const anteilB = Number((1 - anteilA).toFixed(4));
  const betragA = Number((eltern.betrag * anteilA).toFixed(2));
  const betragB = Number((eltern.betrag - betragA).toFixed(2));
  const empfNorm = eltern.empfaenger_normalisiert ?? null;

  const basis = {
    owner_id: eltern.owner_id,
    konto_id: eltern.konto_id,
    buchung_datum: eltern.buchung_datum,
    verwendungszweck: eltern.verwendungszweck,
    empfaenger: eltern.empfaenger,
    empfaenger_normalisiert: empfNorm,
    waehrung: eltern.waehrung,
    import_quelle: "split" as const,
    begruendung,
    konfidenz: 1,
    quelle,
    status: "manuell_bestaetigt" as const,
    pruef_grund: null,
    parent_buchung_id: eltern.id,
  };

  const a: SplitKind = {
    ...basis,
    betrag: betragA,
    duplikat_hash: `${eltern.duplikat_hash}#split-a`,
    klassifikation: def.klassifikation_a,
    steuerrelevant: steuerrelevantAus(def.klassifikation_a),
    kategorie_id: def.kategorie_id_a ?? null,
    ust_satz: def.ust_satz_a ?? null,
    split_anteil: anteilA,
  };
  const b: SplitKind = {
    ...basis,
    betrag: betragB,
    duplikat_hash: `${eltern.duplikat_hash}#split-b`,
    klassifikation: def.klassifikation_b,
    steuerrelevant: steuerrelevantAus(def.klassifikation_b),
    kategorie_id: def.kategorie_id_b ?? null,
    ust_satz: def.ust_satz_b ?? null,
    split_anteil: anteilB,
  };
  return [a, b];
}

/** Optionen für die DB-Anwendung. */
export interface SplitAnwendungOptionen {
  /** Audit-Aktion (z. B. `manuell_aufgeteilt` oder `regel_aufgeteilt`). */
  aktion: string;
  /** Audit-Quelle (`nutzer` oder `regel`). */
  quelle: "nutzer" | "regel";
  /** Quelle, die in die Kind-Buchungen geschrieben wird. */
  kind_quelle?: "manuell" | "regel";
  /** Begründungstext der Kind-Buchungen (Default: generisch). */
  kind_begruendung?: string;
  /** Zusätzliche Audit-Details (z. B. beleg_hinweis, regel_id). */
  audit_details?: Record<string, unknown>;
}

export interface SplitErgebnis {
  ok: boolean;
  fehler?: "kinder_insert" | "klammer_update";
  betrag_a?: number;
  betrag_b?: number;
}

/**
 * Wendet den Split in der DB an: Kinder-Insert → Klammer-Update → Audit.
 * Owner-Scope wird über die Eltern-`owner_id` und die `.eq()`-Filter erzwungen
 * (zusätzlich zur RLS). Fachfehler werden als Ergebnis zurückgegeben (kein
 * Throw), damit der Aufrufer eine HTTP-Antwort bauen kann.
 */
export async function wendeSplitAn(
  supabase: SupabaseClient,
  eltern: SplitEltern,
  def: SplitDefinition,
  opts: SplitAnwendungOptionen,
): Promise<SplitErgebnis> {
  const kinder = baueSplitKinder(
    eltern,
    def,
    opts.kind_quelle ?? "manuell",
    opts.kind_begruendung,
  );
  const betragA = kinder[0].betrag;
  const betragB = kinder[1].betrag;

  const { error: kindErr } = await supabase.from("buchung").insert(kinder);
  if (kindErr) {
    return { ok: false, fehler: "kinder_insert" };
  }

  // Eltern-Buchung wird zur eingefrorenen Klammer (neutral, ohne USt-Wirkung).
  const { error: elternErr } = await supabase
    .from("buchung")
    .update({
      klassifikation: "neutral",
      steuerrelevant: false,
      quelle: opts.quelle === "regel" ? "regel" : "manuell",
      status: "manuell_bestaetigt",
      pruef_grund: null,
      begruendung: "In Teilbuchungen aufgeteilt (Klammerbuchung).",
    })
    .eq("id", eltern.id)
    .eq("owner_id", eltern.owner_id)
    .neq("status", "manuell_bestaetigt");
  if (elternErr) {
    return { ok: false, fehler: "klammer_update" };
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: eltern.owner_id,
    entitaet: "buchung",
    entitaet_id: eltern.id,
    aktion: opts.aktion,
    quelle: opts.quelle,
    details: {
      anteil_a: def.anteil_a,
      anteil_b: kinder[1].split_anteil,
      betrag_a: betragA,
      betrag_b: betragB,
      ...(opts.audit_details ?? {}),
    },
  });

  return { ok: true, betrag_a: betragA, betrag_b: betragB };
}
