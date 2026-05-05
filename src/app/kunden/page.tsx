import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { KundenRowMenu } from "./kunden-row-menu";

type Search = {
  q?: string;
  status?: "aktiv" | "archiviert" | "alle";
  branche?: string;
};

export default async function KundenListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "aktiv";
  const brancheFilter = sp.branche ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("kunden")
    .select(
      "id, kunden_nr, firma, ansprechpartner, status, updated_at, kunde_branche(branche_id, kunden_branchen(id, name))",
    )
    .order("updated_at", { ascending: false });

  if (status !== "alle") query = query.eq("status", status);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `firma.ilike.${like},kunden_nr.ilike.${like},ansprechpartner.ilike.${like},email.ilike.${like}`,
    );
  }

  const { data: kunden, error } = await query.limit(500);
  const { data: branchen } = await supabase
    .from("kunden_branchen")
    .select("id, name")
    .order("name");

  type KbRow = {
    branche_id: string;
    kunden_branchen: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const firstBranche = (kb: KbRow): { id: string; name: string } | null => {
    const v = kb.kunden_branchen;
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  };

  const filtered = brancheFilter
    ? (kunden ?? []).filter((k) =>
        ((k.kunde_branche ?? []) as KbRow[]).some(
          (kb) => firstBranche(kb)?.id === brancheFilter,
        ),
      )
    : (kunden ?? []);

  return (
    <AppShell>
      <PageHeader
        title="Kunden"
        subtitle="Kundendatenbank für individuelle Auswahlen, Preise und Kataloge"
        breadcrumbs={[{ label: "Kunden" }]}
      >
        <Button asChild>
          <Link href="/kunden/neu">
            <Plus className="h-4 w-4" />
            Neuer Kunde
          </Link>
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 py-4">
          <form className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              name="q"
              placeholder="Suche Firma, Kunden-Nr., Ansprechpartner, E-Mail …"
              defaultValue={q}
              className="w-72"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="aktiv">aktiv</option>
              <option value="archiviert">archiviert</option>
              <option value="alle">alle</option>
            </select>
            <select
              name="branche"
              defaultValue={brancheFilter}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">alle Branchen</option>
              {(branchen ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Anwenden
            </Button>
            {(q || brancheFilter || status !== "aktiv") && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/kunden">Zurücksetzen</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Kunden konnten nicht geladen werden: {error.message}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            {kunden && kunden.length === 0 ? (
              <>
                <h2 className="text-lg font-semibold">Noch keine Kunden angelegt</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Lege deinen ersten Kunden an. Pro Kunde kannst du eine eigene
                  Produktauswahl, Preisspur und Aufschlag/Rabatt speichern und
                  per Klick einen kundenspezifischen Katalog drucken.
                </p>
                <Button asChild className="mt-2">
                  <Link href="/kunden/neu">
                    <Plus className="h-4 w-4" />
                    Ersten Kunden anlegen
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Keine Treffer</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Mit den aktuellen Filtern wurden keine Kunden gefunden.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Kunden-Nr.</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Ansprechpartner</TableHead>
                <TableHead>Branche</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-36">Letzte Änderung</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((k) => {
                const brancheNames = ((k.kunde_branche ?? []) as KbRow[])
                  .map((kb) => firstBranche(kb)?.name)
                  .filter(Boolean) as string[];
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/kunden/${k.id}/stammdaten`}
                        className="hover:underline"
                      >
                        {k.kunden_nr}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/kunden/${k.id}/stammdaten`}
                        className="hover:underline"
                      >
                        {k.firma}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.ansprechpartner ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {brancheNames.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          brancheNames.map((n) => (
                            <Badge key={n} variant="secondary" className="text-[10px]">
                              {n}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={k.status === "aktiv" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {k.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(k.updated_at).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <KundenRowMenu kundeId={k.id} status={k.status} firma={k.firma} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  );
}
