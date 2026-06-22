"use client";

// PROJ-18 — Lieferanten-Liste mit drei Sektionen
// (Geschäftlich / Privat / Unklar). Pattern lehnt sich an
// abo-radar.tsx an, ist aber bewusst eigener Datentyp/eigene
// Komponente, damit beide Tabs unabhängig evolvieren können.
//
// Aktionen pro Lieferant:
//   - Aufklappen → Buchungstabelle mit Inline-Kategorie-Select
//   - Bulk: Kategorie auf alle anwenden, "Alle bestätigen & Regel lernen"
//   - Pauschal "Immer privat" / "Immer geschäftlich"
//     → setzt klassifikation auf alle + legt Klassifikations-Regel an
//   - Eye-Icon: BuchungDetailSheet öffnen

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Eye,
  Loader2,
  Repeat,
  StickyNote,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  lerneKlassifikationsRegel,
  lerneRegelFuer,
  regelToast,
} from "@/lib/finanzen/regel-helper";
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";
import { BuchungDetailSheet } from "@/components/kategorien-analyse/buchung-detail-sheet";
import { BetragSummary } from "@/components/kategorien-analyse/betrag-summary";
import { LieferantNotizenPanel } from "@/components/lieferanten-notizen/lieferant-notizen-panel";
import type { KategorieTyp } from "@/lib/types";
import type { BulkKategorieResponse } from "@/app/api/buchungen/bulk-kategorie/route";
import type { BulkKlassifikationResponse } from "@/app/api/buchungen/bulk-klassifikation/route";
import type { BulkUstResponse } from "@/app/api/buchungen/bulk-ust/route";
import type {
  LieferantBuchungAnzeige,
  LieferantItemAnzeige,
  LieferantenResponse,
} from "@/app/api/finanzen/lieferanten/route";

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

// USt-Satz ⇄ Select-Wert. null = "kein" (neutrale/private Posten ohne Satz).
function ustZuWert(u: number | null | undefined): string {
  return u === null || u === undefined ? "kein" : String(u);
}
function wertZuUst(v: string): number | null {
  return v === "kein" ? null : Number(v);
}

const KLASSIFIKATION_ICON = {
  geschaeftlich: Briefcase,
  privat: User,
  unklar: CircleHelp,
} as const;

/** Deutsche Labels für die Abo-Intervalle (PROJ-18 Abo-Markierung). */
const ABO_INTERVALL_LABEL = {
  woechentlich: "wöchentlich",
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  jaehrlich: "jährlich",
} as const;

/**
 * Neutrale Buchungen (Geldtransit/Umbuchung) ans Ende sortieren, innerhalb
 * jeder Gruppe chronologisch. So führen im Drilldown die steuerlich
 * relevanten Buchungen — die Durchläufer landen sichtbar abgesetzt darunter.
 */
function neutralAnsEnde(
  bs: LieferantBuchungAnzeige[],
): LieferantBuchungAnzeige[] {
  return [...bs].sort((a, b) => {
    const an = a.kategorie_typ === "neutral" ? 1 : 0;
    const bn = b.kategorie_typ === "neutral" ? 1 : 0;
    if (an !== bn) return an - bn;
    return a.buchung_datum.localeCompare(b.buchung_datum);
  });
}

export function LieferantenListe({
  daten,
  onMutiert,
}: {
  daten: LieferantenResponse;
  onMutiert?: () => void;
}) {
  const [kategorien, setKategorien] = useState<KategorieOption[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [offen, setOffen] = useState<{
    geschaeftlich: boolean;
    privat: boolean;
    unklar: boolean;
  }>({ geschaeftlich: true, privat: true, unklar: true });

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/kontenrahmen");
        if (r.ok) {
          const j = (await r.json()) as { data: KategorieOption[] };
          setKategorien(j.data.filter((k) => k.aktiv));
        }
      } catch {
        /* nicht hard-failen — Inline-Edit nur eingeschränkt */
      }
    })();
  }, []);

  const sektionen = {
    geschaeftlich: daten.items.filter(
      (i) => i.dominante_klassifikation === "geschaeftlich",
    ),
    privat: daten.items.filter(
      (i) => i.dominante_klassifikation === "privat",
    ),
    unklar: daten.items.filter(
      (i) => i.dominante_klassifikation === "unklar",
    ),
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">
          Lieferanten
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Lookback {daten.lookback.von} – {daten.lookback.bis}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Empfänger mit ≥ 3 Buchungen, die kein Abo-Muster bilden. Aldi,
          MediaMarkt, Tankstelle und ähnliche.
        </p>
      </CardHeader>
      <CardContent>
        {daten.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Lieferanten erkannt — Empfänger mit ≥ 3 Buchungen ohne
            Abo-Muster erscheinen hier.
          </p>
        ) : (
          <div className="space-y-5">
            <SektionBlock
              titel="Geschäftlich"
              klassifikation="geschaeftlich"
              count={sektionen.geschaeftlich.length}
              expanded={offen.geschaeftlich}
              onToggle={() =>
                setOffen((s) => ({ ...s, geschaeftlich: !s.geschaeftlich }))
              }
            >
              {sektionen.geschaeftlich.map((item) => (
                <LieferantItemRow
                  key={item.empfaenger_norm}
                  item={item}
                  kategorien={kategorien}
                  onOpenSheet={(id) => setDetailId(id)}
                  onMutiert={onMutiert}
                />
              ))}
              {sektionen.geschaeftlich.length === 0 ? (
                <SektionLeer text="Keine geschäftlichen Lieferanten erkannt." />
              ) : null}
            </SektionBlock>

            <SektionBlock
              titel="Privat"
              klassifikation="privat"
              count={sektionen.privat.length}
              expanded={offen.privat}
              onToggle={() =>
                setOffen((s) => ({ ...s, privat: !s.privat }))
              }
            >
              {sektionen.privat.map((item) => (
                <LieferantItemRow
                  key={item.empfaenger_norm}
                  item={item}
                  kategorien={kategorien}
                  onOpenSheet={(id) => setDetailId(id)}
                  onMutiert={onMutiert}
                />
              ))}
              {sektionen.privat.length === 0 ? (
                <SektionLeer text="Keine privaten Lieferanten erkannt." />
              ) : null}
            </SektionBlock>

            <SektionBlock
              titel="Unklar"
              klassifikation="unklar"
              count={sektionen.unklar.length}
              expanded={offen.unklar}
              onToggle={() =>
                setOffen((s) => ({ ...s, unklar: !s.unklar }))
              }
            >
              {sektionen.unklar.map((item) => (
                <LieferantItemRow
                  key={item.empfaenger_norm}
                  item={item}
                  kategorien={kategorien}
                  onOpenSheet={(id) => setDetailId(id)}
                  onMutiert={onMutiert}
                />
              ))}
              {sektionen.unklar.length === 0 ? (
                <SektionLeer text="Keine gemischten Lieferanten — alle sind eindeutig klassifiziert." />
              ) : null}
            </SektionBlock>
          </div>
        )}
      </CardContent>

      <BuchungDetailSheet
        buchungId={detailId}
        kategorien={kategorien}
        onClose={() => setDetailId(null)}
        onMutiert={() => onMutiert?.()}
      />
    </Card>
  );
}

function SektionBlock({
  titel,
  klassifikation,
  count,
  expanded,
  onToggle,
  children,
}: {
  titel: string;
  klassifikation: "geschaeftlich" | "privat" | "unklar";
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = KLASSIFIKATION_ICON[klassifikation];
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 border-b py-2 text-left transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
          {titel}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
        <span className="flex-1" />
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {expanded ? <div className="divide-y">{children}</div> : null}
    </section>
  );
}

function SektionLeer({ text }: { text: string }) {
  return (
    <div className="px-2 py-5 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function LieferantItemRow({
  item,
  kategorien,
  onOpenSheet,
  onMutiert,
}: {
  item: LieferantItemAnzeige;
  kategorien: KategorieOption[];
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // PROJ-21 — Notiz-Zähler lokal, damit das Badge nach Add/Delete im Drilldown
  // sofort stimmt, ohne die ganze Liste neu zu laden.
  const [notizAnzahl, setNotizAnzahl] = useState(item.notiz_anzahl);
  const tintHintergrund =
    item.richtung === "einnahme" ? "bg-tint-cyan" : "bg-tint-cerise";
  const richtungFarbe =
    item.richtung === "einnahme"
      ? "text-income-strong dark:text-income"
      : "text-destructive";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 py-3 pl-3 pr-2 text-left transition-all hover:brightness-95 ${tintHintergrund}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {item.empfaenger}
            </span>
            {item.dominante_kategorie_anzeige ? (
              <Badge variant="outline" className="text-[10px]">
                {item.dominante_kategorie_anzeige.bezeichnung}
                <span className="ml-1 text-muted-foreground tabular-nums">
                  {Math.round(
                    item.dominante_kategorie_anzeige.anteil * 100,
                  )}
                  %
                </span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                ohne Kategorie
              </Badge>
            )}
            {item.abo ? (
              <Badge
                variant="secondary"
                className="gap-1 text-[10px]"
                title={`Wiederkehrend (${ABO_INTERVALL_LABEL[item.abo.intervall]}) — erscheint auch im Abo-Radar`}
              >
                <Repeat className="h-3 w-3" />
                Abo · {ABO_INTERVALL_LABEL[item.abo.intervall]}
              </Badge>
            ) : null}
            {notizAnzahl > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-tint-yellow px-1.5 py-0.5 text-[10px] font-medium text-highlight-strong"
                title={item.notiz_vorschau ?? "Notiz vorhanden"}
              >
                <StickyNote className="h-3 w-3" />
                {notizAnzahl}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {item.richtung === "einnahme" ? (
              <ArrowUpRight className="h-3 w-3 text-income-strong" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-destructive" />
            )}
            <span>
              {item.anzahl}× erfasst · {deDate(item.erste)} →{" "}
              {deDate(item.letzte)}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-baseline gap-6 text-right sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Gesamt
            </div>
            <div className="font-mono text-sm tabular-nums">
              {eur(item.gesamt_summe)}
            </div>
          </div>
          <div className="min-w-[110px]">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Jahr
            </div>
            <div
              className={`font-mono text-base font-semibold tabular-nums ${richtungFarbe}`}
            >
              {eur(item.jahresumsatz)}
            </div>
          </div>
        </div>

        <span className="shrink-0 text-muted-foreground transition-transform group-hover:text-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded ? (
        <div className="border-t bg-muted/20 px-2 py-3">
          <LieferantDrilldown
            item={item}
            kategorien={kategorien}
            onOpenSheet={onOpenSheet}
            onMutiert={onMutiert}
            onNotizAnzahl={setNotizAnzahl}
          />
        </div>
      ) : null}
    </div>
  );
}

function LieferantDrilldown({
  item,
  kategorien,
  onOpenSheet,
  onMutiert,
  onNotizAnzahl,
}: {
  item: LieferantItemAnzeige;
  kategorien: KategorieOption[];
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
  /** PROJ-21 — meldet die aktuelle Notiz-Anzahl zurück (Badge-Update). */
  onNotizAnzahl?: (anzahl: number) => void;
}) {
  // Lokaler Snapshot — optimistische Updates ohne Komplett-Reload.
  // Neutrale Durchläufer ans Ende; Reihenfolge danach stabil, damit
  // Inline-Edits keine Zeilen springen lassen.
  const [buchungen, setBuchungen] = useState<LieferantBuchungAnzeige[]>(() =>
    neutralAnsEnde(item.buchungen),
  );
  useEffect(() => {
    setBuchungen(neutralAnsEnde(item.buchungen));
    setAuswahl(new Set());
  }, [item.buchungen]);

  const [bulkKat, setBulkKat] = useState<string>("__none__");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ustSavingId, setUstSavingId] = useState<string | null>(null);
  const [bulkBusy, startBulk] = useTransition();
  const [klassBusy, setKlassBusy] = useState<
    "privat" | "geschaeftlich" | null
  >(null);

  // PROJ-18 — Zeilen-Auswahl + Bulk-Bearbeitung der markierten Teilmenge
  // (Klassifikation / Kategorie / USt), analog zur Prüfliste.
  const [auswahl, setAuswahl] = useState<Set<string>>(() => new Set());
  const [selKat, setSelKat] = useState<string>("__none__");
  const [selUst, setSelUst] = useState<string>("__none__");
  const [selBusy, setSelBusy] = useState(false);

  const alleGewaehlt =
    buchungen.length > 0 && buchungen.every((b) => auswahl.has(b.id));
  function toggleAuswahl(id: string) {
    setAuswahl((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function alleWaehlen(an: boolean) {
    setAuswahl(an ? new Set(buchungen.map((b) => b.id)) : new Set());
  }
  const auswahlIds = () =>
    buchungen.filter((b) => auswahl.has(b.id)).map((b) => b.id);

  const distinct = new Set(
    buchungen.map((b) => b.kategorie_id ?? "__none__"),
  );
  const alleGleicheKategorie = distinct.size === 1;
  const aktuelleKategorieId =
    alleGleicheKategorie && !distinct.has("__none__")
      ? Array.from(distinct)[0]
      : null;

  async function aendereEinzeln(
    b: LieferantBuchungAnzeige,
    neueId: string,
  ) {
    if (neueId === b.kategorie_id) return;
    setSavingId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategorie_id: neueId, bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const neueKat = kategorien.find((k) => k.id === neueId);
      setBuchungen((bs) =>
        bs.map((x) =>
          x.id === b.id
            ? {
                ...x,
                kategorie_id: neueId,
                kategorie_bezeichnung: neueKat?.bezeichnung ?? null,
                kategorie_typ: neueKat?.typ ?? null,
                status: "manuell_bestaetigt",
              }
            : x,
        ),
      );
      toast.success("Kategorie geändert");
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Fehler: " + (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setSavingId(null);
    }
  }

  // Einzelne Zeile: USt-Satz ändern (0/7/19/null) — speichert sofort und
  // bestätigt die Buchung (wie der Kategorie-Inline-Edit).
  async function aendereUstEinzeln(
    b: LieferantBuchungAnzeige,
    neuerSatz: number | null,
  ) {
    if (neuerSatz === (b.ust_satz ?? null)) return;
    setUstSavingId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ust_satz: neuerSatz, bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      setBuchungen((bs) =>
        bs.map((x) =>
          x.id === b.id
            ? { ...x, ust_satz: neuerSatz, status: "manuell_bestaetigt" }
            : x,
        ),
      );
      toast.success("USt-Satz geändert");
      onMutiert?.();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setUstSavingId(null);
    }
  }

  // Bulk auf die markierte Teilmenge — Klassifikation.
  async function bulkKlassAuswahl(klass: "privat" | "geschaeftlich") {
    const ids = auswahlIds();
    if (ids.length === 0) return;
    setSelBusy(true);
    try {
      const r = await fetch("/api/buchungen/bulk-klassifikation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, klassifikation: klass }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as BulkKlassifikationResponse;
      setBuchungen((bs) =>
        bs.map((b) =>
          auswahl.has(b.id)
            ? { ...b, klassifikation: j.klassifikation, status: "manuell_bestaetigt" }
            : b,
        ),
      );
      toast.success(
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} als ${klass === "privat" ? "privat" : "geschäftlich"} markiert`,
      );
      setAuswahl(new Set());
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Klassifikation fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setSelBusy(false);
    }
  }

  // Bulk auf die markierte Teilmenge — Kategorie.
  async function bulkKatAuswahl() {
    if (selKat === "__none__") {
      toast.error("Bitte eine Kategorie auswählen.");
      return;
    }
    const ids = auswahlIds();
    if (ids.length === 0) return;
    setSelBusy(true);
    try {
      const r = await fetch("/api/buchungen/bulk-kategorie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, kategorie_id: selKat }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as BulkKategorieResponse;
      setBuchungen((bs) =>
        bs.map((b) =>
          auswahl.has(b.id)
            ? {
                ...b,
                kategorie_id: j.kategorie.id,
                kategorie_bezeichnung: j.kategorie.bezeichnung,
                kategorie_typ: j.kategorie.typ,
                status: "manuell_bestaetigt",
              }
            : b,
        ),
      );
      toast.success(
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf "${j.kategorie.bezeichnung}" gesetzt`,
      );
      setAuswahl(new Set());
      setSelKat("__none__");
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Kategorie-Update fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setSelBusy(false);
    }
  }

  // Bulk auf die markierte Teilmenge — USt-Satz.
  async function bulkUstAuswahl() {
    if (selUst === "__none__") {
      toast.error("Bitte einen USt-Satz auswählen.");
      return;
    }
    const ids = auswahlIds();
    if (ids.length === 0) return;
    const satz = wertZuUst(selUst);
    setSelBusy(true);
    try {
      const r = await fetch("/api/buchungen/bulk-ust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ust_satz: satz }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as BulkUstResponse;
      setBuchungen((bs) =>
        bs.map((b) =>
          auswahl.has(b.id)
            ? { ...b, ust_satz: satz, status: "manuell_bestaetigt" }
            : b,
        ),
      );
      toast.success(
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf ${satz === null ? "kein" : satz + " %"} gesetzt`,
      );
      setAuswahl(new Set());
      setSelUst("__none__");
      onMutiert?.();
    } catch (e) {
      toast.error(
        "USt-Update fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setSelBusy(false);
    }
  }

  function wendeAufAlleAn() {
    if (bulkKat === "__none__") {
      toast.error("Bitte eine Kategorie auswählen.");
      return;
    }
    const ids = buchungen.map((b) => b.id);
    startBulk(async () => {
      try {
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, kategorie_id: bulkKat }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as BulkKategorieResponse;
        setBuchungen((bs) =>
          bs.map((b) => ({
            ...b,
            kategorie_id: j.kategorie.id,
            kategorie_bezeichnung: j.kategorie.bezeichnung,
            kategorie_typ: j.kategorie.typ,
            status: "manuell_bestaetigt",
          })),
        );

        const regelStatus = await lerneRegelFuer(
          item.empfaenger,
          j.kategorie.id,
          j.kategorie.typ,
        );
        regelToast(
          regelStatus,
          item.empfaenger,
          `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf "${j.kategorie.bezeichnung}" gesetzt`,
        );
        onMutiert?.();
      } catch (e) {
        toast.error(
          "Bulk-Update fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  function alleBestaetigenMitRegel() {
    if (!alleGleicheKategorie || !aktuelleKategorieId) {
      toast.error(
        "Geht nur, wenn alle Buchungen dieselbe Kategorie haben. Vorher 'auf alle anwenden' nutzen.",
      );
      return;
    }
    startBulk(async () => {
      try {
        const ids = buchungen.map((b) => b.id);
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids,
            kategorie_id: aktuelleKategorieId,
          }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as BulkKategorieResponse;
        setBuchungen((bs) =>
          bs.map((b) => ({
            ...b,
            kategorie_id: j.kategorie.id,
            kategorie_bezeichnung: j.kategorie.bezeichnung,
            kategorie_typ: j.kategorie.typ,
            status: "manuell_bestaetigt",
          })),
        );

        const regelStatus = await lerneRegelFuer(
          item.empfaenger,
          j.kategorie.id,
          j.kategorie.typ,
        );
        regelToast(
          regelStatus,
          item.empfaenger,
          `Alle ${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} bestätigt`,
        );
        onMutiert?.();
      } catch (e) {
        toast.error(
          "Alle bestätigen fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  async function setzeKlassifikationPauschal(
    klass: "privat" | "geschaeftlich",
  ) {
    setKlassBusy(klass);
    try {
      const ids = buchungen.map((b) => b.id);
      const r = await fetch("/api/buchungen/bulk-klassifikation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, klassifikation: klass }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as BulkKlassifikationResponse;
      setBuchungen((bs) =>
        bs.map((b) => ({
          ...b,
          klassifikation: j.klassifikation,
          status: "manuell_bestaetigt",
        })),
      );

      const regelStatus = await lerneKlassifikationsRegel(
        item.empfaenger,
        klass,
      );
      regelToast(
        regelStatus,
        item.empfaenger,
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} als ${klass === "privat" ? "privat" : "geschäftlich"} markiert`,
      );
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Klassifikation fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setKlassBusy(null);
    }
  }

  return (
    <div className="space-y-3 px-2">
      {/* Klassifikations-Aktion */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Pauschal markieren
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setzeKlassifikationPauschal("privat")}
            disabled={klassBusy !== null}
            title={`Alle ${buchungen.length} als privat markieren + Regel anlegen`}
          >
            {klassBusy === "privat" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <User className="mr-1.5 h-3.5 w-3.5" />
            )}
            Immer privat
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setzeKlassifikationPauschal("geschaeftlich")}
            disabled={klassBusy !== null}
            title={`Alle ${buchungen.length} als geschäftlich markieren + Regel anlegen`}
          >
            {klassBusy === "geschaeftlich" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
            )}
            Immer geschäftlich
          </Button>
        </div>
      </div>

      {/* Bulk-Kategorie-Aktion */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Kategorie auf alle anwenden
          </div>
          <div className="flex items-center gap-2">
            <KategorieCombobox
              kategorien={kategorien}
              value={bulkKat === "__none__" ? "" : bulkKat}
              onChange={(v) => {
                if (v) setBulkKat(v);
              }}
              placeholder="Kategorie wählen…"
              triggerClassName="h-9 w-[280px] text-sm"
              ariaLabel="Kategorie wählen"
            />
            <Button
              size="sm"
              onClick={wendeAufAlleAn}
              disabled={bulkBusy || bulkKat === "__none__"}
            >
              {bulkBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Auf alle {buchungen.length} anwenden
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={alleBestaetigenMitRegel}
              disabled={
                bulkBusy || !alleGleicheKategorie || !aktuelleKategorieId
              }
              title={
                !alleGleicheKategorie
                  ? "Buchungen haben uneinheitliche Kategorien — vorher 'auf alle anwenden' nutzen"
                  : !aktuelleKategorieId
                    ? "Es ist keine Kategorie gesetzt"
                    : `Alle ${buchungen.length} bestätigen und Regel für "${item.empfaenger}" lernen`
              }
            >
              {bulkBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              Alle bestätigen & Regel lernen
            </Button>
          </div>
        </div>
      </div>

      {/* Auswahl-Bulk — nur sichtbar, wenn Zeilen markiert sind. Wirkt auf
          die markierte Teilmenge (nicht auf alle Buchungen des Lieferanten). */}
      {auswahl.size > 0 ? (
        <div className="space-y-2 rounded-md border border-brand-violet/40 bg-tint-violet/30 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-violet">
              Auswahl bearbeiten · {auswahl.size} markiert
            </div>
            <button
              type="button"
              onClick={() => setAuswahl(new Set())}
              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              Auswahl aufheben
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkKlassAuswahl("privat")}
              disabled={selBusy}
            >
              <User className="mr-1.5 h-3.5 w-3.5" />
              privat
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkKlassAuswahl("geschaeftlich")}
              disabled={selBusy}
            >
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
              geschäftlich
            </Button>
            <span aria-hidden className="h-6 w-px bg-border" />
            <KategorieCombobox
              kategorien={kategorien}
              value={selKat === "__none__" ? "" : selKat}
              onChange={(v) => {
                if (v) setSelKat(v);
              }}
              placeholder="Kategorie…"
              triggerClassName="h-8 w-[220px] text-xs"
              ariaLabel="Kategorie für Auswahl"
            />
            <Button
              size="sm"
              onClick={bulkKatAuswahl}
              disabled={selBusy || selKat === "__none__"}
            >
              Kategorie setzen
            </Button>
            <span aria-hidden className="h-6 w-px bg-border" />
            <Select value={selUst} onValueChange={setSelUst}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue placeholder="USt…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="19">19 %</SelectItem>
                <SelectItem value="7">7 %</SelectItem>
                <SelectItem value="0">0 %</SelectItem>
                <SelectItem value="kein">kein</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={bulkUstAuswahl}
              disabled={selBusy || selUst === "__none__"}
            >
              {selBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              USt setzen
            </Button>
          </div>
        </div>
      ) : null}

      {/* Buchungs-Liste */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px]">
              <Checkbox
                checked={alleGewaehlt}
                onCheckedChange={(v) => alleWaehlen(Boolean(v))}
                aria-label="Alle Buchungen auswählen"
              />
            </TableHead>
            <TableHead className="w-[100px]">Datum</TableHead>
            <TableHead className="w-[120px]">Konto</TableHead>
            <TableHead className="text-right w-[110px]">Betrag</TableHead>
            <TableHead className="w-[120px]">USt</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buchungen.map((b) => {
            const istNeutral = b.kategorie_typ === "neutral";
            return (
            <TableRow
              key={b.id}
              className={istNeutral ? "bg-muted/30" : undefined}
              title={
                istNeutral
                  ? "Neutral (Geldtransit) — durchlaufender Posten, keine Steuerwirkung"
                  : undefined
              }
            >
              <TableCell>
                <Checkbox
                  checked={auswahl.has(b.id)}
                  onCheckedChange={() => toggleAuswahl(b.id)}
                  aria-label="Buchung auswählen"
                />
              </TableCell>
              <TableCell className="tabular-nums text-sm">
                {deDate(b.buchung_datum)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {b.konto_bezeichnung}
              </TableCell>
              <TableCell
                className={
                  "text-right tabular-nums font-mono text-sm " +
                  (istNeutral
                    ? "text-muted-foreground"
                    : b.betrag < 0
                      ? "text-destructive"
                      : "text-income-strong dark:text-income")
                }
              >
                {eur(b.betrag)}
              </TableCell>
              <TableCell>
                {(() => {
                  const fehltSatz =
                    (b.ust_satz === null || b.ust_satz === undefined) &&
                    (b.kategorie_typ === "einnahme" ||
                      b.kategorie_typ === "ausgabe");
                  return (
                    <Select
                      value={ustZuWert(b.ust_satz)}
                      onValueChange={(v) => aendereUstEinzeln(b, wertZuUst(v))}
                      disabled={ustSavingId === b.id}
                    >
                      <SelectTrigger
                        className={
                          "h-8 w-[92px] text-xs " +
                          (fehltSatz
                            ? "border-destructive/60 text-destructive"
                            : "")
                        }
                        title={
                          fehltSatz
                            ? "Kein USt-Satz gesetzt — bitte prüfen"
                            : undefined
                        }
                        aria-label="USt-Satz"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="19">19 %</SelectItem>
                        <SelectItem value="7">7 %</SelectItem>
                        <SelectItem value="0">0 %</SelectItem>
                        <SelectItem value="kein">kein</SelectItem>
                      </SelectContent>
                    </Select>
                  );
                })()}
              </TableCell>
              <TableCell>
                <KategorieCombobox
                  kategorien={kategorien}
                  value={b.kategorie_id ?? ""}
                  onChange={(v) => {
                    if (v) aendereEinzeln(b, v);
                  }}
                  disabled={savingId === b.id}
                  triggerClassName="h-8 text-xs"
                  triggerInhalt={
                    <span className="truncate">
                      {b.kategorie_bezeichnung ?? "— ohne —"}
                    </span>
                  }
                  ariaLabel="Kategorie wählen"
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onOpenSheet(b.id)}
                  title="Volle Details öffnen"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {buchungen.length > 0 && (
        <div className="flex justify-end">
          <BetragSummary
            betraege={buchungen.map((b) => Number(b.betrag))}
            className="w-full max-w-xs"
          />
        </div>
      )}

      {/* PROJ-21 — Lieferanten-Notizen (lazy geladen) */}
      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5" />
          Notizen zu {item.empfaenger}
        </div>
        <LieferantNotizenPanel
          empfaengerNorm={item.empfaenger_norm}
          empfaengerName={item.empfaenger}
          onCountChange={onNotizAnzahl}
        />
      </div>
    </div>
  );
}
