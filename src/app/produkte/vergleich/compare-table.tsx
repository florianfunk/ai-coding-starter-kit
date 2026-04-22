"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Field definition for the comparison table
interface FieldDef {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

interface FieldGroup {
  label: string;
  fields: FieldDef[];
}

const formatNumber = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("de-DE") : String(v);
};

const formatBoolean = (v: unknown) => {
  if (v === null || v === undefined) return "";
  return v ? "Ja" : "Nein";
};

const formatCurrency = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
};

const FIELD_GROUPS: FieldGroup[] = [
  {
    label: "Grunddaten",
    fields: [
      { key: "artikelnummer", label: "Artikelnummer" },
      { key: "name", label: "Name" },
      { key: "_bereich", label: "Bereich" },
      { key: "_kategorie", label: "Kategorie" },
      { key: "artikel_bearbeitet", label: "Status", format: (v) => (v ? "Bearbeitet" : "Unbearbeitet") },
      { key: "datenblatt_titel", label: "Datenblatt-Titel" },
    ],
  },
  {
    label: "Preise",
    fields: [
      { key: "_listenpreis", label: "Listenpreis", format: formatCurrency },
      { key: "_ek", label: "Einkaufspreis", format: formatCurrency },
    ],
  },
  {
    label: "Elektrotechnisch",
    fields: [
      { key: "leistung_w", label: "Leistung (W)", format: formatNumber },
      { key: "nennstrom_a", label: "Nennstrom (A)", format: formatNumber },
      { key: "nennspannung_v", label: "Nennspannung (V)", format: formatNumber },
      { key: "schutzklasse", label: "Schutzklasse" },
      { key: "spannungsart", label: "Spannungsart" },
      { key: "gesamteffizienz_lm_w", label: "Effizienz (lm/W)", format: formatNumber },
    ],
  },
  {
    label: "Lichttechnisch",
    fields: [
      { key: "lichtstrom_lm", label: "Lichtstrom (lm)", format: formatNumber },
      { key: "abstrahlwinkel_grad", label: "Abstrahlwinkel", format: formatNumber },
      { key: "farbtemperatur_k", label: "Farbtemperatur (K)", format: formatNumber },
      { key: "farbwiedergabeindex_cri", label: "CRI", format: formatNumber },
      { key: "farbkonsistenz_sdcm", label: "SDCM" },
      { key: "led_chip", label: "LED-Chip" },
      { key: "lichtverteilung", label: "Lichtverteilung" },
      { key: "energieeffizienzklasse", label: "Energieeffizienzklasse" },
      { key: "ugr", label: "UGR" },
    ],
  },
  {
    label: "Mechanisch",
    fields: [
      { key: "masse_text", label: "Masse" },
      { key: "laenge_mm", label: "Laenge (mm)", format: formatNumber },
      { key: "breite_mm", label: "Breite (mm)", format: formatNumber },
      { key: "hoehe_mm", label: "Hoehe (mm)", format: formatNumber },
      { key: "aussendurchmesser_mm", label: "Aussendurchmesser (mm)", format: formatNumber },
      { key: "einbaudurchmesser_mm", label: "Einbaudurchmesser (mm)", format: formatNumber },
      { key: "gewicht_g", label: "Gewicht (g)", format: formatNumber },
      { key: "gehaeusefarbe", label: "Gehaeusefarbe" },
      { key: "montageart", label: "Montageart" },
      { key: "schutzart_ip", label: "Schutzart IP" },
      { key: "werkstoff_gehaeuse", label: "Werkstoff Gehaeuse" },
      { key: "leuchtmittel", label: "Leuchtmittel" },
      { key: "sockel", label: "Sockel" },
      { key: "schlagfestigkeit", label: "Schlagfestigkeit" },
      { key: "rollenlaenge_m", label: "Rollenlaenge (m)", format: formatNumber },
      { key: "maximale_laenge_m", label: "Max. Laenge (m)", format: formatNumber },
      { key: "anzahl_led_pro_meter", label: "LED/m", format: formatNumber },
      { key: "abstand_led_zu_led_mm", label: "LED-Abstand (mm)", format: formatNumber },
      { key: "laenge_abschnitte_mm", label: "Abschnittlaenge (mm)", format: formatNumber },
      { key: "kleinster_biegeradius_mm", label: "Min. Biegeradius (mm)", format: formatNumber },
    ],
  },
  {
    label: "Thermisch / Sonstiges",
    fields: [
      { key: "lebensdauer_h", label: "Lebensdauer (h)", format: formatNumber },
      { key: "temperatur_ta", label: "Temperatur Ta" },
      { key: "temperatur_tc", label: "Temperatur Tc" },
      { key: "mit_betriebsgeraet", label: "Mit Betriebsgeraet", format: formatBoolean },
      { key: "zertifikate", label: "Zertifikate" },
      { key: "optional_text", label: "Optionaler Text" },
    ],
  },
];

interface CompareTableProps {
  produkte: Array<Record<string, unknown>>;
  preisMap: Record<string, { listenpreis: number | null; ek: number | null }>;
  bereichMap: Record<string, string>;
  kategorieMap: Record<string, string>;
  imageUrlMap: Record<string, string | null>;
}

function getValue(
  produkt: Record<string, unknown>,
  key: string,
  preisMap: Record<string, { listenpreis: number | null; ek: number | null }>,
  bereichMap: Record<string, string>,
  kategorieMap: Record<string, string>,
): unknown {
  const id = produkt.id as string;
  if (key === "_bereich") return bereichMap[produkt.bereich_id as string] ?? "";
  if (key === "_kategorie") return kategorieMap[produkt.kategorie_id as string] ?? "";
  if (key === "_listenpreis") return preisMap[id]?.listenpreis ?? null;
  if (key === "_ek") return preisMap[id]?.ek ?? null;
  return produkt[key];
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function formatValue(v: unknown, field: FieldDef): string {
  if (isEmpty(v)) return "";
  if (field.format) return field.format(v);
  return String(v);
}

function allSame(values: string[]): boolean {
  if (values.length <= 1) return true;
  return values.every((v) => v === values[0]);
}

function anyFilled(values: unknown[]): boolean {
  return values.some((v) => !isEmpty(v));
}

export function CompareTable({
  produkte,
  preisMap,
  bereichMap,
  kategorieMap,
  imageUrlMap,
}: CompareTableProps) {
  const produktCount = produkte.length;
  // Width classes for product columns based on count
  const colWidth = produktCount === 2 ? "w-[40%]" : "w-[30%]";

  return (
    <Table>
      {/* Sticky header with product info */}
      <TableHeader className="sticky top-0 z-20">
        <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
          <TableHead className="w-[200px] min-w-[200px] text-primary-foreground font-semibold">
            Eigenschaft
          </TableHead>
          {produkte.map((p) => {
            const imgUrl = imageUrlMap[p.id as string];
            return (
            <TableHead
              key={p.id as string}
              className={`${colWidth} text-primary-foreground font-semibold`}
            >
              <Link
                href={`/produkte/${p.id as string}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                {imgUrl ? (
                  <div className="w-10 h-10 rounded bg-white/10 overflow-hidden shrink-0">
                    <Image
                      src={imgUrl}
                      alt={(p.name as string) ?? "Produkt"}
                      width={40}
                      height={40}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-white/10 shrink-0 flex items-center justify-center text-xs text-primary-foreground/50">
                    --
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">
                    {p.artikelnummer as string}
                  </div>
                  <div className="text-xs text-primary-foreground/70 truncate">
                    {(p.name as string) ?? "Ohne Name"}
                  </div>
                </div>
              </Link>
            </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {FIELD_GROUPS.map((group) => {
          // Filter fields that have at least one filled value
          const visibleFields = group.fields.filter((field) => {
            const rawValues = produkte.map((p) =>
              getValue(p, field.key, preisMap, bereichMap, kategorieMap),
            );
            return anyFilled(rawValues);
          });

          if (visibleFields.length === 0) return null;

          return (
            <GroupRows
              key={group.label}
              group={{ ...group, fields: visibleFields }}
              produkte={produkte}
              preisMap={preisMap}
              bereichMap={bereichMap}
              kategorieMap={kategorieMap}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function GroupRows({
  group,
  produkte,
  preisMap,
  bereichMap,
  kategorieMap,
}: {
  group: FieldGroup;
  produkte: Array<Record<string, unknown>>;
  preisMap: Record<string, { listenpreis: number | null; ek: number | null }>;
  bereichMap: Record<string, string>;
  kategorieMap: Record<string, string>;
}) {
  return (
    <>
      {/* Group header */}
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell
          colSpan={produkte.length + 1}
          className="py-2 px-4"
        >
          <span className="text-xs uppercase tracking-widest font-semibold text-primary">
            {group.label}
          </span>
        </TableCell>
      </TableRow>

      {/* Field rows */}
      {group.fields.map((field) => {
        const rawValues = produkte.map((p) =>
          getValue(p, field.key, preisMap, bereichMap, kategorieMap),
        );
        const formatted = rawValues.map((v) => formatValue(v, field));
        const same = allSame(formatted);

        return (
          <TableRow key={field.key} className="hover:bg-muted/30">
            <TableCell className="font-medium text-sm text-muted-foreground whitespace-nowrap py-2">
              {field.label}
            </TableCell>
            {produkte.map((p, i) => {
              const raw = rawValues[i];
              const display = formatted[i];
              const isEmptyVal = isEmpty(raw);

              let cellClass = "py-2 text-sm";
              if (isEmptyVal) {
                cellClass += " border border-dashed border-muted-foreground/20";
              } else if (!same) {
                cellClass += " bg-yellow-50 dark:bg-yellow-950/30";
              } else {
                cellClass += " text-muted-foreground";
              }

              return (
                <TableCell key={p.id as string} className={cellClass}>
                  {isEmptyVal ? (
                    <span className="text-muted-foreground/30 text-xs">--</span>
                  ) : field.key === "artikel_bearbeitet" ? (
                    <Badge
                      variant={raw ? "default" : "outline"}
                      className={
                        raw
                          ? "bg-success text-success-foreground text-[10px]"
                          : "border-destructive/40 text-destructive text-[10px]"
                      }
                    >
                      {display}
                    </Badge>
                  ) : (
                    <span className={!same ? "font-medium text-foreground" : ""}>
                      {display}
                    </span>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        );
      })}
    </>
  );
}
