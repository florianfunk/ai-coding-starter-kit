"use client";

// PROJ-14 — Chronologische Liste aller Geldbewegungen. Filter:
// Empfänger-Suche, Kategorie (inkl. "ohne"), Richtung (Eingang/Ausgang).
// Inline-Edit der Kategorie wie im Drill-Down. Pagination clientseitig
// kontrolliert (Seite + pro_seite an die API).

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Search,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import type {
  BewegungenResponse,
  BewegungZeile,
} from "@/app/api/finanzen/bewegungen/route";
import type { Bereich } from "@/lib/validation/kategorien-analyse";
import type { KategorieTyp } from "@/lib/types";
import { BuchungDetailSheet } from "@/components/kategorien-analyse/buchung-detail-sheet";

interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  aktiv: boolean;
}

export interface GeldbewegungenFilter {
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  bereich: Bereich;
}

type Sort = "datum" | "betrag";
type Richtung = "asc" | "desc";

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

const TYP_LABEL: Record<string, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
  privat: "Privat",
  neutral: "Neutral",
};
const TYP_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  einnahme: "default",
  ausgabe: "secondary",
  privat: "outline",
  neutral: "outline",
};

export function GeldbewegungenAnsicht({
  filter,
}: {
  filter: GeldbewegungenFilter;
}) {
  const [suche, setSuche] = useState("");
  const [sucheDebounced, setSucheDebounced] = useState("");
  const [richtung, setRichtung] = useState<"alle" | "einnahme" | "ausgabe">(
    "alle",
  );
  const [kategorieFilter, setKategorieFilter] = useState<string>("alle"); // "alle" | "ohne" | uuid
  const [sort, setSort] = useState<Sort>("datum");
  const [sortRichtung, setSortRichtung] = useState<Richtung>("desc");
  const [seite, setSeite] = useState(1);
  const [proSeite, setProSeite] = useState(100);

  const [daten, setDaten] = useState<BewegungenResponse | null>(null);
  const [kategorien, setKategorien] = useState<KategorieOption[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  function toggleAufklappen(id: string) {
    setAufgeklappt((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Suche debouncen — 300ms
  useEffect(() => {
    const t = setTimeout(() => setSucheDebounced(suche.trim()), 300);
    return () => clearTimeout(t);
  }, [suche]);

  // Stamm-Kategorien einmalig laden
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/kontenrahmen");
        if (r.ok) {
          const j = (await r.json()) as { data: KategorieOption[] };
          setKategorien(j.data.filter((k) => k.aktiv));
        }
      } catch {
        /* kein Hard-Fail — Inline-Edit nur eingeschränkt */
      }
    })();
  }, []);

  // Filter-Änderung → Seite zurücksetzen
  useEffect(() => {
    setSeite(1);
  }, [
    filter.von,
    filter.bis,
    filter.kontoId,
    filter.bereich,
    sucheDebounced,
    richtung,
    kategorieFilter,
    proSeite,
  ]);

  const ladeDaten = useCallback(() => {
    setFehler(null);
    const params = new URLSearchParams();
    if (filter.von) params.set("von", filter.von);
    if (filter.bis) params.set("bis", filter.bis);
    if (filter.kontoId) params.set("konto_id", filter.kontoId);
    if (filter.bereich !== "alle") params.set("bereich", filter.bereich);
    if (sucheDebounced) params.set("suche", sucheDebounced);
    if (richtung !== "alle") params.set("richtung", richtung);
    if (kategorieFilter !== "alle") params.set("kategorie_id", kategorieFilter);
    params.set("sort", sort);
    params.set("richtung_sort", sortRichtung);
    params.set("seite", String(seite));
    params.set("pro_seite", String(proSeite));

    startTransition(async () => {
      try {
        const r = await fetch(`/api/finanzen/bewegungen?${params.toString()}`);
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        setDaten((await r.json()) as BewegungenResponse);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setFehler(msg);
        toast.error("Bewegungen konnten nicht geladen werden: " + msg);
      }
    });
  }, [
    filter.von,
    filter.bis,
    filter.kontoId,
    filter.bereich,
    sucheDebounced,
    richtung,
    kategorieFilter,
    sort,
    sortRichtung,
    seite,
    proSeite,
  ]);

  useEffect(() => {
    ladeDaten();
  }, [ladeDaten]);

  function toggleSort(feld: Sort) {
    if (sort === feld) {
      setSortRichtung((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSort(feld);
      setSortRichtung("desc");
    }
  }

  async function aendereKategorie(zeile: BewegungZeile, neueKategorieId: string) {
    if (neueKategorieId === zeile.kategorie_id) return;
    setSavingId(zeile.id);
    try {
      const r = await fetch(`/api/buchungen/${zeile.id}`, {
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
      ladeDaten();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  async function bestaetige(zeile: BewegungZeile) {
    setSavingId(zeile.id);
    try {
      const r = await fetch(`/api/buchungen/${zeile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      toast.success("Bestätigt — bleibt bei Re-Klassifizierung unangetastet");
      ladeDaten();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  const seitenAnzahl = daten ? Math.max(1, Math.ceil(daten.gesamt / proSeite)) : 1;
  const vonZeile = daten && daten.gesamt > 0 ? (seite - 1) * proSeite + 1 : 0;
  const bisZeile = daten ? Math.min(seite * proSeite, daten.gesamt) : 0;

  return (
    <div className="space-y-4">
      {/* Kennzahlen */}
      {daten && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KennCard
            label="Σ Eingänge im Filter"
            wert={eur(daten.summen.einnahmen)}
            akzent="positiv"
          />
          <KennCard
            label="Σ Ausgänge im Filter"
            wert={eur(daten.summen.ausgaben)}
            akzent="negativ"
          />
          <KennCard
            label="Saldo"
            wert={eur(daten.summen.saldo)}
            akzent={daten.summen.saldo >= 0 ? "positiv" : "negativ"}
          />
        </div>
      )}

      {/* Filter-Leiste */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="suche">Empfänger oder Zweck</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="suche"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="z. B. Spotify, Miete …"
                className="w-[240px] pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="richtung">Richtung</Label>
            <Select
              value={richtung}
              onValueChange={(v) => setRichtung(v as typeof richtung)}
            >
              <SelectTrigger id="richtung" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="einnahme">Nur Eingänge</SelectItem>
                <SelectItem value="ausgabe">Nur Ausgänge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kat">Kategorie</Label>
            <Select value={kategorieFilter} onValueChange={setKategorieFilter}>
              <SelectTrigger id="kat" className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                <SelectItem value="ohne">— ohne Kategorie —</SelectItem>
                <KategorieGruppen kategorien={kategorien} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proseite">Pro Seite</Label>
            <Select
              value={String(proSeite)}
              onValueChange={(v) => setProSeite(Number(v))}
            >
              <SelectTrigger id="proseite" className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {daten ? (
              <>
                {daten.gesamt} Treffer · Zeilen {vonZeile}–{bisZeile}
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Tabelle */}
      <Card>
        <CardContent className="pt-6">
          {fehler ? (
            <p className="text-sm text-destructive">{fehler}</p>
          ) : !daten ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : daten.zeilen.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Bewegungen für die aktuellen Filter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28px]"></TableHead>
                  <TableHead className="w-[100px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("datum")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Datum
                      <SortIcon
                        aktiv={sort === "datum"}
                        richtung={sortRichtung}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px]">Konto</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Zweck</TableHead>
                  <TableHead className="w-[110px] text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("betrag")}
                      className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Betrag
                      <SortIcon
                        aktiv={sort === "betrag"}
                        richtung={sortRichtung}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="w-[240px]">Kategorie</TableHead>
                  <TableHead className="w-[100px]">Bereich</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daten.zeilen.map((z) => {
                  const expanded = aufgeklappt.has(z.id);
                  return (
                    <Fragment key={z.id}>
                      <TableRow
                        data-state={expanded ? "selected" : undefined}
                        className="group"
                      >
                        <TableCell className="p-0 pl-2">
                          <button
                            type="button"
                            onClick={() => toggleAufklappen(z.id)}
                            aria-label={
                              expanded
                                ? "Details ausblenden"
                                : "Details einblenden"
                            }
                            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {deDate(z.buchung_datum)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {z.konto_bezeichnung}
                        </TableCell>
                        <TableCell
                          className={
                            "max-w-[200px] " +
                            (expanded ? "" : "truncate")
                          }
                        >
                          {z.empfaenger ?? "—"}
                        </TableCell>
                        <TableCell
                          className={
                            "max-w-[260px] text-xs text-muted-foreground " +
                            (expanded ? "whitespace-pre-wrap break-words" : "truncate")
                          }
                        >
                          {z.verwendungszweck ?? "—"}
                        </TableCell>
                        <TableCell
                          className={
                            "text-right tabular-nums font-mono " +
                            (z.betrag < 0
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400")
                          }
                        >
                          {eur(z.betrag)}
                        </TableCell>
                        <TableCell>
                          <Select
                            disabled={savingId === z.id}
                            value={z.kategorie_id ?? "__none__"}
                            onValueChange={(v) =>
                              v !== "__none__" && aendereKategorie(z, v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue
                                placeholder={
                                  z.kategorie_bezeichnung ?? "— ohne —"
                                }
                              >
                                <span className="flex items-center gap-2 truncate">
                                  {z.kategorie_typ ? (
                                    <Badge
                                      variant={
                                        TYP_BADGE[z.kategorie_typ] ?? "outline"
                                      }
                                      className="text-[10px]"
                                    >
                                      {TYP_LABEL[z.kategorie_typ] ??
                                        z.kategorie_typ}
                                    </Badge>
                                  ) : null}
                                  <span className="truncate">
                                    {z.kategorie_bezeichnung ?? "— ohne —"}
                                  </span>
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <KategorieGruppen kategorien={kategorien} />
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <BereichBadge
                            klassif={z.klassifikation}
                            typ={z.kategorie_typ}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            {z.beleg_anzahl > 0 ? (
                              <Badge
                                variant="outline"
                                className="gap-1 text-[10px]"
                                title={`${z.beleg_anzahl} Beleg(e)`}
                              >
                                <FileText className="h-3 w-3" />
                                {z.beleg_anzahl}
                              </Badge>
                            ) : null}
                            {z.status === "manuell_bestaetigt" ? (
                              <Badge
                                variant="secondary"
                                className="gap-1 text-xs"
                                title="Bestätigt"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Badge>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDetailId(z.id)}
                              title="Volle Details öffnen"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={8} className="py-3">
                            <InlineDetails
                              zeile={z}
                              onBestaetigen={() => bestaetige(z)}
                              onOpenSheet={() => setDetailId(z.id)}
                              saving={savingId === z.id}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {daten && daten.gesamt > proSeite && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Seite {seite} von {seitenAnzahl}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={seite <= 1 || isPending}
              onClick={() => setSeite((s) => Math.max(1, s - 1))}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={seite >= seitenAnzahl || isPending}
              onClick={() => setSeite((s) => Math.min(seitenAnzahl, s + 1))}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      <BuchungDetailSheet
        buchungId={detailId}
        kategorien={kategorien}
        onClose={() => setDetailId(null)}
        onMutiert={ladeDaten}
      />
    </div>
  );
}

/** Aufgeklappte Subrow direkt in der Tabelle — kompakte Volltext-Sicht. */
function InlineDetails({
  zeile,
  onBestaetigen,
  onOpenSheet,
  saving,
}: {
  zeile: BewegungZeile;
  onBestaetigen: () => void;
  onOpenSheet: () => void;
  saving: boolean;
}) {
  const QUELLE_LABEL: Record<string, string> = {
    regel: "Regel",
    ki: "KI",
    manuell: "Manuell",
  };
  return (
    <div className="space-y-3 px-2 text-sm">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        <DetailFeld label="Empfänger (voll)" wert={zeile.empfaenger ?? "—"} />
        <DetailFeld
          label="Klassifikation"
          wert={
            zeile.klassifikation ? (
              <Badge variant="outline" className="text-xs">
                {zeile.klassifikation}
              </Badge>
            ) : (
              "—"
            )
          }
        />
        <DetailFeld
          label="Verwendungszweck (voll)"
          wert={
            <span className="whitespace-pre-wrap break-words">
              {zeile.verwendungszweck ?? "—"}
            </span>
          }
          span={2}
        />
        <DetailFeld
          label="USt-Satz"
          wert={zeile.ust_satz === null ? "—" : `${zeile.ust_satz} %`}
        />
        <DetailFeld
          label="Steuerrelevant"
          wert={
            zeile.steuerrelevant === null
              ? "—"
              : zeile.steuerrelevant
                ? "ja"
                : "nein"
          }
        />
        <DetailFeld
          label="Konfidenz"
          wert={
            zeile.konfidenz === null
              ? "—"
              : `${Math.round(zeile.konfidenz * 100)} %`
          }
        />
        <DetailFeld
          label="Entscheidung"
          wert={
            zeile.quelle ? (
              <Badge variant="outline" className="text-xs">
                {QUELLE_LABEL[zeile.quelle] ?? zeile.quelle}
              </Badge>
            ) : (
              "—"
            )
          }
        />
        {zeile.begruendung ? (
          <DetailFeld
            label="Begründung"
            wert={
              <span className="whitespace-pre-wrap text-muted-foreground">
                {zeile.begruendung}
              </span>
            }
            span={2}
          />
        ) : null}
        {zeile.pruef_grund ? (
          <DetailFeld
            label="Prüf-Grund"
            wert={
              <span className="text-destructive">{zeile.pruef_grund}</span>
            }
            span={2}
          />
        ) : null}
        <DetailFeld
          label="Belege"
          wert={
            zeile.beleg_anzahl > 0 ? (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {zeile.beleg_anzahl} verknüpft
              </span>
            ) : (
              <span className="text-muted-foreground">keine</span>
            )
          }
        />
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-2">
        <Button variant="outline" size="sm" onClick={onOpenSheet}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Alle Details + Audit-Historie
        </Button>
        {zeile.status !== "manuell_bestaetigt" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onBestaetigen}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Bestätigen
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DetailFeld({
  label,
  wert,
  span,
}: {
  label: string;
  wert: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "md:col-span-2" : undefined}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{wert}</div>
    </div>
  );
}

function KennCard({
  label,
  wert,
  akzent,
}: {
  label: string;
  wert: string;
  akzent: "positiv" | "negativ";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={
            "mt-1 text-xl font-semibold tabular-nums " +
            (akzent === "positiv"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive")
          }
        >
          {wert}
        </div>
      </CardContent>
    </Card>
  );
}

function SortIcon({
  aktiv,
  richtung,
}: {
  aktiv: boolean;
  richtung: Richtung;
}) {
  if (!aktiv) return <ArrowDownUp className="h-3 w-3 opacity-50" />;
  return richtung === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}

function BereichBadge({
  klassif,
  typ,
}: {
  klassif: BewegungZeile["klassifikation"];
  typ: KategorieTyp | null;
}) {
  // Visuelle Markierung des Bereichs — ohne dass wir die Filter-Logik
  // hier wiederholen müssen. Reine UI-Hilfe.
  if (klassif === "geschaeftlich" || typ === "einnahme" || typ === "ausgabe") {
    return (
      <Badge variant="default" className="text-xs">
        Geschäft
      </Badge>
    );
  }
  if (klassif === "privat" || typ === "privat") {
    return (
      <Badge variant="outline" className="text-xs">
        Privat
      </Badge>
    );
  }
  if (typ === "neutral" || klassif === "neutral") {
    return (
      <Badge variant="outline" className="text-xs">
        Neutral
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      Ungeklärt
    </Badge>
  );
}

function KategorieGruppen({
  kategorien,
}: {
  kategorien: KategorieOption[];
}) {
  const gruppen = useMemo(() => {
    const g: Record<KategorieTyp, KategorieOption[]> = {
      einnahme: [],
      ausgabe: [],
      privat: [],
      neutral: [],
    };
    for (const k of kategorien) g[k.typ].push(k);
    return g;
  }, [kategorien]);
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
