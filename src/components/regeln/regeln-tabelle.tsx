"use client";

// PROJ-7: Regel-Tabelle. Bedingung/Aktion lesbar, Priorität, aktiv-Switch,
// Trefferzähler. Editor-Dialog zum Anlegen/Bearbeiten, Löschen mit
// Bestätigung. Konfliktwarnung wird im Dialog angezeigt.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Kategorie, Konto, Lernregel } from "@/lib/types";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">Lernregeln</div>
          <p className="text-[12px] text-muted-foreground">
            Regeln mit Vorrang vor der KI. Änderungen wirken nur auf künftige
            bzw. offene Fälle.
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
          Regel
        </Button>
      </div>

      {istLeer ? (
        <div className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-violet text-brand-violet">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
            Noch keine Lernregeln
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
            Lege eine an oder erzeuge eine aus einer Entscheidung in der
            Prüfliste.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <ul role="list" className="divide-y divide-line-hair">
            {regeln.map((r) => (
              <li
                key={r.id}
                className={
                  "flex items-center gap-3 px-4 py-3 " +
                  (r.aktiv ? "" : "opacity-60")
                }
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tint-violet font-mono text-[12px] font-bold text-brand-violet">
                  {r.prioritaet}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold leading-tight">
                      {r.bezeichnung}
                    </span>
                    {r.treffer_zaehler > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-tint-cyan px-2 py-0 font-mono text-[10px] font-semibold text-income-strong">
                        {r.treffer_zaehler} ×
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {bedingungText(r, kontoName)}
                    </span>
                    <span className="mx-1.5 text-line-strong">→</span>
                    <span>{aktionText(r, kategorieName)}</span>
                  </div>
                </div>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-violet hover:text-brand-violet"
                  onClick={() => {
                    setBearbeiten(r);
                    setDialogOpen(true);
                  }}
                  title="Bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-cerise hover:text-destructive"
                  disabled={busyId === r.id}
                  onClick={() => setLoeschen(r)}
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
    </div>
  );
}
