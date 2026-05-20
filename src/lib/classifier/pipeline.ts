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
  aktualisiereLetzteKlassifikation,
  defaultTtl,
  holeKenntnis,
  istAbgelaufen,
  istRechercheKandidat,
  upsertKenntnis,
  type EmpfaengerKenntnis,
  type InflightMap,
} from "@/lib/classifier/empfaenger-cache";
import {
  holeAehnlicheBuchungen,
  type HistorieSummary,
} from "@/lib/classifier/historie";
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
> & {
  /**
   * Normalisierter Empfaenger (Pipeline-Stufe 0, beim Import gesetzt).
   * Optional, weil Altdaten ohne Backfill diese Spalte noch leer haben.
   */
  empfaenger_normalisiert?: string | null;
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

  const gruende: string[] = [];
  if (llm.konfidenz < config.konfidenz_schwellwert) {
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
    return entscheideBuchung(buchung, regeln, null, config);
  }

  // (2) Cache-Lookup + ggf. Web-Recherche. Funktioniert nur mit ctx.supabase
  // + ctx.ownerId; ohne diese Felder ist die Pipeline cache-blind (z. B.
  // im Unit-Test).
  const norm = (buchung.empfaenger_normalisiert ?? "").trim();
  const kandidat = istRechercheKandidat(buchung.empfaenger, norm);

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

  // (3) Historie laden — owner-scoped, finalisierte Status, ohne self.
  let historie: HistorieSummary | null = null;
  if (ctx.supabase && ctx.ownerId && norm.length > 0) {
    historie = await holeAehnlicheBuchungen(ctx.supabase, ctx.ownerId, norm, {
      ausschluss_id: buchung.id,
    });
  }

  // (4) LLM-Aufruf mit allem Kontext.
  let llm: LlmErgebnis | null = null;
  let llmFehler: string | null = null;
  try {
    llm = await llmFn(
      {
        verwendungszweck: buchung.verwendungszweck,
        betrag: buchung.betrag,
        empfaenger: buchung.empfaenger,
        web_kontext: webKontext,
        empfaenger_kenntnis: kenntnis,
        historie,
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

  // (5) Entscheidung berechnen.
  const entscheidung = entscheideBuchung(buchung, regeln, llm, config, llmFehler);

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

  return entscheidung;
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
