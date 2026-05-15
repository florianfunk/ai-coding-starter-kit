"use client";

// PROJ-3: Beleg-Tabelle + Detail-Sheet (OCR-Text, Paperless-Link).

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const STATUS_VARIANT: Record<
  BelegListItem["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  importiert: "default",
  unvollstaendig: "secondary",
  quelle_entfernt: "destructive",
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
      <Input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Suche nach Titel, Korrespondent oder Tag…"
        className="sm:max-w-sm"
        aria-label="Belege durchsuchen"
      />

      {gefiltert.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Keine Belege passen zur Suche.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Korrespondent</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gefiltert.map((b) => (
                <TableRow
                  key={b.id}
                  className={
                    b.status === "quelle_entfernt" ? "opacity-60" : ""
                  }
                >
                  <TableCell className="whitespace-nowrap">
                    {formatDatum(b.beleg_datum)}
                  </TableCell>
                  <TableCell>{b.korrespondent ?? "–"}</TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    {b.titel ?? "(ohne Titel)"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatBetrag(b.betrag)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(b.tags ?? []).slice(0, 3).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-xs"
                        >
                          {t}
                        </Badge>
                      ))}
                      {(b.tags ?? []).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(b.tags ?? []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[b.status]}>
                      {STATUS_LABEL[b.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAktiv(b)}
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
                  <Badge variant={STATUS_VARIANT[aktiv.status]}>
                    {STATUS_LABEL[aktiv.status]}
                  </Badge>
                </dd>
              </dl>

              {(aktiv.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(aktiv.tags ?? []).map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
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
