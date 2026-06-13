"use client";

// PROJ-8: USt-VA-Hauptansicht.
// Perioden-Auswahl (gemäß Profil-Rhythmus) + Jahresübersicht,
// Kennzahl-Tabelle (ELSTER-Feldnr.), Drill-down je Kennzahl,
// Warnpanel und "Periode als geprüft abschließen".

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { UstStatus } from "@/lib/types";
import type { UstRhythmus } from "@/lib/tax/perioden";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KennzahlDrilldown } from "./kennzahl-drilldown";
import {
  formatEuro,
  type KennzahlZeileDTO,
  type UstApiResponse,
} from "./typen";

const STATUS_LABEL: Record<UstApiResponse["status"], string> = {
  offen: "Offen",
  geprueft: "Geprüft",
  abgeschlossen: "Abgeschlossen",
};
const STATUS_VARIANT: Record<
  UstApiResponse["status"],
  "default" | "secondary" | "outline"
> = {
  offen: "outline",
  geprueft: "secondary",
  abgeschlossen: "default",
};

export function UstvaAnsicht({
  rhythmus,
  ustStatus,
  jahr,
  perioden,
}: {
  rhythmus: UstRhythmus;
  ustStatus: UstStatus;
  jahr: number;
  perioden: Array<{ periode: number; label: string }>;
}) {
  const [periode, setPeriode] = useState<number>(perioden[0]?.periode ?? 0);
  const [daten, setDaten] = useState<UstApiResponse | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [abschliessen, setAbschliessen] = useState(false);
  const [drillZeile, setDrillZeile] = useState<KennzahlZeileDTO | null>(null);
  const [drillOffen, setDrillOffen] = useState(false);

  const laden_ = useCallback(async () => {
    setLaden(true);
    setFehler(null);
    try {
      const res = await fetch(
        `/api/steuer/ust?jahr=${jahr}&periode=${periode}`,
        { method: "GET" },
      );
      const json = await res.json();
      if (!res.ok) {
        setFehler(json.error ?? "Berechnung fehlgeschlagen.");
        setDaten(null);
        return;
      }
      setDaten(json as UstApiResponse);
    } catch {
      setFehler("Netzwerkfehler beim Laden der Berechnung.");
      setDaten(null);
    } finally {
      setLaden(false);
    }
  }, [jahr, periode]);

  useEffect(() => {
    void laden_();
  }, [laden_]);

  async function periodeAbschliessen() {
    setAbschliessen(true);
    try {
      const res = await fetch("/api/steuer/ust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jahr, periode }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Abschluss fehlgeschlagen.");
        return;
      }
      toast.success("Periode abgeschlossen. Der Snapshot ist eingefroren.");
      await laden_();
    } catch {
      toast.error("Netzwerkfehler beim Abschluss.");
    } finally {
      setAbschliessen(false);
    }
  }

  function oeffneDrilldown(z: KennzahlZeileDTO) {
    setDrillZeile(z);
    setDrillOffen(true);
  }

  const istAbgeschlossen = daten?.status === "abgeschlossen";
  const b = daten?.berechnung ?? null;
  const w = daten?.warnungen ?? null;
  const warnSumme = w
    ? w.offene_pruefung +
      w.unklassifiziert +
      w.geschaeft_ohne_beleg +
      w.datum_unklar +
      w.ohne_ust_satz
    : 0;

  return (
    <div className="space-y-6">
      {/* Perioden-Auswahl */}
      <Card>
        <CardHeader>
          <CardTitle>Voranmeldungszeitraum {jahr}</CardTitle>
          <CardDescription>
            Rhythmus laut Steuerprofil:{" "}
            {rhythmus === "monatlich"
              ? "monatlich"
              : rhythmus === "quartalsweise"
                ? "quartalsweise"
                : "jährlich"}
            {ustStatus === "kleinunternehmer"
              ? " · Kleinunternehmer (§ 19 UStG)"
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs space-y-2">
              <label
                htmlFor="periode"
                className="text-sm text-muted-foreground"
              >
                Periode
              </label>
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
            {daten && (
              <Badge variant={STATUS_VARIANT[daten.status]}>
                {STATUS_LABEL[daten.status]}
              </Badge>
            )}
          </div>

          {/* Jahresübersicht: schnelle Periodenwahl */}
          <div className="flex flex-wrap gap-2">
            {perioden.map((p) => (
              <Button
                key={p.periode}
                size="sm"
                variant={p.periode === periode ? "default" : "outline"}
                onClick={() => setPeriode(p.periode)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {fehler && (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      {daten?.berichtigungshinweis && (
        <Alert>
          <AlertTitle>Berichtigungsbedarf</AlertTitle>
          <AlertDescription>{daten.berichtigungshinweis}</AlertDescription>
        </Alert>
      )}

      {b?.kleinunternehmer && b.hinweis && (
        <Alert>
          <AlertTitle>Kleinunternehmer-Nullmeldung</AlertTitle>
          <AlertDescription>{b.hinweis}</AlertDescription>
        </Alert>
      )}

      {/* Warnpanel */}
      {w && warnSumme > 0 && (
        <Alert variant="destructive">
          <AlertTitle>
            Hinweise vor Abschluss ({warnSumme} Punkt(e))
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {w.offene_pruefung > 0 && (
                <li>{w.offene_pruefung} offene(r) Prüffall/Prüffälle</li>
              )}
              {w.unklassifiziert > 0 && (
                <li>{w.unklassifiziert} unklassifizierte Buchung(en)</li>
              )}
              {w.geschaeft_ohne_beleg > 0 && (
                <li>
                  {w.geschaeft_ohne_beleg} steuerrelevante
                  Geschäftsbuchung(en) ohne Beleg
                </li>
              )}
              {w.datum_unklar > 0 && (
                <li>
                  {w.datum_unklar} Buchung(en) mit unklarem Datum
                  (ausgeschlossen)
                </li>
              )}
              {w.ohne_ust_satz > 0 && (
                <li>
                  {w.ohne_ust_satz} Buchung(en) ohne USt-Satz
                  (ausgeschlossen)
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Kennzahl-Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>
            Kennzahlen {daten ? `· ${daten.periode_label}` : ""}
          </CardTitle>
          <CardDescription>
            ELSTER-USt-VA-Feldnummern. Klicke eine Zeile für die einbezogenen
            Buchungen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {laden ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !b ? (
            <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Keine Berechnung verfügbar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kz</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead className="text-right">Bemessung</TableHead>
                    <TableHead className="text-right">Steuer</TableHead>
                    <TableHead className="text-right">Buchungen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {b.zeilen.map((z) => {
                    const istVorsteuer = z.schluessel === "vorsteuer";
                    const zeigeAufteilung =
                      istVorsteuer &&
                      !b.kleinunternehmer &&
                      (b.summe.vorsteuer_mit_beleg > 0 ||
                        b.summe.vorsteuer_ohne_beleg > 0);
                    return (
                      <Fragment key={z.schluessel}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => oeffneDrilldown(z)}
                        >
                          <TableCell className="font-mono text-sm">
                            {z.kennzahl}
                          </TableCell>
                          <TableCell className="text-sm">
                            {z.bezeichnung}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEuro(z.betrag)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {z.steuer === null ? "—" : formatEuro(z.steuer)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {z.buchung_ids.length}
                          </TableCell>
                        </TableRow>
                        {zeigeAufteilung && (
                          <>
                            <TableRow className="border-t-0 text-muted-foreground hover:bg-transparent">
                              <TableCell />
                              <TableCell className="text-xs pl-6">
                                davon mit Beleg
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs">
                                {formatEuro(b.summe.vorsteuer_mit_beleg)}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                            </TableRow>
                            <TableRow className="border-t-0 text-muted-foreground hover:bg-transparent">
                              <TableCell />
                              <TableCell className="text-xs pl-6">
                                davon noch ohne Beleg
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs">
                                {formatEuro(b.summe.vorsteuer_ohne_beleg)}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                            </TableRow>
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <SummenKachel
                  label="Umsatz (netto)"
                  wert={formatEuro(b.summe.umsatz_netto)}
                />
                <SummenKachel
                  label="Umsatzsteuer"
                  wert={formatEuro(b.summe.umsatzsteuer)}
                />
                <SummenKachel
                  label="Vorsteuer"
                  wert={formatEuro(b.summe.vorsteuer_abziehbar)}
                />
                <SummenKachel
                  label={b.summe.zahllast >= 0 ? "Zahllast" : "Erstattung"}
                  wert={formatEuro(Math.abs(b.summe.zahllast))}
                  hervorgehoben
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abschluss */}
      {b && !laden && (
        <Card>
          <CardHeader>
            <CardTitle>Periode abschließen</CardTitle>
            <CardDescription>
              Beim Abschluss werden die Zahlen als unveränderlicher Snapshot
              eingefroren. Spätere Buchungen führen nur zu einem
              Berichtigungshinweis, nie zum stillen Überschreiben.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {istAbgeschlossen ? (
              <Alert>
                <AlertTitle>Bereits abgeschlossen</AlertTitle>
                <AlertDescription>
                  Diese Periode wurde geprüft und abgeschlossen
                  {daten?.abgeschlossen_at
                    ? ` (${new Date(
                        daten.abgeschlossen_at,
                      ).toLocaleString("de-DE")})`
                    : ""}
                  . Die angezeigten Zahlen stammen aus dem eingefrorenen
                  Snapshot.
                </AlertDescription>
              </Alert>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={abschliessen}>
                    {abschliessen && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Periode als geprüft abschließen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {daten?.periode_label} abschließen?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Die aktuellen Zahlen werden als unveränderlicher
                      Snapshot gespeichert. Eine Korrektur ist danach nur
                      über eine Berichtigung möglich.
                      {warnSumme > 0
                        ? ` Es bestehen noch ${warnSumme} offene(r) Hinweis(e).`
                        : ""}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={periodeAbschliessen}>
                      Abschließen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      )}

      <KennzahlDrilldown
        zeile={drillZeile}
        details={daten?.buchung_details ?? {}}
        open={drillOffen}
        onOpenChange={setDrillOffen}
      />
    </div>
  );
}

function SummenKachel({
  label,
  wert,
  hervorgehoben,
}: {
  label: string;
  wert: string;
  hervorgehoben?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        hervorgehoben ? "bg-muted" : ""
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{wert}</div>
    </div>
  );
}
