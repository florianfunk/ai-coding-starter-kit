"use client";

// Buchungen — Ledger-Ansicht im iOS 17 / Sonoma-Stil.
//
// Konzept:
//   - Page-Header: grosses Bold-H1 + kurzer Untertitel, kein Hero-Block.
//   - KPI-Karte: weisse Karte mit weichen Trennlinien, vier dichte Zahlen.
//   - Filter-Karte: weisse Karte, Quick-Pills + Konto/Zeitraum.
//   - Buchungs-Liste: weisse Karte mit dezenten Innen-Trennlinien (iOS-Style),
//     je Zeile linker 3px Akzent-Strich nur als Vorzeichen-Marker.
//   - Sehr ruhige Farben, Marken-Farben sparsam (Pluszahl=Cyan,
//     Minuszahl=Cerise, KI=Violet als Pin, Quick-Filter-Active=Violet).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";

import type {
  Buchung,
  BuchungStatus,
  Kategorie,
  Klassifikation,
  Konto,
} from "@/lib/types";
import { BuchungDetailSheet } from "@/components/buchungen/buchung-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Statisches Mapping
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<BuchungStatus, string> = {
  offen: "Offen",
  auto_verbucht: "Auto",
  zur_pruefung: "Prüfung",
  manuell_bestaetigt: "Bestätigt",
};

// Status-Pills im iOS-Stil: vollrund, sehr dezent gefuellt.
const STATUS_PILL: Record<BuchungStatus, string> = {
  offen: "bg-[color:var(--surface-2)] text-muted-foreground",
  auto_verbucht: "bg-[color:var(--surface-2)] text-foreground",
  zur_pruefung: "bg-tint-cerise text-destructive",
  manuell_bestaetigt: "bg-tint-cyan text-income-strong",
};

const KLASS_LABEL: Record<Klassifikation, string> = {
  privat: "Privat",
  geschaeftlich: "Geschäftlich",
  unklar: "Unklar",
  neutral: "Neutral",
};

// ---------------------------------------------------------------------------
// Format-Helfer
// ---------------------------------------------------------------------------

function formatBetrag(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDatumKurz(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
}

const MONATS_KURZ = [
  "Jan", "Feb", "Mrz", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

function monatLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-/);
  if (!m) return "—";
  const monat = parseInt(m[2], 10);
  return MONATS_KURZ[monat - 1] ?? "—";
}

// ---------------------------------------------------------------------------
// Quick-Filter
// ---------------------------------------------------------------------------

function isoHeute(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoVorTagen(t: number): string {
  const d = new Date();
  d.setDate(d.getDate() - t);
  return d.toISOString().slice(0, 10);
}
function isoMonatsAnfang(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function isoJahresAnfang(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function quartalsAnfang(q: 1 | 2 | 3 | 4): string {
  const jahr = new Date().getFullYear();
  const monat = (q - 1) * 3 + 1;
  return `${jahr}-${String(monat).padStart(2, "0")}-01`;
}
function quartalsEnde(q: 1 | 2 | 3 | 4): string {
  const jahr = new Date().getFullYear();
  const endMonat = q * 3;
  const tag = new Date(jahr, endMonat, 0).getDate();
  return `${jahr}-${String(endMonat).padStart(2, "0")}-${tag}`;
}

interface QuickFilter {
  id: string;
  label: string;
  von: string;
  bis: string;
}

type StatusFilter = "alle" | BuchungStatus;
type KlassFilter = "alle" | Klassifikation;
type KategorieFilter = "alle" | "ohne" | string; // string = kategorie_id
type SortFeld = "datum" | "betrag" | "empfaenger";
type SortRichtung = "asc" | "desc";

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  alle: "Alle",
  auto_verbucht: "Auto",
  zur_pruefung: "Prüfung",
  manuell_bestaetigt: "Bestätigt",
  offen: "Offen",
};

const KLASS_FILTER_LABEL: Record<KlassFilter, string> = {
  alle: "Alle",
  geschaeftlich: "Geschäftlich",
  privat: "Privat",
  unklar: "Unklar",
  neutral: "Neutral",
};

const SORT_LABEL: Record<SortFeld, string> = {
  datum: "Datum",
  betrag: "Betrag",
  empfaenger: "Empfänger",
};

const QUICK_FILTER: QuickFilter[] = [
  { id: "7t", label: "7 Tage", von: isoVorTagen(7), bis: isoHeute() },
  { id: "30t", label: "30 Tage", von: isoVorTagen(30), bis: isoHeute() },
  { id: "monat", label: "Dieser Monat", von: isoMonatsAnfang(), bis: isoHeute() },
  { id: "q1", label: "Q1", von: quartalsAnfang(1), bis: quartalsEnde(1) },
  { id: "q2", label: "Q2", von: quartalsAnfang(2), bis: quartalsEnde(2) },
  { id: "q3", label: "Q3", von: quartalsAnfang(3), bis: quartalsEnde(3) },
  { id: "q4", label: "Q4", von: quartalsAnfang(4), bis: quartalsEnde(4) },
  { id: "jahr", label: "Jahr", von: isoJahresAnfang(), bis: isoHeute() },
];

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

export function BuchungenLedger({
  buchungen,
  konten,
  kategorien,
  filter,
}: {
  buchungen: Buchung[];
  konten: Konto[];
  kategorien: Kategorie[];
  filter: { konto?: string; von?: string; bis?: string };
}) {
  const router = useRouter();
  const [konto, setKonto] = useState(filter.konto ?? "alle");
  const [von, setVon] = useState(filter.von ?? "");
  const [bis, setBis] = useState(filter.bis ?? "");
  const [detail, setDetail] = useState<Buchung | null>(null);
  const [detailOffen, setDetailOffen] = useState(false);

  // Client-side Filter & Sort (keine URL-Persistenz — Konto/Zeitraum macht
  // schon Server-Side-Filter; das hier verfeinert nur die geladene Menge).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [klassFilter, setKlassFilter] = useState<KlassFilter>("alle");
  const [kategorieFilter, setKategorieFilter] = useState<KategorieFilter>("alle");
  const [sortFeld, setSortFeld] = useState<SortFeld>("datum");
  const [sortRichtung, setSortRichtung] = useState<SortRichtung>("desc");

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "—";
  const kategorieById = useMemo(() => {
    const m = new Map<string, Kategorie>();
    for (const k of kategorien) m.set(k.id, k);
    return m;
  }, [kategorien]);

  // Filter anwenden (Status, Klassifikation, Kategorie).
  const gefiltert = useMemo(() => {
    return buchungen.filter((b) => {
      if (statusFilter !== "alle" && b.status !== statusFilter) return false;
      if (klassFilter !== "alle" && b.klassifikation !== klassFilter) return false;
      if (kategorieFilter === "ohne") {
        if (b.kategorie_id !== null) return false;
      } else if (kategorieFilter !== "alle") {
        if (b.kategorie_id !== kategorieFilter) return false;
      }
      return true;
    });
  }, [buchungen, statusFilter, klassFilter, kategorieFilter]);

  // Sortieren (auf Kopie, damit Props unverändert bleiben).
  const sortiert = useMemo(() => {
    const out = [...gefiltert];
    const dir = sortRichtung === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sortFeld === "datum") {
        return a.buchung_datum.localeCompare(b.buchung_datum) * dir;
      }
      if (sortFeld === "betrag") {
        return (a.betrag - b.betrag) * dir;
      }
      // empfaenger
      const an = (a.empfaenger ?? "").toLocaleLowerCase("de-DE");
      const bn = (b.empfaenger ?? "").toLocaleLowerCase("de-DE");
      return an.localeCompare(bn, "de-DE") * dir;
    });
    return out;
  }, [gefiltert, sortFeld, sortRichtung]);

  // Kategorien, die in der aktuellen Liste vorkommen — fürs Dropdown.
  const kategorienInListe = useMemo(() => {
    const ids = new Set<string>();
    for (const b of buchungen) {
      if (b.kategorie_id) ids.add(b.kategorie_id);
    }
    return kategorien
      .filter((k) => ids.has(k.id))
      .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, "de-DE"));
  }, [buchungen, kategorien]);

  // Kennzahlen der gefilterten Auswahl.
  const stats = useMemo(() => {
    let einnahmen = 0;
    let ausgaben = 0;
    let zurPruefung = 0;
    for (const b of sortiert) {
      if (b.betrag > 0) einnahmen += b.betrag;
      else ausgaben += Math.abs(b.betrag);
      if (b.status === "zur_pruefung") zurPruefung++;
    }
    return {
      anzahl: sortiert.length,
      einnahmen,
      ausgaben,
      saldo: einnahmen - ausgaben,
      zurPruefung,
    };
  }, [sortiert]);

  const aktiverQuickFilter = QUICK_FILTER.find(
    (q) => q.von === von && q.bis === bis,
  );

  function anwenden(neu?: { von?: string; bis?: string; konto?: string }) {
    const vNeu = neu?.von ?? von;
    const bNeu = neu?.bis ?? bis;
    const kNeu = neu?.konto ?? konto;
    setVon(vNeu);
    setBis(bNeu);
    setKonto(kNeu);
    const params = new URLSearchParams();
    if (kNeu && kNeu !== "alle") params.set("konto", kNeu);
    if (vNeu) params.set("von", vNeu);
    if (bNeu) params.set("bis", bNeu);
    const qs = params.toString();
    router.push(qs ? `/buchungen?${qs}` : "/buchungen");
  }

  function zuruecksetzen() {
    setKonto("alle");
    setVon("");
    setBis("");
    setStatusFilter("alle");
    setKlassFilter("alle");
    setKategorieFilter("alle");
    setSortFeld("datum");
    setSortRichtung("desc");
    router.push("/buchungen");
  }

  function oeffneDetail(b: Buchung) {
    setDetail(b);
    setDetailOffen(true);
  }

  function toggleSort(feld: SortFeld) {
    if (sortFeld === feld) {
      setSortRichtung((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSortFeld(feld);
      setSortRichtung(feld === "empfaenger" ? "asc" : "desc");
    }
  }

  const istLeer = sortiert.length === 0;
  const hatFilter =
    konto !== "alle" ||
    von !== "" ||
    bis !== "" ||
    statusFilter !== "alle" ||
    klassFilter !== "alle" ||
    kategorieFilter !== "alle" ||
    sortFeld !== "datum" ||
    sortRichtung !== "desc";

  // Monats-Gruppierung macht nur Sinn beim Sortieren nach Datum;
  // bei Betrag/Empfänger zeige ich eine einzige flache Sektion.
  const gruppen = useMemo(() => {
    if (sortFeld !== "datum") {
      return [[`flach`, sortiert]] as [string, Buchung[]][];
    }
    const map = new Map<string, Buchung[]>();
    for (const b of sortiert) {
      const m = b.buchung_datum.slice(0, 7); // "YYYY-MM"
      const arr = map.get(m) ?? [];
      arr.push(b);
      map.set(m, arr);
    }
    const eintraege = Array.from(map.entries());
    eintraege.sort((a, b) =>
      sortRichtung === "desc" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]),
    );
    return eintraege;
  }, [sortiert, sortFeld, sortRichtung]);

  return (
    <div className="space-y-7">
      {/* ───────────────── PAGE-HEADER ───────────────── */}
      <header>
        <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-[-0.024em]">
          Buchungen
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
          Alle importierten Kontobewegungen. Der Agent klassifiziert sie
          autonom — privat/geschäftlich, Steuerrelevanz, EÜR-Kategorie. Tippe
          eine Zeile für Begründung und Audit-Trail.
        </p>
      </header>

      {/* ───────────────── KPI-KARTE ───────────────── */}
      <section className="rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="grid grid-cols-2 divide-x divide-line/60 sm:grid-cols-4">
          <KpiZelle
            label="Einträge"
            wert={String(stats.anzahl)}
          />
          <KpiZelle
            label="Einnahmen"
            wert={formatBetrag(stats.einnahmen) + " €"}
            akzent="income"
          />
          <KpiZelle
            label="Ausgaben"
            wert={formatBetrag(-stats.ausgaben) + " €"}
            akzent="expense"
          />
          <KpiZelle
            label="Saldo"
            wert={formatBetrag(stats.saldo) + " €"}
            akzent={stats.saldo >= 0 ? "income" : "expense"}
            betont
          />
        </div>
      </section>

      {/* ───────────────── FILTER-KARTE ───────────────── */}
      <section className="space-y-3 rounded-[var(--radius)] bg-card p-5 shadow-[var(--shadow-1)] ring-1 ring-line/60">
        {/* Quick-Filter-Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_FILTER.map((q) => {
            const aktiv = aktiverQuickFilter?.id === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => anwenden({ von: q.von, bis: q.bis })}
                className={cn(
                  "rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors",
                  aktiv
                    ? "bg-brand-violet text-white"
                    : "bg-[color:var(--surface-2)] text-foreground hover:bg-tint-violet",
                )}
              >
                {q.label}
              </button>
            );
          })}
          {hatFilter ? (
            <button
              type="button"
              onClick={zuruecksetzen}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--surface-2)] hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" /> Filter zurücksetzen
            </button>
          ) : null}
        </div>

        {/* Konto + Datum */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="f-konto" className="text-xs text-muted-foreground">
              Konto
            </Label>
            <Select value={konto} onValueChange={(v) => anwenden({ konto: v })}>
              <SelectTrigger
                id="f-konto"
                className="rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)]"
              >
                <SelectValue placeholder="Alle Konten" />
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
          <div className="space-y-1.5">
            <Label htmlFor="f-von" className="text-xs text-muted-foreground">
              Von
            </Label>
            <Input
              id="f-von"
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              onBlur={() => anwenden()}
              className="rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-bis" className="text-xs text-muted-foreground">
              Bis
            </Label>
            <Input
              id="f-bis"
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              onBlur={() => anwenden()}
              className="rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)]"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => anwenden()}
              className="h-10 rounded-[var(--radius-inner)] bg-brand-violet font-semibold text-white hover:bg-[color:var(--accent-hover)]"
            >
              Anwenden
            </Button>
          </div>
        </div>

        {/* Verfeinerung: Status, Klassifikation, Kategorie, Sortierung */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-status" className="text-xs text-muted-foreground">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger
                id="f-status"
                className="rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)]"
              >
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-klass" className="text-xs text-muted-foreground">
              Klassifikation
            </Label>
            <Select
              value={klassFilter}
              onValueChange={(v) => setKlassFilter(v as KlassFilter)}
            >
              <SelectTrigger
                id="f-klass"
                className="rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KLASS_FILTER_LABEL) as KlassFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KLASS_FILTER_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-kat" className="text-xs text-muted-foreground">
              Kategorie
            </Label>
            <Select
              value={kategorieFilter}
              onValueChange={(v) => setKategorieFilter(v as KategorieFilter)}
            >
              <SelectTrigger
                id="f-kat"
                className="rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                <SelectItem value="ohne">Ohne Kategorie</SelectItem>
                {kategorienInListe.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.bezeichnung}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sortierung</Label>
            <div className="flex h-10 items-stretch gap-1 rounded-[var(--radius-inner)] bg-[color:var(--surface-2)] p-1">
              {(Object.keys(SORT_LABEL) as SortFeld[]).map((feld) => {
                const aktiv = sortFeld === feld;
                return (
                  <button
                    key={feld}
                    type="button"
                    onClick={() => toggleSort(feld)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1 rounded-[calc(var(--radius-inner)-2px)] text-[12.5px] font-semibold transition-colors",
                      aktiv
                        ? "bg-card text-foreground shadow-[var(--shadow-1)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={aktiv}
                  >
                    {SORT_LABEL[feld]}
                    {aktiv ? (
                      sortRichtung === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── LEDGER ───────────────── */}
      {istLeer ? (
        <LedgerLeer
          gefiltert={buchungen.length > 0}
          onReset={zuruecksetzen}
        />
      ) : (
        <section className="space-y-6">
          {gruppen.map(([monatKey, items], gIdx) => {
            const istFlach = monatKey === "flach";
            const label = istFlach
              ? `Sortiert nach ${SORT_LABEL[sortFeld]}`
              : (() => {
                  const jahr = monatKey.slice(0, 4);
                  const monat = parseInt(monatKey.slice(5, 7), 10);
                  return `${MONATS_KURZ[monat - 1]} ${jahr}`;
                })();
            return (
              <div key={monatKey}>
                {/* Sektion-Header — wie iOS Settings */}
                <div className="mb-2 flex items-baseline justify-between px-3 sm:px-1">
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {label}
                  </h2>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {items.length} {items.length === 1 ? "Eintrag" : "Einträge"}
                  </span>
                </div>

                {/* Karte mit Eintraegen */}
                <ul
                  role="list"
                  className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60"
                >
                  {items.map((b, idx) => (
                    <LedgerZeile
                      key={b.id}
                      buchung={b}
                      kontoName={kontoName(b.konto_id)}
                      kategorie={
                        b.kategorie_id
                          ? (kategorieById.get(b.kategorie_id) ?? null)
                          : null
                      }
                      onClick={() => oeffneDetail(b)}
                      letzterEintrag={idx === items.length - 1}
                      animationsIndex={gIdx === 0 ? idx : -1}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <BuchungDetailSheet
        buchung={detail}
        kategorien={kategorien}
        open={detailOffen}
        onOpenChange={setDetailOffen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KpiZelle — eine Zahl in der KPI-Karte
// ---------------------------------------------------------------------------

function KpiZelle({
  label,
  wert,
  akzent,
  betont = false,
}: {
  label: string;
  wert: string;
  akzent?: "income" | "expense";
  /** betont = etwas groesser, fuer Saldo */
  betont?: boolean;
}) {
  const farbe = akzent === "income"
    ? "text-income-strong"
    : akzent === "expense"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="px-5 py-4 sm:py-5">
      <div className="text-[12px] font-medium text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono font-bold tabular-nums leading-none",
          betont ? "text-2xl" : "text-xl",
          farbe,
        )}
      >
        {wert}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LedgerZeile — iOS-Listen-Eintrag
// ---------------------------------------------------------------------------

function LedgerZeile({
  buchung: b,
  kontoName,
  kategorie,
  onClick,
  letzterEintrag,
  animationsIndex,
}: {
  buchung: Buchung;
  kontoName: string;
  kategorie: Kategorie | null;
  onClick: () => void;
  letzterEintrag: boolean;
  animationsIndex: number;
}) {
  const ausgabe = b.betrag < 0;
  const datumKurz = formatDatumKurz(b.buchung_datum);
  const monatHinweis = monatLabel(b.buchung_datum);
  const konfidenz = b.konfidenz !== null ? Math.round(b.konfidenz * 100) : null;
  const verwendung = b.verwendungszweck?.trim() ?? "";

  return (
    <li
      className={cn(!letzterEintrag && "border-b border-line-hair")}
      style={{
        animation:
          animationsIndex >= 0 && animationsIndex < 12
            ? "ledgerIn 0.4s ease-out backwards"
            : undefined,
        animationDelay:
          animationsIndex >= 0 && animationsIndex < 12
            ? `${animationsIndex * 22}ms`
            : undefined,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative grid w-full grid-cols-[3px_88px_1fr_auto_16px] items-stretch gap-x-4 py-3 pl-3 pr-3 text-left transition-colors hover:bg-[color:var(--surface-2)] sm:pl-4 sm:pr-4"
      >
        {/* Vorzeichen-Balken links (statt Icon-Container — schlanker, tabellariger) */}
        <div
          aria-hidden
          className={cn(
            "self-stretch rounded-full",
            ausgabe ? "bg-destructive/70" : "bg-income-strong/70",
          )}
        />

        {/* Spalte Datum — schmal, fix */}
        <div className="flex flex-col justify-center font-mono text-[12.5px] tabular-nums text-muted-foreground">
          <span className="text-[13px] font-semibold text-foreground">
            {datumKurz}
          </span>
          <span className="text-[11px] uppercase tracking-wide">
            {monatHinweis}
          </span>
        </div>

        {/* Spalte Inhalt — 3 Zeilen */}
        <div className="min-w-0 space-y-1">
          {/* Zeile 1 — Empfänger */}
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold leading-tight">
              {b.empfaenger?.trim() || "—"}
            </span>
            {b.quelle === "ki" ? (
              <Sparkles
                className="h-3 w-3 shrink-0 text-brand-violet"
                aria-label="KI-Klassifizierung"
              />
            ) : null}
          </div>

          {/* Zeile 2 — Kategorie (voll sichtbar) + Klassifikation + Status */}
          <div className="flex flex-wrap items-center gap-1.5">
            {kategorie ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-tint-violet px-2 py-0.5 text-[11.5px] font-medium text-brand-violet">
                <Tag className="h-3 w-3 shrink-0" />
                <span>{kategorie.bezeichnung}</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                ohne Kategorie
              </span>
            )}
            {b.klassifikation && b.klassifikation !== "unklar" ? (
              <span className="inline-flex items-center rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {KLASS_LABEL[b.klassifikation]}
              </span>
            ) : b.klassifikation === "unklar" ? (
              <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-highlight-strong">
                <HelpCircle className="h-3 w-3" />
                Unklar
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                STATUS_PILL[b.status],
              )}
            >
              {STATUS_LABEL[b.status]}
            </span>
          </div>

          {/* Zeile 3 — Verwendungszweck + Konto */}
          <div className="flex items-baseline gap-2 text-[12px] text-muted-foreground">
            <span className="truncate">{verwendung || "—"}</span>
            <span className="text-line-strong">·</span>
            <span className="shrink-0 text-[11.5px] uppercase tracking-wide">
              {kontoName}
            </span>
          </div>
        </div>

        {/* Spalte Betrag — rechts, kompakt */}
        <div className="flex flex-col items-end justify-center gap-1">
          <div
            className={cn(
              "font-mono text-[16px] font-bold tabular-nums leading-none",
              ausgabe ? "text-destructive" : "text-income-strong",
            )}
          >
            {ausgabe ? "−" : "+"}
            {formatBetrag(Math.abs(b.betrag))}
            {b.waehrung !== "EUR" ? (
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                {b.waehrung}
              </span>
            ) : null}
          </div>
          {konfidenz !== null && konfidenz < 70 ? (
            <span className="font-mono text-[10.5px] font-medium text-muted-foreground">
              Konfidenz {konfidenz}%
            </span>
          ) : null}
        </div>

        {/* Chevron */}
        <ChevronRight className="self-center text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />

        <span className="sr-only">
          {b.klassifikation
            ? `Klassifikation: ${KLASS_LABEL[b.klassifikation]}`
            : "Noch nicht klassifiziert"}
          {`. Monat: ${monatHinweis}.`}
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function LedgerLeer({
  gefiltert,
  onReset,
}: {
  gefiltert: boolean;
  onReset: () => void;
}) {
  return (
    <section className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-violet text-brand-violet">
        <TrendingUp className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
        {gefiltert ? "Keine Treffer" : "Keine Buchungen"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
        {gefiltert ? (
          "Die aktiven Filter liefern keine Einträge. Lockere sie oder setze sie zurück."
        ) : (
          <>
            Für die aktuelle Auswahl liegen keine Bewegungen vor. Importiere
            einen Kontoauszug unter{" "}
            <strong>Bankkonten → Kontoauszug importieren</strong>.
          </>
        )}
      </p>
      {gefiltert ? (
        <Button
          variant="outline"
          className="mt-5 rounded-full"
          onClick={onReset}
        >
          Filter zurücksetzen
        </Button>
      ) : null}
    </section>
  );
}
