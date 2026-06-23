// PROJ-5 + PROJ-15 — Orchestrierung der Klassifizierungs-Pipeline.
//
// Ablauf je Buchung (neue Reihenfolge ab PROJ-15):
//   1. (Normalisierung erfolgte beim Import — empfaenger_normalisiert ist
//       in der Buchung mitgegeben; Pipeline normalisiert hier NICHTS mehr.)
//   2. Regel-Engine (rules.ts) — deterministisch, Vorrang vor KI.
//      Treffer ohne Konflikt → status 'auto_verbucht', quelle 'regel'.
//   3. Empfaenger-Kenntnis-Cache-Lookup (empfaenger-cache.ts):
//      - Hit & nicht abgelaufen → Kenntnis als LLM-Kontext.
//      - Miss & DSGVO-Recherche-Kandidat → Firecrawl-Call (Race-Schutz via
//        InflightMap) → Upsert in Cache.
//   4. Buchungs-Historie (historie.ts) als LLM-Kontext.
//   5. LLM (llm.ts) — bekommt jetzt Kenntnis + Historie mit, ein einziger
//      Aufruf, KEIN Retry-Loop mehr (Web-Recherche ist Fuell-Mechanismus
//      des Caches, nicht Pipeline-Fallback).
//   6. Konfidenz-Bewertung wie bisher.
//   7. Bei Konfidenz >= Schwellwert UND nicht-aus-Cache-erstklassifiziert →
//      Upsert in Cache (quelle='llm', kuerzere TTL).
//
// Schutz: Buchungen mit status 'manuell_bestaetigt' werden NIE überschrieben
// (Re-Klassifizierung überspringt sie). LLM-Ausfall → nur Regeln, Rest in die
// Prüfliste, kein Datenverlust, kein Raten.
//
// `entscheideBuchung` ist eine REINE Funktion (testbar ohne IO).
// `klassifiziereBuchung` orchestriert inkl. LLM-Aufruf, Cache und Historie.

import type {
  Buchung,
  Klassifikation,
  Lernregel,
  LernregelSplit,
} from "@/lib/types";
import { werteRegelnAus, type BuchungFuerRegel } from "@/lib/classifier/rules";
import { wendeSplitAn, type SplitDefinition } from "@/lib/classifier/split-apply";
import {
  LlmKlassifiziererError,
  klassifiziereMitLlm,
  type KategorieOption,
  type LlmEingabe,
  type LlmErgebnis,
} from "@/lib/classifier/llm";
import {
  aktualisiereLetzteKlassifikation,
  defaultTtl,
  holeKenntnis,
  istAbgelaufen,
  istRechercheKandidat,
  upsertKenntnis,
  type EmpfaengerKenntnis,
  type InflightMap,
  type LetzteKlassifikation,
} from "@/lib/classifier/empfaenger-cache";
import {
  holeAehnlicheBuchungen,
  type HistorieSummary,
} from "@/lib/classifier/historie";
import {
  istArbeitgeber,
  type MeinProfil,
} from "@/lib/classifier/profil";
import {
  vorjahrSchluessel,
  type VorjahrKategorisierung,
} from "@/lib/classifier/vorjahres-uebernahme";
import type { FewShotBeispiel } from "@/lib/classifier/few-shot";
import {
  extrahiereBrancheUndLeistung,
  formatiereRechercheKontext,
  rechercheEmpfaenger,
  type BrancheUndLeistung,
  type WebRechercheErgebnis,
  type WebRechercheTreffer,
} from "@/lib/classifier/web-research";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PipelineConfig {
  /** Mindest-Konfidenz für Auto-Verbuchung (Default 0.85). */
  konfidenz_schwellwert: number;
  /** Ausreißer-Limit in EUR (|Betrag| darüber → immer Prüfung). Default 2000. */
  betrag_limit: number;
  /**
   * Web-Recherche aktivieren (ab PROJ-15 als Cache-Fuell-Mechanismus, NICHT
   * mehr als Pipeline-Retry). Default true — erfordert `FIRECRAWL_API_KEY`
   * (sonst stillschweigend ohne Effekt; ein Cooldown-Eintrag wird trotzdem
   * geschrieben, damit es keine Endlos-Retries pro Lauf gibt).
   */
  web_recherche_aktiv?: boolean;
  /**
   * Default-Kategorie-Fallback: wenn die KI eine eindeutige Klassifikation
   * liefert (privat/neutral, Konfidenz ≥ Schwellwert), aber keine
   * spezifische Kategorie wählt, weist die Pipeline die hier hinterlegte
   * Default-Kategorie zu — statt die Buchung in die Prüfliste zu schieben.
   * Schlüssel = Klassifikation, Wert = kategorie_id (aus PROJ-2-Seed).
   * Optional; ohne Wert greift der Fallback nicht.
   */
  default_kategorie?: Partial<Record<Klassifikation, string>>;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  konfidenz_schwellwert: 0.85,
  betrag_limit: 2000,
  web_recherche_aktiv: true,
};

/**
 * PROJ-25 (AC3) — fester Konfidenz-Aufschlag, wenn LLM-Kategorie,
 * Historie-Mehrheitskategorie UND Cache-Default-Kategorie alle identisch sind.
 * Hebt grenzwertige Fälle (0.78–0.84) bei klarem Signal-Konsens über die
 * Auto-Verbuchungs-Schwelle. Deckel 1.0.
 */
export const KONSENS_BOOST = 0.1;

/**
 * PROJ-25 (AC4) — Mindest-Mehrheitsquote der Historie, ab der bei LLM-Ausfall
 * eine Buchung mit der Historie-Mehrheitskategorie VORbelegt wird (Status
 * bleibt zur_pruefung). Greift erst ab `HISTORIE_FALLBACK_MIN_ANZAHL` Treffern.
 */
const HISTORIE_FALLBACK_QUOTE = 0.8;
const HISTORIE_FALLBACK_MIN_ANZAHL = 3;

/**
 * PROJ-25 — Signale, die `entscheideBuchung` für Konsens-Boost (AC3) und
 * LLM-Ausfall-Fallback (AC4) zusätzlich zum LLM-Ergebnis kennen muss. Wird
 * vom Orchestrator `klassifiziereBuchung` durchgereicht; in reinen Unit-Tests
 * direkt gesetzt. Default {} → Verhalten exakt wie vor PROJ-25.
 */
export interface EntscheidungsSignale {
  historie?: HistorieSummary | null;
  cache_default?: LetzteKlassifikation | null;
}

/** Felder, die die Pipeline an der Buchung setzt. */
export interface Klassifikationsergebnis {
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  ust_satz: number | null;
  begruendung: string;
  konfidenz: number | null;
  quelle: "regel" | "ki" | "vorjahr" | "cache";
  regel_id: string | null;
  status: "auto_verbucht" | "zur_pruefung";
  pruef_grund: string | null;
  /**
   * PROJ-15 P1 — true, wenn eine Lernregel mit `aktion.split` gegriffen hat und
   * die Pipeline die Buchung in zwei Kind-Buchungen aufgeteilt hat (Eltern =
   * Klammer). Der Aufrufer darf in diesem Fall KEIN normales Buchungs-Update
   * mehr fahren — `wendeSplitAn` hat die Klammer bereits geschrieben.
   * Default/undefined = kein Split.
   */
  split_angewandt?: boolean;
}

/** Audit-Detail (wird vom Aufrufer als audit_eintrag persistiert). */
export interface EntscheidungsAudit {
  buchung_id: string;
  aktion: "klassifiziert";
  quelle: string;
  details: Record<string, unknown>;
}

export interface PipelineEntscheidung {
  ergebnis: Klassifikationsergebnis;
  audit: EntscheidungsAudit;
}

/** Buchungsteilmenge, die die Pipeline benötigt. */
export type BuchungFuerPipeline = Pick<
  Buchung,
  "id" | "konto_id" | "betrag" | "verwendungszweck" | "empfaenger" | "status"
> & {
  /**
   * Normalisierter Empfaenger (Pipeline-Stufe 0, beim Import gesetzt).
   * Optional, weil Altdaten ohne Backfill diese Spalte noch leer haben.
   */
  empfaenger_normalisiert?: string | null;
  /**
   * Optionales Buchungsdatum — wird fuer Arbeitgeber-Zeitraumpruefung
   * (`aktiv_von`/`aktiv_bis`) genutzt. Bei fehlendem Datum gilt: ein Match
   * auf den Arbeitgebernamen ist ausreichend.
   */
  buchung_datum?: string | null;
  /**
   * PROJ-15 P1 — nur für die automatische Split-Aktion benötigt: die Kinder
   * erben Währung und Duplikat-Hash der Klammer. Optional, weil der reguläre
   * Klassifizierungspfad sie nicht braucht; ohne diese Felder + Datum kann
   * die Pipeline keinen Split ausführen (Fallback: einfacher Regel-Treffer).
   */
  waehrung?: string | null;
  duplikat_hash?: string | null;
};

/** Wird geworfen, wenn eine bereits manuell bestätigte Buchung übergeben wird. */
export class ManuellBestaetigtError extends Error {
  constructor() {
    super("Buchung ist manuell bestätigt und wird nicht überschrieben.");
    this.name = "ManuellBestaetigtError";
  }
}

/**
 * REINE Entscheidungsfunktion: kombiniert Regel-Auswertung und (optionales)
 * LLM-Ergebnis zu einer finalen Klassifikation. Kein IO.
 *
 * @param llm  LLM-Ergebnis oder `null` (kein Regeltreffer und LLM ausgefallen
 *             bzw. nicht aufgerufen).
 */
export function entscheideBuchung(
  buchung: BuchungFuerPipeline,
  regeln: readonly Lernregel[],
  llm: LlmErgebnis | null,
  config: PipelineConfig = DEFAULT_CONFIG,
  llmFehler: string | null = null,
  llmRetries: number = 0,
  signale: EntscheidungsSignale = {},
): PipelineEntscheidung {
  if (buchung.status === "manuell_bestaetigt") {
    throw new ManuellBestaetigtError();
  }

  const fuerRegel: BuchungFuerRegel = {
    konto_id: buchung.konto_id,
    betrag: buchung.betrag,
    verwendungszweck: buchung.verwendungszweck,
    empfaenger: buchung.empfaenger,
  };
  const regelAuswertung = werteRegelnAus(regeln, fuerRegel);
  const istAusreisser = Math.abs(buchung.betrag) > config.betrag_limit;

  // --- Stufe 1: Regeltreffer (deterministisch, Vorrang) -------------------
  if (regelAuswertung.treffer) {
    const t = regelAuswertung.treffer;

    if (regelAuswertung.konflikt) {
      return baue(buchung, {
        klassifikation: t.klassifikation,
        steuerrelevant: null,
        kategorie_id: t.kategorie_id,
        ust_satz: t.ust_satz,
        begruendung:
          "Mehrere Lernregeln gleicher Priorität widersprechen sich — manuelle Prüfung nötig.",
        konfidenz: 1,
        quelle: "regel",
        regel_id: t.regel_id,
        status: "zur_pruefung",
        pruef_grund: "regelkonflikt",
        auditExtra: {
          passende_regeln: regelAuswertung.passende_regel_ids,
          konflikt: true,
        },
      });
    }

    if (istAusreisser) {
      return baue(buchung, {
        klassifikation: t.klassifikation,
        steuerrelevant: null,
        kategorie_id: t.kategorie_id,
        ust_satz: t.ust_satz,
        begruendung:
          "Regel angewandt, aber Betrag über Ausreißer-Limit — manuelle Prüfung.",
        konfidenz: 1,
        quelle: "regel",
        regel_id: t.regel_id,
        status: "zur_pruefung",
        pruef_grund: "ausreisser_betrag",
        auditExtra: {
          regel_id: t.regel_id,
          betrag_limit: config.betrag_limit,
        },
      });
    }

    return baue(buchung, {
      klassifikation: t.klassifikation,
      steuerrelevant:
        t.klassifikation === "privat" || t.klassifikation === "neutral"
          ? false
          : t.klassifikation === "geschaeftlich"
            ? true
            : null,
      kategorie_id: t.kategorie_id,
      ust_satz: t.ust_satz,
      begruendung: `Automatisch über Lernregel zugeordnet (Priorität ${t.prioritaet}).`,
      konfidenz: 1,
      quelle: "regel",
      regel_id: t.regel_id,
      status: "auto_verbucht",
      pruef_grund: null,
      auditExtra: { regel_id: t.regel_id, prioritaet: t.prioritaet },
    });
  }

  // --- Stufe 2/3: KI + Konfidenz-Bewertung --------------------------------
  if (!llm) {
    const detail = llmFehler ? ` Details: ${llmFehler}` : "";

    // PROJ-25 (AC4) — LLM-Ausfall-Fallback: statt einer leeren Prüflisten-
    // Buchung greifen wir auf ein eindeutiges Signal zurück und belegen die
    // Buchung VOR. Status bleibt 'zur_pruefung' (keine Auto-Verbuchung ohne
    // KI-Bestätigung), aber mit ausgefüllter Kategorie + Quelle-Marker.
    // Cache-Default hat Vorrang vor Historie.
    const vorbelegung = ermittleAusfallVorbelegung(signale);
    if (vorbelegung) {
      return baue(buchung, {
        klassifikation: vorbelegung.klassifikation,
        steuerrelevant: vorbelegung.steuerrelevant,
        kategorie_id: vorbelegung.kategorie_id,
        ust_satz: vorbelegung.ust_satz,
        begruendung:
          `KI-Klassifizierung nicht verfügbar — vorbelegt aus ${vorbelegung.quelle_text} (bitte prüfen).${detail}`,
        konfidenz: null,
        // BEWUSST quelle='ki': Die Buchung bleibt 'zur_pruefung' (keine
        // Auto-Verbuchung), die WAHRE Vorbelegungsquelle steht im Audit unter
        // `fallback_quelle` (cache|historie). Wir führen hier KEINE eigene
        // DB-quelle für den Ausfall-Fallback ein — die Provenienz ist über das
        // Audit nachvollziehbar. (QA-Hinweis W1, 2026-06-23: kein Bug.)
        quelle: "ki",
        regel_id: null,
        status: "zur_pruefung",
        pruef_grund: "ki_nicht_verfuegbar",
        auditExtra: {
          llm: "nicht_verfuegbar",
          llm_fehler: llmFehler,
          llm_retries: llmRetries,
          fallback_quelle: vorbelegung.fallback_quelle,
        },
      });
    }

    return baue(buchung, {
      klassifikation: null,
      steuerrelevant: null,
      kategorie_id: null,
      ust_satz: null,
      begruendung:
        `Keine passende Regel und KI-Klassifizierung nicht verfügbar — zur Prüfung.${detail}`,
      konfidenz: null,
      quelle: "ki",
      regel_id: null,
      status: "zur_pruefung",
      pruef_grund: "ki_nicht_verfuegbar",
      auditExtra: {
        llm: "nicht_verfuegbar",
        llm_fehler: llmFehler,
        llm_retries: llmRetries,
      },
    });
  }

  // Fallback: bei eindeutig privater/neutraler Klassifikation mit hoher
  // Konfidenz, aber ohne kategorie_id — Default-Kategorie zuweisen
  // (z. B. „Privatentnahme" für privat). Verhindert, dass klar erkannte
  // private Posten nur deshalb in der Prüfliste landen, weil der Kontenrahmen
  // keine spezifische Privat-Unterkategorie hat.
  let effektiveKategorieId = llm.kategorie_id;
  if (
    !effektiveKategorieId &&
    (llm.klassifikation === "privat" || llm.klassifikation === "neutral") &&
    llm.konfidenz >= config.konfidenz_schwellwert &&
    config.default_kategorie?.[llm.klassifikation]
  ) {
    effektiveKategorieId = config.default_kategorie[llm.klassifikation]!;
  }

  // PROJ-25 (AC3) — Konsens-Konfidenz-Boost: Stimmen LLM-Kategorie,
  // Historie-Mehrheitskategorie UND Cache-Default-Kategorie überein (alle
  // gesetzt & gleich), heben wir die LLM-Konfidenz um KONSENS_BOOST an
  // (Deckel 1.0). Greift NICHT, wenn ein Signal fehlt oder abweicht. Die
  // geboostete Konfidenz fließt sowohl ins Schwellwert-Routing als auch in
  // das gespeicherte Ergebnis + Audit.
  const histKat = signale.historie?.haeufigste_kategorie_id ?? null;
  const cacheKat = signale.cache_default?.kategorie_id ?? null;
  const konsens =
    effektiveKategorieId != null &&
    histKat != null &&
    cacheKat != null &&
    effektiveKategorieId === histKat &&
    effektiveKategorieId === cacheKat;
  const basisKonfidenz = llm.konfidenz;
  const effektiveKonfidenz = konsens
    ? Math.min(1.0, basisKonfidenz + KONSENS_BOOST)
    : basisKonfidenz;

  const gruende: string[] = [];
  if (effektiveKonfidenz < config.konfidenz_schwellwert) {
    gruende.push("konfidenz_unter_schwellwert");
  }
  if (!effektiveKategorieId) {
    gruende.push("keine_kategorie");
  }
  if (llm.klassifikation === "unklar") {
    gruende.push("klassifikation_unklar");
  }
  if (istAusreisser) {
    gruende.push("ausreisser_betrag");
  }

  const status = gruende.length === 0 ? "auto_verbucht" : "zur_pruefung";

  return baue(buchung, {
    klassifikation: llm.klassifikation,
    steuerrelevant: llm.steuerrelevant,
    kategorie_id: effektiveKategorieId,
    ust_satz: llm.ust_satz,
    begruendung: llm.begruendung,
    konfidenz: effektiveKonfidenz,
    quelle: "ki",
    regel_id: null,
    status,
    pruef_grund: gruende.length > 0 ? gruende.join(",") : null,
    auditExtra: {
      konfidenz: effektiveKonfidenz,
      schwellwert: config.konfidenz_schwellwert,
      betrag_limit: config.betrag_limit,
      // 0 bei erfolgreichem Initial-Versuch; >0 wenn das LLM stochastisch
      // zurueckkam (Retry-Mechanismus aus llm.ts).
      llm_retries: llmRetries,
      ...(konsens
        ? {
            konsens_boost: {
              angewandt: true,
              basis_konfidenz: basisKonfidenz,
              geboostet: effektiveKonfidenz,
            },
          }
        : {}),
    },
  });
}

interface BaueArgs extends Omit<Klassifikationsergebnis, never> {
  auditExtra: Record<string, unknown>;
}

function baue(
  buchung: BuchungFuerPipeline,
  args: BaueArgs,
): PipelineEntscheidung {
  const { auditExtra, ...ergebnis } = args;
  return {
    ergebnis,
    audit: {
      buchung_id: buchung.id,
      aktion: "klassifiziert",
      quelle:
        ergebnis.quelle === "regel" && ergebnis.regel_id
          ? `regel:${ergebnis.regel_id}`
          : ergebnis.quelle,
      details: {
        eingang: {
          betrag: buchung.betrag,
          verwendungszweck: buchung.verwendungszweck,
          empfaenger: buchung.empfaenger,
        },
        ergebnis: {
          klassifikation: ergebnis.klassifikation,
          steuerrelevant: ergebnis.steuerrelevant,
          kategorie_id: ergebnis.kategorie_id,
          status: ergebnis.status,
          konfidenz: ergebnis.konfidenz,
          pruef_grund: ergebnis.pruef_grund,
        },
        ...auditExtra,
      },
    },
  };
}

/**
 * PROJ-23 — REINE Übernahme-Entscheidung: kopiert eine eindeutige Vorjahres-/
 * Historie-Kategorisierung desselben Empfängers 1:1 auf die Buchung. Beträge
 * über dem Ausreißer-Limit gehen wie überall trotzdem zur Prüfung (statt
 * blind auto-verbucht). Kein IO.
 */
export function entscheideVorjahresUebernahme(
  buchung: BuchungFuerPipeline,
  treffer: VorjahrKategorisierung,
  config: PipelineConfig = DEFAULT_CONFIG,
): PipelineEntscheidung {
  if (buchung.status === "manuell_bestaetigt") {
    throw new ManuellBestaetigtError();
  }
  const istAusreisser = Math.abs(buchung.betrag) > config.betrag_limit;
  return baue(buchung, {
    klassifikation: treffer.klassifikation,
    steuerrelevant: treffer.steuerrelevant,
    kategorie_id: treffer.kategorie_id,
    ust_satz: treffer.ust_satz,
    begruendung: istAusreisser
      ? "Gleicher Empfänger bereits eindeutig kategorisiert (Vorjahr/Historie) — Betrag über Ausreißer-Limit, daher zur Prüfung."
      : "Automatisch aus eindeutiger Vorjahres-/Historie-Kategorisierung desselben Empfängers übernommen.",
    konfidenz: 1,
    quelle: "vorjahr",
    regel_id: null,
    status: istAusreisser ? "zur_pruefung" : "auto_verbucht",
    pruef_grund: istAusreisser ? "ausreisser_betrag" : null,
    auditExtra: {
      vorjahr_uebernahme: true,
      uebernommene_kategorie_id: treffer.kategorie_id,
    },
  });
}

/**
 * PROJ-25 (AC1) — REINE Übernahme-Entscheidung aus einem Cache-Default, der aus
 * einer früheren MANUELLEN Korrektur desselben Empfängers stammt (quelle='cache').
 * Analog zu `entscheideVorjahresUebernahme`: deterministisch, kein LLM-Call.
 * Beträge über dem Ausreißer-Limit gehen wie überall zur Prüfung. Kein IO.
 */
export function entscheideCacheUebernahme(
  buchung: BuchungFuerPipeline,
  letzteKlassifikation: LetzteKlassifikation,
  config: PipelineConfig = DEFAULT_CONFIG,
): PipelineEntscheidung {
  if (buchung.status === "manuell_bestaetigt") {
    throw new ManuellBestaetigtError();
  }
  const istAusreisser = Math.abs(buchung.betrag) > config.betrag_limit;
  return baue(buchung, {
    klassifikation: letzteKlassifikation.klassifikation,
    steuerrelevant: letzteKlassifikation.steuerrelevant,
    kategorie_id: letzteKlassifikation.kategorie_id,
    ust_satz: letzteKlassifikation.ust_satz,
    begruendung: istAusreisser
      ? "Aus früherer manueller Korrektur desselben Empfängers übernommen — Betrag über Ausreißer-Limit, daher zur Prüfung."
      : "Aus früherer manueller Korrektur desselben Empfängers übernommen.",
    konfidenz: 1,
    quelle: "cache",
    regel_id: null,
    status: istAusreisser ? "zur_pruefung" : "auto_verbucht",
    pruef_grund: istAusreisser ? "ausreisser_betrag" : null,
    auditExtra: {
      cache_uebernahme: true,
      uebernommene_kategorie_id: letzteKlassifikation.kategorie_id,
    },
  });
}

/**
 * PROJ-25 (AC4) — wählt aus den Signalen eine Vorbelegung für den LLM-Ausfall.
 * Cache-Default hat Vorrang vor Historie. Historie greift nur bei klarer
 * Mehrheit (>= HISTORIE_FALLBACK_QUOTE bei >= HISTORIE_FALLBACK_MIN_ANZAHL).
 * Reine Funktion.
 */
function ermittleAusfallVorbelegung(signale: EntscheidungsSignale): {
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  ust_satz: number | null;
  quelle_text: string;
  fallback_quelle: "cache" | "historie";
} | null {
  const cache = signale.cache_default;
  if (cache && cache.kategorie_id) {
    return {
      klassifikation: cache.klassifikation,
      steuerrelevant: cache.steuerrelevant,
      kategorie_id: cache.kategorie_id,
      ust_satz: cache.ust_satz,
      quelle_text: "bekanntem Empfänger-Default",
      fallback_quelle: "cache",
    };
  }

  const h = signale.historie;
  if (
    h &&
    h.haeufigste_kategorie_id != null &&
    h.anzahl >= HISTORIE_FALLBACK_MIN_ANZAHL &&
    h.haeufigste_kategorie_anzahl / h.anzahl >= HISTORIE_FALLBACK_QUOTE
  ) {
    return {
      klassifikation: h.haeufigste_klassifikation,
      steuerrelevant:
        h.haeufigste_klassifikation === "geschaeftlich"
          ? true
          : h.haeufigste_klassifikation === "privat" ||
              h.haeufigste_klassifikation === "neutral"
            ? false
            : null,
      kategorie_id: h.haeufigste_kategorie_id,
      ust_satz: null,
      quelle_text: "klarer Empfänger-Historie",
      fallback_quelle: "historie",
    };
  }

  return null;
}

/** Optionales Daten-Bundle, das die API-Route an die Pipeline reicht. */
export interface PipelineKontext {
  /**
   * Job-scoped Map fuer Race-Schutz beim Massen-Lauf: wenn 50 Buchungen
   * denselben unbekannten Empfaenger haben, teilen sie sich einen
   * Firecrawl-Call. Bewusst nicht modul-global, damit Tests nichts mocken
   * muessen und parallele Jobs sich nicht blockieren.
   */
  inflight?: InflightMap;
  /** Supabase-Client (server-cookies) fuer Cache- und Historie-DB-Calls. */
  supabase?: SupabaseClient;
  /** Owner-ID, fuer DB-Calls nach Cache und Historie. */
  ownerId?: string;
  /**
   * PROJ-23: Vorjahres-Übernahme-Map (empfaenger_norm → eindeutige
   * Kategorisierung aus bereits final verbuchten Buchungen). Wird vom
   * API-Route EINMAL pro Job aus den finalisierten Buchungen gebaut. Greift
   * NACH den Regeln und VOR dem LLM: bei Treffer wird 1:1 übernommen und das
   * LLM gar nicht erst aufgerufen.
   */
  vorjahr_map?: Map<string, VorjahrKategorisierung>;
  /**
   * PROJ-16: Persoenliche Stammdaten ("Mein Profil"). Wird vom API-Route
   * EINMAL pro Job geladen und hier durchgereicht. Steuert:
   *  - LLM-Prompt-Block (Arbeitgeber/Familie/Wohnort/eigene Konten)
   *  - Familien-Empfaenger werden NICHT in den Web-Cache geschickt (DSGVO)
   *  - Arbeitgeber-Match (Lohn/Gehalt) erhaelt explizites Pre-Hint
   */
  mein_profil?: MeinProfil | null;
  /**
   * PROJ-28: Few-Shot-Beispiele aus den bisherigen final bestaetigten
   * Buchungen des Owners. Wird vom API-Route EINMAL pro Job gebaut
   * (analog vorjahr_map / mein_profil) und als LLM-Prompt-Kontext durchgereicht.
   * NUR Orientierung — greift NICHT vor den deterministischen Paessen
   * (Regeln/Vorjahr/Cache behalten Vorrang).
   */
  few_shot?: FewShotBeispiel[];
}

type LlmFn = (
  e: LlmEingabe,
  k: readonly KategorieOption[],
) => Promise<LlmErgebnis>;

type RechercheFn = (
  empfaenger: string | null,
) => Promise<WebRechercheErgebnis | null>;

/**
 * Funktion, die aus den Web-Snippets eine kompakte Branche + Leistung
 * extrahiert. Per Default ein LLM-Call (siehe `web-research.ts`); in Tests
 * mockbar — analog zu `RechercheFn`.
 */
type ExtrahiereFn = (
  snippets: readonly WebRechercheTreffer[],
  empfaengername: string,
) => Promise<BrancheUndLeistung | null>;

/**
 * Orchestriert eine einzelne Buchung mit neuer Reihenfolge (PROJ-15):
 *  1) Regel-Engine (Vorrang).
 *  2) Cache-Lookup auf `empfaenger_normalisiert` (nur wenn ctx.supabase
 *     + ctx.ownerId gesetzt). Miss + Recherche-Kandidat → Firecrawl mit
 *     InflightMap-Race-Schutz → Upsert.
 *  3) Buchungs-Historie als LLM-Kontext.
 *  4) LLM-Aufruf mit Kenntnis + Historie + Web-Kontext (einmalig).
 *  5) Konfidenz-Routing.
 *  6) Bei Konfidenz >= Schwellwert UND nicht aus Cache erstklassifiziert →
 *     Upsert `quelle='llm'` mit kuerzerer TTL.
 *
 * Web-Recherche-Retry entfaellt: Cache fuellt das Wissen schon vor dem
 * ersten LLM-Aufruf an. Wenn der Cache leer ist, recherchieren wir EINMAL
 * und uebergeben das Ergebnis dem LLM direkt — kein zweiter Aufruf.
 */
export async function klassifiziereBuchung(
  buchung: BuchungFuerPipeline,
  regeln: readonly Lernregel[],
  kategorien: readonly KategorieOption[],
  config: PipelineConfig = DEFAULT_CONFIG,
  llmFn: LlmFn = klassifiziereMitLlm,
  rechercheFn: RechercheFn = rechercheEmpfaenger,
  ctx: PipelineKontext = {},
  extrahiereFn: ExtrahiereFn = extrahiereBrancheUndLeistung,
): Promise<PipelineEntscheidung> {
  if (buchung.status === "manuell_bestaetigt") {
    throw new ManuellBestaetigtError();
  }

  // (1) Regel-Engine — schneller Pfad: greift eine Regel, wird das LLM gar
  // nicht aufgerufen.
  const regelAuswertung = werteRegelnAus(regeln, {
    konto_id: buchung.konto_id,
    betrag: buchung.betrag,
    verwendungszweck: buchung.verwendungszweck,
    empfaenger: buchung.empfaenger,
  });
  if (regelAuswertung.treffer) {
    const entscheidung = entscheideBuchung(buchung, regeln, null, config);

    // PROJ-15 P1 — trägt die getroffene Regel eine `aktion.split`, teilen wir
    // die Buchung in zwei Kind-Buchungen auf (statt eine einfache Kategorie zu
    // setzen). Das passiert NUR im konfliktfreien, nicht-Ausreißer-Auto-Pfad:
    // ein Regelkonflikt oder ein Ausreißer-Betrag wandert wie gehabt zur
    // Prüfung, ohne automatisch aufzuteilen.
    const split = regelAuswertung.treffer.split;
    if (
      split &&
      entscheidung.ergebnis.status === "auto_verbucht" &&
      ctx.supabase &&
      ctx.ownerId &&
      buchung.buchung_datum &&
      typeof buchung.waehrung === "string" &&
      typeof buchung.duplikat_hash === "string"
    ) {
      await wendeRegelSplitAn(
        ctx.supabase,
        ctx.ownerId,
        buchung,
        split,
        regelAuswertung.treffer.regel_id,
      );
      entscheidung.ergebnis.split_angewandt = true;
      entscheidung.audit.details = {
        ...entscheidung.audit.details,
        split_angewandt: true,
        split_regel_id: regelAuswertung.treffer.regel_id,
      };
    }

    return entscheidung;
  }

  // (1b) PROJ-23 — Vorjahres-Übernahme: greift kein gelernter Regelsatz, aber
  // derselbe (normalisierte) Empfänger wurde in bereits final verbuchten
  // Buchungen EINDEUTIG kategorisiert → übernehmen wir das 1:1 und sparen den
  // LLM-Aufruf. Gemischte/zu dünne Historie → weiter im normalen Prozess.
  if (ctx.vorjahr_map) {
    const treffer = ctx.vorjahr_map.get(
      vorjahrSchluessel(buchung.empfaenger_normalisiert),
    );
    if (treffer) {
      return entscheideVorjahresUebernahme(buchung, treffer, config);
    }
  }

  // (2) Cache-Lookup + ggf. Web-Recherche. Funktioniert nur mit ctx.supabase
  // + ctx.ownerId; ohne diese Felder ist die Pipeline cache-blind (z. B.
  // im Unit-Test).
  const norm = (buchung.empfaenger_normalisiert ?? "").trim();
  // PROJ-16: Familienmitglieder werden hart aus dem Recherche-Pool
  // ausgeschlossen — auch wenn ihr Name >=3 Wortteile haette.
  const kandidat = istRechercheKandidat(
    buchung.empfaenger,
    norm,
    ctx.mein_profil?.familie,
  );

  let kenntnis: EmpfaengerKenntnis | null = null;
  let webGenutzt = false;
  let webQuery: string | null = null;
  let webKontext: string | undefined = undefined;
  let cacheVorhanden = false;

  // True genau dann, wenn in diesem konkreten Lauf eine Web-Recherche
  // ausgeloest wurde (Cache-Miss + Kandidat + Recherche aktiv). Unabhaengig
  // davon, ob die Recherche Snippets gefunden hat — fuer das Audit zaehlt
  // der Aufruf selbst, weil Firecrawl-Budget verbraucht wurde.
  let frischRecherchiert = false;

  if (ctx.supabase && ctx.ownerId && norm.length > 0) {
    kenntnis = await holeKenntnis(ctx.supabase, ctx.ownerId, norm);
    cacheVorhanden = kenntnis !== null && !istAbgelaufen(kenntnis);

    if (
      !cacheVorhanden &&
      kandidat &&
      (config.web_recherche_aktiv ?? true)
    ) {
      // Race-Schutz: gleicher Empfaenger im selben Job → ein Web-Call.
      // Die InflightMap ist BEWUSST job-scoped (kein Modul-Singleton):
      // Tests muessen nichts mocken, parallele Jobs blockieren sich nicht
      // und es gibt keine Memory-Leaks ueber die Server-Lebenszeit.
      const inflight = ctx.inflight;
      const key = `${ctx.ownerId}::${norm}`;
      let promise: Promise<EmpfaengerKenntnis | null> | undefined;
      if (inflight && inflight.has(key)) {
        promise = inflight.get(key);
      }
      if (!promise) {
        promise = recherchiereUndUpserte(
          ctx.supabase,
          ctx.ownerId,
          norm,
          buchung.empfaenger,
          rechercheFn,
          extrahiereFn,
        );
        if (inflight) inflight.set(key, promise);
        // Nur die Buchung, die den Call wirklich AUSGELOEST hat, zaehlt
        // als "frisch recherchiert"; die per Inflight-Map mitlaufenden
        // schoepfen aus dem geteilten Promise.
        frischRecherchiert = true;
      }
      kenntnis = (await promise) ?? kenntnis;
      cacheVorhanden = kenntnis !== null && !istAbgelaufen(kenntnis);
    }
  }

  if (kenntnis && Array.isArray(kenntnis.web_snippets) && kenntnis.web_snippets.length > 0) {
    webKontext = formatiereRechercheKontext({
      query: `${(buchung.empfaenger ?? norm).slice(0, 80)} Deutschland Unternehmen Branche`,
      treffer: kenntnis.web_snippets,
    });
  }
  if (frischRecherchiert) {
    webGenutzt = true;
    webQuery = `${(buchung.empfaenger ?? norm).slice(0, 80)} Deutschland Unternehmen Branche`;
  }

  // (2b) PROJ-25 (AC1/AC2/AC5) — Cache-Default-Pass: NACH Regeln + Vorjahr,
  // VOR dem LLM. Greift nur bei gültigem (nicht abgelaufenem) Cache-Eintrag
  // mit gesetztem `letzte_klassifikation_default`.
  //  - quelle='manuell' → deterministisch übernehmen (kein LLM-Call), quelle
  //    'cache'. Ausreißer-Limit gilt wie überall (→ zur Prüfung).
  //  - quelle='llm'/'web' → NICHT übernehmen, sondern als weicher LLM-Hinweis
  //    in den Prompt geben (übersteuert die KI nicht hart).
  const cacheDefault =
    cacheVorhanden && kenntnis?.letzte_klassifikation_default
      ? kenntnis.letzte_klassifikation_default
      : null;

  if (cacheDefault && kenntnis?.quelle === "manuell") {
    const entscheidung = entscheideCacheUebernahme(buchung, cacheDefault, config);
    entscheidung.audit.details = {
      ...entscheidung.audit.details,
      empfaenger_kenntnis: { quelle: kenntnis.quelle, cached: cacheVorhanden },
    };
    return entscheidung;
  }

  let cacheDefaultHinweis: string | null = null;
  if (cacheDefault && kenntnis && kenntnis.quelle !== "manuell") {
    const katBez =
      cacheDefault.kategorie_id
        ? kategorien.find((k) => k.id === cacheDefault.kategorie_id)
            ?.bezeichnung ?? "(unbekannte Kategorie)"
        : "(keine Kategorie)";
    cacheDefaultHinweis =
      `Dieser Empfänger wurde zuletzt als ${cacheDefault.klassifikation} ` +
      `(Kategorie ${katBez}) klassifiziert.`;
  }

  // (3) Historie laden — owner-scoped, finalisierte Status, ohne self.
  let historie: HistorieSummary | null = null;
  if (ctx.supabase && ctx.ownerId && norm.length > 0) {
    historie = await holeAehnlicheBuchungen(ctx.supabase, ctx.ownerId, norm, {
      ausschluss_id: buchung.id,
    });
  }

  // PROJ-16: Profil-Hinweis ableiten. Wenn das Profil im Kontext steht und
  // der normalisierte Empfaenger eindeutig in den Stammdaten auftaucht,
  // liefern wir dem LLM eine kurze Klartext-Anweisung mit. Das LLM bleibt
  // weiterhin entscheidungsfaehig — wir geben nur das Signal vor, das es
  // sonst aus dem Profil-Block selbst rekonstruieren muesste.
  const profilHinweis = leiteProfilHinweisAb(buchung, ctx.mein_profil);

  // (4) LLM-Aufruf mit allem Kontext.
  let llm: LlmErgebnis | null = null;
  let llmFehler: string | null = null;
  let llmRetries = 0;
  try {
    llm = await llmFn(
      {
        verwendungszweck: buchung.verwendungszweck,
        betrag: buchung.betrag,
        empfaenger: buchung.empfaenger,
        web_kontext: webKontext,
        empfaenger_kenntnis: kenntnis,
        historie,
        mein_profil: ctx.mein_profil ?? null,
        profil_hinweis: profilHinweis,
        cache_default_hinweis: cacheDefaultHinweis,
        few_shot_beispiele: ctx.few_shot,
      },
      kategorien,
    );
    llmRetries = llm?.retries ?? 0;
  } catch (err) {
    if (err instanceof LlmKlassifiziererError) {
      llm = null;
      llmFehler = err.message;
      // PROJ-15 (Retry-Mechanismus): Anzahl der tatsaechlich durchgefuehrten
      // Retries wird mit ins Audit geschrieben, damit wir auswerten koennen,
      // wie haeufig die zweite Chance gebraucht (und gescheitert) ist.
      llmRetries = err.retries;
    } else {
      throw err;
    }
  }

  // (5) Entscheidung berechnen. PROJ-25: Historie + Cache-Default als Signale
  // durchreichen (AC3 Konsens-Boost, AC4 LLM-Ausfall-Fallback).
  const entscheidung = entscheideBuchung(
    buchung,
    regeln,
    llm,
    config,
    llmFehler,
    llmRetries,
    { historie, cache_default: cacheDefault },
  );

  // (6) Bei hoher LLM-Konfidenz und Recherche-Kandidat: in Cache uebernehmen.
  // Verzweigung nach Quelle (PROJ-15-Bugfix):
  //  - kenntnis === null         → Neuanlage mit quelle='llm'
  //  - kenntnis.quelle === 'web' → NUR letzte_klassifikation_default updaten;
  //                                 quelle/Branche/Leistung/Snippets bleiben
  //                                 unangetastet (Web-Wissen nicht verlieren)
  //  - kenntnis.quelle === 'llm' → vollstaendiger Upsert mit quelle='llm'
  //  - kenntnis.quelle === 'manuell' → NIE anfassen
  if (
    ctx.supabase &&
    ctx.ownerId &&
    norm.length > 0 &&
    llm &&
    kandidat &&
    llm.konfidenz >= config.konfidenz_schwellwert
  ) {
    const letzteKlassifikation = {
      klassifikation: llm.klassifikation,
      steuerrelevant: llm.steuerrelevant,
      kategorie_id: llm.kategorie_id,
      ust_satz: llm.ust_satz as 0 | 7 | 19 | null,
      konfidenz: llm.konfidenz,
    };

    if (kenntnis === null) {
      await upsertKenntnis(ctx.supabase, {
        owner_id: ctx.ownerId,
        empfaenger_norm: norm,
        rohwert_beispiel: buchung.empfaenger ?? null,
        quelle: "llm",
        ttl_tage: defaultTtl("llm"),
        branche: null,
        leistung: null,
        web_snippets: null,
        recherche_versucht: false,
        letzte_klassifikation_default: letzteKlassifikation,
      });
    } else if (kenntnis.quelle === "web") {
      // Web-Eintrag mit Branche/Leistung/Snippets bleibt unveraendert —
      // wir merken uns nur die zuletzt erfolgreiche LLM-Klassifikation.
      await aktualisiereLetzteKlassifikation(
        ctx.supabase,
        ctx.ownerId,
        norm,
        letzteKlassifikation,
      );
    } else if (kenntnis.quelle === "llm") {
      // Reiner LLM-Eintrag: Klassifikations-Defaults neu setzen.
      await upsertKenntnis(ctx.supabase, {
        owner_id: ctx.ownerId,
        empfaenger_norm: norm,
        rohwert_beispiel: buchung.empfaenger ?? null,
        quelle: "llm",
        ttl_tage: defaultTtl("llm"),
        branche: kenntnis.branche,
        leistung: kenntnis.leistung,
        web_snippets: kenntnis.web_snippets,
        recherche_versucht: kenntnis.recherche_versucht,
        letzte_klassifikation_default: letzteKlassifikation,
      });
    }
    // kenntnis.quelle === 'manuell' → bewusst keine Aktion.
  }

  if (webGenutzt) {
    entscheidung.audit.details = {
      ...entscheidung.audit.details,
      web_recherche: { genutzt: true, query: webQuery },
    };
  }
  if (kenntnis) {
    entscheidung.audit.details = {
      ...entscheidung.audit.details,
      empfaenger_kenntnis: {
        quelle: kenntnis.quelle,
        cached: cacheVorhanden,
      },
    };
  }
  if (historie && historie.anzahl >= 2) {
    entscheidung.audit.details = {
      ...entscheidung.audit.details,
      historie: {
        anzahl: historie.anzahl,
        haeufigste_kategorie_id: historie.haeufigste_kategorie_id,
      },
    };
  }
  if (profilHinweis) {
    entscheidung.audit.details = {
      ...entscheidung.audit.details,
      profil_hinweis: profilHinweis,
    };
  }
  // PROJ-28 (AC6): Few-Shot wurde nur dann tatsaechlich in den Prompt
  // gerendert, wenn das LLM auch aufgerufen wurde (llm-Pfad erreicht) und
  // mindestens ein Beispiel mit aufloesbarer Kategorie existiert. Wir zaehlen
  // analog zum Block-Builder in llm.ts (nur Beispiele, deren kategorie_id in
  // der Kategorienliste vorkommt).
  if (llm && ctx.few_shot && ctx.few_shot.length > 0) {
    const erlaubt = new Set(kategorien.map((k) => k.id));
    const anzahl = ctx.few_shot.filter((b) =>
      erlaubt.has(b.kategorie_id),
    ).length;
    if (anzahl > 0) {
      entscheidung.audit.details = {
        ...entscheidung.audit.details,
        few_shot: { anzahl },
      };
    }
  }

  return entscheidung;
}

/**
 * PROJ-16 — leitet aus dem Profil + der Buchung einen kurzen Klartext-Hinweis
 * fuer das LLM ab. Drei Faelle in dieser Reihenfolge:
 *  1. Empfaenger ist ein aktiver Arbeitgeber UND Verwendungszweck enthaelt
 *     Lohn/Gehalt/Bezüge → "Privat-Gehalt".
 *  2. Empfaenger ist ein Familienmitglied (und NICHT explizit auch
 *     Geschaeftspartner) → "Privatentnahme/Privateinlage".
 *  3. Keine Treffer → null (kein Hinweis).
 *
 * Reine Funktion. Tests gegen `leiteProfilHinweisAb` ueber das Modul
 * exportiert? Nein — bewusst nur intern, das Verhalten wird ueber
 * `klassifiziereBuchung` getestet.
 */
function leiteProfilHinweisAb(
  buchung: BuchungFuerPipeline,
  profil: MeinProfil | null | undefined,
): string | null {
  if (!profil) return null;
  const norm = (buchung.empfaenger_normalisiert ?? "").trim();
  if (norm.length === 0) return null;

  // 1) Arbeitgeber + Lohn/Gehalt-Zweck → Privat-Gehalt.
  const zweckLower = (buchung.verwendungszweck ?? "").toLowerCase();
  const istLohnZweck =
    /\b(lohn|gehalt|bezuege|bezüge|verguetung|vergütung|tantieme|sold)\b/u.test(
      zweckLower,
    );
  if (
    istArbeitgeber(profil, norm, buchung.buchung_datum ?? undefined) &&
    istLohnZweck
  ) {
    return "Empfänger ist ein eingetragener Arbeitgeber des Inhabers und der Verwendungszweck deutet auf Lohn/Gehalt — als Privatentnahme/Lohn klassifizieren (klassifikation 'privat').";
  }

  // 2) Familienmitglied (nicht zusaetzlich Geschaeftspartner).
  const familieTreffer = profil.familie.find(
    (f) =>
      f.name_normalisiert.trim().toLowerCase() === norm.toLowerCase() &&
      !f.auch_geschaeftspartner,
  );
  if (familieTreffer) {
    return `Empfänger '${familieTreffer.name}' ist Familienmitglied (${familieTreffer.rolle}) — Privatentnahme/Privateinlage, keine USt.`;
  }

  return null;
}

/**
 * Test-exportierter Helper. Dient ausschliesslich der Tests in
 * pipeline.test.ts und ist NICHT Teil der oeffentlichen API.
 */
export function _leiteProfilHinweisAbFuerTest(
  buchung: BuchungFuerPipeline,
  profil: MeinProfil | null | undefined,
): string | null {
  return leiteProfilHinweisAb(buchung, profil);
}

/**
 * Fuehrt eine Web-Recherche fuer einen unbekannten Empfaenger durch und
 * legt das Ergebnis (auch leeres Ergebnis als Cooldown) im Cache ab.
 * Liefert die geschriebene Kenntnis zurueck — oder null, falls Recherche
 * gar nicht moeglich war (kein API-Key, Timeout, ...).
 *
 * Bei Recherche-Fehler/leerer Antwort wird trotzdem ein Cooldown-Eintrag
 * (`recherche_versucht=true`, leere Snippets) geschrieben, damit derselbe
 * Empfaenger im selben Lauf nicht 50x erneut Firecrawl belaestigt.
 *
 * PROJ-15-Bugfix: Sobald Snippets vorhanden sind, wird ein zusaetzlicher
 * kleiner LLM-Call gemacht, um Branche + Leistung aus den Snippets zu
 * destillieren. Schlaegt der LLM-Call fehl (Timeout, kein Key, leere
 * Antwort), bleiben Branche/Leistung schlicht `null` — der Web-Eintrag
 * selbst wird auf jeden Fall geschrieben.
 */
async function recherchiereUndUpserte(
  supabase: SupabaseClient,
  ownerId: string,
  norm: string,
  rohwert: string | null,
  rechercheFn: RechercheFn,
  extrahiereFn: ExtrahiereFn,
): Promise<EmpfaengerKenntnis | null> {
  const ergebnis = await rechercheFn(rohwert);
  const snippets = ergebnis?.treffer ?? null;

  let branche: string | null = null;
  let leistung: string | null = null;
  if (snippets && snippets.length > 0) {
    try {
      const struk = await extrahiereFn(snippets, rohwert ?? "");
      branche = struk?.branche ?? null;
      leistung = struk?.leistung ?? null;
    } catch {
      // Cache-Pflege ist optional — bei Fehlern bleibt es bei null/null.
    }
  }

  await upsertKenntnis(supabase, {
    owner_id: ownerId,
    empfaenger_norm: norm,
    rohwert_beispiel: rohwert,
    quelle: "web",
    recherche_versucht: true,
    web_snippets: snippets,
    branche,
    leistung,
    ttl_tage: defaultTtl("web"),
  });

  // Frischen Eintrag zurueckholen — vereinfacht die Konsumenten.
  return await holeKenntnis(supabase, ownerId, norm);
}

/**
 * PROJ-15 P1 — wendet eine `aktion.split` einer Lernregel auf die Buchung an.
 * Bildet die geschäftlich/privat-Form der `LernregelSplit` auf die a/b-Form der
 * `SplitDefinition` ab (Seite A = geschäftlich, Seite B = privat) und delegiert
 * die DB-Schritte an das wiederverwendbare `wendeSplitAn` aus split-apply.ts —
 * derselbe Code-Pfad wie die manuelle Aufteilung in der Prüflisten-Route.
 *
 * Owner-Scope läuft über die Eltern-`owner_id` und die `.eq()`-Filter in
 * `wendeSplitAn` (zusätzlich zur RLS). Fehler werden hier NICHT geworfen — die
 * Klassifizierung der Buchung war erfolgreich; ein gescheiterter Split-Insert
 * würde sonst die gesamte Zeile abbrechen. (Der Aufrufer erkennt am
 * `split_angewandt`-Flag, dass das normale Update entfallen muss; ein
 * fehlgeschlagener Insert hinterlässt eine Klammer ohne Kinder — bewusst
 * tolerierter Randfall, der über das Audit nachvollziehbar bleibt.)
 */
async function wendeRegelSplitAn(
  supabase: SupabaseClient,
  ownerId: string,
  buchung: BuchungFuerPipeline,
  split: LernregelSplit,
  regelId: string,
): Promise<void> {
  const def: SplitDefinition = {
    anteil_a: split.anteil_geschaeftlich,
    klassifikation_a: "geschaeftlich",
    kategorie_id_a: split.kategorie_geschaeftlich ?? null,
    ust_satz_a: split.ust_satz_geschaeftlich ?? null,
    klassifikation_b: "privat",
    kategorie_id_b: split.kategorie_privat ?? null,
    ust_satz_b: null,
  };

  await wendeSplitAn(
    supabase,
    {
      id: buchung.id,
      owner_id: ownerId,
      konto_id: buchung.konto_id,
      buchung_datum: buchung.buchung_datum!,
      betrag: buchung.betrag,
      verwendungszweck: buchung.verwendungszweck,
      empfaenger: buchung.empfaenger,
      empfaenger_normalisiert: buchung.empfaenger_normalisiert ?? null,
      waehrung: buchung.waehrung as string,
      duplikat_hash: buchung.duplikat_hash as string,
    },
    def,
    {
      aktion: "regel_aufgeteilt",
      quelle: "regel",
      kind_quelle: "regel",
      kind_begruendung: "Teilbuchung aus automatischer Regel-Aufteilung.",
      audit_details: { regel_id: regelId },
    },
  );
}
