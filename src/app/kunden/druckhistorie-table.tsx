import Link from "next/link";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PdfDownloadLink } from "./pdf-download-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  typ: "katalog" | "datenblatt";
  kunde_id: string | null;
  produkt_id: string | null;
  parameter: Record<string, unknown> | null;
  pdf_path: string | null;
  error_text: string | null;
  created_at: string;
  kunden?: { id: string; firma: string; kunden_nr: string } | null;
};

type Props = {
  jobs: Job[];
  showKunde?: boolean;
};

const STATUS_LABEL: Record<Job["status"], string> = {
  queued: "wartet",
  running: "läuft",
  done: "fertig",
  error: "fehlerhaft",
};

function StatusBadge({ status }: { status: Job["status"] }) {
  if (status === "done") {
    return (
      <Badge variant="default" className="text-[10px]">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        fertig
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        <AlertCircle className="mr-1 h-3 w-3" />
        Fehler
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function DruckhistorieTable({ jobs, showKunde = false }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        Noch keine Druckaufträge — den Katalog drucken über den Quick-Button im Header.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-36">Datum</TableHead>
          <TableHead className="w-24">Typ</TableHead>
          {showKunde && <TableHead>Kunde</TableHead>}
          <TableHead className="w-28">Layout</TableHead>
          <TableHead className="w-32">Spur</TableHead>
          <TableHead className="w-24 text-right">Aufschlag</TableHead>
          <TableHead className="w-20">Währung</TableHead>
          <TableHead className="w-20 text-right">Produkte</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((j) => {
          const p = (j.parameter ?? {}) as Record<string, unknown>;
          const layout = (p.layout as string) ?? "—";
          const spur = (p.preisauswahl as string) ?? (p.preis_spur as string) ?? "—";
          const vorzeichen = (p.preisAenderung as string) ?? (p.aufschlag_vorzeichen as string);
          const pct = (p.preisProzent as number) ?? (p.aufschlag_pct as number);
          const currency = (p.waehrung as string) ?? "EUR";
          const produktIds = (p.produktIds as string[] | null | undefined) ?? null;
          const anzahl = produktIds == null ? "alle" : String(produktIds.length);

          return (
            <TableRow key={j.id}>
              <TableCell className="text-xs">
                {new Date(j.created_at).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {j.typ}
                </Badge>
              </TableCell>
              {showKunde && (
                <TableCell className="text-xs">
                  {j.kunden ? (
                    <Link
                      href={`/kunden/${j.kunde_id}/druckhistorie`}
                      className="hover:underline"
                    >
                      {j.kunden.firma}
                      <span className="ml-1 text-muted-foreground">
                        ({j.kunden.kunden_nr})
                      </span>
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              <TableCell className="text-xs capitalize">{layout}</TableCell>
              <TableCell className="text-xs capitalize">{spur}</TableCell>
              <TableCell className="text-right text-xs">
                {pct != null
                  ? `${vorzeichen === "minus" ? "−" : "+"}${Number(pct).toFixed(1)} %`
                  : "—"}
              </TableCell>
              <TableCell className="text-xs">{currency}</TableCell>
              <TableCell className="text-right text-xs">{anzahl}</TableCell>
              <TableCell>
                <StatusBadge status={j.status} />
                {j.status === "error" && j.error_text && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-2">
                    {j.error_text}
                  </p>
                )}
              </TableCell>
              <TableCell>
                {j.status === "done" && j.pdf_path && (
                  <PdfDownloadLink jobId={j.id} />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
