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
 * Baut aus den final verbuchten Buchungen die Übernahme-Map — **Manuell-First**
 * (PROJ-24): die vom Nutzer händisch bestätigten Vorjahres-Buchungen sind die
 * verlässliche Wahrheit und haben Vorrang vor auto-verbuchten.
 *
 * Je Empfänger (nur Zeilen MIT Kategorie):
 *  - Gibt es **mindestens eine `manuell_bestaetigt`-Buchung**, ist die
 *    **Basis** = nur die manuellen. Übernommen wird, wenn diese untereinander
 *    homogen sind (genau eine `kategorie_id` + eine `klassifikation`). Bereits
 *    EINE bestätigte Buchung reicht; abweichende auto-verbuchte werden ignoriert.
 *  - Gibt es **keine** manuelle Buchung, ist die Basis = die auto-verbuchten.
 *    Übernommen wird nur bei Homogenität UND **mindestens zwei** Buchungen
 *    (Outlier-Schutz gegen einzelne LLM-Fehlentscheidungen).
 *
 * Widersprüchliche manuelle Kategorien desselben Empfängers (du hast bewusst
 * unterschiedlich kategorisiert) → kein Auto-Übernehmen → normaler LLM-Prozess.
 */
export function baueVorjahrUebernahmeMap(
  zeilen: readonly FinalBuchungZeile[],
): Map<string, VorjahrKategorisierung> {
  // Gruppieren nach Empfänger-Schlüssel, getrennt nach manuell/auto.
  const gruppen = new Map<
    string,
    { manuell: FinalBuchungZeile[]; auto: FinalBuchungZeile[] }
  >();
  for (const z of zeilen) {
    if (z.kategorie_id == null) continue;
    const key = vorjahrSchluessel(z.empfaenger_normalisiert);
    if (key.length === 0) continue;
    let g = gruppen.get(key);
    if (!g) {
      g = { manuell: [], auto: [] };
      gruppen.set(key, g);
    }
    if (z.status === "manuell_bestaetigt") g.manuell.push(z);
    else g.auto.push(z);
  }

  const map = new Map<string, VorjahrKategorisierung>();
  for (const [key, g] of gruppen) {
    // Manuell-First: manuelle Buchungen sind die Wahrheit, sonst auto.
    const basis = g.manuell.length > 0 ? g.manuell : g.auto;
    // Outlier-Schutz nur für rein auto-verbuchte: mindestens zwei nötig.
    if (g.manuell.length === 0 && g.auto.length < 2) continue;

    // Homogenität auf der Basis: genau eine kategorie_id UND eine klassifikation.
    const distinctKat = new Set(basis.map((z) => z.kategorie_id));
    if (distinctKat.size !== 1) continue;
    const distinctKlass = new Set(basis.map((z) => z.klassifikation));
    if (distinctKlass.size !== 1) continue;

    const erste = basis[0];
    map.set(key, {
      kategorie_id: erste.kategorie_id as string,
      klassifikation: erste.klassifikation,
      steuerrelevant: erste.steuerrelevant,
      ust_satz: erste.ust_satz,
    });
  }
  return map;
}
