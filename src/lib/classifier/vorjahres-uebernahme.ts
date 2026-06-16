// PROJ-23: Vorjahres-Übernahme — deterministischer Vor-Pass der Klassifizierung.
//
// Idee: Bevor das LLM bemüht wird, prüfen wir, ob derselbe (normalisierte)
// Empfänger in BEREITS final verbuchten Buchungen (typ. Vorjahr, z. B. 2026)
// EINDEUTIG kategorisiert wurde. Wenn ja, übernehmen wir diese Kategorisierung
// 1:1 — schneller, billiger, reproduzierbar. Der Rest läuft normal weiter.
//
// Dieses Modul ist REIN (kein IO): es baut aus den final verbuchten Buchungen
// eine Map `empfaenger_norm -> eindeutige Kategorisierung`. Die Pipeline-
// Integration (entscheideVorjahresUebernahme) liegt in pipeline.ts.

import type { Klassifikation } from "@/lib/types";

/** Die übernehmbare Kategorisierung eines eindeutigen Empfängers. */
export interface VorjahrKategorisierung {
  kategorie_id: string;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  ust_satz: number | null;
}

/** Eingabe-Zeile: eine bereits final verbuchte Buchung (Teilmenge). */
export interface FinalBuchungZeile {
  empfaenger_normalisiert: string | null;
  kategorie_id: string | null;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  ust_satz: number | null;
  status: string;
}

/** Normalisierungs-Schlüssel: getrimmt + kleingeschrieben (matcht die Pipeline). */
export function vorjahrSchluessel(empfaengerNorm: string | null | undefined): string {
  return (empfaengerNorm ?? "").trim().toLowerCase();
}

/**
 * Baut aus den final verbuchten Buchungen die Übernahme-Map.
 *
 * Ein Empfänger landet NUR dann in der Map (= wird automatisch übernommen),
 * wenn ALLE seine final verbuchten Buchungen mit Kategorie:
 *  - dieselbe `kategorie_id` (genau eine, nicht null) haben UND
 *  - dieselbe `klassifikation` haben (homogen) UND
 *  - die Outlier-Sicherung erfüllen: mindestens eine davon ist
 *    `manuell_bestaetigt` ODER es gibt mindestens zwei solche Buchungen.
 *
 * So wird kein einzelner (evtl. LLM-falscher) auto-verbuchter Ausreißer sofort
 * zur Regel; eine vom Nutzer bestätigte Buchung zählt aber sofort. Gemischte
 * Kategorien → Empfänger NICHT in der Map → normaler LLM-Prozess.
 */
export function baueVorjahrUebernahmeMap(
  zeilen: readonly FinalBuchungZeile[],
): Map<string, VorjahrKategorisierung> {
  // Gruppieren nach Empfänger-Schlüssel; nur Zeilen MIT Kategorie zählen.
  const gruppen = new Map<string, FinalBuchungZeile[]>();
  for (const z of zeilen) {
    if (z.kategorie_id == null) continue;
    const key = vorjahrSchluessel(z.empfaenger_normalisiert);
    if (key.length === 0) continue;
    const liste = gruppen.get(key);
    if (liste) liste.push(z);
    else gruppen.set(key, [z]);
  }

  const map = new Map<string, VorjahrKategorisierung>();
  for (const [key, liste] of gruppen) {
    // Homogenität: genau eine kategorie_id UND eine klassifikation.
    const distinctKat = new Set(liste.map((z) => z.kategorie_id));
    if (distinctKat.size !== 1) continue;
    const distinctKlass = new Set(liste.map((z) => z.klassifikation));
    if (distinctKlass.size !== 1) continue;

    // Outlier-Sicherung.
    const manuell = liste.filter((z) => z.status === "manuell_bestaetigt").length;
    const eligible = manuell >= 1 || liste.length >= 2;
    if (!eligible) continue;

    const erste = liste[0];
    map.set(key, {
      kategorie_id: erste.kategorie_id as string,
      klassifikation: erste.klassifikation,
      steuerrelevant: erste.steuerrelevant,
      ust_satz: erste.ust_satz,
    });
  }
  return map;
}
