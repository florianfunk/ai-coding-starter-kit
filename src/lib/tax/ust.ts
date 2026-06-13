// PROJ-8: Rein deterministische USt-Voranmeldungs-Berechnung.
//
// Aggregiert ausschließlich Buchungen einer Periode nach festen Regeln —
// KEINE KI, KEINE Rundungsfehler (Rechnung in Cent). Reproduzierbar &
// auditierbar (Drill-down liefert die einbezogenen Buchungs-IDs je
// Kennzahl).
//
// Regeln (Acceptance Criteria PROJ-8):
// - Es fließen NUR Buchungen mit klassifikation='geschaeftlich' UND
//   steuerrelevant=true ein. privat/neutral/unklar werden ausgeschlossen.
// - Einnahmen (Betrag > 0) → steuerpflichtiger Umsatz je USt-Satz (19/7/0).
// - Ausgaben (Betrag < 0) → Vorsteuer wird auf Kz 66 voll angesetzt,
//   unabhängig vom Belegstatus (vorläufige Sicht). Zusätzlich wird
//   transparent ausgewiesen, welcher Anteil davon belegt bzw. unbelegt
//   ist (vorsteuer_mit_beleg / vorsteuer_ohne_beleg) — die endgültige
//   USt-VA benötigt Belege, daher bleibt das Diagnostik-Signal erhalten.
// - Kleinunternehmer (firmenprofil.ust_status='kleinunternehmer') →
//   Nullmeldung: keine USt, keine Vorsteuer.
// - 0 % / Reverse-Charge → eigene Kennzahl, kein USt-Ausweis.

import type { UstStatus } from "@/lib/types";

/** Eingangsdatensatz einer Buchung für die USt-Aggregation. */
export interface UstBuchung {
  id: string;
  buchung_datum: string;
  /** > 0 = Einnahme, < 0 = Ausgabe (Vorzeichenkonvention wie Import). */
  betrag: number;
  klassifikation: "privat" | "geschaeftlich" | "unklar" | "neutral" | null;
  steuerrelevant: boolean | null;
  /** USt-Satz der Buchung (0 | 7 | 19) oder null = nicht zuordenbar. */
  ust_satz: number | null;
  /** true, wenn mind. eine beleg_buchung-Zuordnung existiert. */
  belegt: boolean;
}

/** Unterstützte USt-Sätze. */
export type UstSatz = 0 | 7 | 19;
export const UST_SAETZE: readonly UstSatz[] = [19, 7, 0] as const;

/**
 * ELSTER-USt-Voranmeldungs-Kennzahlen (pflegbare Stammdaten — überlebt
 * Formularänderungen, da hier zentral und nicht hartkodiert in der UI).
 * Nummern gemäß amtlichem USt-VA-Vordruck.
 */
export interface ElsterFeld {
  /** Kennzahl, z.B. "81". */
  kennzahl: string;
  /** Klartext-Bezeichnung für die UI. */
  bezeichnung: string;
}

export const ELSTER_USTVA = {
  /** Steuerpflichtige Umsätze zum allgemeinen Satz (19 %) – Bemessung. */
  umsatz_19: { kennzahl: "81", bezeichnung: "Umsätze zu 19 %" },
  /** Steuerpflichtige Umsätze zum ermäßigten Satz (7 %) – Bemessung. */
  umsatz_7: { kennzahl: "86", bezeichnung: "Umsätze zu 7 %" },
  /** Steuerfreie/0 %/Reverse-Charge-Umsätze (kein USt-Ausweis). */
  umsatz_0: {
    kennzahl: "35",
    bezeichnung: "Umsätze 0 % / steuerfrei / Reverse-Charge",
  },
  /** Abziehbare Vorsteuer aus Rechnungen anderer Unternehmer. */
  vorsteuer: { kennzahl: "66", bezeichnung: "Abziehbare Vorsteuer" },
  /** Verbleibender USt-Betrag / Zahllast bzw. Erstattung. */
  zahllast: { kennzahl: "83", bezeichnung: "Zahllast / Erstattung" },
} as const satisfies Record<string, ElsterFeld>;

/** Cent-genau runden (kaufmännisch), Eingaben sind Euro-Beträge. */
function rundeCent(euro: number): number {
  return Math.round((euro + Number.EPSILON) * 100);
}

function centZuEuro(cent: number): number {
  return cent / 100;
}

/** USt-Betrag in Cent aus Netto-Bemessung in Cent und Satz. */
function ustVonNettoCent(nettoCent: number, satz: UstSatz): number {
  return Math.round((nettoCent * satz) / 100);
}

/** Eine Kennzahl-Zeile im Ergebnis (Drill-down via buchung_ids). */
export interface KennzahlZeile {
  schluessel: keyof typeof ELSTER_USTVA;
  kennzahl: string;
  bezeichnung: string;
  /** Bemessungsgrundlage bzw. Betrag in Euro (2 Nachkommastellen). */
  betrag: number;
  /** Steuerbetrag in Euro, sofern für die Kennzahl relevant. */
  steuer: number | null;
  /** IDs der einbezogenen Buchungen (Drill-down/Audit). */
  buchung_ids: string[];
}

export interface UstBerechnung {
  jahr: number;
  periode: number;
  /** true → Kleinunternehmer-Nullmeldung. */
  kleinunternehmer: boolean;
  /** Hinweistext bei Nullmeldung, sonst null. */
  hinweis: string | null;
  /** Umsatz/USt je Satz + Vorsteuer + Zahllast (UI-Tabelle). */
  zeilen: KennzahlZeile[];
  /** Summen (Euro). */
  summe: {
    umsatz_netto: number;
    umsatzsteuer: number;
    /** Volle Vorsteuer (mit + ohne Beleg) — Wert, der in Kz 66 landet. */
    vorsteuer_abziehbar: number;
    /** Davon: Vorsteuer aus belegten Ausgaben. */
    vorsteuer_mit_beleg: number;
    /** Davon: Vorsteuer aus unbelegten Ausgaben. */
    vorsteuer_ohne_beleg: number;
    /** > 0 = Zahllast (an FA), < 0 = Erstattung. */
    zahllast: number;
  };
  /** Diagnostik für Warnpanel. */
  diagnostik: {
    /** Anzahl Ausgabenbuchungen mit Vorsteuer-Potenzial ohne Beleg. */
    vorsteuer_ohne_beleg_anzahl: number;
    /** Vorsteuerbetrag (Euro) aus unbelegten Ausgaben (= summe.vorsteuer_ohne_beleg). */
    vorsteuer_ohne_beleg_betrag: number;
    /** Buchungen ohne zuordenbaren USt-Satz (ausgeschlossen). */
    ohne_ust_satz_anzahl: number;
    /** Eingeflossene (berücksichtigte) Buchungen gesamt. */
    beruecksichtigt_anzahl: number;
  };
}

/** Normalisiert einen beliebigen USt-Satz auf 0|7|19 oder null. */
function normSatz(satz: number | null): UstSatz | null {
  if (satz === 19) return 19;
  if (satz === 7) return 7;
  if (satz === 0) return 0;
  return null;
}

/**
 * Deterministische USt-VA-Berechnung für eine Periode.
 *
 * @param buchungen Buchungen DER Periode (Filter auf Zeitraum erfolgt
 *   außerhalb via perioden.ts). Es werden nur geschäftlich +
 *   steuerrelevante berücksichtigt.
 * @param ustStatus Profil-USt-Status (steuert Kleinunternehmer-Nullmeldung).
 */
export function berechneUstVa(
  buchungen: UstBuchung[],
  jahr: number,
  periode: number,
  ustStatus: UstStatus,
): UstBerechnung {
  const kleinunternehmer = ustStatus === "kleinunternehmer";

  // Akkumulatoren in Cent (keine Float-Drift).
  const umsatzNettoCent: Record<UstSatz, number> = { 0: 0, 7: 0, 19: 0 };
  const umsatzIds: Record<UstSatz, string[]> = { 0: [], 7: [], 19: [] };
  let umsatzsteuerCent = 0;
  // Volle Vorsteuer (mit + ohne Beleg) — landet in Kz 66.
  let vorsteuerCent = 0;
  const vorsteuerIds: string[] = [];
  // Aufteilung der Vorsteuer für Transparenz im UI.
  let vorsteuerMitBelegCent = 0;
  let vorsteuerOhneBelegCent = 0;
  let vorsteuerOhneBelegAnzahl = 0;
  let ohneUstSatzAnzahl = 0;
  let beruecksichtigt = 0;

  for (const b of buchungen) {
    // Harte Filter: nur geschäftlich + steuerrelevant.
    if (b.klassifikation !== "geschaeftlich") continue;
    if (b.steuerrelevant !== true) continue;

    const satz = normSatz(b.ust_satz);
    if (satz === null) {
      ohneUstSatzAnzahl++;
      continue;
    }

    beruecksichtigt++;
    const betragCent = rundeCent(b.betrag);

    if (betragCent > 0) {
      // Einnahme → steuerpflichtiger Umsatz je Satz.
      // Bruttobetrag → Netto-Bemessung herausrechnen.
      const nettoCent =
        satz === 0
          ? betragCent
          : Math.round((betragCent * 100) / (100 + satz));
      umsatzNettoCent[satz] += nettoCent;
      umsatzIds[satz].push(b.id);
      if (kleinunternehmer) continue;
      umsatzsteuerCent += ustVonNettoCent(nettoCent, satz);
    } else if (betragCent < 0) {
      // Ausgabe → Vorsteuer wird voll angesetzt (Kz 66), egal ob belegt.
      // Belegstatus wird transparent ausgewiesen (mit/ohne Beleg-Anteil).
      if (satz === 0) continue; // 0 % Eingang → keine Vorsteuer.
      if (kleinunternehmer) continue; // keine Vorsteuer abziehbar.
      const ausgabeBruttoCent = -betragCent;
      const nettoCent = Math.round((ausgabeBruttoCent * 100) / (100 + satz));
      const vstCent = ausgabeBruttoCent - nettoCent;
      vorsteuerCent += vstCent;
      vorsteuerIds.push(b.id);
      if (b.belegt) {
        vorsteuerMitBelegCent += vstCent;
      } else {
        vorsteuerOhneBelegCent += vstCent;
        vorsteuerOhneBelegAnzahl++;
      }
    }
    // betragCent === 0 → kein Effekt.
  }

  const umsatzGesamtNettoCent =
    umsatzNettoCent[19] + umsatzNettoCent[7] + umsatzNettoCent[0];
  const zahllastCent = umsatzsteuerCent - vorsteuerCent;

  const zeilen: KennzahlZeile[] = [
    {
      schluessel: "umsatz_19",
      ...ELSTER_USTVA.umsatz_19,
      betrag: centZuEuro(umsatzNettoCent[19]),
      steuer: kleinunternehmer
        ? 0
        : centZuEuro(ustVonNettoCent(umsatzNettoCent[19], 19)),
      buchung_ids: umsatzIds[19],
    },
    {
      schluessel: "umsatz_7",
      ...ELSTER_USTVA.umsatz_7,
      betrag: centZuEuro(umsatzNettoCent[7]),
      steuer: kleinunternehmer
        ? 0
        : centZuEuro(ustVonNettoCent(umsatzNettoCent[7], 7)),
      buchung_ids: umsatzIds[7],
    },
    {
      schluessel: "umsatz_0",
      ...ELSTER_USTVA.umsatz_0,
      betrag: centZuEuro(umsatzNettoCent[0]),
      steuer: null,
      buchung_ids: umsatzIds[0],
    },
    {
      schluessel: "vorsteuer",
      ...ELSTER_USTVA.vorsteuer,
      betrag: centZuEuro(vorsteuerCent),
      steuer: null,
      buchung_ids: vorsteuerIds,
    },
    {
      schluessel: "zahllast",
      ...ELSTER_USTVA.zahllast,
      betrag: centZuEuro(zahllastCent),
      steuer: null,
      buchung_ids: [],
    },
  ];

  return {
    jahr,
    periode,
    kleinunternehmer,
    hinweis: kleinunternehmer
      ? "Kleinunternehmer nach § 19 UStG: Es wird keine Umsatzsteuer ausgewiesen und keine Vorsteuer abgezogen (Nullmeldung)."
      : null,
    zeilen,
    summe: {
      umsatz_netto: centZuEuro(umsatzGesamtNettoCent),
      umsatzsteuer: centZuEuro(umsatzsteuerCent),
      vorsteuer_abziehbar: centZuEuro(vorsteuerCent),
      vorsteuer_mit_beleg: centZuEuro(vorsteuerMitBelegCent),
      vorsteuer_ohne_beleg: centZuEuro(vorsteuerOhneBelegCent),
      zahllast: centZuEuro(zahllastCent),
    },
    diagnostik: {
      vorsteuer_ohne_beleg_anzahl: vorsteuerOhneBelegAnzahl,
      vorsteuer_ohne_beleg_betrag: centZuEuro(vorsteuerOhneBelegCent),
      ohne_ust_satz_anzahl: ohneUstSatzAnzahl,
      beruecksichtigt_anzahl: beruecksichtigt,
    },
  };
}
