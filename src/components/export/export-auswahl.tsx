"use client";

// PROJ-11: Interaktive Export-Auswahl.
//
// Wählt Typ (EÜR / USt-VA / Privatentnahmen / Buchungsexport / ELSTER),
// Jahr bzw. Periode und Format. Zeigt eine deutliche „vorläufig"-Warnung,
// solange die gewählte Periode/Jahr nicht abgeschlossen ist, prüft das per
// Status-Abfrage und startet die serverseitige Erzeugung mit Download.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { UstRhythmus } from "@/lib/tax/perioden";
import {
  erlaubteFormate,
  type ExportFormat,
  type ExportTyp,
} from "@/lib/validation/export";

interface TypInfo {
  id: ExportTyp;
  label: string;
  beschreibung: string;
  brauchtPeriode: boolean;
  privat?: boolean;
}

const TYPEN: TypInfo[] = [
  {
    id: "euer",
    label: "EÜR-Aufstellung (PDF)",
    beschreibung:
      "Einnahmenüberschussrechnung des Wirtschaftsjahres mit Firmenkopf.",
    brauchtPeriode: false,
  },
  {
    id: "ustva",
    label: "USt-Voranmeldung (PDF)",
    beschreibung:
      "USt-VA einer Periode inkl. ELSTER-Kennzahlen und Zusammenfassung.",
    brauchtPeriode: true,
  },
  {
    id: "privatentnahmen",
    label: "Privatentnahmen-Aufstellung (PDF)",
    beschreibung:
      "Dedizierter, getrennter Auszug aller privaten Posten des Jahres.",
    brauchtPeriode: false,
    privat: true,
  },
  {
    id: "buchungen",
    label: "Buchungsexport (CSV/DATEV-ähnlich)",
    beschreibung:
      "Alle betrieblichen Buchungssätze des Jahres für die Kanzleisoftware.",
    brauchtPeriode: false,
  },
  {
    id: "elster",
    label: "ELSTER-Kennzahlen (PDF/CSV)",
    beschreibung:
      "USt-VA-Kennzahlen je Feldnummer zum manuellen Übertragen in ELSTER.",
    brauchtPeriode: true,
  },
];

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
};

const RHY_LABEL: Record<UstRhythmus, string> = {
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  jaehrlich: "jährlich",
};

export function ExportAuswahl({
  jahre,
  rhythmus,
  periodenProJahr,
  jahrInitial,
}: {
  jahre: number[];
  rhythmus: UstRhythmus;
  periodenProJahr: Record<number, Array<{ periode: number; label: string }>>;
  /** PROJ-22: Vorauswahl (aktives Jahr). Default: jüngstes Jahr. */
  jahrInitial?: number;
}) {
  const [typId, setTypId] = useState<ExportTyp>("euer");
  const [jahr, setJahr] = useState<number>(
    jahrInitial ?? jahre[0] ?? new Date().getFullYear(),
  );
  const [periode, setPeriode] = useState<number>(0);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [laden, setLaden] = useState(false);
  const [statusLaden, setStatusLaden] = useState(false);
  const [abgeschlossen, setAbgeschlossen] = useState<boolean | null>(null);

  const typ = useMemo(
    () => TYPEN.find((t) => t.id === typId) ?? TYPEN[0],
    [typId],
  );
  const formate = erlaubteFormate(typId);
  const perioden = useMemo(
    () => periodenProJahr[jahr] ?? [],
    [periodenProJahr, jahr],
  );

  // Format auf einen für den Typ erlaubten Wert zwingen.
  useEffect(() => {
    if (!formate.includes(format)) setFormat(formate[0]);
  }, [formate, format]);

  // Periode auf eine im Jahr gültige Periode zwingen.
  useEffect(() => {
    if (perioden.length > 0 && !perioden.some((p) => p.periode === periode)) {
      setPeriode(perioden[0].periode);
    }
  }, [perioden, periode]);

  // Abschluss-Status der gewählten Periode/Jahr prüfen (für die Warnung).
  const pruefeStatus = useCallback(async () => {
    setAbgeschlossen(null);
    if (typId === "privatentnahmen" || typId === "buchungen") {
      // Diese Exporte sind nie „abgeschlossen-gebunden".
      return;
    }
    setStatusLaden(true);
    try {
      const art = typ.brauchtPeriode ? "ust_va" : "wirtschaftsjahr";
      const qs = new URLSearchParams({
        art,
        jahr: String(jahr),
      });
      if (typ.brauchtPeriode) qs.set("periode", String(periode));
      const res = await fetch(`/api/export/status?${qs.toString()}`);
      if (!res.ok) {
        setAbgeschlossen(false);
        return;
      }
      const json = (await res.json()) as { abgeschlossen: boolean };
      setAbgeschlossen(Boolean(json.abgeschlossen));
    } catch {
      setAbgeschlossen(false);
    } finally {
      setStatusLaden(false);
    }
  }, [typId, typ.brauchtPeriode, jahr, periode]);

  useEffect(() => {
    void pruefeStatus();
  }, [pruefeStatus]);

  async function erzeugen() {
    setLaden(true);
    try {
      const body: Record<string, unknown> = { typ: typId, format, jahr };
      if (typ.brauchtPeriode) body.periode = periode;
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = "Export fehlgeschlagen.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* nicht-JSON Fehler */
        }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = cd.match(/filename="([^"]+)"/);
      const name = m ? m[1] : "export";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export erstellt und heruntergeladen.");
    } catch {
      toast.error("Netzwerkfehler beim Export.");
    } finally {
      setLaden(false);
    }
  }

  const zeigeVorlaeufig =
    typ.brauchtPeriode || typId === "euer"
      ? abgeschlossen === false
      : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export-Typ</CardTitle>
          <CardDescription>
            Wähle, was exportiert werden soll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={typId}
            onValueChange={(v) => setTypId(v as ExportTyp)}
            className="grid gap-3 sm:grid-cols-2"
          >
            {TYPEN.map((t) => (
              <label
                key={t.id}
                htmlFor={`typ-${t.id}`}
                className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${
                  typId === t.id ? "border-primary bg-muted/50" : ""
                }`}
              >
                <RadioGroupItem
                  id={`typ-${t.id}`}
                  value={t.id}
                  className="mt-0.5"
                />
                <span>
                  <span className="flex items-center gap-2 font-medium">
                    {t.label}
                    {t.privat ? (
                      <Badge variant="secondary">privat</Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {t.beschreibung}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zeitraum &amp; Format</CardTitle>
          <CardDescription>
            USt-VA/ELSTER nutzen Perioden (Rhythmus laut Steuerprofil:{" "}
            {RHY_LABEL[rhythmus]}), übrige Exporte das Wirtschaftsjahr.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-[12rem] space-y-2">
              <Label htmlFor="jahr">Jahr</Label>
              <Select
                value={String(jahr)}
                onValueChange={(v) => setJahr(Number(v))}
              >
                <SelectTrigger id="jahr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jahre.map((j) => (
                    <SelectItem key={j} value={String(j)}>
                      {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {typ.brauchtPeriode && (
              <div className="w-full max-w-[14rem] space-y-2">
                <Label htmlFor="periode">Periode</Label>
                <Select
                  value={String(periode)}
                  onValueChange={(v) => setPeriode(Number(v))}
                >
                  <SelectTrigger id="periode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {perioden.map((p) => (
                      <SelectItem key={p.periode} value={String(p.periode)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as ExportFormat)}
              >
                <SelectTrigger id="format" className="w-[8rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formate.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {statusLaden && (
            <p className="text-sm text-muted-foreground">
              Abschluss-Status wird geprüft…
            </p>
          )}

          {zeigeVorlaeufig && (
            <Alert variant="destructive">
              <AlertTitle>Vorläufiger Export</AlertTitle>
              <AlertDescription>
                {typ.brauchtPeriode
                  ? "Diese Periode"
                  : "Dieses Wirtschaftsjahr"}{" "}
                ist noch nicht abgeschlossen. Die Datei wird sichtbar als
                „vorläufig“ gekennzeichnet (Wasserzeichen) und ist nicht zur
                endgültigen Weitergabe/Einreichung bestimmt. Schließe die
                Periode/das Jahr ab, um einen stabilen Snapshot-Export zu
                erhalten.
              </AlertDescription>
            </Alert>
          )}

          {abgeschlossen === true && (
            <Alert>
              <AlertTitle>Abgeschlossen</AlertTitle>
              <AlertDescription>
                Der Export verwendet den unveränderlichen Snapshot — die
                Zahlen sind stabil und reproduzierbar.
              </AlertDescription>
            </Alert>
          )}

          {typ.privat && (
            <Alert>
              <AlertTitle>Privater Auszug</AlertTitle>
              <AlertDescription>
                Dieser Export enthält ausschließlich private Posten und ist
                getrennt von den betrieblichen Auswertungen zu behandeln.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={erzeugen} disabled={laden}>
              {laden ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export erzeugen &amp; herunterladen
            </Button>
            <span className="text-xs text-muted-foreground">
              {typ.label} · {jahr}
              {typ.brauchtPeriode
                ? ` · ${
                    perioden.find((p) => p.periode === periode)?.label ?? ""
                  }`
                : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
