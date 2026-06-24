// PROJ-30: Trend-Sparklines — REINE Monatsreihen-Aggregation fürs Dashboard.
//
// Liefert pro Monat des laufenden Wirtschaftsjahres (genau 12 Punkte, in
// WJ-Reihenfolge) die vorläufigen Geld-Kennzahlen Einnahmen, Ausgaben und
// USt-Zahllast. Verwendet EXAKT dieselbe Klassifikations-/Vorzeichen-/USt-Logik
// wie `berechneJahresKennzahlen` in ./aggregate — nur monatlich gebucketet
// statt über das ganze Jahr summiert. Daraus folgt: die Summe aller Monatswerte
// entspricht (modulo Cent-Rundung) dem Jahreswert.
//
// KEINE DB-, KI- oder UI-Abhängigkeit — voll testbar mit `heute` als Parameter.
// `berechneJahresKennzahlen` bleibt unangetastet; dies steht bewusst daneben.

import {
  laufendesWirtschaftsjahr,
  rundeCent,
  type DashboardBuchung,
} from "./aggregate";

const MONATE_KURZ = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/** Ein Monatspunkt der Trend-Reihe. */
export interface MonatsPunkt {
  /** ISO yyyy-MM (z. B. "2026-03"). */
  monat: string;
  /** Anzeigelabel, z. B. "Mär" bzw. "Mär 25" bei Jahreswechsel im WJ. */
  label: string;
  /** Vorläufige geschäftliche Einnahmen des Monats, cent-gerundet. */
  einnahmen: number;
  /** Vorläufige geschäftliche Ausgaben des Monats (positiv), cent-gerundet. */
  ausgaben: number;
  /** USt-Zahllast des Monats (USt auf Einnahmen − Vorsteuer), cent-gerundet. */
  ust_zahllast: number;
}

/** Interner, noch ungerundeter Akkumulator je Monat. */
interface Bucket {
  monat: string;
  jahr: number;
  monatNr: number; // 1–12
  einnahmen: number;
  ausgaben: number;
  ustEinnahmen: number;
  vorsteuer: number;
}

/**
 * Erzeugt die 12 Monats-Buckets ab WJ-Startmonat (inkl. Jahreswechsel bei
 * abweichendem Wirtschaftsjahr, z. B. wjBeginn=4 → Apr..Mrz Folgejahr).
 */
function erzeugeBuckets(startJahr: number, startMonat: number): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = 0; i < 12; i += 1) {
    const offset = startMonat - 1 + i; // 0-basiert ab Startmonat
    const jahr = startJahr + Math.floor(offset / 12);
    const monatNr = (offset % 12) + 1; // 1–12
    buckets.push({
      monat: `${jahr}-${String(monatNr).padStart(2, "0")}`,
      jahr,
      monatNr,
      einnahmen: 0,
      ausgaben: 0,
      ustEinnahmen: 0,
      vorsteuer: 0,
    });
  }
  return buckets;
}

/**
 * Bildet das Anzeigelabel. Zeigt das (zweistellige) Jahr zusätzlich an, wenn
 * das WJ über einen Jahreswechsel läuft — damit "Jan" eindeutig bleibt.
 */
function bucketLabel(b: Bucket, jahrUebergreifend: boolean): string {
  const name = MONATE_KURZ[b.monatNr - 1];
  if (!jahrUebergreifend) return name;
  return `${name} ${String(b.jahr).slice(-2)}`;
}

/**
 * Berechnet die Monatsreihen des laufenden Wirtschaftsjahres.
 *
 * Identische Einbeziehungs-/Rechenregeln wie `berechneJahresKennzahlen`:
 * - nur `klassifikation === "geschaeftlich"`
 * - nur Buchungen, deren `buchung_datum` im WJ-Fenster liegt
 * - USt-Satz nur, wenn 0/7/19 hinterlegt
 * - Einnahmen-USt = betrag * satz / (100 + satz); Vorsteuer analog auf alle
 *   geschäftlichen Ausgaben mit Satz (Phase 1, ohne Belegabgleich)
 *
 * @param heute        Referenzdatum (ISO yyyy-MM-dd) — bestimmt das WJ-Fenster.
 * @param wjBeginnMonat 1–12; 1 = Kalenderjahr.
 * @returns Genau 12 Monatspunkte in WJ-Reihenfolge (Monate ohne Buchungen = 0).
 */
export function berechneMonatsReihen(
  buchungen: readonly DashboardBuchung[],
  heute: string,
  wjBeginnMonat: number,
): MonatsPunkt[] {
  const { von, bis } = laufendesWirtschaftsjahr(heute, wjBeginnMonat);

  const startJahr = Number(von.slice(0, 4));
  const startMonat = Number(von.slice(5, 7));
  const buckets = erzeugeBuckets(startJahr, startMonat);
  const jahrUebergreifend = startMonat !== 1;

  // Schneller Zugriff Monat (yyyy-MM) → Bucket.
  const proMonat = new Map<string, Bucket>();
  for (const b of buckets) proMonat.set(b.monat, b);

  for (const b of buchungen) {
    if (b.klassifikation !== "geschaeftlich") continue;
    const datum = b.buchung_datum.slice(0, 10);
    // Identische Intervallprüfung wie im Jahres-Aggregat (inkl. Grenzen).
    if (datum < von || datum > bis) continue;

    const monat = datum.slice(0, 7); // yyyy-MM
    const bucket = proMonat.get(monat);
    if (!bucket) continue; // sollte im WJ-Fenster nie passieren

    const satz =
      b.ust_satz === 19 || b.ust_satz === 7 || b.ust_satz === 0
        ? b.ust_satz
        : null;

    if (b.betrag > 0) {
      bucket.einnahmen += b.betrag;
      if (satz && satz > 0) {
        bucket.ustEinnahmen += (b.betrag * satz) / (100 + satz);
      }
    } else if (b.betrag < 0) {
      const abs = Math.abs(b.betrag);
      bucket.ausgaben += abs;
      if (satz && satz > 0) {
        bucket.vorsteuer += (abs * satz) / (100 + satz);
      }
    }
  }

  return buckets.map((b) => ({
    monat: b.monat,
    label: bucketLabel(b, jahrUebergreifend),
    einnahmen: rundeCent(b.einnahmen),
    ausgaben: rundeCent(b.ausgaben),
    ust_zahllast: rundeCent(b.ustEinnahmen - b.vorsteuer),
  }));
}

/** Ein KPI-Wertepaar aktueller Monat vs. Vormonat (Δ = aktuell − vormonat). */
export interface DeltaPaar {
  aktuell: number;
  vormonat: number;
}

/** Δ je Kern-KPI: jüngster Monat mit Daten + dessen unmittelbarer Vorgänger. */
export interface TrendDelta {
  /** Index des herangezogenen "aktuellen" Monats in `punkte` (−1 = keine Daten). */
  aktuellerIndex: number;
  einnahmen: DeltaPaar;
  ausgaben: DeltaPaar;
  ust_zahllast: DeltaPaar;
}

/**
 * Ermittelt aus den Monatsreihen den jüngsten Monat MIT Daten (irgendein
 * Kern-KPI ≠ 0) und dessen unmittelbaren Vorgänger-Monat. Der Vormonat-Wert
 * ist der direkt vorangehende Bucket (auch wenn dieser 0 ist) — so bildet Δ
 * den tatsächlichen Monatswechsel ab, nicht einen übersprungenen Leermonat.
 *
 * Reine Funktion (kein Datum nötig): "aktuell" = letzter Monat mit Buchungen,
 * damit auch unterjährig (Folgemonate noch leer) ein sinnvolles Δ entsteht.
 * Δ selbst (aktuell − vormonat) überlässt diese Funktion dem Aufrufer.
 */
export function letzterUndVormonat(punkte: readonly MonatsPunkt[]): TrendDelta {
  const istLeer = (p: MonatsPunkt) =>
    p.einnahmen === 0 && p.ausgaben === 0 && p.ust_zahllast === 0;

  let aktuellerIndex = -1;
  for (let i = punkte.length - 1; i >= 0; i -= 1) {
    if (!istLeer(punkte[i])) {
      aktuellerIndex = i;
      break;
    }
  }

  const leer: DeltaPaar = { aktuell: 0, vormonat: 0 };
  if (aktuellerIndex < 0) {
    return {
      aktuellerIndex: -1,
      einnahmen: leer,
      ausgaben: leer,
      ust_zahllast: leer,
    };
  }

  const akt = punkte[aktuellerIndex];
  const vor = aktuellerIndex > 0 ? punkte[aktuellerIndex - 1] : null;

  return {
    aktuellerIndex,
    einnahmen: { aktuell: akt.einnahmen, vormonat: vor?.einnahmen ?? 0 },
    ausgaben: { aktuell: akt.ausgaben, vormonat: vor?.ausgaben ?? 0 },
    ust_zahllast: {
      aktuell: akt.ust_zahllast,
      vormonat: vor?.ust_zahllast ?? 0,
    },
  };
}
