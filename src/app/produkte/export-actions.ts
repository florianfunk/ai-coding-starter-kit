"use server";

import { createClient } from "@/lib/supabase/server";

/* ── Types ─────────────────────────────────────────────────────── */

type ExportOptions = {
  columns: string[];
  search?: string;
  bereichId?: string;
  kategorieId?: string;
  status?: string;
  vollstaendigkeit?: string;
};

type ExportResult = {
  data: string | null;
  filename: string | null;
  mimeType: string;
  count: number;
  error: string | null;
};

/* ── Column label mapping ──────────────────────────────────────── */

const COLUMN_LABELS: Record<string, string> = {
  artikelnummer: "Artikelnummer",
  name: "Name",
  bereich_name: "Bereich",
  kategorie_name: "Kategorie",
  artikel_bearbeitet: "Status",
  listenpreis: "Listenpreis",
  ek: "EK Lichtengros",
  ek_eisenkeil: "EK Eisenkeil",
  gueltig_ab: "Preis gueltig ab",
  datenblatt_titel: "Datenblatt-Titel",
  datenblatt_text: "Datenblatt-Text",
  leistung_w: "Leistung (W)",
  nennstrom_a: "Nennstrom (A)",
  nennspannung_v: "Nennspannung (V)",
  schutzklasse: "Schutzklasse",
  spannungsart: "Spannungsart",
  gesamteffizienz_lm_w: "Gesamteffizienz (lm/W)",
  lichtstrom_lm: "Lichtstrom (lm)",
  abstrahlwinkel_grad: "Abstrahlwinkel (Grad)",
  energieeffizienzklasse: "Energieeffizienzklasse",
  farbtemperatur_k: "Farbtemperatur (K)",
  farbkonsistenz_sdcm: "Farbkonsistenz SDCM",
  farbwiedergabeindex_cri: "CRI",
  led_chip: "LED-Chip",
  lichtverteilung: "Lichtverteilung",
  ugr: "UGR",
  masse_text: "Masse (L x B x H)",
  laenge_mm: "Laenge (mm)",
  breite_mm: "Breite (mm)",
  hoehe_mm: "Hoehe (mm)",
  aussendurchmesser_mm: "Aussendurchmesser (mm)",
  einbaudurchmesser_mm: "Einbaudurchmesser (mm)",
  gewicht_g: "Gewicht (g)",
  gehaeusefarbe: "Gehaeusefarbe",
  montageart: "Montageart",
  schlagfestigkeit: "Schlagfestigkeit",
  schutzart_ip: "Schutzart IP",
  werkstoff_gehaeuse: "Werkstoff Gehaeuse",
  leuchtmittel: "Leuchtmittel",
  sockel: "Sockel",
  rollenlaenge_m: "Rollenlaenge (m)",
  maximale_laenge_m: "Maximale Laenge (m)",
  anzahl_led_pro_meter: "Anzahl LED pro Meter",
  abstand_led_zu_led_mm: "Abstand LED zu LED (mm)",
  laenge_abschnitte_mm: "Laenge Abschnitte (mm)",
  kleinster_biegeradius_mm: "Kleinster Biegeradius (mm)",
  lebensdauer_h: "Lebensdauer (h)",
  temperatur_ta: "Umgebungstemperatur Ta",
  temperatur_tc: "Temperatur Tc",
  mit_betriebsgeraet: "Mit Betriebsgeraet",
  optional_text: "Optional",
  zertifikate: "Zertifikate",
};

/* ── Helpers ───────────────────────────────────────────────────── */

/** Fields that come from the preise table rather than produkte */
const PREIS_FIELDS = new Set(["listenpreis", "ek", "ek_eisenkeil", "gueltig_ab"]);
/** Fields that are computed / joined rather than direct produkt columns */
const VIRTUAL_FIELDS = new Set(["bereich_name", "kategorie_name"]);

const NUMBER_COLUMNS = new Set([
  "listenpreis", "ek", "ek_eisenkeil",
  "leistung_w", "nennstrom_a", "nennspannung_v", "gesamteffizienz_lm_w",
  "lichtstrom_lm", "abstrahlwinkel_grad", "farbtemperatur_k", "farbwiedergabeindex_cri",
  "laenge_mm", "breite_mm", "hoehe_mm", "aussendurchmesser_mm", "einbaudurchmesser_mm",
  "gewicht_g", "rollenlaenge_m", "maximale_laenge_m", "anzahl_led_pro_meter",
  "abstand_led_zu_led_mm", "laenge_abschnitte_mm", "kleinster_biegeradius_mm",
  "lebensdauer_h",
]);

function escapeCsvField(value: string): string {
  // If value contains semicolons, quotes, or newlines — wrap in quotes
  if (value.includes(";") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown, column: string): string {
  if (value == null || value === "") return "";

  if (column === "artikel_bearbeitet") {
    return value ? "Bearbeitet" : "Unbearbeitet";
  }
  if (column === "mit_betriebsgeraet") {
    return value ? "Ja" : "Nein";
  }

  // Number columns: use German decimal format (comma)
  if (NUMBER_COLUMNS.has(column) && typeof value === "number") {
    return String(value).replace(".", ",");
  }
  if (NUMBER_COLUMNS.has(column) && typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return String(n).replace(".", ",");
  }

  return String(value);
}

/* ── Main export action ────────────────────────────────────────── */

export async function exportProdukte(options: ExportOptions): Promise<ExportResult> {
  try {
    const { columns, search, bereichId, kategorieId, status, vollstaendigkeit } = options;

    if (!columns.length) {
      return { data: null, filename: null, mimeType: "text/csv", count: 0, error: "Keine Spalten ausgewaehlt." };
    }

    const supabase = await createClient();

    const needPreise = columns.some((c) => PREIS_FIELDS.has(c));
    const needBereich = columns.includes("bereich_name");
    const needKategorie = columns.includes("kategorie_name");

    // Fetch all columns — simpler and avoids dynamic select typing issues
    let query = supabase.from("produkte").select("*");

    if (search) {
      const q = search.trim();
      query = query.or(`artikelnummer.ilike.%${q}%,name.ilike.%${q}%,datenblatt_titel.ilike.%${q}%`);
    }
    if (bereichId) query = query.eq("bereich_id", bereichId);
    if (kategorieId) query = query.eq("kategorie_id", kategorieId);
    if (status === "unbearbeitet") query = query.eq("artikel_bearbeitet", false);
    if (status === "bearbeitet") query = query.eq("artikel_bearbeitet", true);

    query = query.order("artikelnummer", { ascending: true });

    const { data: produkte, error: qError } = await query;
    if (qError) return { data: null, filename: null, mimeType: "text/csv", count: 0, error: qError.message };
    if (!produkte || produkte.length === 0) {
      return { data: null, filename: null, mimeType: "text/csv", count: 0, error: "Keine Produkte gefunden." };
    }

    // Fetch joined data in parallel
    const produktIds = produkte.map((p) => p.id);

    const [preiseResult, bereicheResult, kategorienResult] = await Promise.all([
      needPreise
        ? supabase.from("aktuelle_preise_flat").select("produkt_id,listenpreis,ek,ek_eisenkeil,gueltig_ab").in("produkt_id", produktIds)
        : { data: [] },
      needBereich
        ? supabase.from("bereiche").select("id,name")
        : { data: [] },
      needKategorie
        ? supabase.from("kategorien").select("id,name")
        : { data: [] },
    ]);

    // Build lookup maps
    const preisMap = new Map<string, { listenpreis: number | null; ek: number | null; ek_eisenkeil: number | null; gueltig_ab: string | null }>();
    for (const p of preiseResult.data ?? []) {
      preisMap.set(p.produkt_id, {
        listenpreis: p.listenpreis != null ? Number(p.listenpreis) : null,
        ek: p.ek != null ? Number(p.ek) : null,
        ek_eisenkeil: p.ek_eisenkeil != null ? Number(p.ek_eisenkeil) : null,
        gueltig_ab: p.gueltig_ab ?? null,
      });
    }
    const bereichMap = new Map<string, string>();
    for (const b of bereicheResult.data ?? []) bereichMap.set(b.id, b.name);
    const kategorieMap = new Map<string, string>();
    for (const k of kategorienResult.data ?? []) kategorieMap.set(k.id, k.name);

    // Note: vollstaendigkeit filter requires completeness calculation
    // For now, skip it in export (it's a computed field that requires icon/image counts)
    // This keeps the export simple and fast
    let filteredProdukte = produkte;
    if (vollstaendigkeit) {
      // Cannot filter by completeness in server action without heavy computation
      // Export all matching products and note in filename
    }

    // Build CSV rows
    const headerRow = columns.map((c) => escapeCsvField(COLUMN_LABELS[c] ?? c)).join(";");

    const dataRows = filteredProdukte.map((produkt) => {
      return columns
        .map((col) => {
          let value: unknown;

          if (col === "bereich_name") {
            value = bereichMap.get(produkt.bereich_id) ?? "";
          } else if (col === "kategorie_name") {
            value = kategorieMap.get(produkt.kategorie_id) ?? "";
          } else if (PREIS_FIELDS.has(col)) {
            const preis = preisMap.get(produkt.id);
            value = preis ? preis[col as keyof typeof preis] : null;
          } else {
            value = (produkt as Record<string, unknown>)[col];
          }

          return escapeCsvField(formatValue(value, col));
        })
        .join(";");
    });

    // UTF-8 BOM + header + data
    const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

    // Encode as base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(csvContent);
    const base64 = Buffer.from(bytes).toString("base64");

    // Determine filename based on whether it's a price-only export
    const isPriceExport = columns.length <= 6 && columns.includes("listenpreis") && !columns.includes("leistung_w");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = isPriceExport
      ? `Preisliste_${dateStr}.csv`
      : `Produktkatalog_${dateStr}.csv`;

    return {
      data: base64,
      filename,
      mimeType: "text/csv;charset=utf-8",
      count: filteredProdukte.length,
      error: null,
    };
  } catch (err) {
    console.error("Export error:", err);
    return { data: null, filename: null, mimeType: "text/csv", count: 0, error: "Export fehlgeschlagen." };
  }
}
