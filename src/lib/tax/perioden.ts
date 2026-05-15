// PROJ-8/9: Generische, reine Periodenlogik (date-fns).
//
// Leitet aus dem Firmenprofil (wirtschaftsjahr_beginn, ust_va_rhythmus)
// die USt-Voranmeldungs-Perioden eines Jahres ab und ordnet ein Datum
// einer Periode zu. Keine DB-, KI- oder UI-Abhängigkeit — voll testbar.
//
// PROJ-9 nutzt die Wirtschaftsjahr-Funktionen lesend mit; daher generisch
// und ohne USt-spezifische Annahmen im Wirtschaftsjahr-Teil halten.

import {
  addMonths,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export type UstRhythmus = "monatlich" | "quartalsweise" | "jaehrlich";

/** Eine USt-VA-Periode innerhalb eines Kalenderjahres. */
export interface UstPeriode {
  /** Kalenderjahr der Periode. */
  jahr: number;
  /**
   * Periodennummer:
   * - monatlich: 1..12 (Monat)
   * - quartalsweise: 1..4 (Quartal)
   * - jaehrlich: 0 (Jahresmeldung, einzige Periode)
   */
  periode: number;
  /** Anzeigelabel, z.B. "März 2026" / "Q2 2026" / "Jahr 2026". */
  label: string;
  /** Erster Tag der Periode (ISO yyyy-MM-dd). */
  start: string;
  /** Letzter Tag der Periode (ISO yyyy-MM-dd). */
  ende: string;
}

/** Inklusive Datumsgrenzen (ISO yyyy-MM-dd). */
export interface DatumsIntervall {
  start: string;
  ende: string;
}

const MONATE_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const ISO = "yyyy-MM-dd";

function iso(d: Date): string {
  return format(d, ISO);
}

/** Erster Tag eines Monats (1-basiert) als lokales Datum. */
function ersterDesMonats(jahr: number, monat1: number): Date {
  return new Date(jahr, monat1 - 1, 1);
}

/**
 * Wirtschaftsjahr-Grenzen für ein gegebenes Wirtschaftsjahr.
 *
 * `wirtschaftsjahr_beginn` = Monat (1..12), in dem das WJ startet.
 * - Beginn = 1 → Kalenderjahr (01.01.–31.12. von `jahr`).
 * - Beginn ≠ 1 → abweichendes WJ; das "Jahr" ist das Jahr, in dem das WJ
 *   BEGINNT. Beispiel: Beginn = 4, jahr = 2026 → 01.04.2026–31.03.2027.
 *
 * Generisch (auch von PROJ-9 genutzt).
 */
export function wirtschaftsjahrGrenzen(
  jahr: number,
  wirtschaftsjahrBeginn: number,
): DatumsIntervall {
  const beginn = normalisiereMonat(wirtschaftsjahrBeginn);
  const start = ersterDesMonats(jahr, beginn);
  // Ende = ein Tag vor dem Beginn des nächsten WJ.
  const naechsterStart = addMonths(start, 12);
  const ende = subDays(naechsterStart, 1);
  return { start: iso(start), ende: iso(ende) };
}

/**
 * Liefert für ein Datum das Wirtschaftsjahr (= Jahr, in dem das WJ beginnt).
 * Bei Kalenderjahr-WJ identisch mit dem Kalenderjahr.
 */
export function wirtschaftsjahrZuDatum(
  datumIso: string,
  wirtschaftsjahrBeginn: number,
): number {
  const d = parseDatum(datumIso);
  const beginn = normalisiereMonat(wirtschaftsjahrBeginn);
  const monat1 = d.getMonth() + 1;
  // Liegt der Monat VOR dem WJ-Beginn, gehört das Datum noch zum WJ des
  // Vorjahres.
  return monat1 >= beginn ? d.getFullYear() : d.getFullYear() - 1;
}

/**
 * Erzeugt die Liste aller USt-VA-Perioden eines Kalenderjahres gemäß
 * Rhythmus. monatlich → 12, quartalsweise → 4, jaehrlich → 1.
 *
 * Hinweis: USt-VA-Perioden folgen dem Kalenderjahr (nicht dem
 * Wirtschaftsjahr) — die USt ist eine Kalenderjahr-Steuer.
 */
export function ustVaPerioden(
  jahr: number,
  rhythmus: UstRhythmus,
): UstPeriode[] {
  if (rhythmus === "jaehrlich") {
    return [
      {
        jahr,
        periode: 0,
        label: `Jahr ${jahr}`,
        start: iso(new Date(jahr, 0, 1)),
        ende: iso(new Date(jahr, 11, 31)),
      },
    ];
  }

  if (rhythmus === "quartalsweise") {
    return [1, 2, 3, 4].map((q) => {
      const startMonat = (q - 1) * 3; // 0,3,6,9
      const start = new Date(jahr, startMonat, 1);
      const ende = endOfMonth(new Date(jahr, startMonat + 2, 1));
      return {
        jahr,
        periode: q,
        label: `Q${q} ${jahr}`,
        start: iso(start),
        ende: iso(ende),
      };
    });
  }

  // monatlich
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(jahr, i, 1);
    const ende = endOfMonth(start);
    return {
      jahr,
      periode: i + 1,
      label: `${MONATE_DE[i]} ${jahr}`,
      start: iso(start),
      ende: iso(ende),
    };
  });
}

/**
 * Findet die USt-VA-Periode, in die ein Datum fällt.
 * Liefert `null`, wenn das Datum ungültig/leer ist (→ Ausschluss + Warnung
 * im aufrufenden Modul).
 */
export function periodeFuerDatum(
  datumIso: string | null | undefined,
  jahr: number,
  rhythmus: UstRhythmus,
): UstPeriode | null {
  if (!datumIso) return null;
  let d: Date;
  try {
    d = parseDatum(datumIso);
  } catch {
    return null;
  }
  if (d.getFullYear() !== jahr) return null;

  const perioden = ustVaPerioden(jahr, rhythmus);
  for (const p of perioden) {
    if (
      isWithinInterval(d, {
        start: startOfDay(parseISO(p.start)),
        end: startOfDay(parseISO(p.ende)),
      })
    ) {
      return p;
    }
  }
  return null;
}

/** Einzelne USt-VA-Periode (oder null bei ungültiger Periodennummer). */
export function ustVaPeriode(
  jahr: number,
  periode: number,
  rhythmus: UstRhythmus,
): UstPeriode | null {
  return (
    ustVaPerioden(jahr, rhythmus).find((p) => p.periode === periode) ?? null
  );
}

/** Robustes ISO-Datum-Parsing (yyyy-MM-dd, auch mit Zeitanteil). */
export function parseDatum(datumIso: string): Date {
  const m = datumIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`Ungültiges Datum: ${datumIso}`);
  const jahr = Number(m[1]);
  const monat = Number(m[2]);
  const tag = Number(m[3]);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) {
    throw new Error(`Ungültiges Datum: ${datumIso}`);
  }
  const d = new Date(jahr, monat - 1, tag);
  if (
    d.getFullYear() !== jahr ||
    d.getMonth() !== monat - 1 ||
    d.getDate() !== tag
  ) {
    throw new Error(`Ungültiges Datum: ${datumIso}`);
  }
  return d;
}

function normalisiereMonat(m: number): number {
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error(`Ungültiger Monat (1..12 erwartet): ${m}`);
  }
  return m;
}
