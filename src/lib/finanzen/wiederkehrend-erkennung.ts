// PROJ-14 / Abo-Radar-Fix — reine Kern-Algorithmik der Wiederkehr-Erkennung,
// herausgezogen aus der API-Route, damit sie ohne Supabase-Mock testbar ist.
//
// Verantwortung:
//   - Cluster aus Buchungen einer Gruppe bilden (Intervall, Stabilität)
//   - Ausreißer-tolerant arbeiten: einzelne Buchungen, die stark vom Median
//     abweichen, dürfen das Cluster nicht zerstören, solange die Mehrheit
//     stabil ist.
//
// Bewusst KEIN IO, kein Logger, keine Zod — pure Funktionen für Tests.

export type Intervall =
  | "woechentlich"
  | "monatlich"
  | "quartalsweise"
  | "jaehrlich";

export type Richtung = "ausgabe" | "einnahme";

export interface IntervallProfil {
  name: Intervall;
  min: number;
  max: number;
  proJahr: number;
}

export const INTERVALL_PROFILE: IntervallProfil[] = [
  { name: "woechentlich", min: 5, max: 10, proJahr: 52 },
  { name: "monatlich", min: 25, max: 35, proJahr: 12 },
  { name: "quartalsweise", min: 80, max: 100, proJahr: 4 },
  { name: "jaehrlich", min: 330, max: 400, proJahr: 1 },
];

export const MIN_BUCHUNGEN = 3;
/** Erhöht von 0.2 auf 0.3 — Bug 3: realistische Toleranz nach Ausreißer-Filter. */
export const BETRAG_TOLERANZ = 0.3;
export const MIN_LOOKBACK_TAGE = 365;
/** Eine einzelne Buchung gilt als Ausreißer, wenn sie > 50 % vom Median abweicht. */
export const AUSREISSER_SCHWELLE = 0.5;
/**
 * Höchstanteil Ausreißer im Cluster, sonst wird das ganze Cluster verworfen.
 * Wir akzeptieren bis zu < 50 % (= keine Mehrheit der Buchungen darf Ausreißer
 * sein) — damit greift die Toleranz im realen Fall „4 Buchungen, 1 Ausreißer"
 * (25 %), das Verwerfen aber sicher bei "2 von 4" (50 %).
 * Zusätzlich greift `MIN_BUCHUNGEN` für die stabile Restmenge.
 */
export const MAX_AUSREISSER_ANTEIL = 0.5;

export interface ErkennungsBuchung {
  /** ISO-Datum (YYYY-MM-DD). */
  buchung_datum: string;
  /** Original-Betrag MIT Vorzeichen — negativ = Ausgabe, positiv = Einnahme. */
  betrag: number;
}

export interface ErkanntesCluster<B extends ErkennungsBuchung> {
  intervall: Intervall;
  intervall_tage: number;
  /** Median-|Betrag| aller stabilen (Nicht-Ausreißer-)Buchungen. */
  betrag_median: number;
  /** Richtung: positiver Median → Einnahme, negativer → Ausgabe. */
  richtung: Richtung;
  /** Geschätzte Jahresbelastung/-volumen (Betrag * proJahr). */
  jahresvolumen: number;
  konfidenz: number;
  /** Buchungen mit Markierung, ob Ausreißer-Flag gesetzt ist. */
  buchungen: Array<B & { ausreisser: boolean }>;
  /** Anzahl Buchungen GESAMT (inkl. Ausreißer). */
  anzahl: number;
  /** Anzahl als Ausreißer markierte Buchungen. */
  anzahl_ausreisser: number;
}

export function median(zahlen: number[]): number {
  if (zahlen.length === 0) return 0;
  const sortiert = [...zahlen].sort((a, b) => a - b);
  const m = Math.floor(sortiert.length / 2);
  return sortiert.length % 2
    ? sortiert[m]
    : (sortiert[m - 1] + sortiert[m]) / 2;
}

export function tageZwischen(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

export function klassifiziereIntervall(tage: number): IntervallProfil | null {
  return INTERVALL_PROFILE.find((p) => tage >= p.min && tage <= p.max) ?? null;
}

/**
 * Aus den Beträgen (Absolutwerten) berechne den Median UND markiere Ausreißer
 * (Buchungen mit |betrag - median| / median > AUSREISSER_SCHWELLE).
 *
 * Wenn der Ausreißer-Anteil ≤ MAX_AUSREISSER_ANTEIL ist UND nach Filterung
 * noch ≥ MIN_BUCHUNGEN stabile Buchungen übrig sind, wird das bereinigte
 * Cluster verwendet. Sonst → null (Cluster verwerfen).
 *
 * Liefert pro Eingangs-Index das Flag `ausreisser` zurück, damit der Aufrufer
 * die Original-Buchungen entsprechend markieren kann.
 */
export interface AusreisserAuswertung {
  betragMedian: number;
  ausreisser: boolean[];
  /** Anzahl stabile (Nicht-Ausreißer-)Buchungen. */
  anzahlStabil: number;
  /** relAbw über die STABILE Menge — wird gegen BETRAG_TOLERANZ geprüft. */
  relAbwStabil: number;
  /** True, wenn überhaupt Ausreißer entfernt wurden (für Konfidenz-Dämpfung). */
  bereinigt: boolean;
}

export function bewerteBetragsStabilitaet(
  betraegeMitVorzeichen: number[],
): AusreisserAuswertung | null {
  const betraegeAbs = betraegeMitVorzeichen.map((b) => Math.abs(b));
  const betragMedian = median(betraegeAbs);
  if (betragMedian === 0) return null;

  const ausreisser = betraegeAbs.map(
    (b) => Math.abs(b - betragMedian) / betragMedian > AUSREISSER_SCHWELLE,
  );
  const anzahlAusreisser = ausreisser.filter(Boolean).length;
  const anzahlStabil = betraegeAbs.length - anzahlAusreisser;
  const ausreisserAnteil = anzahlAusreisser / betraegeAbs.length;

  // Mehrheits-Check: Ausreißer dürfen nicht ≥ MAX_AUSREISSER_ANTEIL sein.
  // (Bei genau 50/50 ist nicht klar, was der "echte" Cluster ist → verwerfen.)
  if (ausreisserAnteil >= MAX_AUSREISSER_ANTEIL) {
    return null;
  }
  if (anzahlStabil < MIN_BUCHUNGEN) {
    return null;
  }

  // Median NUR über die stabile Menge neu berechnen, damit der Vorzeichen-
  // Entscheider unten konsistent ist (siehe `bestimmeRichtung`).
  const stabilAbs = betraegeAbs.filter((_, i) => !ausreisser[i]);
  const stabilMedian = median(stabilAbs);
  const relAbwStabil = median(
    stabilAbs.map((b) => Math.abs(b - stabilMedian) / stabilMedian),
  );

  return {
    betragMedian: stabilMedian,
    ausreisser,
    anzahlStabil,
    relAbwStabil,
    bereinigt: anzahlAusreisser > 0,
  };
}

/**
 * Richtung anhand des Median der Vorzeichen-Beträge bestimmen. Positive
 * Mehrheit → Einnahme, negative → Ausgabe.
 */
export function bestimmeRichtung(
  betraegeMitVorzeichen: number[],
  ausreisserFlags: boolean[],
): Richtung {
  const stabil = betraegeMitVorzeichen.filter((_, i) => !ausreisserFlags[i]);
  // Mehrheits-Entscheidung über das Vorzeichen, nicht Median des Wertes —
  // robuster gegen Misch-Cluster.
  const positive = stabil.filter((b) => b > 0).length;
  return positive > stabil.length / 2 ? "einnahme" : "ausgabe";
}

export function berechneKonfidenz(
  anzahl: number,
  relAbw: number,
  bereinigt: boolean,
): number {
  let k = Math.min(
    0.95,
    0.5 +
      Math.min(0.2, (anzahl - MIN_BUCHUNGEN) * 0.05) +
      (BETRAG_TOLERANZ - relAbw) * 1.5,
  );
  // Bug 3: bei Bereinigung Konfidenz leicht dämpfen, damit die Anzeige
  // ehrlich bleibt.
  if (bereinigt) k *= 0.9;
  return k;
}

/**
 * Hauptfunktion: Aus einer chronologisch sortierten Buchungs-Liste eines
 * normalisierten Empfängers ein Cluster bilden — oder null, wenn kein
 * stabiler Rhythmus erkennbar ist.
 *
 * Aufrufer ist dafür verantwortlich, dass die Buchungen
 *   - bereits nach Empfänger gruppiert sind
 *   - chronologisch (aufsteigend) sortiert sind
 *   - mindestens MIN_BUCHUNGEN Einträge enthalten
 */
export function erkenneCluster<B extends ErkennungsBuchung>(
  buchungen: B[],
): ErkanntesCluster<B> | null {
  if (buchungen.length < MIN_BUCHUNGEN) return null;

  // 1) Intervall-Median über Datumsabstände.
  const abstaende: number[] = [];
  for (let i = 1; i < buchungen.length; i++) {
    abstaende.push(
      tageZwischen(buchungen[i - 1].buchung_datum, buchungen[i].buchung_datum),
    );
  }
  const intervallTage = median(abstaende);
  const profil = klassifiziereIntervall(intervallTage);
  if (!profil) return null;

  // 2) Beträge-Stabilität mit Ausreißer-Toleranz.
  const betraegeSigned = buchungen.map((b) => Number(b.betrag) || 0);
  const stab = bewerteBetragsStabilitaet(betraegeSigned);
  if (!stab) return null;
  if (stab.relAbwStabil > BETRAG_TOLERANZ) return null;

  // 3) Richtung und Konfidenz.
  const richtung = bestimmeRichtung(betraegeSigned, stab.ausreisser);
  const konfidenz = berechneKonfidenz(
    stab.anzahlStabil,
    stab.relAbwStabil,
    stab.bereinigt,
  );

  // 4) Buchungen mit Ausreißer-Flag annotieren.
  const annotiert = buchungen.map((b, i) => ({
    ...b,
    ausreisser: stab.ausreisser[i],
  }));

  return {
    intervall: profil.name,
    intervall_tage: Math.round(intervallTage),
    betrag_median: stab.betragMedian,
    richtung,
    jahresvolumen: stab.betragMedian * profil.proJahr,
    konfidenz,
    buchungen: annotiert,
    anzahl: buchungen.length,
    anzahl_ausreisser: stab.ausreisser.filter(Boolean).length,
  };
}

/**
 * Wählt aus mehreren Original-Empfänger-Varianten den häufigsten Wert
 * (Mode). Bei Gleichstand entscheidet die erste Vorkommen-Reihenfolge.
 */
export function modusEmpfaenger(varianten: Array<string | null>): string {
  const zaehler = new Map<string, number>();
  let bestKey = "";
  let bestCount = 0;
  for (const v of varianten) {
    const k = (v ?? "").trim();
    if (!k) continue;
    const next = (zaehler.get(k) ?? 0) + 1;
    zaehler.set(k, next);
    if (next > bestCount) {
      bestCount = next;
      bestKey = k;
    }
  }
  return bestKey;
}
