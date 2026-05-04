/**
 * PROJ-46 — Sprach-Helfer für die Datenblatt-Renderer.
 *
 * Liest pro Sprache den passenden Wert aus einer Produkt-Row (`*_it`-Spalten
 * für IT, sonst Default). Fällt für leere `*_it`-Felder auf die deutsche
 * Variante zurück, damit das PDF nie löchrig wird.
 */
import { TRANSLATABLE_BY_DE } from "@/lib/i18n/translatable-fields";

export type DatenblattLang = "de" | "it";

/** Liest aus `produkt` den Wert der Spalte `deKey` — bei `lang=it` zuerst die
 *  IT-Spiegel-Spalte, mit Fallback auf die deutsche Spalte wenn IT leer ist. */
export function localizedField(
  produkt: Record<string, unknown>,
  deKey: string,
  lang: DatenblattLang,
): string | null {
  if (lang === "it") {
    const def = TRANSLATABLE_BY_DE[deKey];
    if (def) {
      const raw = produkt[def.it];
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw;
      }
    }
  }
  const fallback = produkt[deKey];
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }
  return null;
}

/** Statische Beschriftungen, die im LaTeX-Template auftauchen (Headlines,
 *  Footer-Phrasen). Werden im Payload als `labels` mitgeschickt; das Template
 *  liest sie via Jinja statt deutsche Strings hartzukodieren. */
export const STATIC_LABELS: Record<DatenblattLang, Record<string, string>> = {
  de: {
    technische_daten: "Technische Daten",
    anwendung_hinweise: "Anwendung & Hinweise",
    achtung: "ACHTUNG",
    details: "DETAILS",
    treiber: "Treiber",
    energieeffizienz: "Energieeffizienzklasse",
    stand: "Stand",
    // Wird im Footer rechts ausgegeben — entspricht dem alten hartcodierten
    // String. Bewusst kurz, weil der Footer dreispaltig ist.
    fussnote: "Technische Aenderungen vorbehalten",
  },
  it: {
    technische_daten: "Dati tecnici",
    anwendung_hinweise: "Applicazione e Note",
    achtung: "ATTENZIONE",
    details: "DETTAGLI",
    treiber: "Driver",
    energieeffizienz: "Classe di efficienza energetica",
    stand: "Aggiornato",
    fussnote: "Modifiche tecniche riservate",
  },
};

/** Datum lokalisiert formatieren (DD.MM.YYYY in beiden Sprachen). */
export function formatDateForLang(d: Date, _lang: DatenblattLang): string {
  // Italienisch verwendet ebenfalls DD/MM/YYYY oder DD.MM.YYYY — wir bleiben
  // beim Punkt-Trenner, damit das Footer-Layout in beiden Sprachen identisch
  // wirkt.
  return d.toLocaleDateString("de-DE");
}
