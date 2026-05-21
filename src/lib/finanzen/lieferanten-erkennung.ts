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
import type {
  BuchungStatus,
  KategorieTyp,
  Klassifikation,
} from "@/lib/types";

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
