"use client";

// PROJ-14 — Drill-Down: alle Buchungen einer Kategorie + Inline-Edit
// (Kategorie ändern, bestätigen). Lädt die Buchungen via /api/.../buchungen,
// PATCH geht an /api/buchungen/[id].

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, CheckCheck } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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

import type { Buchung, KategorieTyp } from "@/lib/types";
import type { KategorieAggregat } from "@/app/api/kategorien-analyse/route";
import type { BulkKategorieResponse } from "@/app/api/buchungen/bulk-kategorie/route";

interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  aktiv: boolean;
}

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function deDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function KategorieDrilldown({
  kategorie,
  von,
  bis,
  kontoId,
  nurSteuerrelevant,
  onClose,
  onMutiert,
}: {
  kategorie: KategorieAggregat | null;
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  nurSteuerrelevant: boolean;
  onClose: () => void;
  onMutiert: () => void;
}) {
  const offen = kategorie !== null;
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  const [kategorien, setKategorien] = useState<KategorieOption[]>([]);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  // Mehrfachauswahl + Bulk-Bestätigung.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zielKat, setZielKat] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const unbestaetigt = useMemo(
    () => buchungen.filter((b) => b.status !== "manuell_bestaetigt"),
    [buchungen],
  );
  const alleSichtbarGewaehlt =
    buchungen.length > 0 && selected.size === buchungen.length;

  useEffect(() => {
    if (!kategorie) return;
    setLadeFehler(null);
    const params = new URLSearchParams();
    if (kategorie.kategorie_id) params.set("kategorie_id", kategorie.kategorie_id);
    else params.set("kategorie_id", "ohne");
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (kontoId) params.set("konto_id", kontoId);
    if (nurSteuerrelevant) params.set("nur_steuerrelevant", "true");

    startTransition(async () => {
      try {
        const [bRes, kRes] = await Promise.all([
          fetch(`/api/kategorien-analyse/buchungen?${params.toString()}`),
          fetch("/api/kontenrahmen"),
        ]);
        if (!bRes.ok) throw new Error(`Buchungen HTTP ${bRes.status}`);
        if (!kRes.ok) throw new Error(`Kategorien HTTP ${kRes.status}`);
        const bj = (await bRes.json()) as { buchungen: Buchung[] };
        const kj = (await kRes.json()) as { data: KategorieOption[] };
        setBuchungen(bj.buchungen);
        setKategorien(kj.data.filter((k) => k.aktiv));
        setSelected(new Set());
      } catch (e) {
        setLadeFehler(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    });
  }, [kategorie, von, bis, kontoId, nurSteuerrelevant]);

  async function aendereKategorie(buchung: Buchung, neueKategorieId: string) {
    if (neueKategorieId === buchung.kategorie_id) return;
    setSavingId(buchung.id);
    try {
      const r = await fetch(`/api/buchungen/${buchung.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategorie_id: neueKategorieId,
          bestaetigen: true,
        }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      toast.success("Kategorie geändert & bestätigt");
      // Optimistisch entfernen — Buchung gehört jetzt zur neuen Kategorie.
      setBuchungen((bs) => bs.filter((b) => b.id !== buchung.id));
      onMutiert();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  async function bestaetige(buchung: Buchung) {
    setSavingId(buchung.id);
    try {
      const r = await fetch(`/api/buchungen/${buchung.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      toast.success("Bestätigt — bleibt bei Re-Klassifizierung unangetastet");
      setBuchungen((bs) =>
        bs.map((b) =>
          b.id === buchung.id ? { ...b, status: "manuell_bestaetigt" } : b,
        ),
      );
      onMutiert();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  function toggleZeile(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAlle() {
    setSelected((s) =>
      s.size === buchungen.length
        ? new Set()
        : new Set(buchungen.map((b) => b.id)),
    );
  }

  /**
   * Setzt für viele Buchungen die Zielkategorie + status=manuell_bestaetigt
   * (ein Request an /api/buchungen/bulk-kategorie). Bleibt die Kategorie
   * gleich, werden die Zeilen nur als bestätigt markiert; bei Wechsel in eine
   * andere Kategorie verschwinden sie aus dieser Ansicht.
   */
  async function bulkSetzen(ids: string[], zielKategorieId: string) {
    if (ids.length === 0 || !zielKategorieId) return;
    setBulkBusy(true);
    try {
      const r = await fetch("/api/buchungen/bulk-kategorie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, kategorie_id: zielKategorieId }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as BulkKategorieResponse;
      const idSet = new Set(ids);
      const gleicheKategorie = zielKategorieId === kategorie?.kategorie_id;
      setBuchungen((bs) =>
        gleicheKategorie
          ? bs.map((b) =>
              idSet.has(b.id) ? { ...b, status: "manuell_bestaetigt" } : b,
            )
          : bs.filter((b) => !idSet.has(b.id)),
      );
      setSelected(new Set());
      toast.success(
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} bestätigt` +
          (gleicheKategorie ? "" : ` → ${j.kategorie.bezeichnung}`),
      );
      onMutiert();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setBulkBusy(false);
    }
  }

  // „Alle bestätigen": alle noch nicht bestätigten Zeilen in DIESER Kategorie.
  function alleBestaetigen() {
    if (!kategorie?.kategorie_id) return;
    bulkSetzen(
      unbestaetigt.map((b) => b.id),
      kategorie.kategorie_id,
    );
  }

  // „Übernehmen & bestätigen": markierte Zeilen in die gewählte Kategorie.
  function auswahlUebernehmen() {
    const ziel = zielKat || kategorie?.kategorie_id || "";
    bulkSetzen(Array.from(selected), ziel);
  }

  return (
    <Sheet open={offen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[1100px] sm:w-[90vw]">
        <SheetHeader>
          <SheetTitle>{kategorie?.bezeichnung ?? ""}</SheetTitle>
          <SheetDescription>
            {kategorie ? (
              <>
                {kategorie.anzahl} Buchung{kategorie.anzahl === 1 ? "" : "en"} ·{" "}
                {eur(kategorie.summe)} ·{" "}
                {kategorie.konfidenz_avg !== null
                  ? `⌀ Konfidenz ${Math.round(kategorie.konfidenz_avg * 100)} %`
                  : "keine KI-Konfidenz"}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {offen && buchungen.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-b pb-3">
            <Button
              size="sm"
              onClick={alleBestaetigen}
              disabled={
                bulkBusy ||
                unbestaetigt.length === 0 ||
                !kategorie?.kategorie_id
              }
            >
              {bulkBusy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
              )}
              Alle bestätigen ({unbestaetigt.length})
            </Button>

            {selected.size > 0 && (
              <>
                <span className="ml-1 text-sm text-muted-foreground">
                  {selected.size} ausgewählt
                </span>
                <Select value={zielKat} onValueChange={setZielKat}>
                  <SelectTrigger className="h-8 w-[240px] text-xs">
                    <SelectValue placeholder="Zielkategorie (optional)…" />
                  </SelectTrigger>
                  <SelectContent>
                    <KategorieGruppen kategorien={kategorien} />
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={auswahlUebernehmen} disabled={bulkBusy}>
                  {bulkBusy ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {zielKat ? "Übernehmen & bestätigen" : "Auswahl bestätigen"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  disabled={bulkBusy}
                >
                  Auswahl aufheben
                </Button>
              </>
            )}
          </div>
        )}

        <div className="mt-4 max-h-[80vh] overflow-y-auto">
          {isPending && buchungen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lade Buchungen…</p>
          ) : ladeFehler ? (
            <p className="text-sm text-destructive">{ladeFehler}</p>
          ) : buchungen.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Buchungen in dieser Kategorie (für die aktuellen Filter).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px]">
                    <Checkbox
                      checked={alleSichtbarGewaehlt}
                      onCheckedChange={toggleAlle}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
                  <TableHead className="w-[100px]">Datum</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Zweck</TableHead>
                  <TableHead className="text-right w-[110px]">Betrag</TableHead>
                  <TableHead className="text-right w-[80px]">Konf.</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[260px]">Kategorie ändern</TableHead>
                  <TableHead className="w-[110px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buchungen.map((b) => (
                  <TableRow
                    key={b.id}
                    data-state={selected.has(b.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(b.id)}
                        onCheckedChange={() => toggleZeile(b.id)}
                        aria-label="Zeile auswählen"
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {deDate(b.buchung_datum)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {b.empfaenger ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                      {b.verwendungszweck ?? "—"}
                    </TableCell>
                    <TableCell
                      className={
                        "text-right tabular-nums font-mono " +
                        (Number(b.betrag) < 0 ? "text-destructive" : "")
                      }
                    >
                      {eur(Number(b.betrag))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.konfidenz === null
                        ? "—"
                        : `${Math.round(Number(b.konfidenz) * 100)} %`}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={savingId === b.id}
                        value={b.kategorie_id ?? "__none__"}
                        onValueChange={(v) =>
                          v !== "__none__" && aendereKategorie(b, v)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Kategorie wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          <KategorieGruppen kategorien={kategorien} />
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {b.status === "manuell_bestaetigt" ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          bestätigt
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingId === b.id}
                          onClick={() => bestaetige(b)}
                        >
                          {savingId === b.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Bestätigen"
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status: Buchung["status"] }) {
  const map: Record<
    Buchung["status"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    offen: { label: "Offen", variant: "outline" },
    auto_verbucht: { label: "Auto", variant: "default" },
    zur_pruefung: { label: "Prüfung", variant: "destructive" },
    manuell_bestaetigt: { label: "Bestätigt", variant: "secondary" },
  };
  const m = map[status];
  return (
    <Badge variant={m.variant} className="text-xs">
      {m.label}
    </Badge>
  );
}

function KategorieGruppen({
  kategorien,
}: {
  kategorien: KategorieOption[];
}) {
  const gruppen: Record<KategorieTyp, KategorieOption[]> = {
    einnahme: [],
    ausgabe: [],
    privat: [],
    neutral: [],
  };
  for (const k of kategorien) gruppen[k.typ].push(k);
  const labels: Record<KategorieTyp, string> = {
    einnahme: "Einnahmen",
    ausgabe: "Ausgaben",
    privat: "Privat",
    neutral: "Neutral",
  };
  const reihenfolge: KategorieTyp[] = ["einnahme", "ausgabe", "privat", "neutral"];
  return (
    <>
      {reihenfolge.map((typ) =>
        gruppen[typ].length === 0 ? null : (
          <SelectGroup key={typ}>
            <SelectLabel>{labels[typ]}</SelectLabel>
            {gruppen[typ]
              .slice()
              .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung))
              .map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.bezeichnung}
                </SelectItem>
              ))}
          </SelectGroup>
        ),
      )}
    </>
  );
}
