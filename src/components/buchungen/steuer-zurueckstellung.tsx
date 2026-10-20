"use client";

import { useState } from "react";
import type { Buchung } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SteuerBuchung = Pick<Buchung, "id" | "steuer_zurueckgestellt" | "steuer_zurueckgestellt_grund" | "steuer_zurueckgestellt_am">;

export function SteuerZurueckstellung({ buchung, onGespeichert }: { buchung: SteuerBuchung; onGespeichert: () => void }) {
  const [grund, setGrund] = useState("");
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const zurueck = buchung.steuer_zurueckgestellt === true;

  async function speichern() {
    if (saving) return;
    setSaving(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/buchungen/${buchung.id}/zurueckstellung`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zurueck
          ? { aktion: "wiederaufnehmen", erwartet_am: buchung.steuer_zurueckgestellt_am ?? null }
          : { aktion: "zurueckstellen", grund: grund.trim(), erwartet_am: buchung.steuer_zurueckgestellt_am ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen.");
      onGespeichert();
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Steuerliche Berücksichtigung" className="space-y-3 rounded-md border p-3 text-sm">
      <h3 className="font-semibold">{zurueck ? "Zurückgestellt – steuerlich ausgeschlossen" : "Steuerliche Berücksichtigung"}</h3>
      <p className="text-muted-foreground">{zurueck
        ? "Diese Buchung zählt nicht in den Steuerauswertungen und steuerlichen Exporten."
        : "Bei strittigen Rechnungen kannst du die Buchung vorübergehend aus den Steuerauswertungen und steuerlichen Exporten ausschließen. Sie bleibt in den Kontobewegungen erhalten."}</p>
      {zurueck ? <p className="whitespace-pre-wrap break-words"><strong>Grund:</strong> {buchung.steuer_zurueckgestellt_grund}</p> : (
        <div className="space-y-1.5">
          <Label htmlFor={`steuer-grund-${buchung.id}`}>Grund für die Rückstellung</Label>
          <Textarea id={`steuer-grund-${buchung.id}`} value={grund} onChange={(e) => setGrund(e.target.value)}
            maxLength={1000} disabled={saving} placeholder="Zum Beispiel: Rechnung strittig, Klärung mit Lieferant läuft" />
        </div>
      )}
      {fehler && <p role="alert" className="text-destructive">{fehler}</p>}
      <Button type="button" variant="outline" disabled={saving || (!zurueck && !grund.trim())} onClick={speichern}>
        {saving ? "Wird gespeichert…" : zurueck ? "Wieder aufnehmen" : "Für Steuer zurückstellen"}
      </Button>
    </section>
  );
}
