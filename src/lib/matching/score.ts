// PROJ-6: Reine, testbare Scoring-Logik Buchung <-> Beleg.
//
// Gewichtetes Scoring über vier Kriterien:
//   - Betrag        (exakt / Toleranzfenster, Skonto/Gebühren)
//   - Datum         (Datumsfenster, Rechnungs- vs. Zahlungsdatum)
//   - Empfänger     (normalisierter String-Vergleich Empfänger/Korrespondent)
//   - Text          (Token-Overlap Verwendungszweck vs. Titel/Korrespondent/OCR)
//
// KEINE externen Pakete, KEIN DB-/Netzzugriff. Liefert Score 0..1 plus
// nachvollziehbaren Kriterien-Breakdown.

/** Eingangsmerkmale einer Buchung für das Scoring (DB-unabhängig). */
export interface BuchungFuerScore {
  id: string;
  betrag: number;
  buchung_datum: string; // ISO yyyy-mm-dd
  verwendungszweck: string | null;
  empfaenger: string | null;
}

/** Eingangsmerkmale eines Belegs für das Scoring (DB-unabhängig). */
export interface BelegFuerScore {
  id: string;
  betrag: number | null;
  beleg_datum: string | null; // ISO yyyy-mm-dd
  titel: string | null;
  korrespondent: string | null;
  ocr_text: string | null;
}

/** Konfigurierbare Toleranzen (Defaults für deutsche Buchhaltung). */
export interface ScoreConfig {
  /** Absolute Betragstoleranz in EUR (Skonto/Rundung). Default 0,50. */
  betrag_abs_toleranz: number;
  /** Relative Betragstoleranz (Anteil, z.B. 0.02 = 2%). Default 0.02. */
  betrag_rel_toleranz: number;
  /** Maximales Datumsfenster in Tagen (Rechnung vs. Zahlung). Default 14. */
  datum_fenster_tage: number;
  /** Gewichte der vier Kriterien (Summe wird normalisiert). */
  gewichte: {
    betrag: number;
    datum: number;
    empfaenger: number;
    text: number;
  };
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  betrag_abs_toleranz: 0.5,
  betrag_rel_toleranz: 0.02,
  datum_fenster_tage: 14,
  gewichte: { betrag: 0.45, datum: 0.2, empfaenger: 0.2, text: 0.15 },
};

/** Schwellen für die Einordnung des Gesamt-Scores. */
export const SCORE_SCHWELLEN = {
  /** >= eindeutig → Auto-Match. */
  eindeutig: 0.85,
  /** >= unsicher (< eindeutig) → manuell prüfen. */
  unsicher: 0.5,
} as const;

/** Einzelnes Kriterien-Ergebnis (für Nachvollziehbarkeit). */
export interface KriteriumErgebnis {
  /** Roh-Teilscore 0..1 für dieses Kriterium. */
  score: number;
  /** Gewicht, mit dem es in den Gesamtscore einging. */
  gewicht: number;
  /** Klartext-Begründung (UI). */
  detail: string;
}

export interface ScoreBreakdown {
  betrag: KriteriumErgebnis;
  datum: KriteriumErgebnis;
  empfaenger: KriteriumErgebnis;
  text: KriteriumErgebnis;
}

export type ScoreEinordnung = "eindeutig" | "unsicher" | "kein_match";

export interface ScoreErgebnis {
  /** Gewichteter Gesamtscore 0..1 (auf 3 Nachkommastellen gerundet). */
  score: number;
  einordnung: ScoreEinordnung;
  kriterien: ScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen (exportiert für Unit-Tests)
// ---------------------------------------------------------------------------

/**
 * Normalisiert einen String: lower-case, deutsche Umlaute transliteriert
 * (ä→ae, ö→oe, ü→ue, ß→ss), restliche Diakritika/Sonderzeichen entfernt.
 *
 * Die Umlaut-Transliteration ist bewusst VOR dem Diakritika-Strip, damit
 * "Müller" und "Mueller" denselben normalisierten Wert ergeben (in deutschen
 * Empfänger-/Korrespondenten-Feldern beide Schreibweisen üblich).
 */
export function normalisiere(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // verbleibende kombinierende Akzente
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Zerlegt einen String in normalisierte Tokens (Länge >= 2). */
export function tokenize(input: string | null | undefined): string[] {
  return normalisiere(input)
    .split(" ")
    .filter((t) => t.length >= 2);
}

/** Tage-Differenz zwischen zwei ISO-Daten (absolut). NaN bei Fehlern. */
export function tageDifferenz(isoA: string, isoB: string): number {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.abs(a - b) / 86_400_000;
}

/**
 * Betrags-Teilscore.
 *
 * Vergleich auf Beträgen wird auf den Absolutwert reduziert (Belege führen
 * Beträge i.d.R. positiv, Ausgabenbuchungen negativ). Innerhalb der Toleranz
 * 1.0, danach linearer Abfall bis zur doppelten Toleranz, dann 0.
 */
export function betragScore(
  buchungBetrag: number,
  belegBetrag: number | null,
  cfg: ScoreConfig,
): KriteriumErgebnis {
  const g = cfg.gewichte.betrag;
  if (belegBetrag === null || Number.isNaN(belegBetrag)) {
    return { score: 0, gewicht: g, detail: "Kein Belegbetrag vorhanden" };
  }
  const a = Math.abs(buchungBetrag);
  const b = Math.abs(belegBetrag);
  const diff = Math.abs(a - b);
  const toleranz = Math.max(
    cfg.betrag_abs_toleranz,
    b * cfg.betrag_rel_toleranz,
  );

  if (diff <= 1e-9) {
    return { score: 1, gewicht: g, detail: "Betrag exakt gleich" };
  }
  if (diff <= toleranz) {
    return {
      score: 1,
      gewicht: g,
      detail: `Betrag innerhalb Toleranz (Δ ${diff.toFixed(2)} €)`,
    };
  }
  if (diff <= toleranz * 2) {
    const score = 1 - (diff - toleranz) / toleranz;
    return {
      score: Math.max(0, score),
      gewicht: g,
      detail: `Betrag nahe Toleranz (Δ ${diff.toFixed(2)} €)`,
    };
  }
  return {
    score: 0,
    gewicht: g,
    detail: `Betrag weicht stark ab (Δ ${diff.toFixed(2)} €)`,
  };
}

/**
 * Harte fachliche Kandidatengrenze. Text-/Datumsähnlichkeit darf niemals
 * einen unplausiblen Betrag überstimmen; zugleich spart der Vorfilter teure
 * OCR-Tokenisierung für tausende offensichtlich fremde Belege.
 */
export function istBetragPlausibel(
  buchungBetrag: number,
  belegBetrag: number | null,
  cfg: ScoreConfig,
): boolean {
  if (belegBetrag === null || !Number.isFinite(belegBetrag)) return false;
  const buchungAbs = Math.abs(buchungBetrag);
  const belegAbs = Math.abs(belegBetrag);
  const toleranz = Math.max(
    cfg.betrag_abs_toleranz,
    belegAbs * cfg.betrag_rel_toleranz,
  );
  return Math.abs(buchungAbs - belegAbs) <= toleranz * 2;
}

/**
 * Datums-Teilscore. Innerhalb halbem Fenster ~1.0, danach linearer Abfall
 * bis zum vollen Fenster, dann 0. Toleriert Rechnungs- vs. Zahlungsdatum.
 */
export function datumScore(
  buchungDatum: string,
  belegDatum: string | null,
  cfg: ScoreConfig,
): KriteriumErgebnis {
  const g = cfg.gewichte.datum;
  if (!belegDatum) {
    return { score: 0, gewicht: g, detail: "Kein Belegdatum vorhanden" };
  }
  const tage = tageDifferenz(buchungDatum, belegDatum);
  if (Number.isNaN(tage)) {
    return { score: 0, gewicht: g, detail: "Datum nicht interpretierbar" };
  }
  const fenster = cfg.datum_fenster_tage;
  const halb = fenster / 2;
  if (tage <= halb) {
    return {
      score: 1,
      gewicht: g,
      detail: `Datum eng beieinander (${Math.round(tage)} Tage)`,
    };
  }
  if (tage <= fenster) {
    const score = 1 - (tage - halb) / halb;
    return {
      score: Math.max(0, score),
      gewicht: g,
      detail: `Datum im Fenster (${Math.round(tage)} Tage)`,
    };
  }
  return {
    score: 0,
    gewicht: g,
    detail: `Datum außerhalb Fenster (${Math.round(tage)} Tage)`,
  };
}

/**
 * Empfänger/Korrespondent-Ähnlichkeit. Token-Jaccard plus Substring-Bonus.
 */
export function empfaengerScore(
  buchungEmpfaenger: string | null,
  belegKorrespondent: string | null,
  cfg: ScoreConfig,
): KriteriumErgebnis {
  const g = cfg.gewichte.empfaenger;
  const e = normalisiere(buchungEmpfaenger);
  const k = normalisiere(belegKorrespondent);
  if (!e || !k) {
    return { score: 0, gewicht: g, detail: "Empfänger/Korrespondent fehlt" };
  }
  if (e === k) {
    return { score: 1, gewicht: g, detail: "Empfänger identisch" };
  }
  if (e.includes(k) || k.includes(e)) {
    return {
      score: 0.9,
      gewicht: g,
      detail: "Empfänger als Teilstring enthalten",
    };
  }
  const j = jaccard(new Set(tokenize(e)), new Set(tokenize(k)));
  return {
    score: j,
    gewicht: g,
    detail: j > 0 ? `Empfänger teilweise ähnlich (${pct(j)})` : "Empfänger verschieden",
  };
}

/**
 * Textähnlichkeit: Verwendungszweck (Buchung) vs. Titel + Korrespondent +
 * OCR-Stichworte (Beleg). Token-Overlap-Heuristik (Overlap-Koeffizient).
 */
export function textScore(
  buchung: Pick<BuchungFuerScore, "verwendungszweck">,
  beleg: Pick<BelegFuerScore, "titel" | "korrespondent" | "ocr_text">,
  cfg: ScoreConfig,
): KriteriumErgebnis {
  const g = cfg.gewichte.text;
  const bTokens = new Set(tokenize(buchung.verwendungszweck));
  if (bTokens.size === 0) {
    return { score: 0, gewicht: g, detail: "Kein Verwendungszweck" };
  }
  // OCR-Text gekappt, damit ein langer Beleg nicht alles "matcht".
  const belegText = [
    beleg.titel ?? "",
    beleg.korrespondent ?? "",
    (beleg.ocr_text ?? "").slice(0, 2000),
  ].join(" ");
  const belegTokens = new Set(tokenize(belegText));
  if (belegTokens.size === 0) {
    return { score: 0, gewicht: g, detail: "Kein Belegtext" };
  }
  const overlap = overlapKoeffizient(bTokens, belegTokens);
  return {
    score: overlap,
    gewicht: g,
    detail:
      overlap > 0
        ? `Textüberschneidung (${pct(overlap)})`
        : "Keine Textüberschneidung",
  };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let schnitt = 0;
  for (const x of a) if (b.has(x)) schnitt++;
  const vereinigung = a.size + b.size - schnitt;
  return vereinigung === 0 ? 0 : schnitt / vereinigung;
}

/** Overlap-Koeffizient: Schnitt / kleinere Menge (robust bei Längenunterschied). */
function overlapKoeffizient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let schnitt = 0;
  for (const x of a) if (b.has(x)) schnitt++;
  return schnitt / Math.min(a.size, b.size);
}

function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}

function einordnung(score: number): ScoreEinordnung {
  if (score >= SCORE_SCHWELLEN.eindeutig) return "eindeutig";
  if (score >= SCORE_SCHWELLEN.unsicher) return "unsicher";
  return "kein_match";
}

/**
 * Berechnet den gewichteten Gesamtscore Buchung <-> Beleg samt Breakdown.
 *
 * Gewichte werden auf Summe 1 normalisiert, damit der Score garantiert in
 * [0,1] liegt — unabhängig davon, wie die Gewichte konfiguriert sind.
 */
export function bewerteMatch(
  buchung: BuchungFuerScore,
  beleg: BelegFuerScore,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): ScoreErgebnis {
  const kriterien: ScoreBreakdown = {
    betrag: betragScore(buchung.betrag, beleg.betrag, config),
    datum: datumScore(buchung.buchung_datum, beleg.beleg_datum, config),
    empfaenger: empfaengerScore(buchung.empfaenger, beleg.korrespondent, config),
    text: textScore(buchung, beleg, config),
  };

  const liste = [
    kriterien.betrag,
    kriterien.datum,
    kriterien.empfaenger,
    kriterien.text,
  ];
  const gewichtSumme = liste.reduce((s, k) => s + k.gewicht, 0);
  const roh =
    gewichtSumme > 0
      ? liste.reduce((s, k) => s + k.score * k.gewicht, 0) / gewichtSumme
      : 0;
  const score = Math.round(Math.min(1, Math.max(0, roh)) * 1000) / 1000;

  return { score, einordnung: einordnung(score), kriterien };
}
