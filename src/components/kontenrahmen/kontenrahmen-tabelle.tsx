"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
import type { Kategorie, KategorieTyp } from "@/lib/types";
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
import { KategorieDialog } from "./kategorie-dialog";

const TYP_LABELS: Record<KategorieTyp, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
  privat: "Privat",
  neutral: "Neutral",
};

const TYP_VARIANT: Record<
  KategorieTyp,
  "default" | "secondary" | "outline" | "destructive"
> = {
  einnahme: "default",
  ausgabe: "secondary",
  privat: "outline",
  neutral: "outline",
};

function ustLabel(satz: number | null): string {
  if (satz === null) return "–";
  return `${satz} %`;
}

export function KontenrahmenTabelle({
  initialKategorien,
}: {
  initialKategorien: Kategorie[];
}) {
  const router = useRouter();
  const [kategorien, setKategorien] = useState<Kategorie[]>(initialKategorien);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<Kategorie | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deaktivieren, setDeaktivieren] = useState<Kategorie | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/kontenrahmen");
      const json = await res.json();
      if (res.ok) {
        setKategorien(json.data ?? []);
      }
    } catch {
      // Stillschweigend: nächste Aktion versucht erneut.
    }
    router.refresh();
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/kontenrahmen/seed", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Anlegen fehlgeschlagen");
        return;
      }
      toast.success(json.message ?? "Standard-Kontenrahmen angelegt");
      await reload();
    } catch {
      toast.error("Netzwerkfehler beim Anlegen");
    } finally {
      setSeeding(false);
    }
  }

  async function toggleAktiv(k: Kategorie, naechsterWert: boolean) {
    // Deaktivieren erfordert Bestätigung (historische Buchungen).
    if (!naechsterWert) {
      setDeaktivieren(k);
      return;
    }
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/kontenrahmen/${k.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bezeichnung: k.bezeichnung,
          typ: k.typ,
          ust_satz: k.ust_satz,
          euer_zeile: k.euer_zeile,
          elster_kennzahl: k.elster_kennzahl,
          aktiv: true,
          gueltig_ab: k.gueltig_ab,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Aktualisieren fehlgeschlagen");
        return;
      }
      toast.success("Kategorie aktiviert");
      await reload();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeaktivieren() {
    if (!deaktivieren) return;
    const k = deaktivieren;
    setDeaktivieren(null);
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/kontenrahmen/${k.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Deaktivieren fehlgeschlagen");
        return;
      }
      toast.success(json.message ?? "Kategorie deaktiviert");
      await reload();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setBusyId(null);
    }
  }

  const istLeer = kategorien.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>EÜR-Kontenrahmen</CardTitle>
          <CardDescription>
            Kategorien für Einnahmen, Ausgaben, Privat und neutrale Posten.
            Deaktivierte Kategorien bleiben für bestehende Buchungen erhalten.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {istLeer && (
            <Button
              variant="outline"
              onClick={handleSeed}
              disabled={seeding}
            >
              {seeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Standard-Kontenrahmen anlegen
            </Button>
          )}
          <Button
            onClick={() => {
              setBearbeiten(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Kategorie
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {istLeer ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Kategorien angelegt.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege den Standard-Kontenrahmen an oder erstelle eine eigene
              Kategorie.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={handleSeed}
              disabled={seeding}
            >
              {seeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Standard-Kontenrahmen anlegen
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>USt-Satz</TableHead>
                  <TableHead>EÜR-Zeile</TableHead>
                  <TableHead>ELSTER-Kennzahl</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kategorien.map((k) => (
                  <TableRow
                    key={k.id}
                    className={k.aktiv ? "" : "opacity-60"}
                  >
                    <TableCell className="font-medium">
                      {k.bezeichnung}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYP_VARIANT[k.typ]}>
                        {TYP_LABELS[k.typ]}
                      </Badge>
                    </TableCell>
                    <TableCell>{ustLabel(k.ust_satz)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {k.euer_zeile ?? "–"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.elster_kennzahl ?? "–"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={k.aktiv}
                        disabled={busyId === k.id}
                        onCheckedChange={(v) => toggleAktiv(k, v)}
                        aria-label={
                          k.aktiv
                            ? `${k.bezeichnung} deaktivieren`
                            : `${k.bezeichnung} aktivieren`
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBearbeiten(k);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        Bearbeiten
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <KategorieDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kategorie={bearbeiten}
        onSaved={reload}
      />

      <AlertDialog
        open={deaktivieren !== null}
        onOpenChange={(o) => {
          if (!o) setDeaktivieren(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deaktivieren?.bezeichnung}" wird deaktiviert und ist nicht mehr
              neu zuweisbar. Bestehende Buchungen bleiben unverändert erhalten.
              Es wird nichts gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeaktivieren}>
              Deaktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
