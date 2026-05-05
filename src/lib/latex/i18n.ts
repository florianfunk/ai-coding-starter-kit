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

/**
 * Quickfact-Kachel-Labels und Spec-Gruppen-Labels — alles, was im PDF als
 * deutsche Beschriftung von Tech-Daten auftaucht.
 *
 * Lookup-Funktion: gibt den IT-Text zurück, wenn lang=it und Mapping existiert,
 * sonst den DE-Text (oder den übergebenen Default, wenn nichts in der Map ist).
 */
export const QUICKFACT_LABELS: Record<string, string> = {
  // DE-Original → IT
  Leistung: "Potenza",
  Spannung: "Tensione",
  Lichtstrom: "Flusso luminoso",
  "LED/m": "LED/m",
  Cutting: "Taglio",
  Abstrahlwinkel: "Angolo",
  CRI: "CRI",
  Schutzklasse: "Classe protezione",
  Erdung: "Messa a terra",
  Einbautiefe: "Prof. installazione",
  Lebensdauer: "Durata",
  LM80: "LM80",
  EEK: "Classe energetica",
  CCT: "CCT",
  Farbe: "Colore",
  IP: "IP",
  Effizienz: "Efficienza",
  Schutzart: "Grado IP",
  Zertifikat: "Certificato",
};

export const SPEC_GROUP_LABELS: Record<string, string> = {
  "Elektrik & Sicherheit": "Elettrico e sicurezza",
  Photometrie: "Fotometria",
  "Bestückung & Geometrie": "Componenti e geometria",
  "Betrieb & Konformität": "Funzionamento e conformità",
};

export const SPEC_ROW_LABELS: Record<string, string> = {
  "Mit Betriebsgerät": "Con alimentatore",
  "Schutzklasse / IP": "Classe / IP",
  Effizienz: "Efficienza",
  Energieeffizienzklasse: "Classe efficienza energetica",
  SDCM: "SDCM",
  Abstrahlwinkel: "Angolo di emissione",
  "LED-Chip": "Chip LED",
  "LED/m · Pitch": "LED/m · Pitch",
  "Maße L × B × H": "Dimensioni L × P × A",
  "Abschnitt / Max. Länge": "Taglio / Lunghezza max.",
  "Min. Biegeradius / Rolle": "Raggio min. / Bobina",
  "Umgebung Ta / Tc": "Ambiente Ta / Tc",
  "Lebensdauer L70": "Durata L70",
  Zertifikate: "Certificati",
};

/** Bool-Werte der Spec-Tabelle. */
export const BOOL_VALUES: Record<DatenblattLang, { ja: string; nein: string }> = {
  de: { ja: "Ja", nein: "Nein" },
  it: { ja: "Sì", nein: "No" },
};

/** Holt den lokalisierten Wert aus einer Map; bei lang=it+Map-Hit → IT, sonst Original. */
export function tLabel(
  map: Record<string, string>,
  deLabel: string,
  lang: DatenblattLang,
): string {
  if (lang === "it") {
    const it = map[deLabel];
    if (it) return it;
  }
  return deLabel;
}
