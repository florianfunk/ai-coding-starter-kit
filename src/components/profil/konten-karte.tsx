"use client";

// PROJ-16 — Konten-Karte: Anzeige aller Konten des Owners mit Toggle
// „ist_eigenes_konto". Eigene Konten oben, Drittkonten unten.
//
// PATCH /api/konten/[id]/eigenes ändert das Flag pro Konto.

import { useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface KontoEintrag {
  id: string;
  bezeichnung: string;
  ist_eigenes_konto: boolean;
  iban: string | null;
}

export function KontenKarte({
  initial,
}: {
  initial: KontoEintrag[];
}) {
  const [konten, setKonten] = useState<KontoEintrag[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(k: KontoEintrag, neu: boolean) {
    setBusyId(k.id);
    // Optimistisches UI-Update.
    setKonten((prev) =>
      prev.map((x) => (x.id === k.id ? { ...x, ist_eigenes_konto: neu } : x)),
    );
    try {
      const res = await fetch(`/api/konten/${k.id}/eigenes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ist_eigenes_konto: neu }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Rollback.
        setKonten((prev) =>
          prev.map((x) =>
            x.id === k.id ? { ...x, ist_eigenes_konto: k.ist_eigenes_konto } : x,
          ),
        );
        toast.error(json.error ?? "Konto konnte nicht aktualisiert werden.");
        return;
      }
      toast.success(
        neu ? "Als eigenes Konto markiert." : "Als Drittkonto markiert.",
      );
    } catch {
      // Rollback.
      setKonten((prev) =>
        prev.map((x) =>
          x.id === k.id ? { ...x, ist_eigenes_konto: k.ist_eigenes_konto } : x,
        ),
      );
      toast.error("Netzwerkfehler.");
    } finally {
      setBusyId(null);
    }
  }

  const eigene = konten.filter((k) => k.ist_eigenes_konto);
  const fremde = konten.filter((k) => !k.ist_eigenes_konto);
  const istLeer = konten.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eigene Bankkonten</CardTitle>
        <CardDescription>
          Umbuchungen zwischen eigenen Konten werden als Geldtransit (neutral)
          erkannt. Hier markierst du, welche der importierten Konten dir
          gehören.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {istLeer ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Konten angelegt. Lege Konten unter „Bankkonten" an.
          </div>
        ) : (
          <>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Eigene Konten
              </h3>
              {eigene.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aktuell sind keine Konten als „eigen" markiert.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {eigene.map((k) => (
                    <KontoZeile
                      key={k.id}
                      konto={k}
                      busy={busyId === k.id}
                      onToggle={(v) => toggle(k, v)}
                    />
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Drittkonten
              </h3>
              {fremde.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Drittkonten markiert.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {fremde.map((k) => (
                    <KontoZeile
                      key={k.id}
                      konto={k}
                      busy={busyId === k.id}
                      onToggle={(v) => toggle(k, v)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KontoZeile({
  konto,
  busy,
  onToggle,
}: {
  konto: KontoEintrag;
  busy: boolean;
  onToggle: (v: boolean) => void;
}) {
  const ibanEnde =
    konto.iban && konto.iban.length >= 4
      ? `…${konto.iban.slice(-4)}`
      : null;
  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="font-medium">{konto.bezeichnung}</div>
        {ibanEnde && (
          <div className="text-xs text-muted-foreground tabular-nums">
            IBAN {ibanEnde}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Eigenes Konto</span>
        <Switch
          checked={konto.ist_eigenes_konto}
          disabled={busy}
          onCheckedChange={onToggle}
          aria-label={`Konto „${konto.bezeichnung}" als eigenes Konto markieren`}
        />
      </div>
    </li>
  );
}
