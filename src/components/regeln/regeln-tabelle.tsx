"use client";

// PROJ-7: Regel-Tabelle. Bedingung/Aktion lesbar, Priorität, aktiv-Switch,
// Trefferzähler. Editor-Dialog zum Anlegen/Bearbeiten, Löschen mit
// Bestätigung. Konfliktwarnung wird im Dialog angezeigt.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Kategorie, Konto, Lernregel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RegelDialog } from "./regel-dialog";

function bedingungText(r: Lernregel, kontoName: (id: string) => string): string {
  const b = r.bedingung ?? {};
  const teile: string[] = [];
  if (b.empfaenger_muster) teile.push(`Empfänger~"${b.empfaenger_muster}"`);
  if (b.zweck_muster) teile.push(`Zweck~"${b.zweck_muster}"`);
  if (b.konto_id) teile.push(`Konto=${kontoName(b.konto_id)}`);
  if (typeof b.betrag_min === "number") teile.push(`≥ ${b.betrag_min}`);
  if (typeof b.betrag_max === "number") teile.push(`≤ ${b.betrag_max}`);
  return teile.length > 0 ? teile.join(" · ") : "—";
}

function aktionText(
  r: Lernregel,
  kategorieName: (id: string) => string,
): string {
  const a = r.aktion ?? {};
  const teile: string[] = [];
  if (a.kategorie_id) teile.push(kategorieName(a.kategorie_id));
  if (typeof a.ust_satz === "number") teile.push(`${a.ust_satz}% USt`);
  if (a.klassifikation) teile.push(a.klassifikation);
  return teile.length > 0 ? teile.join(" · ") : "—";
}

export function RegelnTabelle({
  initialRegeln,
  konten,
  kategorien,
}: {
  initialRegeln: Lernregel[];
  konten: Konto[];
  kategorien: Kategorie[];
}) {
  const router = useRouter();
  const [regeln, setRegeln] = useState<Lernregel[]>(initialRegeln);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<Lernregel | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<Lernregel | null>(null);

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "Unbekannt";
  const kategorieName = (id: string) =>
    kategorien.find((k) => k.id === id)?.bezeichnung ?? "Unbekannt";

  async function reload() {
    try {
      const res = await fetch("/api/regeln");
      const json = await res.json();
      if (res.ok) setRegeln(json.data ?? []);
    } catch {
      // Stillschweigend.
    }
    router.refresh();
  }

  async function toggleAktiv(r: Lernregel, naechster: boolean) {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/regeln/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bezeichnung: r.bezeichnung,
          bedingung: r.bedingung,
          aktion: r.aktion,
          prioritaet: r.prioritaet,
          aktiv: naechster,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Aktualisieren fehlgeschlagen.");
        return;
      }
      if (Array.isArray(json.konflikte) && json.konflikte.length > 0) {
        toast.warning(
          "Regel aktiv, aber es bestehen Konflikte gleicher Priorität.",
        );
      } else {
        toast.success(naechster ? "Regel aktiviert." : "Regel deaktiviert.");
      }
      await reload();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmLoeschen() {
    if (!loeschen) return;
    const r = loeschen;
    setLoeschen(null);
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/regeln/${r.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      toast.success(json.message ?? "Regel gelöscht.");
      await reload();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setBusyId(null);
    }
  }

  const istLeer = regeln.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Lernregeln</CardTitle>
          <CardDescription>
            Regeln mit Vorrang vor der KI. Änderungen wirken nur auf künftige
            bzw. offene Fälle – bestätigte Buchungen bleiben unverändert.
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setBearbeiten(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Regel
        </Button>
      </CardHeader>
      <CardContent>
        {istLeer ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Lernregeln. Lege eine an oder erzeuge eine aus einer
              Entscheidung in der Prüfliste.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Bedingung</TableHead>
                  <TableHead>Aktion</TableHead>
                  <TableHead className="text-center">Priorität</TableHead>
                  <TableHead className="text-center">Treffer</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regeln.map((r) => (
                  <TableRow key={r.id} className={r.aktiv ? "" : "opacity-60"}>
                    <TableCell className="font-medium">
                      {r.bezeichnung}
                    </TableCell>
                    <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                      {bedingungText(r, kontoName)}
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                      {aktionText(r, kategorieName)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{r.prioritaet}</Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {r.treffer_zaehler}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.aktiv}
                        disabled={busyId === r.id}
                        onCheckedChange={(v) => toggleAktiv(r, v)}
                        aria-label={
                          r.aktiv
                            ? `${r.bezeichnung} deaktivieren`
                            : `${r.bezeichnung} aktivieren`
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBearbeiten(r);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Bearbeiten
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => setLoeschen(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <RegelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        regel={bearbeiten}
        konten={konten}
        kategorien={kategorien}
        onSaved={reload}
      />

      <AlertDialog
        open={loeschen !== null}
        onOpenChange={(o) => {
          if (!o) setLoeschen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{loeschen?.bezeichnung}" wird gelöscht. Bereits verbuchte
              Buchungen bleiben unverändert (kein Rückwirkungseffekt).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoeschen}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
