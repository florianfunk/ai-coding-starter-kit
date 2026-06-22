"use client";

// PROJ-14 — Abo-/Wiederkehr-Radar mit Drill-Down:
//   - Tabelle pro erkanntem Wiederkehr-Item (Empfänger, Intervall, Anzahl,
//     Ø Betrag, Jahresbelastung, letzte Zahlung, Status, Konfidenz)
//   - Klick / Pfeil-Icon klappt die Buchungen des Items aus
//   - In der Aufklappung: jede Buchung mit Datum/Betrag/Konto + Inline-
//     Kategorie-Select pro Buchung
//   - "Kategorie auf alle anwenden" — Bulk-Aktion über
//     /api/buchungen/bulk-kategorie
//   - Optional: Detail-Sheet pro Buchung (BuchungDetailSheet)

import {
  useEffect,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Circle,
  CircleDot,
  Eye,
  Loader2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  WiederkehrendItem,
  WiederkehrendBuchung,
  WiederkehrendResponse,
} from "@/app/api/finanzen/wiederkehrend/route";
import type { BulkKategorieResponse } from "@/app/api/buchungen/bulk-kategorie/route";
import type { KategorieTyp } from "@/lib/types";
import { lerneRegelFuer, regelToast } from "@/lib/finanzen/regel-helper";
import { BuchungDetailSheet } from "@/components/kategorien-analyse/buchung-detail-sheet";
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";

interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  aktiv: boolean;
}

const INTERVALL_LABEL: Record<WiederkehrendItem["intervall"], string> = {
  woechentlich: "wöchentlich",
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  jaehrlich: "jährlich",
};

const TYP_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  einnahme: "default",
  ausgabe: "secondary",
  privat: "outline",
  neutral: "outline",
};
const TYP_LABEL: Record<string, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
  privat: "Privat",
  neutral: "Neutral",
};

const RICHTUNG_LABEL: Record<WiederkehrendItem["richtung"], string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
};

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

export function AboRadar({
  abos,
  onMutiert,
}: {
  abos: WiederkehrendResponse;
  /** Wird gerufen, sobald sich Buchungen geändert haben (Cockpit lädt neu). */
  onMutiert?: () => void;
}) {
  const [kategorien, setKategorien] = useState<KategorieOption[]>([]);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bestaetigteAusblenden, setBestaetigteAusblenden] = useState(false);
  // Sektion-Aufklappstatus: Offen offen, Rest zu (Workflow-Fokus).
  const [sektionOffen, setSektionOffen] = useState<{
    offen: boolean;
    bestaetigt: boolean;
    beendet: boolean;
  }>({ offen: true, bestaetigt: false, beendet: false });

  // Kategorien einmalig für die Selects laden
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

  // Filter: Gruppen, in denen JEDE Buchung bereits manuell bestaetigt ist,
  // werden ausgeblendet — typischer Workflow-Wunsch nach "Alle bestaetigen
  // & Regel lernen".
  const sichtbareItems = bestaetigteAusblenden
    ? abos.items.filter(
        (i) =>
          !i.buchungen.every((b) => b.status === "manuell_bestaetigt"),
      )
    : abos.items;
  const ausgeblendetAnzahl = abos.items.length - sichtbareItems.length;
  const aktiv = sichtbareItems.filter((i) => i.noch_aktiv);
  const inaktiv = sichtbareItems.filter((i) => !i.noch_aktiv);

  // Sektionen: Offen → Bestätigt → Beendet.
  //   - Offen:    Mind. 1 Buchung nicht bestaetigt UND nicht 'beendet'-markiert
  //   - Bestätigt: ALLE Buchungen bestaetigt UND nicht 'beendet'-markiert
  //   - Beendet:  Kuendigung-Status === 'beendet'
  function bucketFuer(
    i: WiederkehrendItem,
  ): "offen" | "bestaetigt" | "beendet" {
    if (i.kuendigung_status === "beendet") return "beendet";
    const alleBestaetigt =
      i.buchungen.length > 0 &&
      i.buchungen.every((b) => b.status === "manuell_bestaetigt");
    return alleBestaetigt ? "bestaetigt" : "offen";
  }
  const sektion = {
    offen: sichtbareItems.filter((i) => bucketFuer(i) === "offen"),
    bestaetigt: sichtbareItems.filter((i) => bucketFuer(i) === "bestaetigt"),
    beendet: sichtbareItems.filter((i) => bucketFuer(i) === "beendet"),
  };

  function itemKey(i: WiederkehrendItem): string {
    return `${i.empfaenger}__${i.intervall}`;
  }

  function toggle(i: WiederkehrendItem) {
    const k = itemKey(i);
    setAufgeklappt((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  const alleAufgeklappt =
    sichtbareItems.length > 0 &&
    sichtbareItems.every((i) => aufgeklappt.has(itemKey(i)));

  function toggleAlle() {
    if (alleAufgeklappt) {
      setAufgeklappt(new Set());
    } else {
      setAufgeklappt(new Set(sichtbareItems.map(itemKey)));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">
            Abo-/Wiederkehr-Radar
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Lookback {abos.lookback.von} – {abos.lookback.bis}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Wiederkehrende Buchungen (Einnahmen &amp; Ausgaben)
          </p>
        </div>
        {abos.items.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={bestaetigteAusblenden}
                onChange={(e) => setBestaetigteAusblenden(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span>Bestätigte ausblenden</span>
              {ausgeblendetAnzahl > 0 ? (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {ausgeblendetAnzahl}
                </Badge>
              ) : null}
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAlle}
              disabled={sichtbareItems.length === 0}
              className="h-8 gap-1.5 text-xs"
              title={
                alleAufgeklappt
                  ? "Alle Buchungslisten zuklappen"
                  : "Alle Buchungslisten aufklappen"
              }
            >
              {alleAufgeklappt ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
              {alleAufgeklappt ? "Alle zuklappen" : "Alle aufklappen"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {abos.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine wiederkehrenden Zahlungen erkannt. Erkannt werden
            Zahlungen mit ≥ 3 Buchungen, stabilem Betrag (±30 %) und
            regelmäßigem Abstand. Einzelne Ausreißer werden toleriert.
          </p>
        ) : sichtbareItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Alle erkannten Wiederkehr-Items sind bereits manuell bestätigt.{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => setBestaetigteAusblenden(false)}
            >
              Bestätigte wieder einblenden
            </button>
          </p>
        ) : (
          <div className="space-y-5">
            {/* Summary-Header: zwei grosse Zahlen, kein Kasten — editorial. */}
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b pb-4">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Aktive Ausgaben / Jahr
                  </div>
                  <div className="mt-1 font-mono text-xl font-semibold text-destructive tabular-nums">
                    {eur(abos.jahresbelastung_ausgaben_aktiv)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Aktive Einnahmen / Jahr
                  </div>
                  <div className="mt-1 font-mono text-xl font-semibold text-income-strong dark:text-income tabular-nums">
                    {eur(abos.jahresbelastung_einnahmen_aktiv)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {aktiv.length} aktiv · {inaktiv.length} inaktiv/gekündigt
              </div>
            </div>

            {/* Drei Sektionen */}
            <SektionBlock
              titel="Offen"
              count={sektion.offen.length}
              expanded={sektionOffen.offen}
              onToggle={() =>
                setSektionOffen((s) => ({ ...s, offen: !s.offen }))
              }
              tone="default"
            >
              {sektion.offen.map((i) => (
                <AboItemRow
                  key={itemKey(i)}
                  item={i}
                  kategorien={kategorien}
                  expanded={aufgeklappt.has(itemKey(i))}
                  onToggle={() => toggle(i)}
                  onOpenSheet={(id) => setDetailId(id)}
                  onMutiert={onMutiert}
                  onZuklappen={() => {
                    const k = itemKey(i);
                    setAufgeklappt((s) => {
                      const n = new Set(s);
                      n.delete(k);
                      return n;
                    });
                  }}
                />
              ))}
              {sektion.offen.length === 0 ? (
                <SektionLeer text="Nichts mehr offen — sauber!" />
              ) : null}
            </SektionBlock>

            <SektionBlock
              titel="Bestätigt"
              count={sektion.bestaetigt.length}
              expanded={sektionOffen.bestaetigt}
              onToggle={() =>
                setSektionOffen((s) => ({ ...s, bestaetigt: !s.bestaetigt }))
              }
              tone="success"
            >
              {sektion.bestaetigt.map((i) => (
                <AboItemRow
                  key={itemKey(i)}
                  item={i}
                  kategorien={kategorien}
                  expanded={aufgeklappt.has(itemKey(i))}
                  onToggle={() => toggle(i)}
                  onOpenSheet={(id) => setDetailId(id)}
                  onMutiert={onMutiert}
                  onZuklappen={() => {
                    const k = itemKey(i);
                    setAufgeklappt((s) => {
                      const n = new Set(s);
                      n.delete(k);
                      return n;
                    });
                  }}
                />
              ))}
              {sektion.bestaetigt.length === 0 ? (
                <SektionLeer text="Noch nichts vollständig bestätigt." />
              ) : null}
            </SektionBlock>

            <SektionBlock
              titel="Beendet"
              count={sektion.beendet.length}
              expanded={sektionOffen.beendet}
              onToggle={() =>
                setSektionOffen((s) => ({ ...s, beendet: !s.beendet }))
              }
              tone="muted"
            >
              {sektion.beendet.map((i) => (
                <AboItemRow
                  key={itemKey(i)}
                  item={i}
                  kategorien={kategorien}
                  expanded={aufgeklappt.has(itemKey(i))}
                  onToggle={() => toggle(i)}
                  onOpenSheet={(id) => setDetailId(id)}
                  onMutiert={onMutiert}
                  onZuklappen={() => {
                    const k = itemKey(i);
                    setAufgeklappt((s) => {
                      const n = new Set(s);
                      n.delete(k);
                      return n;
                    });
                  }}
                />
              ))}
              {sektion.beendet.length === 0 ? (
                <SektionLeer text="Keine beendeten Abos." />
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

// -----------------------------------------------------------------------
// Editorial-Layout: Sektionen + Item-Zeile
// -----------------------------------------------------------------------

type Tone = "default" | "success" | "muted";

const TONE_DOT: Record<Tone, string> = {
  default: "bg-foreground/70",
  success: "bg-income-strong",
  muted: "bg-muted-foreground/40",
};

function SektionBlock({
  titel,
  count,
  expanded,
  onToggle,
  tone,
  children,
}: {
  titel: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 border-b py-2 text-left transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`}
          aria-hidden
        />
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

function BestaetigtIndikator({
  bestaetigt,
  gesamt,
}: {
  bestaetigt: number;
  gesamt: number;
}) {
  if (gesamt === 0)
    return (
      <Circle
        className="h-4 w-4 text-muted-foreground/40"
        aria-label="Keine Buchungen"
      />
    );
  if (bestaetigt === gesamt)
    return (
      <CheckCircle2
        className="h-4 w-4 text-income-strong"
        aria-label={`Alle ${gesamt} Buchungen bestätigt`}
      />
    );
  if (bestaetigt > 0)
    return (
      <CircleDot
        className="h-4 w-4 text-highlight"
        aria-label={`${bestaetigt} von ${gesamt} Buchungen bestätigt`}
      />
    );
  return (
    <Circle
      className="h-4 w-4 text-muted-foreground/40"
      aria-label="Nicht bestätigt"
    />
  );
}

function KuendigungChip({
  status,
}: {
  status: "offen" | "gekuendigt" | "beendet";
}) {
  const label =
    status === "offen"
      ? "zur Kündigung"
      : status === "gekuendigt"
        ? "gekündigt"
        : "beendet";
  const cls =
    status === "beendet"
      ? "text-muted-foreground border-muted-foreground/30"
      : "text-destructive border-destructive/40";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium ${cls}`}
    >
      <Ban className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function AboItemRow({
  item,
  kategorien,
  expanded,
  onToggle,
  onOpenSheet,
  onMutiert,
  onZuklappen,
}: {
  item: WiederkehrendItem;
  kategorien: KategorieOption[];
  expanded: boolean;
  onToggle: () => void;
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
  onZuklappen?: () => void;
}) {
  const bestaetigt = item.buchungen.filter(
    (b) => b.status === "manuell_bestaetigt",
  ).length;
  const gesamt = item.buchungen.length;
  // Netto-Summe vorzeichenbehaftet: Gutschriften/Rückzahlungen in einer
  // Abo-Reihe mindern die Summe, statt als Volumen aufaddiert zu werden.
  const bisherSumme = item.buchungen.reduce(
    (s, b) => s + (Number(b.betrag) || 0),
    0,
  );
  const richtungFarbe =
    item.richtung === "einnahme"
      ? "text-income-strong dark:text-income"
      : "text-destructive";
  const akzentFarbe =
    item.richtung === "einnahme"
      ? "bg-income/80"
      : "bg-destructive/60";

  // Tint pro Zeile — Einnahme = Cyan, Ausgabe = Cerise.
  // Kuendigung-Markierungen ueberschreiben mit Yellow (Hinweis-Charakter).
  const tintHintergrund = item.kuendigung_status && item.kuendigung_status !== "beendet"
    ? "bg-tint-yellow"
    : item.richtung === "einnahme"
      ? "bg-tint-cyan"
      : "bg-tint-cerise";

  return (
    <div
      className={
        "group relative " +
        (!item.noch_aktiv ? "opacity-70" : "")
      }
    >
      {/* Header-Zeile (klickbar zum Aufklappen) — mit Tint-Hintergrund */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 py-3 pl-3 pr-2 text-left transition-all hover:brightness-95 ${tintHintergrund}`}
      >
        {/* Linker Akzent-Streifen (Richtung) */}
        <span
          className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-r ${akzentFarbe}`}
          aria-hidden
        />

        {/* Bestätigt-Indikator */}
        <span className="shrink-0">
          <BestaetigtIndikator bestaetigt={bestaetigt} gesamt={gesamt} />
        </span>

        {/* Empfänger + Subzeile */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {item.empfaenger}
            </span>
            {item.kuendigung_status ? (
              <KuendigungChip status={item.kuendigung_status} />
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {item.richtung === "einnahme" ? (
              <ArrowUpRight className="h-3 w-3 text-income-strong" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-destructive" />
            )}
            <span>
              {RICHTUNG_LABEL[item.richtung]} ·{" "}
              {INTERVALL_LABEL[item.intervall]} (~{item.intervall_tage} T) ·{" "}
              {item.anzahl}× erfasst
            </span>
            {!item.noch_aktiv ? (
              <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                gekündigt?
              </span>
            ) : null}
          </div>
        </div>

        {/* Zahlen-Block: Bisher / Jahr */}
        <div className="hidden shrink-0 items-baseline gap-6 text-right sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Bisher
            </div>
            <div className="font-mono text-sm tabular-nums">
              {eur(bisherSumme)}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {item.anzahl} × {eur(item.durchschnitt)}
            </div>
          </div>
          <div className="min-w-[110px]">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Jahr
            </div>
            <div
              className={`font-mono text-base font-semibold tabular-nums ${richtungFarbe}`}
            >
              {eur(item.jahresbelastung)}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              letzte {deDate(item.letzte)} · {Math.round(item.konfidenz * 100)} %
            </div>
          </div>
        </div>

        {/* Aufklapp-Chevron */}
        <span className="shrink-0 text-muted-foreground transition-transform group-hover:text-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {/* Drilldown */}
      {expanded ? (
        <div className="border-t bg-muted/20 px-2 py-3">
          <ItemDrilldown
            item={item}
            kategorien={kategorien}
            onOpenSheet={onOpenSheet}
            onMutiert={onMutiert}
            onZuklappen={onZuklappen}
          />
        </div>
      ) : null}
    </div>
  );
}

function ItemDrilldown({
  item,
  kategorien,
  onOpenSheet,
  onMutiert,
  onZuklappen,
}: {
  item: WiederkehrendItem;
  kategorien: KategorieOption[];
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
  /** Wird nach "Alle bestätigen & Regel lernen" aufgerufen, um die Gruppe automatisch zu schließen. */
  onZuklappen?: () => void;
}) {
  // Lokaler Snapshot der Buchungen, damit Inline-Edit + Bulk optimistisch
  // sichtbar werden, ohne dass der ganze Radar neu lädt.
  const [buchungen, setBuchungen] = useState<WiederkehrendBuchung[]>(
    item.buchungen,
  );
  useEffect(() => setBuchungen(item.buchungen), [item.buchungen]);

  const [bulkKat, setBulkKat] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bestaetigeId, setBestaetigeId] = useState<string | null>(null);
  const [bulkBusy, startBulk] = useTransition();
  const [kuendigungStatus, setKuendigungStatus] = useState<
    "offen" | "gekuendigt" | "beendet" | null
  >(item.kuendigung_status ?? null);
  const [kuendigungBusy, setKuendigungBusy] = useState(false);
  useEffect(() => {
    setKuendigungStatus(item.kuendigung_status ?? null);
  }, [item.kuendigung_status]);

  const distinct = new Set(buchungen.map((b) => b.kategorie_id ?? "__none__"));
  const alleGleicheKategorie = distinct.size === 1;
  const aktuelleKategorieId =
    alleGleicheKategorie && !distinct.has("__none__")
      ? Array.from(distinct)[0]
      : null;

  async function aendereEinzeln(b: WiederkehrendBuchung, neueId: string) {
    if (neueId === b.kategorie_id) return;
    setSavingId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategorie_id: neueId, bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
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
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  async function toggleKuendigung() {
    if (kuendigungBusy) return;
    setKuendigungBusy(true);
    const norm = item.empfaenger_norm;
    try {
      if (kuendigungStatus === null) {
        // hinzufuegen
        const r = await fetch("/api/kuendigungen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empfaenger: item.empfaenger }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        setKuendigungStatus("offen");
        toast.success(`"${item.empfaenger}" zur Kuendigungsliste hinzugefuegt`);
      } else {
        // entfernen
        const r = await fetch(
          `/api/kuendigungen/${encodeURIComponent(norm)}`,
          { method: "DELETE" },
        );
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        setKuendigungStatus(null);
        toast.success(`Markierung fuer "${item.empfaenger}" entfernt`);
      }
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Markierung fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setKuendigungBusy(false);
    }
  }

  async function bestaetigeUndLerne(b: WiederkehrendBuchung) {
    if (!b.kategorie_id) {
      toast.error("Bitte zuerst eine Kategorie wählen.");
      return;
    }
    setBestaetigeId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }

      const regelStatus = await lerneRegelFuer(
        item.empfaenger,
        b.kategorie_id,
        b.kategorie_typ,
      );

      setBuchungen((bs) =>
        bs.map((x) =>
          x.id === b.id ? { ...x, status: "manuell_bestaetigt" } : x,
        ),
      );
      regelToast(regelStatus, item.empfaenger, "Buchung bestätigt");
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Bestätigen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setBestaetigeId(null);
    }
  }

  /**
   * Pro Zeile: Kategorie dieser Buchung auf ALLE Buchungen des Items
   * anwenden + alle als manuell bestätigt markieren + Lernregel anlegen.
   */
  async function uebernehmeKategorieUndBestaetige(b: WiederkehrendBuchung) {
    if (!b.kategorie_id) {
      toast.error("Diese Buchung hat noch keine Kategorie.");
      return;
    }
    setBestaetigeId(b.id);
    try {
      const ids = buchungen.map((x) => x.id);
      const r = await fetch("/api/buchungen/bulk-kategorie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, kategorie_id: b.kategorie_id }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as BulkKategorieResponse;
      setBuchungen((bs) =>
        bs.map((x) => ({
          ...x,
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
        "Übernehmen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setBestaetigeId(null);
    }
  }

  /**
   * Header-Button: alle Buchungen mit identischer Kategorie bestätigen +
   * Lernregel anlegen. Disabled, wenn Kategorien uneinheitlich sind oder
   * keine Kategorie gesetzt ist.
   */
  function alleBestaetigenMitRegel() {
    if (!alleGleicheKategorie || !aktuelleKategorieId) {
      toast.error(
        "Geht nur, wenn alle Buchungen dieselbe Kategorie haben. Vorher 'auf alle anwenden' nutzen oder eine Zeile mit 'Übernehmen' verwenden.",
      );
      return;
    }
    startBulk(async () => {
      try {
        const ids = buchungen.map((b) => b.id);
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, kategorie_id: aktuelleKategorieId }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
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
        onZuklappen?.();
      } catch (e) {
        toast.error(
          "Alle bestätigen fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  function wendeAuAlleAn() {
    if (bulkKat === "") {
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
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
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
        toast.success(
          `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf "${j.kategorie.bezeichnung}" gesetzt`,
        );
        if (j.uebersprungen.length > 0) {
          toast.warning(
            `${j.uebersprungen.length} Buchung${j.uebersprungen.length === 1 ? "" : "en"} übersprungen (nicht gefunden)`,
          );
        }
        onMutiert?.();
      } catch (e) {
        toast.error(
          "Bulk-Update fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  const kuendigungLabel: Record<"offen" | "gekuendigt" | "beendet", string> = {
    offen: "Zur Kuendigung markiert",
    gekuendigt: "Kuendigung verschickt",
    beendet: "Beendet",
  };

  return (
    <div className="space-y-3 px-2">
      {/* Kuendigungs-Aktion */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
        <div className="flex items-center gap-2 text-sm">
          <Ban className="h-4 w-4 text-muted-foreground" />
          {kuendigungStatus === null ? (
            <span className="text-muted-foreground">
              Nicht zur Kuendigung markiert
            </span>
          ) : (
            <Badge
              variant={
                kuendigungStatus === "beendet" ? "secondary" : "destructive"
              }
              className="text-xs"
            >
              {kuendigungLabel[kuendigungStatus]}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={kuendigungStatus === null ? "destructive" : "outline"}
          onClick={toggleKuendigung}
          disabled={kuendigungBusy}
        >
          {kuendigungBusy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : kuendigungStatus === null ? (
            <Ban className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
          )}
          {kuendigungStatus === null
            ? "Zur Kuendigung markieren"
            : "Markierung entfernen"}
        </Button>
      </div>

      {/* Bulk-Aktion */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Kategorie auf alle anwenden
          </div>
          <div className="flex items-center gap-2">
            <KategorieCombobox
              kategorien={kategorien}
              value={bulkKat}
              onChange={setBulkKat}
              placeholder="Kategorie wählen…"
              triggerClassName="h-9 w-[280px] text-sm"
              ariaLabel="Kategorie wählen"
            />
            <Button
              size="sm"
              onClick={wendeAuAlleAn}
              disabled={bulkBusy || bulkKat === ""}
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
        <div className="ml-auto text-xs text-muted-foreground">
          {alleGleicheKategorie && aktuelleKategorieId
            ? `Aktuell: ${kategorien.find((k) => k.id === aktuelleKategorieId)?.bezeichnung ?? "—"}`
            : alleGleicheKategorie
              ? "Aktuell: alle ohne Kategorie"
              : "Buchungen haben uneinheitliche Kategorien"}
        </div>
      </div>

      {/* Buchungs-Liste */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Datum</TableHead>
            <TableHead className="w-[120px]">Konto</TableHead>
            <TableHead className="text-right w-[110px]">Betrag</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[280px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buchungen.map((b) => (
            <TableRow
              key={b.id}
              className={b.ausreisser ? "bg-highlight-soft/40 dark:bg-highlight-strong/10" : ""}
            >
              <TableCell className="tabular-nums text-sm">
                <div className="flex items-center gap-1.5">
                  <span>{deDate(b.buchung_datum)}</span>
                  {b.ausreisser ? (
                    <Badge
                      variant="outline"
                      className="border-highlight text-[10px] text-highlight-strong dark:text-highlight"
                      title="Weicht stark vom Cluster-Median ab"
                    >
                      Ausreißer
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {b.konto_bezeichnung}
              </TableCell>
              <TableCell
                className={
                  "text-right tabular-nums font-mono text-sm " +
                  (b.ausreisser
                    ? "text-highlight-strong dark:text-highlight"
                    : b.betrag < 0
                      ? "text-destructive"
                      : "text-income-strong dark:text-income")
                }
              >
                {eur(b.betrag)}
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
                  ariaLabel="Kategorie wählen"
                  triggerInhalt={
                    <span className="flex items-center gap-2 truncate">
                      {b.kategorie_typ ? (
                        <Badge
                          variant={TYP_BADGE[b.kategorie_typ] ?? "outline"}
                          className="text-[10px]"
                        >
                          {TYP_LABEL[b.kategorie_typ] ?? b.kategorie_typ}
                        </Badge>
                      ) : null}
                      <span className="truncate">
                        {b.kategorie_bezeichnung ?? "— ohne —"}
                      </span>
                    </span>
                  }
                />
              </TableCell>
              <TableCell>
                {b.status === "manuell_bestaetigt" ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    bestätigt
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {b.status}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => bestaetigeUndLerne(b)}
                    disabled={
                      bestaetigeId === b.id ||
                      savingId === b.id ||
                      bulkBusy ||
                      !b.kategorie_id ||
                      b.status === "manuell_bestaetigt"
                    }
                    title={
                      !b.kategorie_id
                        ? "Erst Kategorie wählen"
                        : b.status === "manuell_bestaetigt"
                          ? "Bereits bestätigt"
                          : `Bestätigen und Regel für "${item.empfaenger}" lernen`
                    }
                  >
                    {bestaetigeId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    Bestätigen
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => uebernehmeKategorieUndBestaetige(b)}
                    disabled={
                      bestaetigeId === b.id ||
                      savingId === b.id ||
                      bulkBusy ||
                      !b.kategorie_id ||
                      buchungen.length <= 1
                    }
                    title={
                      !b.kategorie_id
                        ? "Diese Buchung hat noch keine Kategorie"
                        : buchungen.length <= 1
                          ? "Nur eine Buchung in dieser Gruppe"
                          : `Kategorie "${b.kategorie_bezeichnung ?? "—"}" auf alle ${buchungen.length} anwenden und Regel lernen`
                    }
                  >
                    {bestaetigeId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Für alle
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onOpenSheet(b.id)}
                    title="Volle Details öffnen"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
