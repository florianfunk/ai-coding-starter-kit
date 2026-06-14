"use client";

// PROJ-20: Merkliste-Ansicht. Zeigt alle gemerkten Buchungen im Ledger-Stil,
// sortiert nach Merk-Zeitpunkt (zuletzt gemerkte oben). Klick öffnet das
// Detail-Sheet; der Stern entfernt den Eintrag (verschwindet aus der Liste).

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Star, Tag } from "lucide-react";

import type { Buchung, Kategorie, Klassifikation, Konto } from "@/lib/types";
import { BuchungDetailSheet } from "@/components/buchungen/buchung-detail-sheet";
import { MerkenStern } from "@/components/merkliste/merken-stern";
import { toggleMerken } from "@/lib/merken";
import { cn } from "@/lib/utils";

const KLASS_LABEL: Record<Klassifikation, string> = {
  privat: "Privat",
  geschaeftlich: "Geschäftlich",
  unklar: "Unklar",
  neutral: "Neutral",
};

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

function sortByGemerkt(a: Buchung, b: Buchung): number {
  return (b.gemerkt_am ?? "").localeCompare(a.gemerkt_am ?? "");
}

export function MerklisteAnsicht({
  initialBuchungen,
  konten,
  kategorien,
}: {
  initialBuchungen: Buchung[];
  konten: Konto[];
  kategorien: Kategorie[];
}) {
  const [buchungen, setBuchungen] = useState<Buchung[]>(initialBuchungen);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<Buchung | null>(null);
  const [detailOffen, setDetailOffen] = useState(false);

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "—";
  const kategorieById = useMemo(() => {
    const m = new Map<string, Kategorie>();
    for (const k of kategorien) m.set(k.id, k);
    return m;
  }, [kategorien]);

  async function entfernen(b: Buchung) {
    if (pending.has(b.id)) return;
    setPending((prev) => new Set(prev).add(b.id));
    // Optimistisch aus der Liste nehmen + ggf. Detail schließen.
    setBuchungen((prev) => prev.filter((x) => x.id !== b.id));
    if (detail?.id === b.id) setDetailOffen(false);

    const ok = await toggleMerken(b.id, false);

    setPending((prev) => {
      const next = new Set(prev);
      next.delete(b.id);
      return next;
    });
    if (!ok) {
      // Rollback: wieder einsortieren.
      setBuchungen((prev) => [b, ...prev].sort(sortByGemerkt));
      toast.error("Entfernen fehlgeschlagen — bitte erneut versuchen.");
    } else {
      toast.success("Von Merkliste entfernt");
    }
  }

  function oeffneDetail(b: Buchung) {
    setDetail(b);
    setDetailOffen(true);
  }

  if (buchungen.length === 0) {
    return (
      <section className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-yellow text-highlight-strong">
          <Star className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
          Merkliste ist leer
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
          Setze in den Buchungen, der Prüfliste oder der Kategorien-Analyse den
          Stern, um unsichere Fälle zum späteren Prüfen hier zu sammeln.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-3 text-[12px] text-muted-foreground sm:px-1">
        {buchungen.length} {buchungen.length === 1 ? "Buchung" : "Buchungen"}{" "}
        gemerkt
      </div>
      <ul
        role="list"
        className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60"
      >
        {buchungen.map((b, idx) => {
          const ausgabe = b.betrag < 0;
          const kategorie = b.kategorie_id
            ? (kategorieById.get(b.kategorie_id) ?? null)
            : null;
          return (
            <li
              key={b.id}
              className={cn(
                "flex items-stretch",
                idx < buchungen.length - 1 && "border-b border-line-hair",
              )}
            >
              <button
                type="button"
                onClick={() => oeffneDetail(b)}
                className="group grid min-w-0 flex-1 grid-cols-[88px_1fr_auto_16px] items-center gap-x-4 py-3 pl-3 pr-3 text-left transition-colors hover:bg-[color:var(--surface-2)] sm:pl-4"
              >
                <div className="flex flex-col justify-center font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  <span className="text-[13px] font-semibold text-foreground">
                    {formatDatumKurz(b.buchung_datum)}
                  </span>
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="block truncate text-[15px] font-semibold leading-tight">
                    {b.empfaenger?.trim() || "—"}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {kategorie ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tint-violet px-2 py-0.5 text-[11.5px] font-medium text-brand-violet">
                        <Tag className="h-3 w-3 shrink-0" />
                        <span>{kategorie.bezeichnung}</span>
                      </span>
                    ) : null}
                    {b.klassifikation ? (
                      <span className="inline-flex items-center rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {KLASS_LABEL[b.klassifikation]}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-2 text-[12px] text-muted-foreground">
                    <span className="truncate">
                      {b.verwendungszweck?.trim() || "—"}
                    </span>
                    <span className="text-line-strong">·</span>
                    <span className="shrink-0 text-[11.5px] uppercase tracking-wide">
                      {kontoName(b.konto_id)}
                    </span>
                  </div>
                </div>
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
                <ChevronRight className="self-center text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </button>

              <div className="flex items-center pr-2 sm:pr-3">
                <MerkenStern
                  gemerkt
                  pending={pending.has(b.id)}
                  onToggle={() => entfernen(b)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <BuchungDetailSheet
        buchung={detail}
        kategorien={kategorien}
        open={detailOffen}
        onOpenChange={setDetailOffen}
        gemerkt={detail ? buchungen.some((x) => x.id === detail.id) : false}
        merkenPending={detail ? pending.has(detail.id) : false}
        onToggleMerken={detail ? () => entfernen(detail) : undefined}
      />
    </div>
  );
}
