"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Building2, CreditCard, Wallet } from "lucide-react";
import type { Konto, KontoTyp } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

const TYP_ICON_BG: Record<KontoTyp, string> = {
  bank: "bg-tint-violet text-brand-violet",
  paypal: "bg-tint-cyan text-income-strong",
  kreditkarte: "bg-tint-yellow text-highlight-strong",
};
const TYP_ICON: Record<KontoTyp, typeof Building2> = {
  bank: Building2,
  paypal: Wallet,
  kreditkarte: CreditCard,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">Konten</div>
          <p className="text-[12px] text-muted-foreground">
            Bank-, PayPal- und Kreditkartenkonten mit gespeicherter
            Spalten-Mapping-Vorlage.
          </p>
        </div>
        <Button
          onClick={() => {
            setBearbeiten(null);
            setDialogOpen(true);
          }}
          className="h-9 rounded-full bg-brand-violet font-semibold text-white hover:bg-[color:var(--accent-hover)]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Konto anlegen
        </Button>
      </div>

      {istLeer ? (
        <div className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-violet text-brand-violet">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
            Noch keine Konten angelegt
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
            Lege dein erstes Konto an (z. B. Geschäftskonto, PayPal,
            Kreditkarte).
          </p>
          <Button
            className="mt-4 rounded-full bg-brand-violet font-semibold text-white hover:bg-[color:var(--accent-hover)]"
            onClick={() => {
              setBearbeiten(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Konto anlegen
          </Button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <ul role="list" className="divide-y divide-line-hair">
            {konten.map((k) => {
              const Icon = TYP_ICON[k.typ];
              return (
                <li
                  key={k.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div
                    className={
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] " +
                      TYP_ICON_BG[k.typ]
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold leading-tight">
                        {k.bezeichnung}
                      </span>
                      <span className="rounded-full bg-[color:var(--surface-2)] px-2 py-0 text-[10px] font-medium text-muted-foreground">
                        {TYP_LABELS[k.typ]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {k.mapping ? (
                        <span className="inline-flex items-center gap-1 text-income-strong">
                          ● Mapping konfiguriert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-highlight-strong">
                          ○ Noch kein Mapping
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busyId === k.id}
                      className="h-8 w-8 rounded-full text-muted-foreground hover:bg-tint-violet hover:text-brand-violet"
                      onClick={() => {
                        setBearbeiten(k);
                        setDialogOpen(true);
                      }}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:bg-tint-cerise hover:text-destructive"
                      disabled={busyId === k.id}
                      onClick={() => setLoeschen(k)}
                      title="Löschen"
                    >
                      {busyId === k.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
    </div>
  );
}
