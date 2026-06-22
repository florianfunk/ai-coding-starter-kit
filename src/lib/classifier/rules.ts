// PROJ-5 — Stufe 1 der Klassifizierungs-Pipeline: Regel-Engine.
//
// Reine, deterministische Funktionen (kein IO, kein DB-Zugriff). Wertet
// PROJ-7-Lernregeln gegen eine Buchung aus. Regeln haben Vorrang vor der KI
// (Determinismus). Höchste Priorität gewinnt; widersprechen sich mehrere
// Regeln gleicher Priorität, wird ein Konflikt signalisiert (→ Prüfliste).
//
// Mustervergleich: case-insensitive Substring-Suche (regex-safe, KEINE
// Regex-Auswertung von Nutzereingaben — verhindert ReDoS/Injection).

import type {
  Buchung,
  Klassifikation,
  Lernregel,
  LernregelSplit,
} from "@/lib/types";
import { kompiliereWennSicher } from "@/lib/classifier/regex-engine";

/** Eine konkrete Regel-Entscheidung für eine Buchung. */
export interface RegelErgebnis {
  regel_id: string;
  kategorie_id: string | null;
  ust_satz: number | null;
  klassifikation: Klassifikation | null;
  /** Priorität der angewandten Regel (höher = stärker). */
  prioritaet: number;
  /**
   * PROJ-15 — Split-Aktion der angewandten Regel (oder null). Ist sie gesetzt,
   * teilt die Pipeline die Buchung in zwei Kind-Buchungen auf, statt eine
   * einfache Kategorie/Klassifikation zu setzen.
   */
  split: LernregelSplit | null;
}

/** Gesamtergebnis der Regel-Auswertung für eine Buchung. */
export interface RegelAuswertung {
  /** Angewandtes Ergebnis oder null, wenn keine Regel greift. */
  treffer: RegelErgebnis | null;
  /**
   * true, wenn mehrere Regeln HÖCHSTER Priorität sich widersprechen
   * (uneinheitliche Aktion). Dann darf NICHT automatisch verbucht werden.
   */
  konflikt: boolean;
  /** IDs aller Regeln, die die Bedingung erfüllt haben (für Audit). */
  passende_regel_ids: string[];
}

/** Teilmenge der Buchungsfelder, die die Regel-Engine auswertet. */
export type BuchungFuerRegel = Pick<
  Buchung,
  "konto_id" | "betrag" | "verwendungszweck" | "empfaenger"
> & {
  /**
   * PROJ-15 — normalisierter Empfaenger. Regex-Bedingungen prüfen primär
   * gegen diesen Wert (Fallback: rohes `empfaenger`). Optional, weil
   * Altdaten ohne Backfill die Spalte noch leer haben.
   */
  empfaenger_normalisiert?: string | null;
};

/** Normalisiert Text für robusten, case-insensitiven Vergleich. */
function norm(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

/**
 * Wertet ein Nutzer-Regex fail-safe gegen einen Wert aus. Ein nicht
 * kompilierbares oder ReDoS-unsicheres Muster matcht NIE (gibt `false`).
 * Das Matching ist case-insensitiv (Flag in `kompiliereWennSicher`).
 */
function regexTrifft(muster: string, wert: string | null | undefined): boolean {
  const re = kompiliereWennSicher(muster);
  if (!re) return false; // fail-safe: unsicher/ungültig → kein Match
  return re.test(wert ?? "");
}

/**
 * Prüft, ob eine einzelne Lernregel-Bedingung auf die Buchung zutrifft.
 * Alle gesetzten Teilbedingungen müssen erfüllt sein (UND-Verknüpfung).
 * Eine Regel ohne jede Bedingung trifft NICHT zu (kein Catch-All durch Versehen).
 */
export function regelTrifftZu(
  regel: Lernregel,
  buchung: BuchungFuerRegel,
): boolean {
  const b = regel.bedingung ?? {};
  let hatBedingung = false;

  if (typeof b.empfaenger_muster === "string" && b.empfaenger_muster.trim()) {
    hatBedingung = true;
    if (!norm(buchung.empfaenger).includes(norm(b.empfaenger_muster))) {
      return false;
    }
  }

  if (typeof b.zweck_muster === "string" && b.zweck_muster.trim()) {
    hatBedingung = true;
    if (!norm(buchung.verwendungszweck).includes(norm(b.zweck_muster))) {
      return false;
    }
  }

  // PROJ-15 — Regex-Bedingungen (case-insensitive, ReDoS-geprüft).
  // empfaenger_regex prüft primär gegen den normalisierten Empfaenger und
  // fällt auf das rohe Feld zurück (entweder-oder reicht).
  if (typeof b.empfaenger_regex === "string" && b.empfaenger_regex.trim()) {
    hatBedingung = true;
    const norm_empf = (buchung.empfaenger_normalisiert ?? "").trim();
    const trifft =
      (norm_empf.length > 0 && regexTrifft(b.empfaenger_regex, norm_empf)) ||
      regexTrifft(b.empfaenger_regex, buchung.empfaenger);
    if (!trifft) return false;
  }

  if (typeof b.zweck_regex === "string" && b.zweck_regex.trim()) {
    hatBedingung = true;
    if (!regexTrifft(b.zweck_regex, buchung.verwendungszweck)) {
      return false;
    }
  }

  if (typeof b.konto_id === "string" && b.konto_id.trim()) {
    hatBedingung = true;
    if (b.konto_id !== buchung.konto_id) return false;
  }

  if (typeof b.betrag_min === "number" && Number.isFinite(b.betrag_min)) {
    hatBedingung = true;
    if (buchung.betrag < b.betrag_min) return false;
  }

  if (typeof b.betrag_max === "number" && Number.isFinite(b.betrag_max)) {
    hatBedingung = true;
    if (buchung.betrag > b.betrag_max) return false;
  }

  return hatBedingung;
}

/** Zwei Regel-Aktionen gelten als widersprüchlich, wenn ein gesetztes Feld abweicht. */
function aktionenWidersprechen(a: Lernregel, b: Lernregel): boolean {
  const aa = a.aktion ?? {};
  const ab = b.aktion ?? {};
  if (
    aa.kategorie_id != null &&
    ab.kategorie_id != null &&
    aa.kategorie_id !== ab.kategorie_id
  ) {
    return true;
  }
  if (
    aa.klassifikation != null &&
    ab.klassifikation != null &&
    aa.klassifikation !== ab.klassifikation
  ) {
    return true;
  }
  if (
    aa.ust_satz != null &&
    ab.ust_satz != null &&
    aa.ust_satz !== ab.ust_satz
  ) {
    return true;
  }
  // PROJ-15 — eine Split-Aktion widerspricht jeder abweichenden Aktion
  // (Split vs. Split mit anderen Anteilen, oder Split vs. einfache Aktion).
  if (aa.split != null || ab.split != null) {
    if ((aa.split == null) !== (ab.split == null)) return true;
    if (aa.split != null && ab.split != null) {
      if (
        Math.abs(
          aa.split.anteil_geschaeftlich - ab.split.anteil_geschaeftlich,
        ) >= 1e-6 ||
        (aa.split.kategorie_geschaeftlich ?? null) !==
          (ab.split.kategorie_geschaeftlich ?? null) ||
        (aa.split.kategorie_privat ?? null) !==
          (ab.split.kategorie_privat ?? null)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Wertet alle (aktiven) Lernregeln gegen eine Buchung aus.
 *
 * Determinismus:
 * - Nur `aktiv === true` Regeln werden betrachtet.
 * - Sortierung: höchste `prioritaet` zuerst; bei Gleichstand stabile
 *   Sekundärsortierung nach `id` (reproduzierbar).
 * - Die Regel mit der höchsten Priorität gewinnt.
 * - Widersprechen sich mehrere Regeln der HÖCHSTEN passenden Priorität,
 *   wird `konflikt=true` gesetzt; der Treffer bleibt deterministisch
 *   (erste nach Sortierung), die Pipeline schickt ihn aber zur Prüfung.
 */
export function werteRegelnAus(
  regeln: readonly Lernregel[],
  buchung: BuchungFuerRegel,
): RegelAuswertung {
  const passend = regeln
    .filter((r) => r.aktiv && regelTrifftZu(r, buchung))
    .sort((x, y) => {
      if (y.prioritaet !== x.prioritaet) return y.prioritaet - x.prioritaet;
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    });

  if (passend.length === 0) {
    return { treffer: null, konflikt: false, passende_regel_ids: [] };
  }

  const top = passend[0];
  const hoechstePrio = top.prioritaet;
  const gleichePrio = passend.filter((r) => r.prioritaet === hoechstePrio);

  let konflikt = false;
  for (let i = 1; i < gleichePrio.length; i++) {
    if (aktionenWidersprechen(gleichePrio[0], gleichePrio[i])) {
      konflikt = true;
      break;
    }
  }

  return {
    treffer: {
      regel_id: top.id,
      kategorie_id: top.aktion?.kategorie_id ?? null,
      ust_satz: top.aktion?.ust_satz ?? null,
      klassifikation: top.aktion?.klassifikation ?? null,
      prioritaet: top.prioritaet,
      split: top.aktion?.split ?? null,
    },
    konflikt,
    passende_regel_ids: passend.map((r) => r.id),
  };
}
