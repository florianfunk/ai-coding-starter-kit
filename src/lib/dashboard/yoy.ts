// PROJ-31: Vorjahresvergleich (Year-over-Year) der Dashboard-Kern-KPIs.
//
// REINE, voll testbare Aggregations-/Delta-Helfer — KEINE DB-, KI- oder
// UI-Abhängigkeit. Berechnet für ein Bezugs-Wirtschaftsjahr (abgeleitet aus
// `refDatum`) die Kennzahlen des VORJAHRES-WJ desselben Zeitausschnitts.
//
// Fairness des Vergleichs (Kern der Spec, AC1):
// - Ist das Bezugs-WJ das LAUFENDE WJ (d. h. das WJ, in dem `heute` liegt),
//   dann ist das Bezugsjahr selbst nur "angefangen". Der Vorjahreswert wird
//   deshalb auf denselben Year-to-Date-Ausschnitt begrenzt: das Vorjahr zählt
//   nur bis zum analogen Tag (genau ein Jahr vor `heute`). Sonst verglich man
//   ein VOLLES Vorjahr gegen ein angefangenes laufendes Jahr (Äpfel/Birnen).
// - Ist das Bezugs-WJ abgeschlossen (ein vergangenes Jahr ist aktiv gewählt),
//   wird das VOLLE Vorjahr-WJ verglichen.
//
// Klassifikations-/Vorzeichen-/USt-Logik ist IDENTISCH zu
// `berechneJahresKennzahlen` / `berechneMonatsReihen`:
// - nur `klassifikation === "geschaeftlich"`
// - USt-Satz nur, wenn 0/7/19 hinterlegt
// - Einnahmen-USt = betrag * satz / (100 + satz); Vorsteuer analog auf alle
//   geschäftlichen Ausgaben mit Satz (Phase 1, ohne Belegabgleich)
// - Gewinn = Einnahmen − Ausgaben (netto-Summen, cent-gerundet) — exakt wie dort

import {
  laufendesWirtschaftsjahr,
  rundeCent,
  type DashboardBuchung,
} from "./aggregate";

/** Die vier Kern-KPIs eines Zeitraums (cent-gerundet). */
export interface YoyKennzahlen {
  einnahmen: number;
  ausgaben: number;
  /** USt(Einnahmen) − Vorsteuer(Ausgaben). Negativ = Erstattung. */
  ust_zahllast: number;
  /** Einnahmen − Ausgaben. Negativ = Verlust. */
  gewinn: number;
}

/** Δ einer einzelnen KPI: absolut + prozentual (null = nicht definiert). */
export interface YoyDelta {
  /** aktuell − vorjahr (cent-gerundet). */
  absolut: number;
  /**
   * Prozentuale Veränderung gegenüber dem Vorjahr, oder null, wenn nicht
   * sinnvoll bildbar (Vorjahr = 0 → Division durch 0). Auf 1 Nachkommastelle
   * gerundet. Vorzeichen folgt `absolut`.
   */
  prozent: number | null;
  /**
   * true, wenn der Vorjahreswert 0 ist und der aktuelle Wert ≠ 0 — der Wert
   * ist also "neu" (kein prozentualer Vergleich möglich). Für die UI ("neu").
   */
  ist_neu: boolean;
}

/** Vollständiges YoY-Ergebnis: Vorjahreswerte + Deltas je KPI + Meta. */
export interface YoyVergleich {
  /** Kennzahlen des Vorjahres-Zeitraums (ggf. YTD-begrenzt). */
  vorjahr: YoyKennzahlen;
  /** Δ je KPI (aktuell − vorjahr). */
  delta: {
    einnahmen: YoyDelta;
    ausgaben: YoyDelta;
    ust_zahllast: YoyDelta;
    gewinn: YoyDelta;
  };
  /** Das verglichene Vorjahres-WJ (Jahreszahl des WJ-Beginns). */
  vorjahr_jahr: number;
  /** Inklusiver Zeitraum, der für das Vorjahr herangezogen wurde. */
  vorjahr_zeitraum: { von: string; bis: string };
  /**
   * true, wenn das Bezugs-WJ das laufende WJ ist und der Vorjahreswert deshalb
   * auf denselben YTD-Ausschnitt begrenzt wurde. Steuert das "YTD"-Label.
   */
  ist_ytd: boolean;
  /**
   * true, wenn im Vorjahres-Zeitraum keine geschäftlichen Buchungen lagen
   * (alle Vorjahreswerte 0). UI darf die Zeile dann ausblenden / "kein Vorjahr".
   */
  vorjahr_leer: boolean;
}

/** Liegt `datum` (ISO) inklusiv zwischen `von` und `bis` (ISO)? */
function imIntervall(datum: string, von: string, bis: string): boolean {
  const d = datum.slice(0, 10);
  return d >= von && d <= bis;
}

/**
 * Summiert die Kern-KPIs über alle geschäftlichen Buchungen im Intervall
 * [von, bis]. Identische Rechenregeln wie `berechneJahresKennzahlen`.
 */
function summiere(
  buchungen: readonly DashboardBuchung[],
  von: string,
  bis: string,
): YoyKennzahlen {
  let einnahmen = 0;
  let ausgaben = 0;
  let ustEinnahmen = 0;
  let vorsteuer = 0;

  for (const b of buchungen) {
    if (b.klassifikation !== "geschaeftlich") continue;
    if (!imIntervall(b.buchung_datum, von, bis)) continue;

    const satz =
      b.ust_satz === 19 || b.ust_satz === 7 || b.ust_satz === 0
        ? b.ust_satz
        : null;

    if (b.betrag > 0) {
      einnahmen += b.betrag;
      if (satz && satz > 0) {
        ustEinnahmen += (b.betrag * satz) / (100 + satz);
      }
    } else if (b.betrag < 0) {
      const abs = Math.abs(b.betrag);
      ausgaben += abs;
      if (satz && satz > 0) {
        vorsteuer += (abs * satz) / (100 + satz);
      }
    }
  }

  const einnahmenR = rundeCent(einnahmen);
  const ausgabenR = rundeCent(ausgaben);
  return {
    einnahmen: einnahmenR,
    ausgaben: ausgabenR,
    ust_zahllast: rundeCent(ustEinnahmen - vorsteuer),
    gewinn: rundeCent(einnahmenR - ausgabenR),
  };
}

/** Verschiebt ein ISO-Datum (yyyy-MM-dd) um -1 Jahr (UTC-stabil). */
export function minusEinJahr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const jahr = Number(m[1]) - 1;
  const monat = Number(m[2]);
  const tag = Number(m[3]);
  // 29.02. im Vorjahr ohne Schalttag → auf 28.02. klemmen (Date.UTC rollt
  // sonst auf den 01.03., was den Monat verschöbe).
  const letzterTag = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  const tagOk = Math.min(tag, letzterTag);
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tagOk).padStart(2, "0")}`;
}

/** Bildet einen YoyDelta aus aktuellem und Vorjahreswert (mit /0-Schutz). */
export function bildeDelta(aktuell: number, vorjahr: number): YoyDelta {
  const absolut = rundeCent(aktuell - vorjahr);
  // Division durch 0 sauber: kein NaN/∞.
  if (vorjahr === 0) {
    return {
      absolut,
      prozent: null,
      ist_neu: aktuell !== 0,
    };
  }
  // Prozent auf Basis des Betrags des Vorjahres (auch bei negativem Vorjahr
  // bleibt das Vorzeichen von `absolut` die maßgebliche Richtung).
  const prozentRoh = (absolut / Math.abs(vorjahr)) * 100;
  const prozent = Math.round(prozentRoh * 10) / 10;
  return { absolut, prozent, ist_neu: false };
}

/**
 * Berechnet den Vorjahresvergleich für ein Bezugs-WJ.
 *
 * @param buchungen   Rohbuchungen — müssen mindestens den Vorjahres-Zeitraum
 *                    abdecken (der Aufrufer lädt sie zeitgefiltert, siehe load.ts).
 *                    Buchungen außerhalb des Intervalls werden ignoriert.
 * @param aktuell     Bereits berechnete Kern-KPIs des Bezugsjahres (aus
 *                    `berechneJahresKennzahlen` + Gewinn). Werden 1:1 für die
 *                    Delta-Bildung verwendet — so bleibt das YoY garantiert
 *                    konsistent zum angezeigten Snapshot.
 * @param refDatum    Referenzdatum, das das Bezugs-WJ bestimmt (bei aktivem
 *                    Jahr: 1. Tag des WJ in diesem Jahr; sonst `heute`).
 * @param heute       Tatsächlicher heutiger Tag (ISO) — entscheidet, ob das
 *                    Bezugs-WJ das laufende ist, und liefert den YTD-Schnitt.
 * @param wjBeginnMonat 1–12; 1 = Kalenderjahr.
 */
export function berechneYoy(
  buchungen: readonly DashboardBuchung[],
  aktuell: YoyKennzahlen,
  refDatum: string,
  heute: string,
  wjBeginnMonat: number,
): YoyVergleich {
  const bezug = laufendesWirtschaftsjahr(refDatum, wjBeginnMonat);
  const laufend = laufendesWirtschaftsjahr(heute, wjBeginnMonat);

  // Ist das Bezugs-WJ das laufende WJ? (gleicher WJ-Beginn-Jahrgang)
  const istLaufendes = bezug.jahr === laufend.jahr;

  // Vorjahres-WJ-Fenster: volles Bezugs-WJ um genau 1 Jahr zurück.
  const vjVon = minusEinJahr(bezug.von);
  const vollesVjBis = minusEinJahr(bezug.bis);

  // YTD-Schnitt nur, wenn das Bezugs-WJ das laufende ist: Vorjahr nur bis zum
  // analogen Tag (genau ein Jahr vor heute), geklammert auf das volle WJ-Ende.
  let vjBis = vollesVjBis;
  let istYtd = false;
  if (istLaufendes) {
    const analog = minusEinJahr(heute);
    // Klammern: nie über das volle Vorjahr-WJ-Ende hinaus (Sicherheitsnetz,
    // falls heute jenseits des WJ-Endes läge).
    vjBis = analog < vollesVjBis ? analog : vollesVjBis;
    istYtd = true;
  }

  const vorjahr = summiere(buchungen, vjVon, vjBis);
  const vorjahrLeer =
    vorjahr.einnahmen === 0 &&
    vorjahr.ausgaben === 0 &&
    vorjahr.ust_zahllast === 0 &&
    vorjahr.gewinn === 0;

  return {
    vorjahr,
    delta: {
      einnahmen: bildeDelta(aktuell.einnahmen, vorjahr.einnahmen),
      ausgaben: bildeDelta(aktuell.ausgaben, vorjahr.ausgaben),
      ust_zahllast: bildeDelta(aktuell.ust_zahllast, vorjahr.ust_zahllast),
      gewinn: bildeDelta(aktuell.gewinn, vorjahr.gewinn),
    },
    vorjahr_jahr: bezug.jahr - 1,
    vorjahr_zeitraum: { von: vjVon, bis: vjBis },
    ist_ytd: istYtd,
    vorjahr_leer: vorjahrLeer,
  };
}
