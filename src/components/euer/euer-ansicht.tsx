"use client";

// PROJ-9: Jahres-EÜR-Hauptansicht.
// Wirtschaftsjahr-Auswahl, EÜR-Aufstellung (Anlage-EÜR-Struktur),
// Drill-down-Sheet, Warnpanel, "Jahr abschließen" (mit Bestätigung).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EuerTabelle } from "@/components/euer/euer-tabelle";
import {
  EuerDrilldownSheet,
  type DrilldownGruppe,
} from "@/components/euer/euer-drilldown-sheet";

interface BuchungsZeile {
  id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
}

interface KategorieGruppe {
  kategorie_id: string;
  bezeichnung: string;
  typ: "einnahme" | "ausgabe";
  euer_zeile: string | null;
  summe: number;
  anzahl: number;
  buchungen: BuchungsZeile[];
}

interface EuerErgebnis {
  jahr: number;
  zeitraum: { von: string; bis: string };
  betriebseinnahmen: KategorieGruppe[];
  betriebsausgaben: KategorieGruppe[];
  summe_einnahmen: number;
  summe_ausgaben: number;
  gewinn: number;
  ohne_kategorie: {
    anzahl: number;
    summe_einnahmen: number;
    summe_ausgaben: number;
  };
}

interface Warnungen {
  offene_pruefaelle: { anzahl: number; summe: number };
  unklassifiziert: { anzahl: number; summe: number };
  ohne_beleg: { anzahl: number; summe: number };
  ohne_kategorie: {
    anzahl: number;
    summe_einnahmen: number;
    summe_ausgaben: number;
  };
}

interface EuerAntwort {
  jahr: number;
  abgeschlossen: boolean;
  abgeschlossen_at: string | null;
  ergebnis: EuerErgebnis;
  warnungen: Warnungen;
  berichtigung_noetig: boolean;
  hinweis?: string;
}

function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function EuerAnsicht({
  jahre,
  jahrInitial,
  wjBeginn,
}: {
  jahre: number[];
  jahrInitial: number;
  wjBeginn: number;
}) {
  const [jahr, setJahr] = useState<number>(jahrInitial);
  const [daten, setDaten] = useState<EuerAntwort | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [abschlussLaeuft, setAbschlussLaeuft] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownGruppe | null>(null);
  const [drilldownOffen, setDrilldownOffen] = useState(false);

  const laden = useCallback(async (j: number) => {
    setLaedt(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/steuer/euer?jahr=${j}`);
      const json = await res.json();
      if (!res.ok) {
        setFehler(json.error ?? "EÜR konnte nicht geladen werden.");
        setDaten(null);
        return;
      }
      setDaten(json as EuerAntwort);
    } catch {
      setFehler("Netzwerkfehler beim Laden der EÜR.");
      setDaten(null);
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void laden(jahr);
  }, [jahr, laden]);

  async function abschliessen() {
    setAbschlussLaeuft(true);
    try {
      const res = await fetch("/api/steuer/euer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jahr, bestaetigt: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Jahresabschluss fehlgeschlagen.");
        return;
      }
      toast.success(`Wirtschaftsjahr ${jahr} abgeschlossen.`);
      await laden(jahr);
    } catch {
      toast.error("Netzwerkfehler beim Jahresabschluss.");
    } finally {
      setAbschlussLaeuft(false);
    }
  }

  function oeffneDrilldown(g: KategorieGruppe) {
    setDrilldown({
      bezeichnung: g.bezeichnung,
      typ: g.typ,
      euer_zeile: g.euer_zeile,
      summe: g.summe,
      buchungen: g.buchungen,
    });
    setDrilldownOffen(true);
  }

  const e = daten?.ergebnis;
  const w = daten?.warnungen;
  const hatWarnungen =
    !!w &&
    (w.offene_pruefaelle.anzahl > 0 ||
      w.unklassifiziert.anzahl > 0 ||
      w.ohne_beleg.anzahl > 0 ||
      w.ohne_kategorie.anzahl > 0);

  return (
    <div className="space-y-6">
      {/* Auswahl + Aktion */}
      <Card>
        <CardHeader>
          <CardTitle>Wirtschaftsjahr</CardTitle>
          <CardDescription>
            {wjBeginn === 1
              ? "Kalenderjahr (1. Januar – 31. Dezember)."
              : `Abweichendes Wirtschaftsjahr ab Monat ${wjBeginn}.`}
            {e
              ? ` Zeitraum: ${formatDatum(e.zeitraum.von)} – ${formatDatum(
                  e.zeitraum.bis,
                )}.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-[220px] space-y-2">
              <label
                htmlFor="euer-jahr"
                className="text-sm font-medium"
              >
                Jahr auswählen
              </label>
              <Select
                value={String(jahr)}
                onValueChange={(v) => setJahr(Number(v))}
              >
                <SelectTrigger id="euer-jahr">
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
                  Abgeschlossen am{" "}
                  {formatDatum(daten.abgeschlossen_at)}
                </Badge>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={laedt || abschlussLaeuft || !e}>
                      {abschlussLaeuft ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Jahr abschließen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Wirtschaftsjahr {jahr} abschließen?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Die EÜR wird als unveränderlicher Snapshot
                        eingefroren. Spätere Buchungsänderungen erfordern
                        eine ausdrückliche Neuberechnung (Berichtigung).
                        {hatWarnungen
                          ? " Achtung: Es bestehen noch offene Warnhinweise – diese können das Ergebnis verfälschen."
                          : ""}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={abschliessen}>
                        Endgültig abschließen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fehlerzustand */}
      {fehler ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      ) : null}

      {/* Ladezustand */}
      {laedt ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ) : null}

      {/* Berichtigungshinweis bei abgeschlossenem Jahr */}
      {!laedt && daten?.abgeschlossen ? (
        <Alert>
          <AlertTitle>Abgeschlossenes Wirtschaftsjahr</AlertTitle>
          <AlertDescription>
            {daten.hinweis ??
              "Die Zahlen sind als Snapshot fixiert."}
            {daten.berichtigung_noetig
              ? " Hinweis: Seit dem Abschluss wurden Buchungen in diesem Zeitraum verändert oder ergänzt – eine Berichtigung kann erforderlich sein."
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Warnpanel */}
      {!laedt && w && hatWarnungen ? (
        <Alert variant="destructive">
          <AlertTitle>Warnhinweise vor Abschluss</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {w.offene_pruefaelle.anzahl > 0 ? (
                <li>
                  {w.offene_pruefaelle.anzahl} offene(r) Prüffall/-fälle
                  (Summenwirkung {euro(w.offene_pruefaelle.summe)})
                </li>
              ) : null}
              {w.unklassifiziert.anzahl > 0 ? (
                <li>
                  {w.unklassifiziert.anzahl} unklassifizierte Buchung(en)
                  (Summenwirkung {euro(w.unklassifiziert.summe)})
                </li>
              ) : null}
              {w.ohne_beleg.anzahl > 0 ? (
                <li>
                  {w.ohne_beleg.anzahl} Geschäftsbuchung(en) ohne Beleg
                  (Summenwirkung {euro(w.ohne_beleg.summe)})
                </li>
              ) : null}
              {w.ohne_kategorie.anzahl > 0 ? (
                <li>
                  {w.ohne_kategorie.anzahl} geschäftliche Buchung(en) ohne
                  EÜR-Kategorie – nicht in den Summen enthalten (Einnahmen{" "}
                  {euro(w.ohne_kategorie.summe_einnahmen)}, Ausgaben{" "}
                  {euro(w.ohne_kategorie.summe_ausgaben)})
                </li>
              ) : null}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* EÜR-Aufstellung */}
      {!laedt && e ? (
        <EuerTabelle
          einnahmen={e.betriebseinnahmen}
          ausgaben={e.betriebsausgaben}
          summeEinnahmen={e.summe_einnahmen}
          summeAusgaben={e.summe_ausgaben}
          gewinn={e.gewinn}
          onDrilldown={oeffneDrilldown}
        />
      ) : null}

      <EuerDrilldownSheet
        gruppe={drilldown}
        open={drilldownOffen}
        onOpenChange={setDrilldownOffen}
      />
    </div>
  );
}
