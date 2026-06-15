"use client";

// PROJ-14 — Drill-Down: alle Buchungen einer Kategorie + Inline-Edit
// (Kategorie ändern, bestätigen). Lädt die Buchungen via /api/.../buchungen,
// PATCH geht an /api/buchungen/[id].

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  CheckCheck,
  Info,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";
import { BuchungDetailSheet } from "@/components/kategorien-analyse/buchung-detail-sheet";
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

type SortKey = "datum" | "empfaenger" | "betrag" | "konfidenz";
type SortDir = "asc" | "desc";
type StatusFilter = "alle" | Buchung["status"];

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  alle: "Alle Status",
  offen: "Offen",
  auto_verbucht: "Auto",
  zur_pruefung: "Prüfung",
  manuell_bestaetigt: "Bestätigt",
};

// Eine Zeile der gerenderten Liste: entweder eine Buchung oder – bei
// Gruppierung nach Empfänger – eine Zwischensummen-Zeile.
type Zeile =
  | { kind: "buchung"; b: Buchung }
  | { kind: "summe"; key: string; label: string; anzahl: number; summe: number };

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
  // Detail-Sheet (Info-Button) — Buchung, deren Details gezeigt werden.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Filter + Sortierung.
  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [sortKey, setSortKey] = useState<SortKey>("datum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const unbestaetigt = useMemo(
    () => buchungen.filter((b) => b.status !== "manuell_bestaetigt"),
    [buchungen],
  );

  // Gefilterte + sortierte Buchungen (Basis der Anzeige).
  const sichtbareBuchungen = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let liste = buchungen.filter((b) => {
      if (statusFilter !== "alle" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (b.empfaenger ?? "").toLowerCase().includes(q) ||
        (b.verwendungszweck ?? "").toLowerCase().includes(q)
      );
    });
    liste = liste.slice().sort((a, b) => {
      let r = 0;
      if (sortKey === "datum") r = a.buchung_datum.localeCompare(b.buchung_datum);
      else if (sortKey === "empfaenger")
        r = (a.empfaenger ?? "").localeCompare(b.empfaenger ?? "", "de");
      else if (sortKey === "betrag") r = Number(a.betrag) - Number(b.betrag);
      else r = (Number(a.konfidenz) || 0) - (Number(b.konfidenz) || 0);
      return sortDir === "asc" ? r : -r;
    });
    return liste;
  }, [buchungen, suche, statusFilter, sortKey, sortDir]);

  // Bei Sortierung nach Empfänger: nach Empfänger gruppieren und je Gruppe eine
  // Zwischensumme einschieben (Anzahl + Betragssumme).
  const zeilen = useMemo<Zeile[]>(() => {
    if (sortKey !== "empfaenger") {
      return sichtbareBuchungen.map((b) => ({ kind: "buchung", b }) as Zeile);
    }
    const out: Zeile[] = [];
    let i = 0;
    while (i < sichtbareBuchungen.length) {
      const key = (sichtbareBuchungen[i].empfaenger ?? "—").trim().toLowerCase();
      const label = sichtbareBuchungen[i].empfaenger ?? "—";
      let anzahl = 0;
      let summe = 0;
      while (
        i < sichtbareBuchungen.length &&
        (sichtbareBuchungen[i].empfaenger ?? "—").trim().toLowerCase() === key
      ) {
        const b = sichtbareBuchungen[i];
        out.push({ kind: "buchung", b });
        anzahl += 1;
        summe += Number(b.betrag);
        i += 1;
      }
      out.push({ kind: "summe", key, label, anzahl, summe });
    }
    return out;
  }, [sichtbareBuchungen, sortKey]);

  const alleSichtbarGewaehlt =
    sichtbareBuchungen.length > 0 &&
    sichtbareBuchungen.every((b) => selected.has(b.id));

  function sortiereNach(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // sinnvolle Default-Richtung je Spalte
      setSortDir(key === "empfaenger" ? "asc" : "desc");
    }
  }

  function SortKopf({
    k,
    align = "left",
    className,
    children,
  }: {
    k: SortKey;
    align?: "left" | "right";
    className?: string;
    children: React.ReactNode;
  }) {
    const aktiv = sortKey === k;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => sortiereNach(k)}
          className={cn(
            "flex w-full items-center gap-1 hover:text-foreground",
            align === "right" ? "justify-end" : "justify-start",
          )}
        >
          {children}
          {aktiv ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </TableHead>
    );
  }

  const ladeDaten = useCallback(() => {
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

  useEffect(() => {
    ladeDaten();
  }, [ladeDaten]);

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
    setSelected((s) => {
      const next = new Set(s);
      const alleDa =
        sichtbareBuchungen.length > 0 &&
        sichtbareBuchungen.every((b) => s.has(b.id));
      if (alleDa) for (const b of sichtbareBuchungen) next.delete(b.id);
      else for (const b of sichtbareBuchungen) next.add(b.id);
      return next;
    });
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
    <>
    <Sheet open={offen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:w-[90vw] sm:max-w-none">
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
                <KategorieCombobox
                  kategorien={kategorien}
                  value={zielKat}
                  onChange={setZielKat}
                  triggerClassName="h-8 w-[240px] text-xs"
                  placeholder="Zielkategorie (optional)…"
                  ariaLabel="Zielkategorie wählen"
                  inDialog
                />
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

        {offen && buchungen.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Empfänger oder Zweck filtern…"
                className="h-9 pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_FILTER_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {sichtbareBuchungen.length === buchungen.length
                ? `${buchungen.length} Buchungen`
                : `${sichtbareBuchungen.length} von ${buchungen.length}`}
            </span>
            {(suche || statusFilter !== "alle") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSuche("");
                  setStatusFilter("alle");
                }}
              >
                Filter zurücksetzen
              </Button>
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
                  <SortKopf k="datum" className="w-[100px]">
                    Datum
                  </SortKopf>
                  <SortKopf k="empfaenger">Empfänger</SortKopf>
                  <TableHead>Zweck</TableHead>
                  <SortKopf k="betrag" align="right" className="w-[110px]">
                    Betrag
                  </SortKopf>
                  <TableHead className="text-right w-[70px]">USt</TableHead>
                  <SortKopf k="konfidenz" align="right" className="w-[80px]">
                    Konf.
                  </SortKopf>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[260px]">Kategorie ändern</TableHead>
                  <TableHead className="w-[150px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zeilen.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Keine Treffer für den Filter.
                    </TableCell>
                  </TableRow>
                )}
                {zeilen.map((z) => {
                  if (z.kind === "summe") {
                    return (
                      <TableRow
                        key={`summe-${z.key}`}
                        className="border-y border-primary/20 bg-primary/10 font-semibold hover:bg-primary/10"
                      >
                        <TableCell
                          colSpan={4}
                          className="text-xs uppercase tracking-wide text-primary"
                        >
                          Σ {z.label} · {z.anzahl} Buchung
                          {z.anzahl === 1 ? "" : "en"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums font-mono",
                            z.summe < 0 ? "text-destructive" : "text-primary",
                          )}
                        >
                          {eur(Math.round(z.summe * 100) / 100)}
                        </TableCell>
                        <TableCell colSpan={5} />
                      </TableRow>
                    );
                  }
                  const b = z.b;
                  return (
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
                    <TableCell className="max-w-[300px] truncate">
                      {b.empfaenger ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[440px] truncate text-xs text-muted-foreground">
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
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {b.ust_satz === null ? "—" : `${b.ust_satz} %`}
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
                      <KategorieCombobox
                        kategorien={kategorien}
                        value={b.kategorie_id ?? ""}
                        onChange={(v) => {
                          if (v) aendereKategorie(b, v);
                        }}
                        disabled={savingId === b.id}
                        triggerClassName="h-8 text-xs"
                        placeholder="Kategorie wählen…"
                        ariaLabel="Kategorie wählen"
                        inDialog
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => setDetailId(b.id)}
                          aria-label="Details anzeigen"
                          title="Details"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
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
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <BuchungDetailSheet
      buchungId={detailId}
      kategorien={kategorien}
      onClose={() => setDetailId(null)}
      onMutiert={() => {
        onMutiert();
        ladeDaten();
      }}
    />
    </>
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
