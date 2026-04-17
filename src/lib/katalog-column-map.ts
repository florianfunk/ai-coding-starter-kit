/**
 * Mapping: Spalten-Label (aus kategorien.spalte_1..9) → Produktfeld + Einheit
 *
 * Diese Labels stammen 1:1 aus FileMaker (T1-T9).
 * Der Nutzer wählt pro Kategorie im UI per Dropdown einen dieser Labels aus,
 * und der Katalog-Renderer übersetzt das Label beim PDF-Export in die
 * entsprechende Spalte aus der `produkte`-Tabelle.
 */
export type SpaltenDefinition = {
  label: string;          // Anzeige-Label in Tabellen-Header
  field: string | null;   // Spalte in produkte-Tabelle (oder "preis" für aktuellen Preis)
  unit?: string;          // Einheit, wird an den Wert angehängt
  align?: "left" | "right" | "center";
};

export const SPALTEN_OPTIONEN: SpaltenDefinition[] = [
  // --- Elektrisch ---
  { label: "Leistung", field: "leistung_w", unit: "W", align: "right" },
  { label: "Spannung", field: "nennspannung_v", unit: "V", align: "right" },
  { label: "Nennstrom", field: "nennstrom_a", unit: "A", align: "right" },
  { label: "Effizienz", field: "gesamteffizienz_lm_w", unit: "lm/W", align: "right" },
  { label: "Schutzklasse", field: "schutzklasse", align: "center" },
  { label: "Spannungsart", field: "spannungsart", align: "center" },

  // --- Licht ---
  { label: "Lichtfarbe", field: "farbtemperatur_k", unit: "K", align: "right" },
  { label: "Lichtstrom", field: "lichtstrom_lm", unit: "lm", align: "right" },
  { label: "CRI", field: "farbwiedergabeindex_cri", align: "right" },
  { label: "SDCM", field: "farbkonsistenz_sdcm", align: "center" },
  { label: "Abstrahlwinkel", field: "abstrahlwinkel_grad", unit: "°", align: "right" },
  { label: "LED-Chip", field: "led_chip", align: "left" },
  { label: "Lichtverteilung", field: "lichtverteilung", align: "left" },
  { label: "Energieeffizienzklasse", field: "energieeffizienzklasse", align: "center" },

  // --- Mechanisch ---
  { label: "Leds/Meter", field: "anzahl_led_pro_meter", unit: "/m", align: "right" },
  { label: "Schnittmaß", field: "laenge_abschnitte_mm", unit: "mm", align: "right" },
  { label: "Rollenlänge", field: "rollenlaenge_m", unit: "m", align: "right" },
  { label: "Max. Länge", field: "maximale_laenge_m", unit: "m", align: "right" },
  { label: "Biegeradius", field: "kleinster_biegeradius_mm", unit: "mm", align: "right" },
  { label: "IP", field: "schutzart_ip", align: "center" },
  { label: "Länge", field: "laenge_mm", unit: "mm", align: "right" },
  { label: "Breite", field: "breite_mm", unit: "mm", align: "right" },
  { label: "Höhe", field: "hoehe_mm", unit: "mm", align: "right" },
  { label: "Außendurchmesser", field: "aussendurchmesser_mm", unit: "mm", align: "right" },
  { label: "Einbaudurchmesser", field: "einbaudurchmesser_mm", unit: "mm", align: "right" },
  { label: "Gewicht", field: "gewicht_g", unit: "g", align: "right" },
  { label: "Maße", field: "masse_text", align: "center" },
  { label: "Gehäusefarbe", field: "gehaeusefarbe", align: "center" },
  { label: "Sockel", field: "sockel", align: "center" },
  { label: "Werkstoff", field: "werkstoff_gehaeuse", align: "left" },
  { label: "Montageart", field: "montageart", align: "center" },
  { label: "UGR", field: "ugr", align: "center" },
  { label: "Schlagfestigkeit", field: "schlagfestigkeit", align: "center" },

  // --- Thermisch ---
  { label: "Lebensdauer", field: "lebensdauer_h", unit: "h", align: "right" },
  { label: "Umgebungstemperatur", field: "temperatur_ta", align: "center" },

  // --- Sonstiges ---
  { label: "Info", field: "info_kurz", align: "left" },
  { label: "Infofeld", field: "infofeld", align: "left" },
  { label: "Zertifikate", field: "zertifikate", align: "left" },
  { label: "Optional", field: "optional_text", align: "left" },
  { label: "Treiber", field: "treiber", align: "left" },
  { label: "Leuchtmittel", field: "leuchtmittel", align: "center" },

  // --- Spezial ---
  { label: "Preis", field: "__preis__", align: "right" },
];

/** Lookup: label -> definition */
export const SPALTEN_MAP = new Map(SPALTEN_OPTIONEN.map((s) => [s.label, s]));

export function getSpaltenDefinition(label: string | null): SpaltenDefinition | null {
  if (!label) return null;
  return SPALTEN_MAP.get(label) ?? null;
}

/** Formatiert einen Wert mit Einheit. */
export function formatSpaltenWert(
  produkt: Record<string, any>,
  def: SpaltenDefinition,
  preis: number | null,
  waehrung: "EUR" | "CHF" = "EUR",
): string {
  if (!def.field) return "";
  if (def.field === "__preis__") {
    if (preis == null) return "—";
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(preis);
  }
  const raw = produkt[def.field];
  if (raw == null || raw === "") return "";
  const value = typeof raw === "number" ? new Intl.NumberFormat("de-DE").format(raw) : String(raw);
  return def.unit ? `${value}${def.unit.startsWith("/") || def.unit === "°" ? "" : " "}${def.unit}` : value;
}
