// PROJ-5 — Stufe 3 + Orchestrierung der Klassifizierungs-Pipeline.
//
// Ablauf je Buchung:
//   1. Regel-Engine (rules.ts) — deterministisch, Vorrang vor KI.
//      Treffer ohne Konflikt → status 'auto_verbucht', quelle 'regel'.
//   2. Kein Regeltreffer → LLM (llm.ts), datensparsam.
//   3. Konfidenz-Bewertung:
//      konfidenz >= schwellwert UND Kategorie vorhanden → 'auto_verbucht'.
//      sonst → 'zur_pruefung' mit pruef_grund.
//   Ausreißer-Regel: |Betrag| > betrag_limit → IMMER 'zur_pruefung'
//      (trotz hoher Konfidenz), konfigurierbar.
//
// Schutz: Buchungen mit status 'manuell_bestaetigt' werden NIE überschrieben
// (Re-Klassifizierung überspringt sie). LLM-Ausfall → nur Regeln, Rest in die
// Prüfliste, kein Datenverlust, kein Raten.
//
// `entscheideBuchung` ist eine REINE Funktion (testbar ohne IO).
// `klassifiziereBuchung` orchestriert inkl. LLM-Aufruf + Fehlerfang.

import type { Buchung, Klassifikation, Lernregel } from "@/lib/types";
import { werteRegelnAus, type BuchungFuerRegel } from "@/lib/classifier/rules";
import {
  LlmKlassifiziererError,
  klassifiziereMitLlm,
  type KategorieOption,
  type LlmEingabe,
  type LlmErgebnis,
} from "@/lib/classifier/llm";
import {
  formatiereRechercheKontext,
  rechercheEmpfaenger,
  type WebRechercheErgebnis,
} from "@/lib/classifier/web-research";

export interface PipelineConfig {
  /** Mindest-Konfidenz für Auto-Verbuchung (Default 0.85). */
  konfidenz_schwellwert: number;
  /** Ausreißer-Limit in EUR (|Betrag| darüber → immer Prüfung). Default 2000. */
  betrag_limit: number;
  /**
   * Web-Recherche-Retry bei unsicheren LLM-Antworten aktivieren.
   * Default true — erfordert `FIRECRAWL_API_KEY` (sonst stillschweigend
   * ohne Effekt).
   */
  web_recherche_aktiv?: boolean;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  konfidenz_schwellwert: 0.85,
  betrag_limit: 2000,
  web_recherche_aktiv: true,
};

/** Felder, die die Pipeline an der Buchung setzt. */
export interface Klassifikationsergebnis {
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  ust_satz: number | null;
  begruendung: string;
  konfidenz: number | null;
  quelle: "regel" | "ki";
  regel_id: string | null;
  status: "auto_verbucht" | "zur_pruefung";
  pruef_grund: string | null;
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
>;

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
      auditExtra: { llm: "nicht_verfuegbar", llm_fehler: llmFehler },
    });
  }

  const gruende: string[] = [];
  if (llm.konfidenz < config.konfidenz_schwellwert) {
    gruende.push("konfidenz_unter_schwellwert");
  }
  if (!llm.kategorie_id) {
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
    kategorie_id: llm.kategorie_id,
    ust_satz: llm.ust_satz,
    begruendung: llm.begruendung,
    konfidenz: llm.konfidenz,
    quelle: "ki",
    regel_id: null,
    status,
    pruef_grund: gruende.length > 0 ? gruende.join(",") : null,
    auditExtra: {
      konfidenz: llm.konfidenz,
      schwellwert: config.konfidenz_schwellwert,
      betrag_limit: config.betrag_limit,
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
 * Orchestriert eine einzelne Buchung: Regeln zuerst; nur wenn keine Regel
 * greift, wird das LLM befragt. LLM-Ausfall → Buchung wandert in die
 * Prüfliste (kein Datenverlust, kein Raten).
 *
 * Web-Recherche-Retry: Wenn der erste LLM-Aufruf unsicher ist (Konfidenz
 * unter Schwellwert, 'unklar' oder keine Kategorie), wird der Empfänger
 * einmalig im Web nachgeschlagen und das LLM mit dem Kontext erneut
 * befragt. Wenn das zweite Ergebnis besser ist (höhere Konfidenz oder
 * spezifischer), wird es übernommen — sonst bleibt das Original.
 */
export async function klassifiziereBuchung(
  buchung: BuchungFuerPipeline,
  regeln: readonly Lernregel[],
  kategorien: readonly KategorieOption[],
  config: PipelineConfig = DEFAULT_CONFIG,
  llmFn: (
    e: LlmEingabe,
    k: readonly KategorieOption[],
  ) => Promise<LlmErgebnis> = klassifiziereMitLlm,
  rechercheFn: (
    empfaenger: string | null,
  ) => Promise<WebRechercheErgebnis | null> = rechercheEmpfaenger,
): Promise<PipelineEntscheidung> {
  if (buchung.status === "manuell_bestaetigt") {
    throw new ManuellBestaetigtError();
  }

  // Schneller Pfad: greift eine Regel, wird das LLM gar nicht aufgerufen.
  const regelAuswertung = werteRegelnAus(regeln, {
    konto_id: buchung.konto_id,
    betrag: buchung.betrag,
    verwendungszweck: buchung.verwendungszweck,
    empfaenger: buchung.empfaenger,
  });

  if (regelAuswertung.treffer) {
    return entscheideBuchung(buchung, regeln, null, config);
  }

  // Erster LLM-Versuch (ohne Web).
  let llm: LlmErgebnis | null = null;
  let llmFehler: string | null = null;
  try {
    llm = await llmFn(
      {
        verwendungszweck: buchung.verwendungszweck,
        betrag: buchung.betrag,
        empfaenger: buchung.empfaenger,
      },
      kategorien,
    );
  } catch (err) {
    if (err instanceof LlmKlassifiziererError) {
      llm = null;
      llmFehler = err.message;
    } else {
      throw err;
    }
  }

  // Web-Recherche-Retry bei unsicherem Ergebnis.
  let webGenutzt = false;
  let webQuery: string | null = null;
  if (
    llm &&
    (config.web_recherche_aktiv ?? true) &&
    istUnsicher(llm, config)
  ) {
    const ergebnis = await rechercheFn(buchung.empfaenger);
    if (ergebnis) {
      webGenutzt = true;
      webQuery = ergebnis.query;
      try {
        const llm2 = await llmFn(
          {
            verwendungszweck: buchung.verwendungszweck,
            betrag: buchung.betrag,
            empfaenger: buchung.empfaenger,
            web_kontext: formatiereRechercheKontext(ergebnis),
          },
          kategorien,
        );
        // Nur übernehmen, wenn der zweite Versuch echt besser ist.
        if (istBesser(llm2, llm)) {
          llm = llm2;
        }
      } catch (err) {
        if (!(err instanceof LlmKlassifiziererError)) throw err;
        // sonst: bei Retry-Fehler bleibt das Original-Ergebnis.
      }
    }
  }

  const entscheidung = entscheideBuchung(buchung, regeln, llm, config, llmFehler);
  if (webGenutzt) {
    entscheidung.audit.details = {
      ...entscheidung.audit.details,
      web_recherche: { genutzt: true, query: webQuery },
    };
  }
  return entscheidung;
}

/** Heuristik: ist das LLM-Ergebnis unsicher genug für einen Web-Retry? */
function istUnsicher(llm: LlmErgebnis, config: PipelineConfig): boolean {
  return (
    llm.konfidenz < config.konfidenz_schwellwert ||
    llm.klassifikation === "unklar" ||
    llm.kategorie_id === null
  );
}

/** True, wenn der zweite Versuch echt besser ist als der erste. */
function istBesser(neu: LlmErgebnis, alt: LlmErgebnis): boolean {
  // Spezifischer (Kategorie vorhanden, vorher nicht) → besser.
  if (neu.kategorie_id !== null && alt.kategorie_id === null) return true;
  // Klassifikation eindeutiger geworden → besser.
  if (alt.klassifikation === "unklar" && neu.klassifikation !== "unklar") {
    return true;
  }
  // Sonst muss die Konfidenz spürbar steigen (mind. +0.05).
  return neu.konfidenz >= alt.konfidenz + 0.05;
}
