// PROJ-27 (AC1): USt-VA-Fristen-Rechner — REINE, voll testbare Logik.
//
// Berechnet aus (Rhythmus, heutiges Datum, bereits abgeschlossene Perioden,
// Dauerfristverlängerung) die NÄCHSTE relevante USt-VA-Frist:
//   - die jüngste noch nicht abgeschlossene Periode, deren Abgabefrist
//     noch in der Zukunft liegt, ODER
//   - falls die jüngste offene Periode bereits überfällig ist, eben diese
//     (mit ueberfaellig=true), damit der Nutzer die verpasste Frist sieht.
//
// Abgabefrist = Perioden-Ende + 10 Tage (+1 Monat bei Dauerfristverlängerung).
// KEINE Feiertags-/Wochenend-Verschiebung (bewusst Out of Scope, siehe Spec).
//
// Perioden-Erzeugung wird aus tax/perioden wiederverwendet (ustVaPerioden),
// NICHT neu gebaut. Keine DB-, KI- oder UI-Abhängigkeit.

import { addDays, addMonths, format } from "date-fns";
import {
  ustVaPerioden,
  parseDatum,
  type UstPeriode,
  type UstRhythmus,
} from "@/lib/tax/perioden";

/** Ampelstufe für die Frist-Dringlichkeit. */
export type FristAmpel = "neutral" | "gelb" | "rot";

/** Ergebnis des Fristen-Rechners (oder null, wenn keine offene Frist). */
export interface UstFristInfo {
  /** Die nächste relevante USt-VA-Periode. */
  periode: UstPeriode;
  /** Abgabefrist (ISO yyyy-MM-dd) = Ende + 10 Tage (+1 Monat bei Dauerfrist). */
  abgabefrist: string;
  /** Tage bis zur Frist (negativ = überfällig, 0 = heute fällig). */
  tage_bis_frist: number;
  /** true, wenn die Abgabefrist in der Vergangenheit liegt. */
  ueberfaellig: boolean;
  /** Ampelstufe: >14 T neutral, 4..14 gelb, <=3 oder überfällig rot. */
  ampel: FristAmpel;
}

export interface NaechsteUstFristArgs {
  rhythmus: UstRhythmus;
  /** Heutiges Datum (ISO yyyy-MM-dd) — als Parameter, damit testbar. */
  heute: string;
  /** Bereits abgeschlossene USt-VA-Perioden (status='abgeschlossen'). */
  abgeschlossene_perioden: ReadonlyArray<{ jahr: number; periode: number }>;
  /** Dauerfristverlängerung aus dem Firmenprofil. */
  dauerfristverlaengerung: boolean;
}

const ISO = "yyyy-MM-dd";

/** Abgabefrist einer Periode (Ende + 10 Tage, +1 Monat bei Dauerfrist). */
function abgabefristFuer(
  periode: UstPeriode,
  dauerfristverlaengerung: boolean,
): string {
  let frist = addDays(parseDatum(periode.ende), 10);
  if (dauerfristverlaengerung) frist = addMonths(frist, 1);
  return format(frist, ISO);
}

/** Ganztägige Differenz in Tagen zwischen `ziel` und `heute` (beide ISO). */
function tageDifferenz(ziel: string, heute: string): number {
  const MS_PRO_TAG = 24 * 60 * 60 * 1000;
  // Mitternachts-basierte Differenz (date-fns parseDatum liefert lokale 00:00).
  const z = parseDatum(ziel).getTime();
  const h = parseDatum(heute).getTime();
  return Math.round((z - h) / MS_PRO_TAG);
}

/** Ampel aus Tagen bis Frist + Überfälligkeit. */
function ampelFuer(tageBisFrist: number, ueberfaellig: boolean): FristAmpel {
  if (ueberfaellig || tageBisFrist <= 3) return "rot";
  if (tageBisFrist <= 14) return "gelb";
  return "neutral";
}

/**
 * Ermittelt die nächste relevante USt-VA-Frist.
 *
 * Vorgehen:
 * 1. Kandidaten-Perioden für das Jahr von `heute` UND das Vorjahr erzeugen
 *    (so tauchen überfällige Perioden aus Dez/Q4/Vorjahr noch auf).
 * 2. Abgeschlossene Perioden ausfiltern.
 * 3. Pro Periode die Abgabefrist berechnen, chronologisch nach Frist sortieren.
 * 4. Die erste Periode mit Frist >= heute wählen. Gibt es zuvor noch eine
 *    offene, bereits überfällige Periode, hat diese Vorrang (Nutzer soll die
 *    verpasste Frist sehen). Existiert keine künftige Frist, aber eine
 *    überfällige, wird die jüngste überfällige zurückgegeben.
 */
export function naechsteUstFrist(
  args: NaechsteUstFristArgs,
): UstFristInfo | null {
  const { rhythmus, heute, abgeschlossene_perioden, dauerfristverlaengerung } =
    args;

  const heuteJahr = parseDatum(heute).getFullYear();

  const abgeschlossen = new Set(
    abgeschlossene_perioden.map((p) => `${p.jahr}-${p.periode}`),
  );

  // Kandidaten: Vorjahr + aktuelles Jahr (deckt überfällige Vorjahres-Fristen
  // und künftige Fristen des laufenden Jahres ab).
  const kandidaten = [
    ...ustVaPerioden(heuteJahr - 1, rhythmus),
    ...ustVaPerioden(heuteJahr, rhythmus),
  ]
    .filter((p) => !abgeschlossen.has(`${p.jahr}-${p.periode}`))
    .map((p) => {
      const abgabefrist = abgabefristFuer(p, dauerfristverlaengerung);
      const tage = tageDifferenz(abgabefrist, heute);
      return { periode: p, abgabefrist, tage, ueberfaellig: tage < 0 };
    })
    // Chronologisch nach Abgabefrist aufsteigend.
    .sort((a, b) => (a.abgabefrist < b.abgabefrist ? -1 : 1));

  if (kandidaten.length === 0) return null;

  // Älteste überfällige offene Periode hat Vorrang (verpasste Frist sichtbar).
  const ueberfaellig = kandidaten.find((k) => k.ueberfaellig);
  const naechsteOffen = kandidaten.find((k) => !k.ueberfaellig);

  const treffer = ueberfaellig ?? naechsteOffen;
  if (!treffer) return null;

  return {
    periode: treffer.periode,
    abgabefrist: treffer.abgabefrist,
    tage_bis_frist: treffer.tage,
    ueberfaellig: treffer.ueberfaellig,
    ampel: ampelFuer(treffer.tage, treffer.ueberfaellig),
  };
}
