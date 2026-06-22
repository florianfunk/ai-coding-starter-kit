"use client";

// PROJ-15 P2 (#3): "Häufige Prüflisten-Empfänger" — Kandidatenliste für neue
// Lernregeln. Lädt GET /api/pruefliste/haeufige-empfaenger (Jahres-gescoped
// serverseitig) und zeigt pro normalisiertem Empfänger Häufigkeit, Beispiel-
// Rohwert, Summe/Durchschnitt, jüngstes Datum und die Prüf-Gründe. Aus jeder
// Zeile lässt sich direkt eine Lernregel anlegen (RegelDialog, vorbefüllt).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Sparkles, Users } from "lucide-react";
import type { HaeufigerEmpfaenger } from "@/lib/klassifizierung/haeufige-empfaenger";
import type { Kategorie, Konto } from "@/lib/types";
import { grundLabel } from "@/components/pruefliste/labels";
import { RegelDialog, type RegelPrefill } from "@/components/regeln/regel-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function formatBetrag(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDatum(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function HaeufigeEmpfaengerListe({
  konten,
  kategorien,
}: {
  konten: Konto[];
  kategorien: Kategorie[];
}) {
  const router = useRouter();
  const [daten, setDaten] = useState<HaeufigerEmpfaenger[]>([]);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dialogOffen, setDialogOffen] = useState(false);
  const [prefill, setPrefill] = useState<RegelPrefill | null>(null);

  const laden_ = useCallback(async () => {
    setLaden(true);
    setFehler(null);
    try {
      const res = await fetch(
        "/api/pruefliste/haeufige-empfaenger?min_anzahl=2&limit=100",
      );
      const json = (await res.json().catch(() => null)) as
        | { data?: HaeufigerEmpfaenger[]; error?: string }
        | null;
      if (!res.ok) {
        setFehler(
          json?.error ?? "Die Empfänger-Liste konnte nicht geladen werden.",
        );
        return;
      }
      setDaten(json?.data ?? []);
    } catch {
      setFehler("Netzwerkfehler beim Laden der Empfänger-Liste.");
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void laden_();
  }, [laden_]);

  function regelAnlegen(e: HaeufigerEmpfaenger) {
    setPrefill({
      bezeichnung: `Regel: ${e.beispiel_rohwert}`,
      empfaenger_muster: e.beispiel_rohwert,
    });
    setDialogOffen(true);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-violet" />
            Kandidaten für neue Lernregeln
          </CardTitle>
          <CardDescription>
            Wiederkehrende Empfänger, die immer wieder in der Prüfliste landen
            (≥ 2 Fälle im aktiven Jahr). Lohnt sich für eine Lernregel, damit
            künftige Buchungen automatisch laufen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void laden_()}
              disabled={laden}
              className="rounded-full"
            >
              {laden ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-1.5 h-4 w-4" />
              )}
              Aktualisieren
            </Button>
          </div>

          {fehler ? (
            <Alert variant="destructive">
              <AlertTitle>Fehler beim Laden</AlertTitle>
              <AlertDescription>{fehler}</AlertDescription>
            </Alert>
          ) : laden ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Empfänger…
            </div>
          ) : daten.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-cyan text-income-strong">
                ✓
              </div>
              <h3 className="mt-3 text-base font-semibold">
                Keine wiederkehrenden Prüffälle
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                Im aktiven Jahr gibt es keinen Empfänger mit mindestens zwei
                offenen Prüffällen. Sobald sich Muster häufen, erscheinen sie
                hier als Regel-Kandidaten.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop/Tablet: Tabelle */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empfänger</TableHead>
                      <TableHead className="text-right">Fälle</TableHead>
                      <TableHead className="text-right">Summe</TableHead>
                      <TableHead className="text-right">Ø Betrag</TableHead>
                      <TableHead>Letzte</TableHead>
                      <TableHead>Gründe</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daten.map((e) => (
                      <TableRow key={e.empfaenger_norm}>
                        <TableCell className="max-w-[260px]">
                          <div className="truncate font-medium">
                            {e.beispiel_rohwert}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {e.empfaenger_norm}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {e.anzahl}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatBetrag(e.summe)} €
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {formatBetrag(e.durchschnitt)} €
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                          {formatDatum(e.letzte)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {e.pruef_gruende.map((g) => (
                              <Badge
                                key={g}
                                variant="secondary"
                                className="font-normal"
                              >
                                {grundLabel(g)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regelAnlegen(e)}
                            className="rounded-full"
                          >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                            Regel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Karten-Liste */}
              <ul className="space-y-3 sm:hidden">
                {daten.map((e) => (
                  <li
                    key={e.empfaenger_norm}
                    className="rounded-[var(--radius)] border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {e.beispiel_rohwert}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {e.empfaenger_norm}
                        </div>
                      </div>
                      <Badge variant="secondary">{e.anzahl} Fälle</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                      <span>
                        Summe:{" "}
                        <span className="font-mono tabular-nums text-foreground">
                          {formatBetrag(e.summe)} €
                        </span>
                      </span>
                      <span>
                        Ø{" "}
                        <span className="font-mono tabular-nums">
                          {formatBetrag(e.durchschnitt)} €
                        </span>
                      </span>
                      <span>Letzte: {formatDatum(e.letzte)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.pruef_gruende.map((g) => (
                        <Badge
                          key={g}
                          variant="secondary"
                          className="font-normal"
                        >
                          {grundLabel(g)}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regelAnlegen(e)}
                      className="mt-3 w-full rounded-full"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Lernregel erstellen
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <RegelDialog
        open={dialogOffen}
        onOpenChange={(o) => {
          setDialogOffen(o);
          if (!o) setPrefill(null);
        }}
        regel={null}
        konten={konten}
        kategorien={kategorien}
        prefill={prefill ?? undefined}
        onSaved={() => {
          setDialogOffen(false);
          setPrefill(null);
          router.refresh();
        }}
      />
    </div>
  );
}
