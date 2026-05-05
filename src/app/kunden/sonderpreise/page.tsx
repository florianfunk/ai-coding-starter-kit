import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

type Search = { filter?: "alle" | "rabatte" | "aufschlaege" };

export default async function SonderpreisePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filter = sp.filter ?? "alle";

  const supabase = await createClient();
  const { data: kunden } = await supabase
    .from("kunden")
    .select(
      "id, kunden_nr, firma, status, preis_spur, aufschlag_vorzeichen, aufschlag_pct, alle_produkte, kunde_produkt(count)",
    )
    .eq("status", "aktiv")
    .gt("aufschlag_pct", 0)
    .order("firma");

  let rows = (kunden ?? []).map((k) => ({
    id: k.id as string,
    kunden_nr: k.kunden_nr as string,
    firma: k.firma as string,
    spur: k.preis_spur as string,
    vorzeichen: k.aufschlag_vorzeichen as "plus" | "minus",
    pct: Number(k.aufschlag_pct),
    alleProdukte: !!k.alle_produkte,
    produktCount:
      ((k.kunde_produkt as Array<{ count: number }> | null) ?? [])[0]?.count ?? 0,
  }));

  if (filter === "rabatte") rows = rows.filter((r) => r.vorzeichen === "minus");
  if (filter === "aufschlaege") rows = rows.filter((r) => r.vorzeichen === "plus");

  return (
    <AppShell>
      <PageHeader
        title="Sonderpreise"
        subtitle="Übersicht aller aktiven Kunden mit individuellem Aufschlag oder Rabatt"
        breadcrumbs={[
          { label: "Kunden", href: "/kunden" },
          { label: "Sonderpreise" },
        ]}
      />

      <Card className="mb-4">
        <CardContent className="flex gap-2 py-4">
          {(["alle", "rabatte", "aufschlaege"] as const).map((f) => (
            <Link
              key={f}
              href={f === "alle" ? "/kunden/sonderpreise" : `/kunden/sonderpreise?filter=${f}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                filter === f ? "border-primary bg-primary/10 font-medium" : ""
              }`}
            >
              {f === "alle" ? "alle" : f === "rabatte" ? "nur Rabatte" : "nur Aufschläge"}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine Kunden mit Sonderkonditionen — Aufschlag/Rabatt liegt aktuell überall bei 0 %.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Kunden-Nr.</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead className="w-32">Spur</TableHead>
                  <TableHead className="w-32 text-right">Aufschlag</TableHead>
                  <TableHead className="w-32 text-right">Anzahl Produkte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/kunden/${r.id}/preise`} className="hover:underline">
                        {r.kunden_nr}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/kunden/${r.id}/preise`} className="hover:underline">
                        {r.firma}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {r.spur}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={r.vorzeichen === "minus" ? "text-emerald-600" : ""}>
                        {r.vorzeichen === "minus" ? "−" : "+"}
                        {r.pct.toFixed(1)} %
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.alleProdukte ? "alle" : r.produktCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
