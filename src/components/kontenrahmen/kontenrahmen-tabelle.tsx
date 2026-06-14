"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Copy, Loader2, Trash2, FileText } from "lucide-react";
import type { Kategorie, KategorieTyp } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

const TYP_PILL: Record<KategorieTyp, string> = {
  einnahme: "bg-tint-cyan text-income-strong",
  ausgabe: "bg-tint-cerise text-destructive",
  privat: "bg-tint-violet text-brand-violet",
  neutral: "bg-[color:var(--surface-2)] text-muted-foreground",
};

const TYP_REIHENFOLGE: KategorieTyp[] = [
  "einnahme",
  "ausgabe",
  "privat",
  "neutral",
];

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
  const [vorlage, setVorlage] = useState<Kategorie | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deaktivieren, setDeaktivieren] = useState<Kategorie | null>(null);
  const [hartLoeschen, setHartLoeschen] = useState<Kategorie | null>(null);

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

  // Hard-Delete: Endgueltig loeschen — nur erlaubt, wenn keine Buchung
  // mehr verweist. Backend liefert bei Konflikt 409 + Trefferzahl, die
  // wir hier 1:1 anzeigen.
  async function confirmHartLoeschen() {
    if (!hartLoeschen) return;
    const k = hartLoeschen;
    setHartLoeschen(null);
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/kontenrahmen/${k.id}?hart=true`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Löschen fehlgeschlagen");
        return;
      }
      toast.success(json.message ?? "Kategorie gelöscht");
      await reload();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setBusyId(null);
    }
  }

  const istLeer = kategorien.length === 0;

  // Gruppierung nach Typ — iOS Settings-Style
  const grouped = TYP_REIHENFOLGE.map((typ) => ({
    typ,
    items: kategorien.filter((k) => k.typ === typ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">EÜR-Kontenrahmen</div>
          <p className="text-[12px] text-muted-foreground">
            Kategorien für Einnahmen, Ausgaben, Privat und neutrale Posten.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {istLeer && (
            <Button
              variant="outline"
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-full"
            >
              {seeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Standard-Kontenrahmen
            </Button>
          )}
          <Button
            onClick={() => {
              setBearbeiten(null);
              setVorlage(null);
              setDialogOpen(true);
            }}
            className="h-9 rounded-full bg-brand-violet font-semibold text-white hover:bg-[color:var(--accent-hover)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Kategorie
          </Button>
        </div>
      </div>

      {istLeer ? (
        <div className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-violet text-brand-violet">
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
            Noch keine Kategorien
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
            Lege den Standard-Kontenrahmen an oder erstelle eine eigene Kategorie.
          </p>
          <Button
            className="mt-4 rounded-full"
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
        grouped.map((g) => (
          <section key={g.typ} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {TYP_LABELS[g.typ]}
              </h3>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {g.items.length}
              </span>
            </div>
            <ul
              role="list"
              className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60 divide-y divide-line-hair"
            >
              {g.items.map((k) => (
                <li
                  key={k.id}
                  className={
                    "flex items-center gap-3 px-4 py-3 " +
                    (k.aktiv ? "" : "opacity-60")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold leading-tight">
                        {k.bezeichnung}
                      </span>
                      <span
                        className={
                          "shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold " +
                          TYP_PILL[k.typ]
                        }
                      >
                        {ustLabel(k.ust_satz)}
                      </span>
                    </div>
                    {k.euer_zeile || k.elster_kennzahl ? (
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                        {k.euer_zeile ? (
                          <span className="truncate">{k.euer_zeile}</span>
                        ) : null}
                        {k.elster_kennzahl ? (
                          <>
                            <span className="text-line-strong">·</span>
                            <span>ELSTER {k.elster_kennzahl}</span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-violet hover:text-brand-violet"
                    onClick={() => {
                      setBearbeiten(k);
                      setVorlage(null);
                      setDialogOpen(true);
                    }}
                    title="Bearbeiten"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-violet hover:text-brand-violet"
                    onClick={() => {
                      setBearbeiten(null);
                      setVorlage({
                        ...k,
                        bezeichnung: `${k.bezeichnung} (Kopie)`,
                      });
                      setDialogOpen(true);
                    }}
                    title="Duplizieren"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-cerise hover:text-destructive"
                    disabled={busyId === k.id}
                    onClick={() => setHartLoeschen(k)}
                    title="Endgültig löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <KategorieDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kategorie={bearbeiten}
        vorlage={vorlage}
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

      <AlertDialog
        open={hartLoeschen !== null}
        onOpenChange={(o) => {
          if (!o) setHartLoeschen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{hartLoeschen?.bezeichnung}" wird unwiderruflich gelöscht.
              Das funktioniert nur, wenn keine Buchung mehr darauf verweist —
              sonst muss zuerst umgebucht oder deaktiviert werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmHartLoeschen}
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
