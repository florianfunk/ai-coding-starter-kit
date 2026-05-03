/** Centralized field definitions for the Produkt form & validation. */

export type FieldType = "text" | "number" | "bool" | "textarea";
export type FieldDef = {
  col: string;
  label: string;
  type: FieldType;
  unit?: string;
  /** Optional: Vorschlagswerte für Datalist-Dropdown. Custom-Werte bleiben erlaubt. */
  options?: string[];
  /** Optional: Breite im Grid. "full" = volle Zeile. */
  colSpan?: "full";
};

export const PRODUKT_FIELD_GROUPS: { tab: string; title: string; fields: FieldDef[] }[] = [
  {
    tab: "elektrisch",
    title: "Elektrotechnische Daten",
    fields: [
      { col: "leistung_w", label: "Leistung", unit: "W", type: "number" },
      { col: "nennstrom_a", label: "Nennstrom", unit: "A", type: "number" },
      {
        col: "nennspannung_v",
        label: "Nennspannung",
        unit: "V",
        type: "number",
        options: ["12", "24", "48", "110", "120", "230", "240", "277"],
      },
      {
        col: "schutzklasse",
        label: "Schutzklasse",
        type: "text",
        options: ["I", "II", "III"],
      },
      {
        col: "spannungsart",
        label: "Spannungsart",
        type: "text",
        options: ["DC", "AC", "AC/DC"],
      },
      { col: "gesamteffizienz_lm_w", label: "Gesamteffizienz", unit: "lm/W", type: "number" },
    ],
  },
  {
    tab: "lichttechnisch",
    title: "Lichttechnische Daten",
    fields: [
      { col: "lichtstrom_lm", label: "Lichtstrom", unit: "lm", type: "number" },
      { col: "abstrahlwinkel_grad", label: "Abstrahlwinkel", unit: "°", type: "number" },
      {
        col: "energieeffizienzklasse",
        label: "Energieeffizienzklasse",
        type: "text",
        options: [
          "A",
          "A (≥ 210 lm/W)",
          "B",
          "B (185–210 lm/W)",
          "C",
          "C (160–185 lm/W)",
          "D",
          "D (135–160 lm/W)",
          "E",
          "E (110–135 lm/W)",
          "F",
          "F (85–110 lm/W)",
          "G",
          "G (< 85 lm/W)",
        ],
      },
      {
        col: "farbtemperatur_k",
        label: "Farbtemperatur",
        unit: "K",
        type: "number",
        options: [
          "1800",
          "2000",
          "2200",
          "2400",
          "2500",
          "2700",
          "3000",
          "3300",
          "3500",
          "4000",
          "4500",
          "5000",
          "5500",
          "5700",
          "6000",
          "6500",
        ],
      },
      {
        col: "farbkonsistenz_sdcm",
        label: "Farbkonsistenz SDCM",
        type: "text",
        options: ["SDCM 2", "SDCM 3", "SDCM 4", "SDCM 5", "SDCM 6"],
      },
      {
        col: "farbwiedergabeindex_cri",
        label: "CRI",
        type: "number",
        options: ["80", "82", "85", "90", "95", "97"],
      },
      {
        col: "led_chip",
        label: "LED-Chip",
        type: "text",
        options: ["SMD 2835", "SMD 3528", "SMD 3030", "SMD 5050", "SMD 5630", "COB", "MCOB", "MID-Power", "High-Power"],
      },
      {
        col: "lichtverteilung",
        label: "Lichtverteilung",
        type: "text",
        options: ["direkt", "indirekt", "direkt/indirekt", "rotationssymmetrisch", "asymmetrisch", "breit strahlend", "eng strahlend"],
      },
      {
        col: "ugr",
        label: "UGR",
        type: "text",
        options: ["< 16", "< 19", "< 22", "< 25", "< 28"],
      },
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
      {
        col: "gehaeusefarbe",
        label: "Gehäusefarbe",
        type: "text",
        options: ["weiß", "schwarz", "silber", "anthrazit", "grau", "alu gebürstet", "alu eloxiert", "messing", "kupfer", "chrom", "edelstahl", "RAL nach Wunsch"],
      },
      {
        col: "montageart",
        label: "Montageart",
        type: "text",
        options: ["Einbau", "Aufbau", "Pendel", "Wand", "Decke", "Boden", "Stehend", "Magnethalter", "Schienensystem", "Klemmmontage", "Schraubmontage"],
      },
      {
        col: "schlagfestigkeit",
        label: "Schlagfestigkeit",
        type: "text",
        options: ["IK02", "IK03", "IK04", "IK05", "IK06", "IK07", "IK08", "IK09", "IK10"],
      },
      {
        col: "schutzart_ip",
        label: "Schutzart IP",
        type: "text",
        options: ["IP20", "IP23", "IP40", "IP44", "IP54", "IP65", "IP66", "IP67", "IP68", "IP69K"],
      },
      {
        col: "werkstoff_gehaeuse",
        label: "Werkstoff Gehäuse",
        type: "text",
        options: ["Aluminium", "Aluminium-Druckguss", "Edelstahl", "Stahl", "Kunststoff", "Polycarbonat", "PMMA (Acryl)", "Glas", "Holz", "Messing", "Kupfer"],
      },
      {
        col: "leuchtmittel",
        label: "Leuchtmittel",
        type: "text",
        options: ["LED integriert", "LED austauschbar", "LED-Modul", "LED-Stripe", "LED-Retrofit", "Halogen", "ohne Leuchtmittel"],
      },
      {
        col: "sockel",
        label: "Sockel",
        type: "text",
        options: ["E27", "E14", "GU10", "GU5.3", "G9", "G4", "GX53", "G13", "G24", "2G11", "MR16", "PAR16", "PAR20", "PAR30", "PAR38", "fest verbaut"],
      },
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
      {
        col: "lebensdauer_h",
        label: "Lebensdauer",
        unit: "h",
        type: "number",
        options: ["25000", "30000", "35000", "40000", "50000", "60000", "80000", "100000"],
      },
      {
        col: "temperatur_ta",
        label: "Umgebungstemperatur Ta",
        type: "text",
        options: ["-20~40°C", "-20~45°C", "-20~50°C", "-25~40°C", "-25~50°C", "0~40°C", "0~50°C"],
      },
      {
        col: "temperatur_tc",
        label: "Temperatur Tc",
        type: "text",
        options: ["60°C(max)", "65°C(max)", "70°C(max)", "75°C(max)", "80°C(max)", "85°C(max)"],
      },
    ],
  },
  {
    tab: "sonstiges",
    title: "Sonstiges",
    fields: [
      { col: "mit_betriebsgeraet", label: "Mit Betriebsgerät", type: "bool" },
      { col: "optional_text", label: "Optional", type: "text", colSpan: "full" },
      // Hinweis: „zertifikate" wurde aus der UI entfernt — die Pflege läuft
      // jetzt über die Icons-Section (Gruppe „Zertifikate"). DB-Spalte bleibt
      // bestehen für Migrations-/Altdaten.
    ],
  },
];

export const ALL_PRODUKT_FIELDS = PRODUKT_FIELD_GROUPS.flatMap((g) => g.fields);
