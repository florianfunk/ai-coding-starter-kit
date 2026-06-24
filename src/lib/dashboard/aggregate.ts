// PROJ-12: Dashboard-Aggregation — REINE, serverseitig nutzbare Helfer.
//
// Diese Funktionen nehmen bereits geladene Rohdaten/Counts entgegen und
// formen daraus die Dashboard-Kennzahlen. KEINE DB-, KI- oder UI-Abhängigkeit
// und damit voll testbar.
//
// Bewusste Abgrenzung (Architektur §2 "Determinismus"):
// - Die hier gebildeten Geld-Kennzahlen des laufenden Jahres sind eine
//   EINFACHE, VORLÄUFIGE Summierung (Vorzeichenkonvention wie Import:
//   Betrag > 0 = Einnahme, Betrag < 0 = Ausgabe). Sie ersetzen NICHT die
//   deterministischen tax-Module (EÜR/USt) und werden in der UI klar als
//   "vorläufig" gekennzeichnet. Die tax-Module werden hier NICHT importiert.
// - Die voraussichtliche USt-Zahllast ist eine grobe Schätzung aus den
//   vorläufigen Einnahmen/Ausgaben und ist ebenfalls "vorläufig".

import type { UstFristInfo } from "./fristen";
import type { HealthScore } from "./health-score";
import type { AktivitaetsEintrag } from "./aktivitaet";
import type { MonatsPunkt } from "./trend";
import type { YoyVergleich } from "./yoy";

/** Buchungs-Rohdatensatz, soweit fürs Dashboard relevant. */
export interface DashboardBuchung {
  /** > 0 = Einnahme, < 0 = Ausgabe (Vorzeichenkonvention wie Import). */
  betrag: number;
  buchung_datum: string;
  klassifikation: "privat" | "geschaeftlich" | "unklar" | "neutral" | null;
  status: "offen" | "auto_verbucht" | "zur_pruefung" | "manuell_bestaetigt";
  /** USt-Satz der Buchung (0 | 7 | 19) oder null. */
  ust_satz: number | null;
  /** true, wenn mind. eine beleg_buchung-Zuordnung existiert. */
  belegt: boolean;
}

/** Cent-genaue kaufmännische Rundung (vermeidet Float-Drift). */
export function rundeCent(betrag: number): number {
  const sign = betrag < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(betrag) * 100 + Number.EPSILON)) / 100;
}

/**
 * Inklusive Grenzen des laufenden Wirtschaftsjahres (ISO yyyy-MM-dd).
 *
 * Eigenständige, lokale Hilfsfunktion (KEIN Import aus tax/perioden, um
 * Kopplung an parallel entwickelte Module zu vermeiden).
 *
 * @param heute        Referenzdatum (ISO yyyy-MM-dd), i.d.R. der heutige Tag.
 * @param wjBeginnMonat 1–12; 1 = Kalenderjahr (Default/Fallback).
 */
export function laufendesWirtschaftsjahr(
  heute: string,
  wjBeginnMonat: number,
): { jahr: number; von: string; bis: string } {
  const m = heute.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const refJahr = m ? Number(m[1]) : new Date().getUTCFullYear();
  const refMonat = m ? Number(m[2]) : 1;

  const beginn =
    Number.isInteger(wjBeginnMonat) &&
    wjBeginnMonat >= 1 &&
    wjBeginnMonat <= 12
      ? wjBeginnMonat
      : 1;

  // Startjahr: liegt der Referenzmonat vor dem WJ-Beginn, hat das laufende
  // WJ im Vorjahr begonnen.
  const startJahr = refMonat >= beginn ? refJahr : refJahr - 1;
  const von = `${startJahr}-${String(beginn).padStart(2, "0")}-01`;

  // Ende = letzter Tag des Monats vor dem WJ-Beginn, ein Jahr später
  // (bzw. 31.12. bei Kalenderjahr).
  const endeMonat = beginn === 1 ? 12 : beginn - 1;
  const endeJahr = beginn === 1 ? startJahr : startJahr + 1;
  const letzterTag = letzterTagImMonat(endeJahr, endeMonat);
  const bis = `${endeJahr}-${String(endeMonat).padStart(2, "0")}-${String(
    letzterTag,
  ).padStart(2, "0")}`;

  return { jahr: startJahr, von, bis };
}

function letzterTagImMonat(jahr: number, monat: number): number {
  // Tag 0 des Folgemonats = letzter Tag des Zielmonats.
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

/** Liegt `datum` (ISO) inklusiv zwischen `von` und `bis` (ISO)? */
function imIntervall(datum: string, von: string, bis: string): boolean {
  const d = datum.slice(0, 10);
  return d >= von && d <= bis;
}

/** Aktions-Kennzahlen, die direkt zu einer Detailansicht führen. */
export interface AktionsKennzahlen {
  /** Buchungen mit status='zur_pruefung' (PROJ-7). */
  offene_prueffaelle: number;
  /** Geschäftliche Buchungen ohne Beleg-Zuordnung (PROJ-6). */
  fehlende_belege: number;
  /** Buchungen mit status='offen' (noch nicht klassifiziert, PROJ-5). */
  unklassifiziert: number;
}

/**
 * Zählt die Aktions-Kennzahlen aus den Rohbuchungen.
 *
 * "Fehlende Belege" = als 'geschaeftlich' klassifizierte Buchungen, die
 * (noch) keine Beleg-Zuordnung haben. Private/neutrale/unklare brauchen
 * keinen Beleg und werden hier nicht gezählt.
 */
export function zaehleAktionen(
  buchungen: readonly DashboardBuchung[],
): AktionsKennzahlen {
  let offene = 0;
  let fehlend = 0;
  let unklass = 0;
  for (const b of buchungen) {
    if (b.status === "zur_pruefung") offene += 1;
    if (b.status === "offen") unklass += 1;
    if (b.klassifikation === "geschaeftlich" && !b.belegt) fehlend += 1;
  }
  return {
    offene_prueffaelle: offene,
    fehlende_belege: fehlend,
    unklassifiziert: unklass,
  };
}

/** Vorläufige Geld-Kennzahlen des laufenden Wirtschaftsjahres. */
export interface JahresKennzahlen {
  jahr: number;
  zeitraum: { von: string; bis: string };
  /** Summe geschäftlicher Einnahmen (Betrag > 0), cent-gerundet. */
  einnahmen: number;
  /** Summe geschäftlicher Ausgaben (Betrag < 0, als positiver Wert). */
  ausgaben: number;
  /** Einnahmen − Ausgaben (positiv = Gewinn, negativ = Verlust). */
  vorlaeufiger_gewinn: number;
  /**
   * GROBE voraussichtliche USt-Zahllast: Umsatzsteuer auf Einnahmen abzgl.
   * Vorsteuer auf alle geschäftlichen Ausgaben mit USt-Satz (ohne Belegabgleich,
   * Phase 1 — wie das USt-VA-Modul). Negativ = Erstattung.
   */
  voraussichtliche_ust_zahllast: number;
  /** Anzahl einbezogener (geschäftlicher) Buchungen. */
  anzahl_buchungen: number;
  /** Immer true — Kennzeichnung für die UI. */
  vorlaeufig: true;
}

/**
 * Bildet die vorläufigen Jahres-Kennzahlen.
 *
 * Einbezogen: ausschließlich als 'geschaeftlich' klassifizierte Buchungen,
 * deren `buchung_datum` im laufenden Wirtschaftsjahr liegt. Private,
 * neutrale, unklare und noch unklassifizierte (klassifikation=null)
 * Buchungen bleiben außen vor — bewusst konservativ, damit keine
 * irreführenden Zahlen entstehen.
 *
 * USt-Schätzung: ein USt-Satz wird nur berücksichtigt, wenn er an der
 * Buchung hinterlegt ist (0/7/19). Vorsteuer wird auf alle geschäftlichen
 * Ausgaben mit USt-Satz angesetzt (Phase 1, ohne Belegabgleich — konsistent
 * zum USt-VA-Modul).
 */
export function berechneJahresKennzahlen(
  buchungen: readonly DashboardBuchung[],
  heute: string,
  wjBeginnMonat: number,
): JahresKennzahlen {
  const { jahr, von, bis } = laufendesWirtschaftsjahr(heute, wjBeginnMonat);

  let einnahmen = 0;
  let ausgaben = 0;
  let ustEinnahmen = 0;
  let vorsteuer = 0;
  let anzahl = 0;

  for (const b of buchungen) {
    if (b.klassifikation !== "geschaeftlich") continue;
    if (!imIntervall(b.buchung_datum, von, bis)) continue;
    anzahl += 1;

    const satz =
      b.ust_satz === 19 || b.ust_satz === 7 || b.ust_satz === 0
        ? b.ust_satz
        : null;

    if (b.betrag > 0) {
      einnahmen += b.betrag;
      if (satz && satz > 0) {
        // Brutto → enthaltene USt: betrag * satz / (100 + satz).
        ustEinnahmen += (b.betrag * satz) / (100 + satz);
      }
    } else if (b.betrag < 0) {
      const abs = Math.abs(b.betrag);
      ausgaben += abs;
      // Vorsteuer auf ALLE geschäftlichen Ausgaben mit USt-Satz — kein
      // Belegabgleich (Phase 1, konsistent zum USt-VA-Modul, das die volle
      // Vorsteuer in Kz 66 ansetzt). Sonst zeigte das Dashboard ohne gematchte
      // Belege fälschlich die volle Ausgangssteuer als Zahllast.
      if (satz && satz > 0) {
        vorsteuer += (abs * satz) / (100 + satz);
      }
    }
  }

  const einnahmenR = rundeCent(einnahmen);
  const ausgabenR = rundeCent(ausgaben);
  return {
    jahr,
    zeitraum: { von, bis },
    einnahmen: einnahmenR,
    ausgaben: ausgabenR,
    vorlaeufiger_gewinn: rundeCent(einnahmenR - ausgabenR),
    voraussichtliche_ust_zahllast: rundeCent(ustEinnahmen - vorsteuer),
    anzahl_buchungen: anzahl,
    vorlaeufig: true,
  };
}

/** Status eines Hintergrund-/Sync-Laufs (job_lauf-Auszug). */
export interface SyncStatus {
  vorhanden: boolean;
  status: "laeuft" | "fertig" | "fehler" | null;
  zeitpunkt: string | null;
  fehler_text: string | null;
  /** true, wenn der letzte Lauf mit Fehler endete (UI-Warnhinweis). */
  ist_fehler: boolean;
}

/**
 * Reduziert den zuletzt geladenen job_lauf einer Art auf den Sync-Status.
 * `letzter` ist null, wenn noch nie ein Lauf dieser Art stattfand.
 */
export function syncStatusAus(
  letzter: {
    status: "laeuft" | "fertig" | "fehler";
    created_at: string;
    fehler_text: string | null;
  } | null,
): SyncStatus {
  if (!letzter) {
    return {
      vorhanden: false,
      status: null,
      zeitpunkt: null,
      fehler_text: null,
      ist_fehler: false,
    };
  }
  return {
    vorhanden: true,
    status: letzter.status,
    zeitpunkt: letzter.created_at,
    fehler_text: letzter.status === "fehler" ? letzter.fehler_text : null,
    ist_fehler: letzter.status === "fehler",
  };
}

/** Eine Steuerperiode in der Dashboard-Übersicht. */
export interface PeriodenZeile {
  art: "ust_va" | "wirtschaftsjahr";
  jahr: number;
  periode: number | null;
  status: "offen" | "geprueft" | "abgeschlossen";
  label: string;
}

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

/** Erzeugt ein deutsches Anzeigelabel für eine Steuerperiode. */
export function periodenLabel(
  art: "ust_va" | "wirtschaftsjahr",
  jahr: number,
  periode: number | null,
): string {
  if (art === "wirtschaftsjahr") return `Wirtschaftsjahr ${jahr}`;
  if (periode === null || periode === 0) return `USt-VA Jahr ${jahr}`;
  if (periode >= 1 && periode <= 12) {
    return `USt-VA ${MONATE_KURZ[periode - 1]} ${jahr}`;
  }
  // Quartale werden als 1..4 geführt, kollidieren aber mit Monaten 1..4;
  // ohne Rhythmus-Kontext bleibt die generische Periodenangabe korrekt.
  return `USt-VA Periode ${periode}/${jahr}`;
}

/**
 * Sortiert und labelt Steuerperioden für die Übersicht:
 * neueste zuerst (Jahr desc, dann Periode desc), Wirtschaftsjahre vor
 * USt-VA bei gleichem Jahr.
 */
export function bereitePerioden(
  perioden: readonly {
    art: "ust_va" | "wirtschaftsjahr";
    jahr: number;
    periode: number | null;
    status: "offen" | "geprueft" | "abgeschlossen";
  }[],
): PeriodenZeile[] {
  return [...perioden]
    .map((p) => ({
      ...p,
      label: periodenLabel(p.art, p.jahr, p.periode),
    }))
    .sort((a, b) => {
      if (a.jahr !== b.jahr) return b.jahr - a.jahr;
      if (a.art !== b.art) return a.art === "wirtschaftsjahr" ? -1 : 1;
      return (b.periode ?? 0) - (a.periode ?? 0);
    });
}

/**
 * Status der 6 Ersteinrichtungs-Schritte (Onboarding). Jedes Flag = Schritt
 * abgeschlossen. Reihenfolge entspricht der Schrittnummerierung im UI.
 */
export interface OnboardingStatus {
  /** 1. Firmen-/Steuerprofil angelegt. */
  profil: boolean;
  /** 2. Mindestens eine Kontenrahmen-Kategorie vorhanden. */
  kontenrahmen: boolean;
  /** 3. Paperless-Verbindung mit Token hinterlegt. */
  paperless: boolean;
  /** 4. Mindestens ein Bankkonto angelegt. */
  konten: boolean;
  /** 5. Mindestens eine Buchung importiert. */
  import: boolean;
  /** 6. Mindestens eine Buchung klassifiziert (Status != offen). */
  klassifizierung: boolean;
}

/** True, wenn alle 6 Onboarding-Schritte abgeschlossen sind. */
export function onboardingVollstaendig(s: OnboardingStatus): boolean {
  return (
    s.profil &&
    s.kontenrahmen &&
    s.paperless &&
    s.konten &&
    s.import &&
    s.klassifizierung
  );
}

/** Vollständiges Dashboard-Aggregat (Rückgabe der API/Server-Komponente). */
export interface DashboardAggregat {
  aktionen: AktionsKennzahlen;
  jahr: JahresKennzahlen;
  /**
   * PROJ-30 (AC3): Monatsreihen des laufenden WJ (genau 12 Punkte, WJ-Reihen-
   * folge) für die Trend-Sparklines. Gleiche Datenbasis/Logik wie `jahr`.
   */
  trend: MonatsPunkt[];
  /**
   * PROJ-31: Vorjahresvergleich (YoY) der Kern-KPIs des Bezugsjahres. Bei
   * laufendem Bezugs-WJ auf denselben Year-to-Date-Ausschnitt begrenzt
   * (`ist_ytd`). null, wenn keine Buchungen vorhanden sind (leerer Account).
   * Gleiche Datenbasis/Logik wie `jahr`; bestehende Felder unverändert.
   */
  vorjahr: YoyVergleich | null;
  perioden: PeriodenZeile[];
  paperless_sync: SyncStatus;
  konto_import: SyncStatus;
  /** PROJ-27 (AC1): nächste USt-VA-Frist (null = keine offene Frist). */
  fristen: UstFristInfo | null;
  /** PROJ-27 (AC2): Health-Score "Stand der Buchhaltung". */
  health_score: HealthScore;
  /** PROJ-27 (AC3): jüngste Aktivitäten (Top 20, DESC). */
  aktivitaet: AktivitaetsEintrag[];
  /** true, wenn weder Buchungen noch Belege noch Konten vorhanden sind. */
  ist_leer: boolean;
  /** Status der 6 Ersteinrichtungs-Schritte. */
  onboarding: OnboardingStatus;
  /** ISO-Zeitstempel des Aggregations-Zeitpunkts (Aktualitätsstand). */
  stand: string;
}
