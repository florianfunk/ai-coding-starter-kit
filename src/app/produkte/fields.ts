/** Centralized field definitions for the Produkt form & validation. */

export type FieldType = "text" | "number" | "bool" | "textarea";
export type FieldDef = {
  col: string;
  label: string;
  type: FieldType;
  unit?: string;
};

export const PRODUKT_FIELD_GROUPS: { tab: string; title: string; fields: FieldDef[] }[] = [
  {
    tab: "elektrisch",
    title: "Elektrotechnische Daten",
    fields: [
      { col: "leistung_w", label: "Leistung", unit: "W", type: "number" },
      { col: "nennstrom_a", label: "Nennstrom", unit: "A", type: "number" },
      { col: "nennspannung_v", label: "Nennspannung", unit: "V", type: "number" },
      { col: "schutzklasse", label: "Schutzklasse", type: "text" },
      { col: "spannungsart", label: "Spannungsart", type: "text" },
      { col: "gesamteffizienz_lm_w", label: "Gesamteffizienz", unit: "lm/W", type: "number" },
    ],
  },
  {
    tab: "lichttechnisch",
    title: "Lichttechnische Daten",
    fields: [
      { col: "lichtstrom_lm", label: "Lichtstrom", unit: "lm", type: "number" },
      { col: "abstrahlwinkel_grad", label: "Abstrahlwinkel", unit: "°", type: "number" },
      { col: "energieeffizienzklasse", label: "Energieeffizienzklasse", type: "text" },
      { col: "farbtemperatur_k", label: "Farbtemperatur", unit: "K", type: "number" },
      { col: "farbkonsistenz_sdcm", label: "Farbkonsistenz SDCM", type: "text" },
      { col: "farbwiedergabeindex_cri", label: "CRI", type: "number" },
      { col: "led_chip", label: "LED-Chip", type: "text" },
      { col: "lichtverteilung", label: "Lichtverteilung", type: "text" },
      { col: "ugr", label: "UGR", type: "text" },
    ],
  },
  {
    tab: "mechanisch",
    title: "Mechanische Daten",
    fields: [
      { col: "masse_text", label: "Maße (L×B×H)", type: "text" },
      { col: "laenge_mm", label: "Länge", unit: "mm", type: "number" },
      { col: "breite_mm", label: "Breite", unit: "mm", type: "number" },
      { col: "hoehe_mm", label: "Höhe", unit: "mm", type: "number" },
      { col: "aussendurchmesser_mm", label: "Außendurchmesser", unit: "mm", type: "number" },
      { col: "einbaudurchmesser_mm", label: "Einbaudurchmesser", unit: "mm", type: "number" },
      { col: "gewicht_g", label: "Gewicht", unit: "g", type: "number" },
      { col: "gehaeusefarbe", label: "Gehäusefarbe", type: "text" },
      { col: "montageart", label: "Montageart", type: "text" },
      { col: "schlagfestigkeit", label: "Schlagfestigkeit", type: "text" },
      { col: "schutzart_ip", label: "Schutzart IP", type: "text" },
      { col: "werkstoff_gehaeuse", label: "Werkstoff Gehäuse", type: "text" },
      { col: "leuchtmittel", label: "Leuchtmittel", type: "text" },
      { col: "sockel", label: "Sockel", type: "text" },
      { col: "rollenlaenge_m", label: "Rollenlänge", unit: "m", type: "number" },
      { col: "maximale_laenge_m", label: "Maximale Länge", unit: "m", type: "number" },
      { col: "anzahl_led_pro_meter", label: "Anzahl LED pro Meter", type: "number" },
      { col: "abstand_led_zu_led_mm", label: "Abstand LED zu LED", unit: "mm", type: "number" },
      { col: "laenge_abschnitte_mm", label: "Länge Abschnitte", unit: "mm", type: "number" },
      { col: "kleinster_biegeradius_mm", label: "Kleinster Biegeradius", unit: "mm", type: "number" },
    ],
  },
  {
    tab: "thermisch",
    title: "Thermische Daten",
    fields: [
      { col: "lebensdauer_h", label: "Lebensdauer", unit: "h", type: "number" },
      { col: "temperatur_ta", label: "Umgebungstemperatur Ta", type: "text" },
      { col: "temperatur_tc", label: "Temperatur Tc", type: "text" },
    ],
  },
  {
    tab: "sonstiges",
    title: "Sonstiges",
    fields: [
      { col: "mit_betriebsgeraet", label: "Mit Betriebsgerät", type: "bool" },
      { col: "optional_text", label: "Optional", type: "text" },
      { col: "zertifikate", label: "Zertifikate", type: "text" },
    ],
  },
];

export const ALL_PRODUKT_FIELDS = PRODUKT_FIELD_GROUPS.flatMap((g) => g.fields);
