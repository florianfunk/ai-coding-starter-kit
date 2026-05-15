"use client";

// PROJ-7: Prüflisten-Ansicht. Fall-Liste mit Grund-Badge, Filter/Sortierung,
// Mustergruppierung (gleicher Empfänger), Bulk-Auswahl und Einzel-/Bulk-
// Entscheidung. Nach einer Regel-Anlage wird angeboten, gleichartige offene
// Fälle direkt mitzuerledigen.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";
import type { Buchung, Kategorie, Konto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  EntscheidungsDialog,
  type EntscheidungErgebnis,
} from "./entscheidungs-dialog";
import { formatBetrag, formatDatum, gruendeListe, grundLabel } from "./labels";

interface Mustergruppe {
  schluessel: string;
  empfaenger: string;
  buchung_ids: string[];
}

function normEmpfaenger(value: string | null): string {
  return (value ?? "").toLowerCase().trim();
}

export function PrueflisteAnsicht({
  initialFaelle,
  konten,
  kategorien,
}: {
  initialFaelle: Buchung[];
  konten: Konto[];
  kategorien: Kategorie[];
}) {
  const router = useRouter();
  const [faelle, setFaelle] = useState<Buchung[]>(initialFaelle);
  const [konto, setKonto] = useState("alle");
  const [grund, setGrund] = useState("alle");
  const [sort, setSort] = useState<"datum" | "betrag">("datum");
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [dialogFaelle, setDialogFaelle] = useState<Buchung[] | null>(null);
  const [reloading, setReloading] = useState(false);
  const [nachregel, setNachregel] = useState<{
    anzahl: number;
    regelName: string;
  } | null>(null);

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "—";

  const verfuegbareGruende = useMemo(() => {
    const s = new Set<string>();
    for (const f of faelle) {
      for (const g of gruendeListe(f.pruef_grund)) s.add(g);
    }
    return Array.from(s).sort();
  }, [faelle]);

  const gefiltert = useMemo(() => {
    let liste = faelle.slice();
    if (konto !== "alle") liste = liste.filter((f) => f.konto_id === konto);
    if (grund !== "alle") {
      liste = liste.filter((f) => gruendeListe(f.pruef_grund).includes(grund));
    }
    liste.sort((a, b) =>
      sort === "betrag"
        ? Math.abs(b.betrag) - Math.abs(a.betrag)
        : b.buchung_datum.localeCompare(a.buchung_datum),
    );
    return liste;
  }, [faelle, konto, grund, sort]);

  const gruppen = useMemo<Mustergruppe[]>(() => {
    const map = new Map<string, Mustergruppe>();
    for (const f of gefiltert) {
      const key = normEmpfaenger(f.empfaenger);
      if (!key) continue;
      const g = map.get(key);
      if (g) g.buchung_ids.push(f.id);
      else
        map.set(key, {
          schluessel: key,
          empfaenger: f.empfaenger ?? "",
          buchung_ids: [f.id],
        });
    }
    return Array.from(map.values())
      .filter((g) => g.buchung_ids.length >= 2)
      .sort((a, b) => b.buchung_ids.length - a.buchung_ids.length);
  }, [gefiltert]);

  async function reload(): Promise<Buchung[]> {
    setReloading(true);
    try {
      const res = await fetch("/api/pruefliste");
      const json = await res.json();
      if (res.ok) {
        const neu = (json.data ?? []) as Buchung[];
        setFaelle(neu);
        setAuswahl(new Set());
        router.refresh();
        return neu;
      }
    } catch {
      // Stillschweigend – nächste Aktion versucht erneut.
    } finally {
      setReloading(false);
    }
    return faelle;
  }

  function toggle(id: string) {
    setAuswahl((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alleSichtbarenWaehlen(an: boolean) {
    setAuswahl(an ? new Set(gefiltert.map((f) => f.id)) : new Set());
  }

  function gruppeWaehlen(g: Mustergruppe) {
    setAuswahl(new Set(g.buchung_ids));
    toast.success(
      `${g.buchung_ids.length} Fälle von „${g.empfaenger}" ausgewählt.`,
    );
  }

  function oeffneEinzeln(f: Buchung) {
    setDialogFaelle([f]);
  }

  function oeffneBulk() {
    const sel = gefiltert.filter((f) => auswahl.has(f.id));
    if (sel.length === 0) {
      toast.error("Keine Fälle ausgewählt.");
      return;
    }
    setDialogFaelle(sel);
  }

  async function nachEntscheidung(e: EntscheidungErgebnis) {
    setDialogFaelle(null);
    const neu = await reload();
    if (e.regel && e.gleichartige_offen > 0) {
      // Hinweis im State, plus konkretes Angebot.
      setNachregel({
        anzahl: e.gleichartige_offen,
        regelName: e.regel.bezeichnung,
      });
    }
    return neu;
  }

  async function gleichartigeReklassifizieren() {
    setNachregel(null);
    try {
      const res = await fetch("/api/klassifizierung?nur_offen=false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nur_offen: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(
          json.error ??
            "Erneute Klassifizierung konnte nicht gestartet werden.",
        );
        return;
      }
      toast.success(
        "Re-Klassifizierung gestartet – die neue Regel greift jetzt auf offene Fälle.",
      );
      await reload();
    } catch {
      toast.error("Netzwerkfehler bei der Re-Klassifizierung.");
    }
  }

  const istLeer = faelle.length === 0;
  const alleGewaehlt =
    gefiltert.length > 0 && gefiltert.every((f) => auswahl.has(f.id));

  return (
    <>
      {gruppen.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Mustergruppen
            </CardTitle>
            <CardDescription>
              Gleicher Empfänger – in einem Schritt als Bulk auswählen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {gruppen.map((g) => (
              <Button
                key={g.schluessel}
                variant="outline"
                size="sm"
                onClick={() => gruppeWaehlen(g)}
              >
                {g.empfaenger}
                <Badge variant="secondary" className="ml-2">
                  {g.buchung_ids.length}
                </Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Offene Prüffälle</CardTitle>
            <CardDescription>
              {istLeer
                ? "Keine offenen Ausnahmen – alles erledigt."
                : `${gefiltert.length} von ${faelle.length} Fall/Fällen angezeigt.`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Select value={konto} onValueChange={setKonto}>
                <SelectTrigger>
                  <SelectValue placeholder="Konto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Konten</SelectItem>
                  {konten.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.bezeichnung}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={grund} onValueChange={setGrund}>
                <SelectTrigger>
                  <SelectValue placeholder="Grund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Gründe</SelectItem>
                  {verfuegbareGruende.map((g) => (
                    <SelectItem key={g} value={g}>
                      {grundLabel(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as "datum" | "betrag")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="datum">Nach Datum</SelectItem>
                  <SelectItem value="betrag">Nach Betrag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={oeffneBulk}
              disabled={auswahl.size === 0}
            >
              {auswahl.size > 0
                ? `${auswahl.size} entscheiden`
                : "Auswahl entscheiden"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {istLeer ? (
            <div className="rounded-md border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Die Prüfliste ist leer. Sobald der Agent unsichere Fälle
                findet, erscheinen sie hier.
              </p>
            </div>
          ) : gefiltert.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Kein Fall für die aktuelle Filterauswahl.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={alleGewaehlt}
                        onCheckedChange={(v) =>
                          alleSichtbarenWaehlen(Boolean(v))
                        }
                        aria-label="Alle sichtbaren auswählen"
                      />
                    </TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Zweck</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Konto</TableHead>
                    <TableHead>Grund</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gefiltert.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Checkbox
                          checked={auswahl.has(f.id)}
                          onCheckedChange={() => toggle(f.id)}
                          aria-label={`Fall ${
                            f.empfaenger ?? f.id
                          } auswählen`}
                        />
                      </TableCell>
                      <TableCell>{formatDatum(f.buchung_datum)}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {f.empfaenger ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {f.verwendungszweck ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBetrag(f.betrag)} {f.waehrung}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {kontoName(f.konto_id)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {gruendeListe(f.pruef_grund).map((g) => (
                            <Badge key={g} variant="destructive">
                              {grundLabel(g)}
                            </Badge>
                          ))}
                          {gruendeListe(f.pruef_grund).length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => oeffneEinzeln(f)}
                        >
                          Entscheiden
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {reloading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aktualisiere…
            </div>
          )}
        </CardContent>
      </Card>

      {dialogFaelle && (
        <EntscheidungsDialog
          open={dialogFaelle !== null}
          onOpenChange={(o) => {
            if (!o) setDialogFaelle(null);
          }}
          faelle={dialogFaelle}
          kategorien={kategorien}
          onEntschieden={nachEntscheidung}
        />
      )}

      <AlertDialog
        open={nachregel !== null}
        onOpenChange={(o) => {
          if (!o) setNachregel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gleichartige Fälle mitnehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Regel „{nachregel?.regelName}" passt zu ca.{" "}
              {nachregel?.anzahl} weiteren offenen Prüffällen. Sollen diese
              jetzt mit der neuen Regel erneut klassifiziert werden? Bereits
              bestätigte Buchungen bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Später</AlertDialogCancel>
            <AlertDialogAction onClick={gleichartigeReklassifizieren}>
              Jetzt anwenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
