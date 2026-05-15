"use client";

// PROJ-10: Einkommensteuer-Hauptansicht.
// Tab "ESt-Vorschau": Parameter-Formular (Jahr, Veranlagung, weitere
// Einkünfte, Vorauszahlungen) + geschätzte Steuer + Effektiv-/Grenzsatz +
// Soli + durchgängiger Disclaimer.
// Tab "Privatentnahmen": Liste aller privaten Buchungen, je Monat summiert,
// Drill-down auf Buchungsebene.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstDisclaimer } from "./est-disclaimer";
import {
  PrivatentnahmeDrilldown,
  type PrivatGruppe,
} from "./privatentnahme-drilldown";
import {
  formatDatum,
  formatEuro,
  formatProzent,
  type EstApiResponse,
  type PrivatEntnahmeZeile,
  type Veranlagung,
} from "./typen";

const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

interface MonatsGruppe {
  key: string;
  titel: string;
  summe: number;
  zeilen: PrivatEntnahmeZeile[];
}

/** Gruppiert die Privatentnahmen je Kalendermonat (für Zeitraum-Summen). */
function gruppiereProMonat(zeilen: PrivatEntnahmeZeile[]): MonatsGruppe[] {
  const map = new Map<string, MonatsGruppe>();
  for (const z of zeilen) {
    const key = z.buchung_datum.slice(0, 7); // yyyy-mm
    const [j, m] = key.split("-");
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        titel: `${MONATE[Number(m) - 1] ?? m} ${j}`,
        summe: 0,
        zeilen: [],
      };
      map.set(key, g);
    }
    g.summe += z.betrag;
    g.zeilen.push(z);
  }
  return [...map.values()]
    .map((g) => ({ ...g, summe: Math.round(g.summe * 100) / 100 }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function EstAnsicht({
  jahre,
  jahrInitial,
}: {
  jahre: number[];
  jahrInitial: number;
}) {
  const [jahr, setJahr] = useState<number>(jahrInitial);
  const [veranlagung, setVeranlagung] = useState<Veranlagung>("einzel");
  const [weitere, setWeitere] = useState<string>("0");
  const [voraus, setVoraus] = useState<string>("0");

  const [daten, setDaten] = useState<EstApiResponse | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const [drill, setDrill] = useState<PrivatGruppe | null>(null);
  const [drillOffen, setDrillOffen] = useState(false);

  const laden = useCallback(
    async (
      j: number,
      v: Veranlagung,
      we: string,
      vz: string,
    ) => {
      setLaedt(true);
      setFehler(null);
      try {
        const qs = new URLSearchParams({
          jahr: String(j),
          veranlagung: v,
          weitere_einkuenfte: String(Number(we) || 0),
          vorauszahlungen: String(Number(vz) || 0),
        });
        const res = await fetch(`/api/steuer/est?${qs.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          setFehler(
            json.error ?? "ESt-Vorschau konnte nicht geladen werden.",
          );
          setDaten(null);
          return;
        }
        setDaten(json as EstApiResponse);
      } catch {
        setFehler("Netzwerkfehler beim Laden der ESt-Vorschau.");
        setDaten(null);
      } finally {
        setLaedt(false);
      }
    },
    [],
  );

  // Initiales Laden + bei Jahr-/Veranlagungswechsel automatisch neu rechnen.
  useEffect(() => {
    void laden(jahr, veranlagung, weitere, voraus);
    // weitere/voraus werden manuell per Button neu berechnet, daher nicht
    // in der Dependency-Liste (sonst Rechnung bei jedem Tastendruck).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jahr, veranlagung, laden]);

  function neuBerechnen() {
    void laden(jahr, veranlagung, weitere, voraus);
  }

  function oeffneDrill(g: MonatsGruppe) {
    setDrill({ titel: g.titel, summe: g.summe, zeilen: g.zeilen });
    setDrillOffen(true);
  }

  const s = daten?.schaetzung;
  const monatsGruppen = daten
    ? gruppiereProMonat(daten.privatentnahmen.zeilen)
    : [];

  return (
    <div className="space-y-6">
      {/* Disclaimer immer ganz oben sichtbar (beide Tabs). */}
      <EstDisclaimer text={daten?.disclaimer} />

      {/* Jahr-Auswahl + Status */}
      <Card>
        <CardHeader>
          <CardTitle>Veranlagungszeitraum</CardTitle>
          <CardDescription>
            {daten
              ? `Zeitraum: ${formatDatum(daten.zeitraum.von)} – ${formatDatum(
                  daten.zeitraum.bis,
                )}.`
              : "Wähle das Steuerjahr für die Auswertung."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-[220px] space-y-2">
              <label htmlFor="est-jahr" className="text-sm font-medium">
                Steuerjahr
              </label>
              <Select
                value={String(jahr)}
                onValueChange={(v) => setJahr(Number(v))}
              >
                <SelectTrigger id="est-jahr">
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
            <div className="flex items-center gap-3">
              {daten?.abgeschlossen ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  EÜR abgeschlossen
                </Badge>
              ) : (
                <Badge variant="outline">EÜR vorläufig</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {fehler ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="vorschau">
        <TabsList>
          <TabsTrigger value="vorschau">ESt-Vorschau</TabsTrigger>
          <TabsTrigger value="privat">Privatentnahmen</TabsTrigger>
        </TabsList>

        {/* ---------------- Tab: ESt-Vorschau ---------------- */}
        <TabsContent value="vorschau" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parameter</CardTitle>
              <CardDescription>
                Eckdaten für eine realistischere Schätzung. Basis ist der
                EÜR-Gewinn des gewählten Jahres.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label
                    htmlFor="est-veranlagung"
                    className="text-sm font-medium"
                  >
                    Veranlagungsart
                  </label>
                  <Select
                    value={veranlagung}
                    onValueChange={(v) =>
                      setVeranlagung(v as Veranlagung)
                    }
                  >
                    <SelectTrigger id="est-veranlagung">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="einzel">
                        Einzelveranlagung
                      </SelectItem>
                      <SelectItem value="zusammen">
                        Zusammenveranlagung (Splitting)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="est-weitere"
                    className="text-sm font-medium"
                  >
                    Weitere Einkünfte (€)
                  </label>
                  <Input
                    id="est-weitere"
                    type="number"
                    inputMode="decimal"
                    value={weitere}
                    onChange={(e) => setWeitere(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="est-voraus"
                    className="text-sm font-medium"
                  >
                    Vorauszahlungen (€)
                  </label>
                  <Input
                    id="est-voraus"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={voraus}
                    onChange={(e) => setVoraus(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={neuBerechnen}
                    disabled={laedt}
                    className="w-full"
                  >
                    {laedt ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Schätzung berechnen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {laedt ? (
            <Card>
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ) : null}

          {!laedt && s ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kennzahl
                  label="EÜR-Gewinn (Basis)"
                  wert={formatEuro(daten?.euer_gewinn ?? 0)}
                />
                <Kennzahl
                  label="Zu versteuerndes Einkommen"
                  wert={formatEuro(s.zu_versteuerndes_einkommen)}
                  hinweis={`Bemessung (abgerundet): ${formatEuro(
                    s.bemessungsgrundlage,
                  )}`}
                />
                <Kennzahl
                  label="Geschätzte Einkommensteuer"
                  wert={formatEuro(s.einkommensteuer)}
                  betont
                />
                <Kennzahl
                  label="Solidaritätszuschlag"
                  wert={formatEuro(s.soli)}
                />
                <Kennzahl
                  label="Gesamtbelastung"
                  wert={formatEuro(s.gesamtbelastung)}
                  betont
                />
                <Kennzahl
                  label="Effektiver Steuersatz"
                  wert={formatProzent(s.effektiver_steuersatz)}
                />
                <Kennzahl
                  label="Grenzsteuersatz"
                  wert={formatProzent(s.grenzsteuersatz)}
                />
                <Kennzahl
                  label={
                    s.abschlusszahlung >= 0
                      ? "Voraussichtl. Nachzahlung"
                      : "Voraussichtl. Erstattung"
                  }
                  wert={formatEuro(Math.abs(s.abschlusszahlung))}
                  hinweis={`Vorauszahlungen: ${formatEuro(
                    s.vorauszahlungen,
                  )}`}
                />
              </div>

              {!s.tarif_aus_db ? (
                <Alert variant="destructive">
                  <AlertTitle>Tarif-Hinweis</AlertTitle>
                  <AlertDescription>
                    Für {jahr} ist kein gepflegter ESt-Tarif hinterlegt –
                    es wird der zuletzt bekannte Standardtarif verwendet.
                  </AlertDescription>
                </Alert>
              ) : null}

              {s.hinweise.length > 0 ? (
                <Alert>
                  <AlertTitle>Hinweise</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {s.hinweise.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}
        </TabsContent>

        {/* ---------------- Tab: Privatentnahmen ---------------- */}
        <TabsContent value="privat" className="space-y-6">
          {laedt ? (
            <Card>
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ) : null}

          {!laedt && daten ? (
            <Card>
              <CardHeader>
                <CardTitle>Privatentnahmen {daten.jahr}</CardTitle>
                <CardDescription>
                  Alle als <strong>privat</strong> klassifizierten Buchungen
                  des Zeitraums – aus der betrieblichen EÜR ausgeschlossen.
                  Bei aufgeteilten Buchungen wird nur der Privatanteil
                  berücksichtigt. Klicke einen Monat für den Drill-down.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {daten.privatentnahmen.anzahl === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Keine privaten Buchungen in diesem Zeitraum erfasst.
                  </p>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {daten.privatentnahmen.anzahl} Buchung(en)
                      </Badge>
                      <span className="text-sm">
                        Gesamtsumme:{" "}
                        <strong>
                          {formatEuro(daten.privatentnahmen.summe)}
                        </strong>
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zeitraum (Monat)</TableHead>
                          <TableHead className="text-right">
                            Buchungen
                          </TableHead>
                          <TableHead className="text-right">
                            Summe
                          </TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monatsGruppen.map((g) => (
                          <TableRow key={g.key}>
                            <TableCell className="font-medium">
                              {g.titel}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {g.zeilen.length}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatEuro(g.summe)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => oeffneDrill(g)}
                              >
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      <PrivatentnahmeDrilldown
        gruppe={drill}
        open={drillOffen}
        onOpenChange={setDrillOffen}
      />
    </div>
  );
}

function Kennzahl({
  label,
  wert,
  hinweis,
  betont,
}: {
  label: string;
  wert: string;
  hinweis?: string;
  betont?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">
          {label}
        </div>
        <div
          className={
            betont
              ? "text-2xl font-semibold tabular-nums"
              : "text-xl tabular-nums"
          }
        >
          {wert}
        </div>
        {hinweis ? (
          <div className="text-xs text-muted-foreground">{hinweis}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
