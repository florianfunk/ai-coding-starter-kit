"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Konto, KontoTyp } from "@/lib/types";
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
import { KontoDialog } from "./konto-dialog";

const TYP_LABELS: Record<KontoTyp, string> = {
  bank: "Bank",
  paypal: "PayPal",
  kreditkarte: "Kreditkarte",
};

const TYP_VARIANT: Record<
  KontoTyp,
  "default" | "secondary" | "outline" | "destructive"
> = {
  bank: "default",
  paypal: "secondary",
  kreditkarte: "outline",
};

export function KontenTabelle({
  initialKonten,
}: {
  initialKonten: Konto[];
}) {
  const router = useRouter();
  const [konten, setKonten] = useState<Konto[]>(initialKonten);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<Konto | null>(null);
  const [loeschen, setLoeschen] = useState<Konto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/konten");
      const json = await res.json();
      if (res.ok) setKonten(json.data ?? []);
    } catch {
      // Stillschweigend: nächste Aktion versucht erneut.
    }
    router.refresh();
  }

  async function confirmLoeschen() {
    if (!loeschen) return;
    const k = loeschen;
    setLoeschen(null);
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/konten/${k.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Löschen fehlgeschlagen");
        return;
      }
      toast.success(json.message ?? "Konto gelöscht");
      await reload();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setBusyId(null);
    }
  }

  const istLeer = konten.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Konten</CardTitle>
          <CardDescription>
            Bank-, PayPal- und Kreditkartenkonten mit gespeicherter
            Spalten-Mapping-Vorlage. Das Mapping wird bei jedem weiteren Import
            desselben Kontos automatisch wiederverwendet.
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setBearbeiten(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Konto
        </Button>
      </CardHeader>
      <CardContent>
        {istLeer ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Konten angelegt.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege dein erstes Konto an (z. B. Geschäftskonto, PayPal,
              Kreditkarte).
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setBearbeiten(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Konto anlegen
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Mapping</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {konten.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">
                      {k.bezeichnung}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYP_VARIANT[k.typ]}>
                        {TYP_LABELS[k.typ]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.mapping ? (
                        <Badge variant="outline">konfiguriert</Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          noch nicht eingerichtet
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === k.id}
                        onClick={() => {
                          setBearbeiten(k);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === k.id}
                        onClick={() => setLoeschen(k)}
                      >
                        {busyId === k.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-4 w-4" />
                        )}
                        Löschen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <KontoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        konto={bearbeiten}
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
            <AlertDialogTitle>Konto löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{loeschen?.bezeichnung}“ wird endgültig gelöscht. ACHTUNG: Alle
              diesem Konto zugeordneten Buchungen werden ebenfalls gelöscht.
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLoeschen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
