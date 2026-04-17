"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, ArrowLeft, ArrowRight, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseCsv, parseGermanNumber, parseDate, type CsvParseResult } from "@/lib/csv-parser";
import {
  importPreise,
  matchArtikelnummern,
  type ImportPreiseRow,
  type PreisMatchResult,
} from "../actions";

const STEPS = [
  { label: "Datei hochladen", number: 1 },
  { label: "Spalten zuordnen", number: 2 },
  { label: "Vorschau & Import", number: 3 },
];

type ColumnMapping = {
  artikelnummer: string | null;
  listenpreis: string | null;
  ek_lichtengros: string | null;
  ek_eisenkeil: string | null;
  gueltig_ab: string | null;
};

const FIELD_OPTIONS = [
  { key: "artikelnummer" as const, label: "Artikelnummer (Pflicht)", required: true },
  { key: "listenpreis" as const, label: "Listenpreis", required: false },
  { key: "ek_lichtengros" as const, label: "EK Lichtengros", required: false },
  { key: "ek_eisenkeil" as const, label: "EK Eisenkeil", required: false },
  { key: "gueltig_ab" as const, label: "Gueltig ab", required: false },
];

// Auto-detect column mappings based on header names
function autoDetectMappings(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    artikelnummer: null,
    listenpreis: null,
    ek_lichtengros: null,
    ek_eisenkeil: null,
    gueltig_ab: null,
  };

  for (const header of headers) {
    const lower = header.toLowerCase().trim();

    if (
      lower === "artikelnummer" ||
      lower === "art.nr." ||
      lower === "art.-nr." ||
      lower === "artnr" ||
      lower === "artikel-nr" ||
      lower === "artikelnr"
    ) {
      mapping.artikelnummer = header;
    } else if (
      lower === "listenpreis" ||
      lower === "preis" ||
      lower === "vk" ||
      lower === "vk-preis"
    ) {
      mapping.listenpreis = header;
    } else if (
      lower === "ek lichtengros" ||
      lower === "ek_lichtengros" ||
      lower === "ek lg" ||
      lower === "ek-lg"
    ) {
      mapping.ek_lichtengros = header;
    } else if (
      lower === "ek eisenkeil" ||
      lower === "ek_eisenkeil" ||
      lower === "ek ek" ||
      lower === "ek-ek"
    ) {
      mapping.ek_eisenkeil = header;
    } else if (
      lower === "gueltig ab" ||
      lower === "gueltig_ab" ||
      lower.includes("datum") ||
      lower === "ab"
    ) {
      mapping.gueltig_ab = header;
    }
  }

  return mapping;
}

type PreviewRow = {
  artikelnummer: string;
  listenpreis: number | null;
  ek_lichtengros: number | null;
  ek_eisenkeil: number | null;
  gueltig_ab: string | null;
  match: PreisMatchResult | null;
  status: "found" | "unchanged" | "not_found";
};

export function PreisImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    artikelnummer: null,
    listenpreis: null,
    ek_lichtengros: null,
    ek_eisenkeil: null,
    gueltig_ab: null,
  });
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [deactivateOld, setDeactivateOld] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // --- Step 1: File Upload ---
  const processFile = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Datei zu gross (max. 5 MB)");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      toast.error("Excel-Dateien werden nicht direkt unterstuetzt. Bitte als CSV speichern (Datei > Speichern unter > CSV UTF-8).");
      return;
    }
    if (ext !== "csv") {
      toast.error("Nur CSV-Dateien werden unterstuetzt.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);

      if (parsed.headers.length === 0) {
        toast.error("CSV-Datei ist leer oder konnte nicht geparst werden.");
        return;
      }

      setCsvData(parsed);
      setFileName(file.name);
      setMapping(autoDetectMappings(parsed.headers));
      toast.success(`${parsed.rows.length} Zeilen erkannt`);
    };
    reader.onerror = () => toast.error("Fehler beim Lesen der Datei.");
    reader.readAsText(file, "utf-8");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // --- Step 2 -> 3: Build preview with matching ---
  const buildPreview = useCallback(async () => {
    if (!csvData || !mapping.artikelnummer) return;

    setLoading(true);
    try {
      const artNrIdx = csvData.headers.indexOf(mapping.artikelnummer);
      const lpIdx = mapping.listenpreis ? csvData.headers.indexOf(mapping.listenpreis) : -1;
      const ekLgIdx = mapping.ek_lichtengros ? csvData.headers.indexOf(mapping.ek_lichtengros) : -1;
      const ekEkIdx = mapping.ek_eisenkeil ? csvData.headers.indexOf(mapping.ek_eisenkeil) : -1;
      const datIdx = mapping.gueltig_ab ? csvData.headers.indexOf(mapping.gueltig_ab) : -1;

      // Extract artikelnummern
      const artikelnummern = csvData.rows
        .map((row) => row[artNrIdx]?.trim())
        .filter(Boolean);

      // Match against database
      const { matches, error } = await matchArtikelnummern(artikelnummern);
      if (error) {
        toast.error(error);
        setLoading(false);
        return;
      }

      const rows: PreviewRow[] = csvData.rows
        .filter((row) => row[artNrIdx]?.trim())
        .map((row) => {
          const artNr = row[artNrIdx].trim();
          const listenpreis = lpIdx >= 0 ? parseGermanNumber(row[lpIdx] ?? "") : null;
          const ek_lichtengros = ekLgIdx >= 0 ? parseGermanNumber(row[ekLgIdx] ?? "") : null;
          const ek_eisenkeil = ekEkIdx >= 0 ? parseGermanNumber(row[ekEkIdx] ?? "") : null;
          const gueltig_ab = datIdx >= 0 ? parseDate(row[datIdx] ?? "") : null;
          const match = matches[artNr] ?? null;

          let status: PreviewRow["status"] = "not_found";
          if (match?.produktId) {
            const hasChange =
              (listenpreis != null && listenpreis !== match.alterListenpreis) ||
              (ek_lichtengros != null && ek_lichtengros !== match.alterEkLg) ||
              (ek_eisenkeil != null && ek_eisenkeil !== match.alterEkEk);
            status = hasChange ? "found" : "unchanged";
          }

          return { artikelnummer: artNr, listenpreis, ek_lichtengros, ek_eisenkeil, gueltig_ab, match, status };
        });

      setPreviewRows(rows);
      setStep(3);
    } catch {
      toast.error("Fehler beim Abgleich der Artikelnummern.");
    } finally {
      setLoading(false);
    }
  }, [csvData, mapping]);

  // --- Step 3: Execute import ---
  const executeImport = useCallback(async () => {
    const importable = previewRows.filter((r) => r.status === "found" || r.status === "unchanged");
    if (importable.length === 0) {
      toast.error("Keine importierbaren Zeilen vorhanden.");
      return;
    }

    setImporting(true);
    try {
      const rows: ImportPreiseRow[] = importable.map((r) => ({
        artikelnummer: r.artikelnummer,
        listenpreis: r.listenpreis,
        ek_lichtengros: r.ek_lichtengros,
        ek_eisenkeil: r.ek_eisenkeil,
        gueltig_ab: r.gueltig_ab,
      }));

      const result = await importPreise({ rows, deactivateOld });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.imported} Preise erfolgreich importiert.`);
        if (result.notFound.length > 0) {
          toast.warning(`${result.notFound.length} Artikelnummern nicht gefunden.`);
        }
        router.push("/produkte?toast=success&message=Preis-Import+abgeschlossen");
      }
    } catch {
      toast.error("Fehler beim Import.");
    } finally {
      setImporting(false);
    }
  }, [previewRows, deactivateOld, router]);

  // --- Counts ---
  const foundCount = previewRows.filter((r) => r.status === "found").length;
  const unchangedCount = previewRows.filter((r) => r.status === "unchanged").length;
  const notFoundCount = previewRows.filter((r) => r.status === "not_found").length;

  const formatPrice = (n: number | null) => (n != null ? `${n.toFixed(2)} EUR` : "-");

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === s.number
                  ? "bg-primary text-primary-foreground"
                  : step > s.number
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.number ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                  {s.number}
                </span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: File Upload */}
      {step === 1 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSV-Datei hochladen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => document.getElementById("csv-file-input")?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">
                CSV-Datei hierher ziehen oder klicken
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Nur .csv Dateien (max. 5 MB)
              </p>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                Hinweis zu Excel-Dateien
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                Excel-Dateien (.xlsx, .xls) werden nicht direkt unterstuetzt.
                Bitte zuerst als CSV speichern: <strong>Datei &gt; Speichern unter &gt; CSV UTF-8 (durch Trennzeichen getrennt)</strong>
              </p>
            </div>

            {/* Preview of parsed CSV */}
            {csvData && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{fileName}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {csvData.rows.length} Zeilen, {csvData.headers.length} Spalten
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvData.headers.map((h, i) => (
                          <TableHead key={i} className="whitespace-nowrap text-xs">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.rows.slice(0, 5).map((row, ri) => (
                        <TableRow key={ri}>
                          {row.map((cell, ci) => (
                            <TableCell key={ci} className="whitespace-nowrap text-sm">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {csvData.rows.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... und {csvData.rows.length - 5} weitere Zeilen
                  </p>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} size="lg">
                    Weiter <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && csvData && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Spalten zuordnen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELD_OPTIONS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Select
                    value={mapping[field.key] ?? "__none__"}
                    onValueChange={(val) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: val === "__none__" ? null : val,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nicht zugeordnet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Nicht zugeordnet --</SelectItem>
                      {csvData.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Mapped preview */}
            {mapping.artikelnummer && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Vorschau mit Zuordnung
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Artikelnummer</TableHead>
                        {mapping.listenpreis && <TableHead className="text-xs">Listenpreis</TableHead>}
                        {mapping.ek_lichtengros && <TableHead className="text-xs">EK Lichtengros</TableHead>}
                        {mapping.ek_eisenkeil && <TableHead className="text-xs">EK Eisenkeil</TableHead>}
                        {mapping.gueltig_ab && <TableHead className="text-xs">Gueltig ab</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.rows.slice(0, 5).map((row, ri) => {
                        const artIdx = csvData.headers.indexOf(mapping.artikelnummer!);
                        const lpIdx = mapping.listenpreis ? csvData.headers.indexOf(mapping.listenpreis) : -1;
                        const ekLgIdx = mapping.ek_lichtengros ? csvData.headers.indexOf(mapping.ek_lichtengros) : -1;
                        const ekEkIdx = mapping.ek_eisenkeil ? csvData.headers.indexOf(mapping.ek_eisenkeil) : -1;
                        const datIdx = mapping.gueltig_ab ? csvData.headers.indexOf(mapping.gueltig_ab) : -1;

                        return (
                          <TableRow key={ri}>
                            <TableCell className="font-mono text-sm">{row[artIdx]}</TableCell>
                            {lpIdx >= 0 && (
                              <TableCell className="text-sm">
                                {parseGermanNumber(row[lpIdx] ?? "")?.toFixed(2) ?? "-"}
                              </TableCell>
                            )}
                            {ekLgIdx >= 0 && (
                              <TableCell className="text-sm">
                                {parseGermanNumber(row[ekLgIdx] ?? "")?.toFixed(2) ?? "-"}
                              </TableCell>
                            )}
                            {ekEkIdx >= 0 && (
                              <TableCell className="text-sm">
                                {parseGermanNumber(row[ekEkIdx] ?? "")?.toFixed(2) ?? "-"}
                              </TableCell>
                            )}
                            {datIdx >= 0 && (
                              <TableCell className="text-sm">
                                {parseDate(row[datIdx] ?? "") ?? row[datIdx]}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurueck
              </Button>
              <Button
                onClick={buildPreview}
                disabled={!mapping.artikelnummer || loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abgleich laeuft...
                  </>
                ) : (
                  <>
                    Weiter <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview + Import */}
      {step === 3 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Import-Vorschau</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{foundCount}</p>
                <p className="text-sm text-green-600 dark:text-green-500">Preise werden aktualisiert</p>
              </div>
              <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{unchangedCount}</p>
                <p className="text-sm text-amber-600 dark:text-amber-500">Keine Preisaenderung</p>
              </div>
              <div className="rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{notFoundCount}</p>
                <p className="text-sm text-red-600 dark:text-red-500">Nicht gefunden</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Abdeckung</span>
                <span>
                  {previewRows.length > 0
                    ? Math.round(((foundCount + unchangedCount) / previewRows.length) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  previewRows.length > 0
                    ? ((foundCount + unchangedCount) / previewRows.length) * 100
                    : 0
                }
                className="h-2"
              />
            </div>

            {/* Detail table */}
            <div className="overflow-x-auto rounded-lg border max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky top-0 bg-background">Status</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Artikelnummer</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Produktname</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Listenpreis</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">EK LG</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">EK EK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={
                        row.status === "found"
                          ? "bg-green-50/50 dark:bg-green-950/20"
                          : row.status === "unchanged"
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : "bg-red-50/50 dark:bg-red-950/20"
                      }
                    >
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "found"
                              ? "default"
                              : row.status === "unchanged"
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-xs"
                        >
                          {row.status === "found"
                            ? "Aktualisierung"
                            : row.status === "unchanged"
                              ? "Keine Aenderung"
                              : "Nicht gefunden"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.artikelnummer}</TableCell>
                      <TableCell className="text-sm">
                        {row.match?.produktName ?? (
                          <span className="text-muted-foreground italic">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.match?.produktId ? (
                          <span>
                            <span className="text-muted-foreground line-through mr-1">
                              {formatPrice(row.match.alterListenpreis)}
                            </span>
                            {row.listenpreis != null && (
                              <span className="font-medium">{formatPrice(row.listenpreis)}</span>
                            )}
                          </span>
                        ) : (
                          formatPrice(row.listenpreis)
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.match?.produktId ? (
                          <span>
                            <span className="text-muted-foreground line-through mr-1">
                              {formatPrice(row.match.alterEkLg)}
                            </span>
                            {row.ek_lichtengros != null && (
                              <span className="font-medium">{formatPrice(row.ek_lichtengros)}</span>
                            )}
                          </span>
                        ) : (
                          formatPrice(row.ek_lichtengros)
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.match?.produktId ? (
                          <span>
                            <span className="text-muted-foreground line-through mr-1">
                              {formatPrice(row.match.alterEkEk)}
                            </span>
                            {row.ek_eisenkeil != null && (
                              <span className="font-medium">{formatPrice(row.ek_eisenkeil)}</span>
                            )}
                          </span>
                        ) : (
                          formatPrice(row.ek_eisenkeil)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Options */}
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50 border">
              <Checkbox
                id="deactivate-old"
                checked={deactivateOld}
                onCheckedChange={(checked) => setDeactivateOld(checked === true)}
              />
              <Label htmlFor="deactivate-old" className="text-sm cursor-pointer">
                Alte Preise auf &quot;inaktiv&quot; setzen
              </Label>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurueck
              </Button>
              <Button
                onClick={executeImport}
                disabled={importing || (foundCount + unchangedCount) === 0}
                size="lg"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importiere...
                  </>
                ) : (
                  <>
                    Import starten ({foundCount + unchangedCount} Preise)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
