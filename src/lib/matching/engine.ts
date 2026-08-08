// PROJ-6: Matching-Orchestrierung Buchung <-> Beleg (rein, testbar).
//
// Aufgaben:
//   - Nur als 'geschaeftlich' klassifizierte Buchungen matchen (privat/neutral
//     /unklar haben kein Beleg-Soll → werden ignoriert).
//   - Je Buchung den besten Beleg-Treffer suchen. Eindeutig (>= eindeutig UND
//     deutlich vor dem Zweitbesten) → Status 'auto'. Mehrere ähnlich gute oder
//     im unsicher-Band → Status 'unsicher'. Sonst kein Vorschlag.
//   - Bestehende GESPERRTE (manuelle) Zuordnungen werden NIE überschrieben oder
//     gelöscht (überleben Re-Matching). N:M ist zulässig (Sammelrechnung/Raten).
//
// KEIN DB-/Netzzugriff hier — die API lädt Daten, ruft diese Funktionen und
// schreibt das Ergebnis.

import {
  bewerteMatch,
  DEFAULT_SCORE_CONFIG,
  istBetragPlausibel,
  SCORE_SCHWELLEN,
  tageDifferenz,
  type BelegFuerScore,
  type BuchungFuerScore,
  type ScoreBreakdown,
  type ScoreConfig,
} from "./score";

/** Buchung inkl. Klassifikation (Engine-Eingabe). */
export interface BuchungFuerEngine extends BuchungFuerScore {
  klassifikation: "privat" | "geschaeftlich" | "unklar" | "neutral" | null;
}

/** Bereits existierende Zuordnung (z.B. manuell, gesperrt). */
export interface BestehendeZuordnung {
  beleg_id: string;
  buchung_id: string;
  gesperrt: boolean;
}

export interface EngineConfig extends ScoreConfig {
  /**
   * Mindest-Abstand des besten zum zweitbesten Score, damit ein Treffer als
   * "eindeutig" (auto) gilt. Default 0.1.
   */
  eindeutig_vorsprung: number;
  /** Maximal angezeigte Alternativen je unsicherer Buchung. */
  unsicher_max_kandidaten: number;
  /** Maximaler Score-Abstand eines Kandidaten zum besten Treffer. */
  unsicher_score_abstand: number;
  /** Betrag darf für den deterministischen Schnelltreffer höchstens abweichen. */
  eindeutig_betrag_abs_toleranz: number;
  /** Maximale Tage für Betrag-exakt-plus-Datum-eindeutig. */
  eindeutig_datum_tage: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  ...DEFAULT_SCORE_CONFIG,
  eindeutig_vorsprung: 0.1,
  unsicher_max_kandidaten: 3,
  unsicher_score_abstand: 0.1,
  eindeutig_betrag_abs_toleranz: 0.01,
  eindeutig_datum_tage: 3,
};

export type VorschlagStatus = "auto" | "unsicher";

/** Ein vorgeschlagenes Beleg<->Buchung-Paar (noch nicht persistiert). */
export interface MatchVorschlag {
  buchung_id: string;
  beleg_id: string;
  match_score: number;
  status: VorschlagStatus;
  kriterien: ScoreBreakdown;
}

export interface MatchLaufErgebnis {
  /** Neue/aktualisierbare Vorschläge (auto + unsicher). */
  vorschlaege: MatchVorschlag[];
  /** Geschäftsbuchungen ohne brauchbaren Treffer (Fehlliste-A-Kandidaten). */
  buchungen_ohne_beleg: string[];
  /** Zähl-Statistik für job_lauf.ergebnis. */
  statistik: {
    geprueft: number;
    auto: number;
    unsicher: number;
    ohne_beleg: number;
    uebersprungen_gesperrt: number;
    ignoriert_nicht_geschaeftlich: number;
  };
}

/** True, wenn diese Buchung eine bereits gesperrte Zuordnung besitzt. */
function istGesperrt(
  buchungId: string,
  gesperrte: ReadonlySet<string>,
): boolean {
  return gesperrte.has(buchungId);
}

/**
 * Führt einen Matching-Lauf rein in-memory aus.
 *
 * @param buchungen   Kandidaten-Buchungen (nur 'geschaeftlich' werden gematcht).
 * @param belege      Alle abgleichbaren Belege.
 * @param bestehende  Bereits existierende Zuordnungen. Gesperrte Buchungen
 *                    werden komplett übersprungen (Schutz vor Re-Match).
 * @param config      Toleranzen/Gewichte/Vorsprung.
 */
export function fuehreMatchingAus(
  buchungen: readonly BuchungFuerEngine[],
  belege: readonly BelegFuerScore[],
  bestehende: readonly BestehendeZuordnung[],
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): MatchLaufErgebnis {
  // Buchungen mit gesperrter Zuordnung → nie anfassen.
  const gesperrteBuchungen = new Set(
    bestehende.filter((z) => z.gesperrt).map((z) => z.buchung_id),
  );

  const vorschlaege: MatchVorschlag[] = [];
  const buchungenOhneBeleg: string[] = [];
  let auto = 0;
  let unsicher = 0;
  let ohneBeleg = 0;
  let uebersprungenGesperrt = 0;
  let ignoriert = 0;
  let geprueft = 0;

  for (const b of buchungen) {
    if (b.klassifikation !== "geschaeftlich") {
      ignoriert++;
      continue;
    }
    if (istGesperrt(b.id, gesperrteBuchungen)) {
      uebersprungenGesperrt++;
      continue;
    }
    geprueft++;

    // Alle Belege bewerten, absteigend nach Score.
    const bewertet = belege
      .filter((beleg) => istBetragPlausibel(b.betrag, beleg.betrag, config))
      .map((beleg) => ({
        beleg,
        ergebnis: bewerteMatch(toScoreBuchung(b), beleg, config),
      }))
      .sort((x, y) => y.ergebnis.score - x.ergebnis.score);

    // Deterministischer Schnelltreffer: Ein einziger Beleg mit centgenauem
    // Betrag und sehr engem Datumsabstand ist belastbarer als ein alter
    // Texttreffer desselben Standardbetrags. Mehrere solche Belege bleiben
    // bewusst unsicher; globale Beleg-Kollisionen werden weiter unten ebenso
    // herabgestuft.
    const engeTreffer = bewertet.filter(({ beleg }) => {
      if (beleg.betrag === null || !beleg.beleg_datum) return false;
      const betragDifferenz = Math.abs(
        Math.abs(b.betrag) - Math.abs(beleg.betrag),
      );
      return (
        betragDifferenz <= config.eindeutig_betrag_abs_toleranz &&
        tageDifferenz(b.buchung_datum, beleg.beleg_datum) <=
          config.eindeutig_datum_tage
      );
    });
    if (engeTreffer.length === 1) {
      const treffer = engeTreffer[0];
      vorschlaege.push({
        buchung_id: b.id,
        beleg_id: treffer.beleg.id,
        match_score: treffer.ergebnis.score,
        status: "auto",
        kriterien: treffer.ergebnis.kriterien,
      });
      auto++;
      continue;
    }
    if (engeTreffer.length > 1) {
      for (const treffer of engeTreffer.slice(0, config.unsicher_max_kandidaten)) {
        vorschlaege.push({
          buchung_id: b.id,
          beleg_id: treffer.beleg.id,
          match_score: treffer.ergebnis.score,
          status: "unsicher",
          kriterien: treffer.ergebnis.kriterien,
        });
      }
      unsicher++;
      continue;
    }

    const bester = bewertet[0];
    if (!bester || bester.ergebnis.score < SCORE_SCHWELLEN.unsicher) {
      buchungenOhneBeleg.push(b.id);
      ohneBeleg++;
      continue;
    }

    const zweitbester = bewertet[1];
    const vorsprung = zweitbester
      ? bester.ergebnis.score - zweitbester.ergebnis.score
      : 1;

    const eindeutig =
      bester.ergebnis.score >= SCORE_SCHWELLEN.eindeutig &&
      vorsprung >= config.eindeutig_vorsprung;

    if (eindeutig) {
      vorschlaege.push({
        buchung_id: b.id,
        beleg_id: bester.beleg.id,
        match_score: bester.ergebnis.score,
        status: "auto",
        kriterien: bester.ergebnis.kriterien,
      });
      auto++;
      continue;
    }

    // Mehrdeutig oder im unsicher-Band: nur die besten, nahezu gleich guten
    // Kandidaten vorschlagen. Sonst erzeugen häufige Standardbeträge bei
    // großen Paperless-Beständen Dutzende fachlich wertlose Alternativen.
    const kandidaten = bewertet.filter(
      (k) =>
        k.ergebnis.score >= SCORE_SCHWELLEN.unsicher &&
        bester.ergebnis.score - k.ergebnis.score <=
          config.unsicher_score_abstand,
    ).slice(0, config.unsicher_max_kandidaten);
    for (const k of kandidaten) {
      vorschlaege.push({
        buchung_id: b.id,
        beleg_id: k.beleg.id,
        match_score: k.ergebnis.score,
        status: "unsicher",
        kriterien: k.ergebnis.kriterien,
      });
    }
    unsicher++;
  }

  // Globale Eindeutigkeit: Ein Beleg kann fachlich zwar mehrere Buchungen
  // abdecken (Raten/Sammelzahlung), das darf aber nie ohne Bestätigung als
  // mehrere Auto-Matches festgeschrieben werden. Kollidierende Auto-Treffer
  // werden deshalb vollständig in die Prüfliste herabgestuft.
  const autoNachBeleg = new Map<string, MatchVorschlag[]>();
  for (const vorschlag of vorschlaege) {
    if (vorschlag.status !== "auto") continue;
    const gruppe = autoNachBeleg.get(vorschlag.beleg_id) ?? [];
    gruppe.push(vorschlag);
    autoNachBeleg.set(vorschlag.beleg_id, gruppe);
  }
  for (const gruppe of autoNachBeleg.values()) {
    if (gruppe.length < 2) continue;
    for (const vorschlag of gruppe) vorschlag.status = "unsicher";
    auto -= gruppe.length;
    unsicher += gruppe.length;
  }

  return {
    vorschlaege,
    buchungen_ohne_beleg: buchungenOhneBeleg,
    statistik: {
      geprueft,
      auto,
      unsicher,
      ohne_beleg: ohneBeleg,
      uebersprungen_gesperrt: uebersprungenGesperrt,
      ignoriert_nicht_geschaeftlich: ignoriert,
    },
  };
}

function toScoreBuchung(b: BuchungFuerEngine): BuchungFuerScore {
  return {
    id: b.id,
    betrag: b.betrag,
    buchung_datum: b.buchung_datum,
    verwendungszweck: b.verwendungszweck,
    empfaenger: b.empfaenger,
  };
}
