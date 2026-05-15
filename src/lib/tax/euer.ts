// PROJ-9: Jahres-EÜR nach §4 Abs.3 EStG — REINE deterministische Aggregation.
//
// Keine KI. Striktes Zufluss-/Abflussprinzip: maßgeblich ist allein das
// `buchung_datum`. Eine Buchung zählt genau dann zum Wirtschaftsjahr, wenn ihr
// Datum in den (ggf. abweichenden) Wirtschaftsjahr-Grenzen liegt.
//
// Berücksichtigt werden ausschließlich als 'geschaeftlich' klassifizierte
// Buchungen. Private/neutrale Buchungen sowie Geldtransit sind ausgeschlossen
// (neutral = durchlaufender Posten, kein Ertrag/Aufwand).
//
// Gruppierung erfolgt entlang der amtlichen Anlage EÜR über die Kategorie
// (kategorie.euer_zeile / kategorie.typ). USt-Zahllast/-Erstattung wird
// berücksichtigt, sofern als Einnahme-/Ausgabe-Kategorie verbucht.
//
// Cent-genaue Rundung (kaufmännisch, halbe Cent auf), reproduzierbar.

import type { Buchung, Kategorie, KategorieTyp } from "@/lib/types";

/** Eine Buchungszeile, wie sie in den Drill-down einfließt. */
export interface EuerBuchungsZeile {
  id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
}

/** Aggregat je Kategorie (= EÜR-Position). */
export interface EuerKategorieGruppe {
  kategorie_id: string;
  bezeichnung: string;
  typ: Extract<KategorieTyp, "einnahme" | "ausgabe">;
  euer_zeile: string | null;
  /** Stets positiver Betrag (Summe der Beträge, cent-gerundet). */
  summe: number;
  anzahl: number;
  buchungen: EuerBuchungsZeile[];
}

/** Vollständiges, deterministisches EÜR-Ergebnis eines Wirtschaftsjahres. */
export interface EuerErgebnis {
  jahr: number;
  /** Wirtschaftsjahr-Grenzen (ISO yyyy-mm-dd, inklusiv). */
  zeitraum: { von: string; bis: string };
  betriebseinnahmen: EuerKategorieGruppe[];
  betriebsausgaben: EuerKategorieGruppe[];
  summe_einnahmen: number;
  summe_ausgaben: number;
  /** Einnahmen − Ausgaben (positiv = Gewinn, negativ = Verlust). */
  gewinn: number;
  /** Geschäftliche Buchungen ohne (aktive) Kategoriezuordnung — Hinweis. */
  ohne_kategorie: {
    anzahl: number;
    summe_einnahmen: number;
    summe_ausgaben: number;
  };
}

/** Cent-genaue kaufmännische Rundung (vermeidet Float-Drift). */
export function rundeCent(betrag: number): number {
  // Math.round rundet .5 zur positiven Unendlichkeit; für negative Beträge
  // spiegeln wir, damit -0.005 → -0.01 (symmetrische kaufmännische Rundung).
  const sign = betrag < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(betrag) * 100 + Number.EPSILON)) / 100;
}

/**
 * Bestimmt die inklusiven Grenzen eines Wirtschaftsjahres.
 *
 * Eigenständige, lokale Hilfsfunktion (KEIN Import aus perioden.ts, um
 * Race-Conditions mit der parallelen Implementierung zu vermeiden).
 *
 * @param jahr  Das Wirtschaftsjahr. Bei abweichendem WJ ist dies das Jahr,
 *              in dem das Wirtschaftsjahr *beginnt*.
 * @param wjBeginnMonat  1–12; 1 = Kalenderjahr (Default).
 * @returns ISO-Daten { von, bis } inklusiv.
 */
export function wirtschaftsjahrGrenzen(
  jahr: number,
  wjBeginnMonat: number,
): { von: string; bis: string } {
  // Ungültiger/außerhalb 1–12 liegender Monat → Kalenderjahr (sicherer
  // Default; das Schema erzwingt ohnehin 1–12).
  const m =
    Number.isInteger(wjBeginnMonat) &&
    wjBeginnMonat >= 1 &&
    wjBeginnMonat <= 12
      ? wjBeginnMonat
      : 1;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (m === 1) {
    return { von: `${jahr}-01-01`, bis: `${jahr}-12-31` };
  }

  // Abweichendes Wirtschaftsjahr: Beginn am 1. des wjBeginnMonat im `jahr`,
  // Ende am letzten Tag des Vormonats im Folgejahr.
  const von = `${jahr}-${pad(m)}-01`;
  const endMonat = m - 1; // Vormonat des Beginns
  const endJahr = jahr + 1;
  // Letzter Tag des Endmonats: Tag 0 des Folgemonats (lokale Datums-Arithmetik
  // ohne Zeitzonen-Effekte, da nur Y/M/D verwendet werden).
  const letzterTag = new Date(endJahr, endMonat, 0).getDate();
  const bis = `${endJahr}-${pad(endMonat)}-${pad(letzterTag)}`;
  return { von, bis };
}

/** True, wenn `isoDatum` (yyyy-mm-dd) inklusiv in [von, bis] liegt. */
function imZeitraum(
  isoDatum: string,
  von: string,
  bis: string,
): boolean {
  // ISO-Datumsstrings sind lexikografisch vergleichbar (yyyy-mm-dd).
  const d = isoDatum.slice(0, 10);
  return d >= von && d <= bis;
}

/**
 * Aggregiert die EÜR eines Wirtschaftsjahres — deterministisch.
 *
 * @param buchungen   Owner-scoped Buchungen (Vorfilterung egal, hier strikt
 *                     nochmals nach Zeitraum + Klassifikation gefiltert).
 * @param kategorien  Owner-scoped Kategorien (für euer_zeile/typ/Bezeichnung).
 * @param jahr        Wirtschaftsjahr (Beginnjahr bei abweichendem WJ).
 * @param wjBeginnMonat  Wirtschaftsjahr-Beginn-Monat (1 = Kalenderjahr).
 */
export function berechneEuer(
  buchungen: Buchung[],
  kategorien: Kategorie[],
  jahr: number,
  wjBeginnMonat: number,
): EuerErgebnis {
  const { von, bis } = wirtschaftsjahrGrenzen(jahr, wjBeginnMonat);
  const katById = new Map<string, Kategorie>();
  for (const k of kategorien) katById.set(k.id, k);

  // Aggregations-Töpfe je Kategorie.
  const einnahmen = new Map<string, EuerKategorieGruppe>();
  const ausgaben = new Map<string, EuerKategorieGruppe>();
  let ohneAnzahl = 0;
  let ohneEinnahmen = 0;
  let ohneAusgaben = 0;

  for (const b of buchungen) {
    // 1. Striktes Zufluss-/Abflussprinzip: nur Buchungen im WJ.
    if (!imZeitraum(b.buchung_datum, von, bis)) continue;
    // 2. Nur geschäftlich; privat/neutral/unklar ausgeschlossen.
    if (b.klassifikation !== "geschaeftlich") continue;

    const kat = b.kategorie_id ? katById.get(b.kategorie_id) : undefined;

    // Geschäftliche Buchung ohne (auffindbare) Kategorie → nur Hinweis,
    // fließt NICHT in die Positionssummen ein (nicht zuordenbar).
    if (!kat || (kat.typ !== "einnahme" && kat.typ !== "ausgabe")) {
      // Eine Kategorie vom Typ privat/neutral wäre inkonsistent mit
      // klassifikation='geschaeftlich' — vorsichtshalber ebenfalls als
      // "nicht zuordenbar" behandeln statt sie falsch zu verbuchen.
      ohneAnzahl++;
      if (b.betrag >= 0) ohneEinnahmen += b.betrag;
      else ohneAusgaben += Math.abs(b.betrag);
      continue;
    }

    const istEinnahme = kat.typ === "einnahme";
    const topf = istEinnahme ? einnahmen : ausgaben;
    let gruppe = topf.get(kat.id);
    if (!gruppe) {
      gruppe = {
        kategorie_id: kat.id,
        bezeichnung: kat.bezeichnung,
        typ: kat.typ,
        euer_zeile: kat.euer_zeile,
        summe: 0,
        anzahl: 0,
        buchungen: [],
      };
      topf.set(kat.id, gruppe);
    }
    // Positionssummen stets als Betragsbetrag (positiv) führen.
    gruppe.summe += Math.abs(b.betrag);
    gruppe.anzahl += 1;
    gruppe.buchungen.push({
      id: b.id,
      buchung_datum: b.buchung_datum.slice(0, 10),
      betrag: b.betrag,
      verwendungszweck: b.verwendungszweck,
      empfaenger: b.empfaenger,
    });
  }

  const finalisieren = (
    m: Map<string, EuerKategorieGruppe>,
  ): EuerKategorieGruppe[] =>
    [...m.values()]
      .map((g) => ({
        ...g,
        summe: rundeCent(g.summe),
        buchungen: [...g.buchungen].sort((a, x) =>
          a.buchung_datum < x.buchung_datum
            ? -1
            : a.buchung_datum > x.buchung_datum
              ? 1
              : 0,
        ),
      }))
      .sort((a, x) => {
        // Sortierung entlang der amtlichen EÜR-Zeile (numerisch wenn möglich).
        const za = Number(a.euer_zeile);
        const zx = Number(x.euer_zeile);
        const aNum = a.euer_zeile !== null && !Number.isNaN(za);
        const xNum = x.euer_zeile !== null && !Number.isNaN(zx);
        if (aNum && xNum && za !== zx) return za - zx;
        if (aNum !== xNum) return aNum ? -1 : 1;
        return a.bezeichnung.localeCompare(x.bezeichnung, "de");
      });

  const betriebseinnahmen = finalisieren(einnahmen);
  const betriebsausgaben = finalisieren(ausgaben);

  const summe_einnahmen = rundeCent(
    betriebseinnahmen.reduce((s, g) => s + g.summe, 0),
  );
  const summe_ausgaben = rundeCent(
    betriebsausgaben.reduce((s, g) => s + g.summe, 0),
  );
  const gewinn = rundeCent(summe_einnahmen - summe_ausgaben);

  return {
    jahr,
    zeitraum: { von, bis },
    betriebseinnahmen,
    betriebsausgaben,
    summe_einnahmen,
    summe_ausgaben,
    gewinn,
    ohne_kategorie: {
      anzahl: ohneAnzahl,
      summe_einnahmen: rundeCent(ohneEinnahmen),
      summe_ausgaben: rundeCent(ohneAusgaben),
    },
  };
}
