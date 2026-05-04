"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { exportProdukte } from "./export-actions";

/* ── Column groups ─────────────────────────────────────────────── */

type ColumnDef = { key: string; label: string };

const GRUNDDATEN: ColumnDef[] = [
  { key: "artikelnummer", label: "Artikelnummer" },
  { key: "name", label: "Name" },
  { key: "bereich_name", label: "Bereich" },
  { key: "kategorie_name", label: "Kategorie" },
  { key: "artikel_bearbeitet", label: "Status (bearbeitet)" },
];

const PREISE: ColumnDef[] = [
  { key: "listenpreis", label: "Listenpreis" },
  { key: "ek", label: "EK Lichtengros" },
  { key: "ek_eisenkeil", label: "EK Eisenkeil" },
  { key: "gueltig_ab", label: "Preis gueltig ab" },
];

const TECH_ELEKTRISCH: ColumnDef[] = [
  { key: "leistung_w", label: "Leistung (W)" },
  { key: "nennstrom_a", label: "Nennstrom (A)" },
  { key: "nennspannung_v", label: "Nennspannung (V)" },
  { key: "schutzklasse", label: "Schutzklasse" },
  { key: "spannungsart", label: "Spannungsart" },
  { key: "gesamteffizienz_lm_w", label: "Gesamteffizienz (lm/W)" },
];

const TECH_LICHT: ColumnDef[] = [
  { key: "lichtstrom_lm", label: "Lichtstrom (lm)" },
  { key: "abstrahlwinkel_grad", label: "Abstrahlwinkel (Grad)" },
  { key: "energieeffizienzklasse", label: "Energieeffizienzklasse" },
  { key: "farbtemperatur_k", label: "Farbtemperatur (K)" },
  { key: "farbkonsistenz_sdcm", label: "Farbkonsistenz SDCM" },
  { key: "farbwiedergabeindex_cri", label: "CRI" },
  { key: "led_chip", label: "LED-Chip" },
  { key: "lichtverteilung", label: "Lichtverteilung" },
  { key: "ugr", label: "UGR" },
];

const TECH_MECHANISCH: ColumnDef[] = [
  { key: "masse_text", label: "Masse (L x B x H)" },
  { key: "laenge_mm", label: "Laenge (mm)" },
  { key: "breite_mm", label: "Breite (mm)" },
  { key: "hoehe_mm", label: "Hoehe (mm)" },
  { key: "aussendurchmesser_mm", label: "Aussendurchmesser (mm)" },
  { key: "einbaudurchmesser_mm", label: "Einbaudurchmesser (mm)" },
  { key: "gewicht_g", label: "Gewicht (g)" },
  { key: "gehaeusefarbe", label: "Gehaeusefarbe" },
  { key: "montageart", label: "Montageart" },
  { key: "schlagfestigkeit", label: "Schlagfestigkeit" },
  { key: "schutzart_ip", label: "Schutzart IP" },
  { key: "werkstoff_gehaeuse", label: "Werkstoff Gehaeuse" },
  { key: "leuchtmittel", label: "Leuchtmittel" },
  { key: "sockel", label: "Sockel" },
  { key: "rollenlaenge_m", label: "Rollenlaenge (m)" },
  { key: "maximale_laenge_m", label: "Maximale Laenge (m)" },
  { key: "anzahl_led_pro_meter", label: "Anzahl LED pro Meter" },
  { key: "abstand_led_zu_led_mm", label: "Abstand LED zu LED (mm)" },
  { key: "laenge_abschnitte_mm", label: "Laenge Abschnitte (mm)" },
  { key: "kleinster_biegeradius_mm", label: "Kleinster Biegeradius (mm)" },
];

const TECH_THERMISCH: ColumnDef[] = [
  { key: "lebensdauer_h", label: "Lebensdauer (h)" },
  { key: "temperatur_ta", label: "Umgebungstemperatur Ta" },
  { key: "temperatur_tc", label: "Temperatur Tc" },
];

const TECH_SONSTIGE: ColumnDef[] = [
  { key: "mit_betriebsgeraet", label: "Mit Betriebsgeraet" },
  { key: "optional_text", label: "Optional" },
  { key: "zertifikate", label: "Zertifikate" },
];

const DATENBLATT: ColumnDef[] = [
  { key: "datenblatt_titel", label: "Datenblatt-Titel" },
  { key: "datenblatt_text", label: "Datenblatt-Text" },
  { key: "achtung_text", label: "Sicherheitshinweis" },
];

type ColumnGroup = {
  id: string;
  label: string;
  columns: ColumnDef[];
  defaultOn: boolean;
};

const COLUMN_GROUPS: ColumnGroup[] = [
  { id: "grunddaten", label: "Grunddaten", columns: GRUNDDATEN, defaultOn: true },
  { id: "preise", label: "Preise", columns: PREISE, defaultOn: true },
  { id: "elektrisch", label: "Elektrotechnische Daten", columns: TECH_ELEKTRISCH, defaultOn: false },
  { id: "lichttechnisch", label: "Lichttechnische Daten", columns: TECH_LICHT, defaultOn: false },
  { id: "mechanisch", label: "Mechanische Daten", columns: TECH_MECHANISCH, defaultOn: false },
  { id: "thermisch", label: "Thermische Daten", columns: TECH_THERMISCH, defaultOn: false },
  { id: "sonstige", label: "Sonstiges", columns: TECH_SONSTIGE, defaultOn: false },
  { id: "datenblatt", label: "Datenblatt-Texte", columns: DATENBLATT, defaultOn: false },
];

const ALL_COLUMN_KEYS = COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.key));
const DEFAULT_COLUMNS = COLUMN_GROUPS.filter((g) => g.defaultOn).flatMap((g) => g.columns.map((c) => c.key));

/* ── Props ─────────────────────────────────────────────────────── */

type ExportDialogProps = {
  /** Count of products matching current filters */
  produktCount: number;
  /** Current filter params to pass to server action */
  filters: {
    search?: string;
    bereichId?: string;
    kategorieId?: string;
    status?: string;
    vollstaendigkeit?: string;
  };
};

/* ── Component ─────────────────────────────────────────────────── */

export function ExportDialog({ produktCount, filters }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [mode, setMode] = useState<"produkte" | "preise">("produkte");
  const [isPending, startTransition] = useTransition();

  const PREISE_ONLY_KEYS = [
    "artikelnummer",
    "name",
    "listenpreis",
    "ek",
    "ek_eisenkeil",
    "gueltig_ab",
  ];

  function toggleGroup(group: ColumnGroup) {
    const keys = group.columns.map((c) => c.key);
    const allSelected = keys.every((k) => selectedColumns.has(k));
    const next = new Set(selectedColumns);
    for (const k of keys) {
      if (allSelected) {
        next.delete(k);
      } else {
        next.add(k);
      }
    }
    setSelectedColumns(next);
  }

  function toggleColumn(key: string) {
    const next = new Set(selectedColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedColumns(next);
  }

  function selectAll() {
    setSelectedColumns(new Set(ALL_COLUMN_KEYS));
  }

  function selectNone() {
    setSelectedColumns(new Set());
  }

  function handleExport() {
    const columns = mode === "preise" ? PREISE_ONLY_KEYS : Array.from(selectedColumns);

    if (columns.length === 0) {
      toast.error("Bitte mindestens eine Spalte auswaehlen.");
      return;
    }

    const toastId = toast.loading("Export wird erstellt...");

    startTransition(async () => {
      try {
        const result = await exportProdukte({
          columns,
          search: filters.search,
          bereichId: filters.bereichId,
          kategorieId: filters.kategorieId,
          status: filters.status,
          vollstaendigkeit: filters.vollstaendigkeit,
        });

        if (result.error) {
          toast.error(result.error, { id: toastId });
          return;
        }

        // Decode base64 and trigger download
        const bytes = Uint8Array.from(atob(result.data!), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename!;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`${result.count} Produkte exportiert`, { id: toastId });
        setOpen(false);
      } catch {
        toast.error("Export fehlgeschlagen. Bitte erneut versuchen.", { id: toastId });
      }
    });
  }

  const effectiveCount = mode === "preise" ? PREISE_ONLY_KEYS.length : selectedColumns.size;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Download className="mr-2 h-4 w-4" />
          Exportieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Produkte exportieren</DialogTitle>
          <DialogDescription>
            Es werden {produktCount} Produkte exportiert (aktuelle Filter beruecksichtigt).
            Das Format ist CSV (Semikolon-getrennt, Excel-kompatibel).
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-2">
          <Button
            variant={mode === "produkte" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("produkte")}
          >
            Produktdaten
          </Button>
          <Button
            variant={mode === "preise" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("preise")}
          >
            Nur Preisliste
          </Button>
        </div>

        {mode === "produkte" ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Select all / none */}
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline font-medium"
              >
                Alle auswaehlen
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-primary hover:underline font-medium"
              >
                Alle abwaehlen
              </button>
              <span className="ml-auto text-muted-foreground text-xs self-center">
                {selectedColumns.size} von {ALL_COLUMN_KEYS.length} Spalten
              </span>
            </div>

            <Separator />

            {COLUMN_GROUPS.map((group) => {
              const keys = group.columns.map((c) => c.key);
              const allSelected = keys.every((k) => selectedColumns.has(k));
              const someSelected = keys.some((k) => selectedColumns.has(k));

              return (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleGroup(group)}
                    />
                    <Label
                      htmlFor={`group-${group.id}`}
                      className="text-sm font-semibold cursor-pointer"
                    >
                      {group.label}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 ml-6">
                    {group.columns.map((col) => (
                      <div key={col.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={selectedColumns.has(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        <Label
                          htmlFor={`col-${col.key}`}
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          {col.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-sm text-muted-foreground">
            <p className="mb-2">Folgende Spalten werden exportiert:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Artikelnummer</li>
              <li>Produktname</li>
              <li>Listenpreis</li>
              <li>EK Lichtengros</li>
              <li>EK Eisenkeil</li>
              <li>Gueltig ab</li>
            </ul>
            <p className="mt-3 text-xs">
              Dateiname: Preisliste_{new Date().toISOString().slice(0, 10)}.csv
            </p>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={isPending || (mode === "produkte" && effectiveCount === 0)}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportieren...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {mode === "preise" ? "Preisliste exportieren" : "Exportieren"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
