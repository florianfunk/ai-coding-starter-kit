"use client";

// PROJ-3: Beleg-Tabelle + Detail-Sheet (OCR-Text, Paperless-Link).

import { useState } from "react";
import { ChevronRight, ExternalLink, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface BelegListItem {
  id: string;
  paperless_id: number;
  titel: string | null;
  beleg_datum: string | null;
  korrespondent: string | null;
  betrag: number | null;
  tags: string[] | null;
  dokumenttyp: string | null;
  ocr_text: string | null;
  quell_link: string | null;
  status: "importiert" | "unvollstaendig" | "quelle_entfernt";
}

const STATUS_LABEL: Record<BelegListItem["status"], string> = {
  importiert: "Importiert",
  unvollstaendig: "Unvollständig",
  quelle_entfernt: "In Quelle entfernt",
};

const STATUS_PILL: Record<BelegListItem["status"], string> = {
  importiert: "bg-tint-cyan text-income-strong",
  unvollstaendig: "bg-tint-yellow text-highlight-strong",
  quelle_entfernt: "bg-tint-cerise text-destructive",
};

function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { dateStyle: "medium" });
}

function formatBetrag(betrag: number | null): string {
  if (betrag === null) return "–";
  return betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

export function BelegTabelle({ belege }: { belege: BelegListItem[] }) {
  const [suche, setSuche] = useState("");
  const [aktiv, setAktiv] = useState<BelegListItem | null>(null);

  const gefiltert = suche.trim()
    ? belege.filter((b) => {
        const q = suche.toLowerCase();
        return (
          (b.titel ?? "").toLowerCase().includes(q) ||
          (b.korrespondent ?? "").toLowerCase().includes(q) ||
          (b.tags ?? []).some((t) => t.toLowerCase().includes(q))
        );
      })
    : belege;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suche nach Titel, Korrespondent oder Tag…"
          className="rounded-full border-line bg-card pl-9"
          aria-label="Belege durchsuchen"
        />
      </div>

      {gefiltert.length === 0 ? (
        <div className="rounded-[var(--radius)] bg-card px-8 py-12 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60 text-[13px] text-muted-foreground">
          Keine Belege passen zur Suche.
        </div>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <ul role="list" className="divide-y divide-line-hair">
            {gefiltert.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setAktiv(b)}
                  className={cn(
                    "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--surface-2)]",
                    b.status === "quelle_entfernt" && "opacity-60",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tint-violet text-brand-violet">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold leading-tight">
                        {b.titel ?? "(ohne Titel)"}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold",
                          STATUS_PILL[b.status],
                        )}
                      >
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span>{formatDatum(b.beleg_datum)}</span>
                      {b.korrespondent ? (
                        <>
                          <span className="text-line-strong">·</span>
                          <span className="truncate">{b.korrespondent}</span>
                        </>
                      ) : null}
                      {(b.tags ?? []).length > 0 ? (
                        <>
                          <span className="text-line-strong">·</span>
                          <span className="truncate text-[11px]">
                            {(b.tags ?? []).slice(0, 3).join(" · ")}
                            {(b.tags ?? []).length > 3
                              ? ` +${(b.tags ?? []).length - 3}`
                              : ""}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[14px] font-semibold tabular-nums">
                      {formatBetrag(b.betrag)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet
        open={aktiv !== null}
        onOpenChange={(o) => {
          if (!o) setAktiv(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{aktiv?.titel ?? "Beleg"}</SheetTitle>
            <SheetDescription>
              Paperless-Dokument #{aktiv?.paperless_id}
            </SheetDescription>
          </SheetHeader>

          {aktiv && (
            <div className="mt-4 space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Datum</dt>
                <dd>{formatDatum(aktiv.beleg_datum)}</dd>
                <dt className="text-muted-foreground">Korrespondent</dt>
                <dd>{aktiv.korrespondent ?? "–"}</dd>
                <dt className="text-muted-foreground">Betrag</dt>
                <dd>{formatBetrag(aktiv.betrag)}</dd>
                <dt className="text-muted-foreground">Dokumenttyp</dt>
                <dd>{aktiv.dokumenttyp ?? "–"}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      STATUS_PILL[aktiv.status],
                    )}
                  >
                    {STATUS_LABEL[aktiv.status]}
                  </span>
                </dd>
              </dl>

              {(aktiv.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(aktiv.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {aktiv.quell_link && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={aktiv.quell_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    In Paperless öffnen
                  </a>
                </Button>
              )}

              <div>
                <p className="mb-1 text-sm font-medium">OCR-Text</p>
                <ScrollArea className="h-[40vh] rounded-md border p-3">
                  <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {aktiv.ocr_text?.trim() || "Kein OCR-Text vorhanden."}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
