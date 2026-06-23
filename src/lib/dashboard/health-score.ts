// PROJ-27 (AC2): Health-Score "Stand der Buchhaltung" — REINE, testbare Logik.
//
// Verdichtet vorhandene Aggregat-Zahlen zu einem 0..100-Score + einer
// nachvollziehbaren Komponenten-Aufschlüsselung + einem deutschen Klartext.
// Deterministisch, keine DB/KI/UI-Abhängigkeit.
//
// GEWICHTUNG (Summe = 100), bewusst dokumentiert:
//   - Klassifizierung  30  (Anteil bereits klassifizierter Buchungen)
//   - Belege           25  (Anteil belegter geschäftlicher Buchungen)
//   - Prüffälle        20  (keine offenen Prüffälle = voll)
//   - Sync             10  (kein Sync-Fehler = voll)
//   - Fristen          15  (Fristen-Ampel: neutral/null voll, gelb teilweise,
//                           rot leer)
// Jede Komponente liefert 0..100 % "Erfüllung"; der gewichtete Mittelwert
// ergibt den Gesamtscore (0..100, gerundet).
//
// LEER-ZUSTAND (gesamt_buchungen = 0): Es gibt keine sinnvolle Aussage über
// einen "Stand". Wir geben score=null zurück (nicht 100 — ein leerer Account
// ist nicht "fertig", sondern "noch nichts da") + einen Hinweis-Klartext. Die
// UI zeigt dann einen Onboarding-/Empty-State statt eines Score-Rings.

export type FristAmpel = "neutral" | "gelb" | "rot";

/** Gewichte der Score-Komponenten (Summe = 100). */
export const HEALTH_GEWICHTE = {
  klassifizierung: 30,
  belege: 25,
  prueffaelle: 20,
  sync: 10,
  fristen: 15,
} as const;

export interface HealthScoreArgs {
  /** Gesamtzahl Buchungen (alle Klassifikationen/Status). */
  gesamt_buchungen: number;
  /** Buchungen mit status='offen' (noch nicht klassifiziert). */
  unklassifiziert: number;
  /** Buchungen mit status='zur_pruefung'. */
  offene_prueffaelle: number;
  /** Anzahl als 'geschaeftlich' klassifizierter Buchungen. */
  geschaeftlich_gesamt: number;
  /** Geschäftliche Buchungen ohne Beleg-Zuordnung. */
  fehlende_belege: number;
  /** true, wenn der letzte Sync-Lauf mit Fehler endete. */
  sync_fehler: boolean;
  /** Fristen-Ampel (null = keine offene Frist). */
  fristen_ampel: FristAmpel | null;
}

/** Eine Score-Komponente mit Erfüllungsgrad und Beitrag. */
export interface HealthKomponente {
  schluessel: keyof typeof HEALTH_GEWICHTE;
  /** Erfüllungsgrad 0..100 (%). */
  erfuellung: number;
  /** Maximales Gewicht dieser Komponente. */
  gewicht: number;
  /** Beitrag zum Gesamtscore = erfuellung/100 * gewicht (gerundet). */
  beitrag: number;
  /** Deutsche Kurzbeschreibung der Komponente. */
  label: string;
}

export interface HealthScore {
  /** 0..100 oder null im Leer-Zustand (keine Buchungen). */
  score: number | null;
  /** Komponenten-Aufschlüsselung (auch im Leer-Zustand befüllt mit erfuellung). */
  komponenten: HealthKomponente[];
  /** Deutscher Klartext-Satz für die UI. */
  klartext: string;
  /** true, wenn keine Buchungen vorhanden sind (Score nicht aussagekräftig). */
  ist_leer: boolean;
}

/** Anteil 0..100, robust gegen Division durch 0 (leerer Nenner → 100 %). */
function anteilProzent(erfuellt: number, gesamt: number): number {
  if (gesamt <= 0) return 100;
  const p = (erfuellt / gesamt) * 100;
  return Math.max(0, Math.min(100, p));
}

/** Fristen-Ampel → Erfüllungsgrad. */
function fristenErfuellung(ampel: FristAmpel | null): number {
  switch (ampel) {
    case "rot":
      return 0;
    case "gelb":
      return 50;
    case "neutral":
    case null:
    default:
      return 100;
  }
}

/**
 * Berechnet den Health-Score samt Aufschlüsselung und Klartext.
 *
 * Die Erfüllungsgrade:
 * - Klassifizierung: (gesamt - unklassifiziert) / gesamt
 * - Belege: (geschaeftlich_gesamt - fehlende_belege) / geschaeftlich_gesamt
 * - Prüffälle: 100 wenn keine offenen, sonst linear fallend bezogen auf die
 *   Gesamtzahl der Buchungen (1 Prüffall bei vielen Buchungen wiegt wenig).
 * - Sync: 0 bei Fehler, sonst 100.
 * - Fristen: aus der Ampel (rot 0, gelb 50, neutral/keine 100).
 */
export function berechneHealthScore(args: HealthScoreArgs): HealthScore {
  const {
    gesamt_buchungen,
    unklassifiziert,
    offene_prueffaelle,
    geschaeftlich_gesamt,
    fehlende_belege,
    sync_fehler,
    fristen_ampel,
  } = args;

  const ist_leer = gesamt_buchungen <= 0;

  const klassErf = anteilProzent(
    gesamt_buchungen - unklassifiziert,
    gesamt_buchungen,
  );
  const belegErf = anteilProzent(
    geschaeftlich_gesamt - fehlende_belege,
    geschaeftlich_gesamt,
  );
  const pruefErf = anteilProzent(
    gesamt_buchungen - offene_prueffaelle,
    gesamt_buchungen,
  );
  const syncErf = sync_fehler ? 0 : 100;
  const fristErf = fristenErfuellung(fristen_ampel);

  const roh: Array<{
    schluessel: keyof typeof HEALTH_GEWICHTE;
    erfuellung: number;
    label: string;
  }> = [
    { schluessel: "klassifizierung", erfuellung: klassErf, label: "Klassifizierung" },
    { schluessel: "belege", erfuellung: belegErf, label: "Belege" },
    { schluessel: "prueffaelle", erfuellung: pruefErf, label: "Prüffälle" },
    { schluessel: "sync", erfuellung: syncErf, label: "Synchronisierung" },
    { schluessel: "fristen", erfuellung: fristErf, label: "Fristen" },
  ];

  const komponenten: HealthKomponente[] = roh.map((k) => {
    const gewicht = HEALTH_GEWICHTE[k.schluessel];
    return {
      schluessel: k.schluessel,
      erfuellung: Math.round(k.erfuellung),
      gewicht,
      beitrag: Math.round((k.erfuellung / 100) * gewicht),
      label: k.label,
    };
  });

  if (ist_leer) {
    return {
      score: null,
      komponenten,
      klartext: "Noch keine Buchungen — leg los, indem du Belege oder Kontoauszüge importierst.",
      ist_leer: true,
    };
  }

  const score = Math.round(
    roh.reduce(
      (sum, k) => sum + (k.erfuellung / 100) * HEALTH_GEWICHTE[k.schluessel],
      0,
    ),
  );

  return {
    score,
    komponenten,
    klartext: baueKlartext(score, args),
    ist_leer: false,
  };
}

/** Erzeugt einen deutschen Klartext-Satz mit der Anzahl offener Punkte. */
function baueKlartext(score: number, args: HealthScoreArgs): string {
  const offenePunkte =
    args.unklassifiziert + args.offene_prueffaelle + args.fehlende_belege;

  if (score >= 100 && offenePunkte === 0 && !args.sync_fehler) {
    return "Deine Bücher sind vollständig auf Stand — keine offenen Punkte.";
  }

  const teile: string[] = [];
  if (args.unklassifiziert > 0)
    teile.push(`${args.unklassifiziert} unklassifiziert`);
  if (args.offene_prueffaelle > 0)
    teile.push(`${args.offene_prueffaelle} zu prüfen`);
  if (args.fehlende_belege > 0)
    teile.push(`${args.fehlende_belege} ohne Beleg`);
  if (args.sync_fehler) teile.push("Sync-Fehler");

  const detail = teile.length > 0 ? ` (${teile.join(", ")})` : "";
  return `Bücher zu ${score} % bereit${detail}.`;
}
