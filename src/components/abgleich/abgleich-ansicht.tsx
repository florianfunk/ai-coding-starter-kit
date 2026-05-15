"use client";

// PROJ-6: Beleg-Abgleich — Tabs (Fehlliste A/B, unsichere Matches),
// Re-Matching-Panel mit Job-Fortschritt, Filter, manuelle Zuordnung.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import type { JobLauf, Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KriterienDetail } from "@/components/abgleich/kriterien-detail";
import { ManuelleZuordnungDialog } from "@/components/abgleich/manuelle-zuordnung-dialog";
import {
  formatBetrag,
  formatDatum,
  type BelegKurz,
  type BuchungKurz,
  type FehllisteResponse,
} from "@/components/abgleich/abgleich-typen";

interface MatchErgebnis {
  geprueft?: number;
  auto?: number;
  unsicher?: number;
  ohne_beleg?: number;
  uebersprungen_gesperrt?: number;
  geschrieben?: number;
  fehler?: string[];
}

const STATUS_LABEL: Record<JobLauf["status"], string> = {
  laeuft: "Läuft",
  fertig: "Fertig",
  fehler: "Fehler",
};
const STATUS_VARIANT: Record<
  JobLauf["status"],
  "default" | "secondary" | "destructive"
> = { laeuft: "secondary", fertig: "default", fehler: "destructive" };

function jobZeit(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function AbgleichAnsicht({
  initialJob,
  konten,
  alleBelege,
  alleBuchungen,
}: {
  initialJob: JobLauf | null;
  konten: Konto[];
  alleBelege: BelegKurz[];
  alleBuchungen: BuchungKurz[];
}) {
  const router = useRouter();
  const [job, setJob] = useState<JobLauf | null>(initialJob);
  const [busy, setBusy] = useState(false);
  const [reMatch, setReMatch] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [daten, setDaten] = useState<FehllisteResponse | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  // Filter
  const [konto, setKonto] = useState("alle");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [betragMin, setBetragMin] = useState("");
  const [betragMax, setBetragMax] = useState("");

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const ladeFehllisten = useCallback(async () => {
    setLaedt(true);
    setLadeFehler(null);
    const params = new URLSearchParams();
    if (konto !== "alle") params.set("konto", konto);
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (betragMin) params.set("betrag_min", betragMin);
    if (betragMax) params.set("betrag_max", betragMax);
    try {
      const res = await fetch(`/api/abgleich?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setLadeFehler(json.error ?? "Fehllisten konnten nicht geladen werden.");
        setLaedt(false);
        return;
      }
      setDaten(json as FehllisteResponse);
    } catch {
      setLadeFehler("Netzwerkfehler beim Laden der Fehllisten.");
    }
    setLaedt(false);
  }, [konto, von, bis, betragMin, betragMax]);

  useEffect(() => {
    // Laden in einen Microtask auslagern: kein synchroner setState-Pfad
    // direkt im Effekt-Body (react-hooks/set-state-in-effect).
    let abgebrochen = false;
    queueMicrotask(() => {
      if (!abgebrochen) void ladeFehllisten();
    });
    return () => {
      abgebrochen = true;
    };
  }, [ladeFehllisten]);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/abgleich?status=1");
      if (!res.ok) return;
      const json = (await res.json()) as { job: JobLauf | null };
      setJob(json.job);
      if (json.job && json.job.status !== "laeuft") {
        stopPolling();
        setBusy(false);
        await ladeFehllisten();
        router.refresh();
      }
    } catch {
      // nächster Tick versucht es erneut
    }
  }, [router, stopPolling, ladeFehllisten]);

  useEffect(() => {
    if (job?.status === "laeuft" && !pollRef.current) {
      pollRef.current = setInterval(pollStatus, 2000);
    }
    return stopPolling;
  }, [job?.status, pollStatus, stopPolling]);

  async function starten() {
    setBusy(true);
    try {
      const res = await fetch("/api/abgleich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nur_offen: !reMatch }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Abgleich fehlgeschlagen");
        setBusy(false);
        return;
      }
      const e = json.ergebnis as MatchErgebnis;
      toast.success(
        `Abgleich fertig: ${e.auto ?? 0} eindeutig, ${e.unsicher ?? 0} unsicher`,
      );
      await pollStatus();
      setBusy(false);
      await ladeFehllisten();
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler beim Abgleich");
      setBusy(false);
    }
  }

  async function unsicherAktion(
    belegId: string,
    buchungId: string,
    aktion: "bestaetigen" | "verwerfen",
  ) {
    try {
      const res = await fetch("/api/abgleich/zuordnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beleg_id: belegId,
          buchung_id: buchungId,
          aktion,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Aktion fehlgeschlagen");
        return;
      }
      toast.success(
        aktion === "bestaetigen" ? "Match bestätigt." : "Match verworfen.",
      );
      await ladeFehllisten();
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler");
    }
  }

  const e = (job?.ergebnis as MatchErgebnis | null) ?? {};
  const fehler = e.fehler ?? [];
  const laeuft = job?.status === "laeuft" || busy;
  const gesamt = job?.gesamt ?? 0;
  const prozent =
    gesamt > 0
      ? Math.min(100, Math.round(((job?.fortschritt ?? 0) / gesamt) * 100))
      : 0;

  const z = daten?.zusammenfassung;

  return (
    <div className="space-y-6">
      {/* Re-Matching-Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Automatischer Abgleich</CardTitle>
          <CardDescription>
            Gleicht geschäftliche Buchungen mit Belegen ab. Re-Matching
            aktualisiert nur offene Fälle — bestätigte/manuelle Zuordnungen
            bleiben geschützt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={starten} disabled={laeuft}>
              {laeuft ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {laeuft ? "Läuft…" : "Re-Matching starten"}
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                id="rematch"
                checked={reMatch}
                onCheckedChange={setReMatch}
                disabled={laeuft}
              />
              <Label htmlFor="rematch" className="text-sm">
                Alle neu rechnen (außer gesperrte)
              </Label>
            </div>
            <ManuelleZuordnungDialog
              alleBelege={alleBelege}
              alleBuchungen={alleBuchungen}
              onErfolg={() => {
                void ladeFehllisten();
                router.refresh();
              }}
            />
          </div>

          {job && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Letzter Lauf</span>
                  <Badge variant={STATUS_VARIANT[job.status]}>
                    {STATUS_LABEL[job.status]}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {jobZeit(job.created_at)}
                </span>
              </div>
              {job.status === "laeuft" && (
                <div className="space-y-1">
                  <Progress value={prozent} />
                  <p className="text-xs text-muted-foreground">
                    {job.fortschritt} / {gesamt}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="default">Eindeutig: {e.auto ?? 0}</Badge>
                <Badge variant="secondary">Unsicher: {e.unsicher ?? 0}</Badge>
                <Badge variant="outline">Ohne Beleg: {e.ohne_beleg ?? 0}</Badge>
                <Badge variant="outline">
                  Geschützt: {e.uebersprungen_gesperrt ?? 0}
                </Badge>
                {fehler.length > 0 && (
                  <Badge variant="destructive">Fehler: {fehler.length}</Badge>
                )}
              </div>
              {job.status === "fehler" && job.fehler_text && (
                <Alert variant="destructive">
                  <AlertTitle>Lauf abgebrochen</AlertTitle>
                  <AlertDescription>{job.fehler_text}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter */}
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="f-konto" className="text-xs">
              Konto
            </Label>
            <Select value={konto} onValueChange={setKonto}>
              <SelectTrigger id="f-konto">
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
          <div className="space-y-1">
            <Label htmlFor="f-von" className="text-xs">
              Von
            </Label>
            <Input
              id="f-von"
              type="date"
              value={von}
              onChange={(ev) => setVon(ev.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-bis" className="text-xs">
              Bis
            </Label>
            <Input
              id="f-bis"
              type="date"
              value={bis}
              onChange={(ev) => setBis(ev.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-min" className="text-xs">
              Betrag min (€)
            </Label>
            <Input
              id="f-min"
              type="number"
              inputMode="decimal"
              value={betragMin}
              onChange={(ev) => setBetragMin(ev.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-max" className="text-xs">
              Betrag max (€)
            </Label>
            <Input
              id="f-max"
              type="number"
              inputMode="decimal"
              value={betragMax}
              onChange={(ev) => setBetragMax(ev.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {ladeFehler ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{ladeFehler}</AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">
              Buchungen ohne Beleg
              {z ? ` (${z.buchungen_ohne_beleg})` : ""}
            </TabsTrigger>
            <TabsTrigger value="b">
              Belege ohne Buchung
              {z ? ` (${z.belege_ohne_buchung})` : ""}
            </TabsTrigger>
            <TabsTrigger value="u">
              Unsichere Matches
              {z ? ` (${z.unsicher})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* Fehlliste A */}
          <TabsContent value="a" className="mt-4">
            {laedt ? (
              <Lade />
            ) : (daten?.fehlliste_a ?? []).length === 0 ? (
              <Leer text="Alle geschäftlichen Buchungen haben einen Beleg." />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Empfänger</TableHead>
                      <TableHead>Verwendungszweck</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(daten?.fehlliste_a ?? []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDatum(b.buchung_datum)}
                        </TableCell>
                        <TableCell>{b.empfaenger ?? "–"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {b.verwendungszweck ?? "–"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatBetrag(b.betrag, b.waehrung)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ManuelleZuordnungDialog
                            alleBelege={alleBelege}
                            alleBuchungen={alleBuchungen}
                            vorauswahlBuchung={b}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Beleg zuordnen
                              </Button>
                            }
                            onErfolg={() => {
                              void ladeFehllisten();
                              router.refresh();
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Fehlliste B */}
          <TabsContent value="b" className="mt-4">
            {laedt ? (
              <Lade />
            ) : (daten?.fehlliste_b ?? []).length === 0 ? (
              <Leer text="Jeder Beleg ist einer Buchung zugeordnet." />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Korrespondent</TableHead>
                      <TableHead>Titel</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(daten?.fehlliste_b ?? []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDatum(b.beleg_datum)}
                        </TableCell>
                        <TableCell>{b.korrespondent ?? "–"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {b.titel ?? `Beleg #${b.paperless_id}`}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatBetrag(b.betrag)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ManuelleZuordnungDialog
                            alleBelege={alleBelege}
                            alleBuchungen={alleBuchungen}
                            vorauswahlBeleg={b}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Buchung zuordnen
                              </Button>
                            }
                            onErfolg={() => {
                              void ladeFehllisten();
                              router.refresh();
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Unsichere Matches */}
          <TabsContent value="u" className="mt-4">
            {laedt ? (
              <Lade />
            ) : (daten?.unsichere_matches ?? []).length === 0 ? (
              <Leer text="Keine unsicheren Matches offen." />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buchung</TableHead>
                      <TableHead>Beleg</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(daten?.unsichere_matches ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.buchung ? (
                            <div className="text-sm">
                              <p className="font-medium">
                                {formatBetrag(
                                  m.buchung.betrag,
                                  m.buchung.waehrung,
                                )}
                              </p>
                              <p className="text-muted-foreground">
                                {formatDatum(m.buchung.buchung_datum)} ·{" "}
                                {m.buchung.empfaenger ?? "–"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.beleg ? (
                            <div className="text-sm">
                              <p className="font-medium">
                                {m.beleg.titel ??
                                  `Beleg #${m.beleg.paperless_id}`}
                              </p>
                              <p className="text-muted-foreground">
                                {formatDatum(m.beleg.beleg_datum)} ·{" "}
                                {formatBetrag(m.beleg.betrag)} ·{" "}
                                {m.beleg.korrespondent ?? "–"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <KriterienDetail
                            score={m.match_score}
                            kriterien={m.kriterien}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!m.beleg || !m.buchung}
                              onClick={() =>
                                m.beleg &&
                                m.buchung &&
                                unsicherAktion(
                                  m.beleg.id,
                                  m.buchung.id,
                                  "bestaetigen",
                                )
                              }
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Bestätigen
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!m.beleg || !m.buchung}
                              onClick={() =>
                                m.beleg &&
                                m.buchung &&
                                unsicherAktion(
                                  m.beleg.id,
                                  m.buchung.id,
                                  "verwerfen",
                                )
                              }
                            >
                              <X className="mr-1 h-4 w-4" />
                              Verwerfen
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Lade() {
  return (
    <div className="rounded-md border p-10 text-center">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">Lädt…</p>
    </div>
  );
}

function Leer({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
