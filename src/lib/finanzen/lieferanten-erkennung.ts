// PROJ-18 — Reine Aggregation für den Lieferanten-Tab. Bewusst KEIN IO,
// kein Supabase, kein Zod. Wird vom API-Endpunkt aufgerufen, der die
// Buchungen aus der DB lädt.
//
// Ein "Lieferant" ist ein Empfänger mit ≥ MIN_LIEFERANT_BUCHUNGEN
// Buchungen, der KEIN Abo-Cluster bildet (siehe wiederkehrend-erkennung).
// Beispiele: Aldi (schwankende Beträge), MediaMarkt (unregelmäßig).
//
// Pipeline (siehe `erkenneLieferanten`):
//   1) Gruppieren nach empfaenger_normalisiert
//   2) Pro Gruppe: < MIN → raus; sonst erkenneCluster() → wenn Abo, raus
//   3) Rest aggregieren: dominante Klassifikation, dominante Kategorie,
//      Jahresumsatz, Richtung
//
// Lookback-Logik (mind. 365 Tage) liegt im API-Endpunkt, nicht hier.

import {
  erkenneCluster,
  modusEmpfaenger,
  MIN_BUCHUNGEN,
  tageZwischen,
  type Richtung,
} from "./wiederkehrend-erkennung";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

export const MIN_LIEFERANT_BUCHUNGEN = 3;
/** Anteilsschwelle: ≥ 80% einer Klassifikation → diese ist dominant. */
export const KLASSIFIKATION_DOMINANT_SCHWELLE = 0.8;

export type DominanteKlassifikation = "privat" | "geschaeftlich" | "unklar";

/** Eingangs-Form für die Aggregation. Was die API-Route liefert. */
export interface LieferantenBuchung {
  id: string;
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
  buchung_datum: string;
  betrag: number;
  klassifikation: Klassifikation | null;
  kategorie_id: string | null;
  /**
   * Typ der zugeordneten Kategorie. Optional/abwärtskompatibel: fehlt der
   * Wert, gilt die Buchung als steuerlich relevant (nicht neutral). Wird
   * gebraucht, um Geldtransit/neutrale Durchläufer aus Richtung & dominanter
   * Kategorie auszuschließen.
   */
  kategorie_typ?: KategorieTyp | null;
  /** Aktiver USt-Satz der Buchung (0/7/19) oder null. Für die UI-Anzeige. */
  ust_satz?: number | null;
  konto_id: string;
  status: BuchungStatus;
}

/** Gruppen-Schlüssel → Liste der Buchungen dieses Empfängers. */
export function gruppiereNachEmpfaenger(
  buchungen: LieferantenBuchung[],
): Map<string, LieferantenBuchung[]> {
  const gruppen = new Map<string, LieferantenBuchung[]>();
  for (const b of buchungen) {
    const normaus = (b.empfaenger_normalisiert ?? "").trim();
    const key = normaus || normalisiereEmpfaenger(b.empfaenger);
    if (!key) continue;
    const arr = gruppen.get(key) ?? [];
    arr.push(b);
    gruppen.set(key, arr);
  }
  return gruppen;
}

/**
 * Mehrheitsentscheidung über `klassifikation`. Nur `privat` und
 * `geschaeftlich` zählen — null/unklar/neutral werden ignoriert.
 * Bei ≥ KLASSIFIKATION_DOMINANT_SCHWELLE (80%) Anteil einer Seite über
 * die gesamte Buchungsmenge gilt sie als dominant. Sonst `unklar`.
 */
export function bestimmeDominanteKlassifikation(
  klassifikationen: Array<Klassifikation | null>,
): DominanteKlassifikation {
  if (klassifikationen.length === 0) return "unklar";
  const gesamt = klassifikationen.length;
  let privat = 0;
  let geschaeftlich = 0;
  for (const k of klassifikationen) {
    if (k === "privat") privat++;
    else if (k === "geschaeftlich") geschaeftlich++;
  }
  if (privat / gesamt >= KLASSIFIKATION_DOMINANT_SCHWELLE) return "privat";
  if (geschaeftlich / gesamt >= KLASSIFIKATION_DOMINANT_SCHWELLE)
    return "geschaeftlich";
  return "unklar";
}

export interface DominanteKategorie {
  id: string;
  anzahl: number;
  /** Anteil 0..1 über die GESAMTE Buchungsmenge des Lieferanten. */
  anteil: number;
}

/**
 * Häufigste `kategorie_id` (NULL ausgeschlossen) mit Anteil. Bei
 * Gleichstand entscheidet die erste Vorkommen-Reihenfolge. NULL wenn
 * alle Buchungen ohne Kategorie sind.
 */
export function bestimmeDominanteKategorie(
  kategorieIds: Array<string | null>,
): DominanteKategorie | null {
  if (kategorieIds.length === 0) return null;
  const zaehler = new Map<string, number>();
  let bestId: string | null = null;
  let bestAnzahl = 0;
  for (const id of kategorieIds) {
    if (!id) continue;
    const next = (zaehler.get(id) ?? 0) + 1;
    zaehler.set(id, next);
    if (next > bestAnzahl) {
      bestAnzahl = next;
      bestId = id;
    }
  }
  if (!bestId) return null;
  return {
    id: bestId,
    anzahl: bestAnzahl,
    anteil: bestAnzahl / kategorieIds.length,
  };
}

/** Ergebnis-Item für die UI / API-Response. */
export interface LieferantItem {
  /** Häufigste Original-Schreibweise des Empfängers im Cluster. */
  empfaenger: string;
  /** Normalisierter Schlüssel — Bridge zu Regeln/anderen Features. */
  empfaenger_norm: string;
  anzahl: number;
  /** Summe ALLER Buchungen im Lookback (Absolutwert). */
  gesamt_summe: number;
  /** Hochgerechnet auf 365 Tage; bei Span < 365 entsprechend skaliert. */
  jahresumsatz: number;
  /** Mehrheits-Richtung über die Vorzeichen der Beträge. */
  richtung: Richtung;
  dominante_klassifikation: DominanteKlassifikation;
  dominante_kategorie: DominanteKategorie | null;
  /** ISO-Datum der ersten / letzten Buchung. */
  erste: string;
  letzte: string;
  /** Volle Buchungsliste, chronologisch (aufsteigend) für Drill-Down. */
  buchungen: LieferantenBuchung[];
}

/**
 * Hauptfunktion: aus einer flachen Buchungsliste die Lieferanten-Items
 * berechnen. Abos werden ausgeschlossen, indem `erkenneCluster()` für
 * jede Gruppe aufgerufen wird — gibt es ein Cluster, ist es ein Abo
 * und wandert NICHT in die Lieferanten-Liste.
 */
export function erkenneLieferanten(
  buchungen: LieferantenBuchung[],
): LieferantItem[] {
  const gruppen = gruppiereNachEmpfaenger(buchungen);
  const items: LieferantItem[] = [];

  for (const [empfaengerNorm, gruppe] of gruppen) {
    if (gruppe.length < MIN_LIEFERANT_BUCHUNGEN) continue;

    // Chronologisch sortieren — sowohl für erkenneCluster() als auch
    // für die Span-Berechnung notwendig.
    gruppe.sort((a, b) => a.buchung_datum.localeCompare(b.buchung_datum));

    // Abo-Ausschluss: wenn erkenneCluster() ein Cluster zurückgibt,
    // ist es ein Abo (lebt im Abo-Radar) und gehört NICHT hierher.
    const cluster = erkenneCluster(gruppe);
    if (cluster) continue;

    const anzahl = gruppe.length;
    const gesamtSumme = gruppe.reduce(
      (s, b) => s + Math.abs(Number(b.betrag) || 0),
      0,
    );
    const erste = gruppe[0].buchung_datum;
    const letzte = gruppe[anzahl - 1].buchung_datum;
    const spanTage = Math.max(1, tageZwischen(erste, letzte));
    // Hochrechnung auf 365 Tage; bei sehr kurzem Span begrenzen wir
    // den Skalierfaktor, damit "3 Buchungen in 7 Tagen" nicht
    // unrealistisch hochgerechnet werden.
    const skalierung = Math.min(365 / spanTage, 12);
    const jahresumsatz = Math.round(gesamtSumme * skalierung * 100) / 100;

    // Richtung & dominante Kategorie nur aus steuerlich relevanten Buchungen
    // ableiten — neutrale Geldtransit-Durchläufer (Umbuchung zwischen Konten)
    // sollen Header-Farbe und Kategorie-Badge nicht verzerren. Fallback auf
    // die volle Gruppe, wenn der Empfänger AUSSCHLIESSLICH neutral ist.
    const relevant = gruppe.filter((b) => b.kategorie_typ !== "neutral");
    const signalBasis = relevant.length > 0 ? relevant : gruppe;

    const positive = signalBasis.filter((b) => Number(b.betrag) > 0).length;
    const richtung: Richtung =
      positive > signalBasis.length / 2 ? "einnahme" : "ausgabe";

    const dominanteKlassifikation = bestimmeDominanteKlassifikation(
      gruppe.map((b) => b.klassifikation),
    );
    const dominanteKategorie = bestimmeDominanteKategorie(
      signalBasis.map((b) => b.kategorie_id),
    );

    const anzeigeEmpfaenger =
      modusEmpfaenger(gruppe.map((b) => b.empfaenger)) || "—";

    items.push({
      empfaenger: anzeigeEmpfaenger,
      empfaenger_norm: empfaengerNorm,
      anzahl,
      gesamt_summe: Math.round(gesamtSumme * 100) / 100,
      jahresumsatz,
      richtung,
      dominante_klassifikation: dominanteKlassifikation,
      dominante_kategorie: dominanteKategorie,
      erste,
      letzte,
      buchungen: gruppe,
    });
  }

  // Sortierung: nach Jahresumsatz absteigend. Sektionierung passiert im UI.
  items.sort((a, b) => b.jahresumsatz - a.jahresumsatz);
  return items;
}

// Re-export, damit die API-Route nur aus einer Datei importieren muss.
export { MIN_BUCHUNGEN };
