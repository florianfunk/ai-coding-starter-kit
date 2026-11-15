"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UstRhythmus } from "@/lib/tax/perioden";

export function UstRhythmusEinstellung({ rhythmus, vorher, gueltigAb, jahr }: {
  rhythmus: UstRhythmus; vorher: UstRhythmus | null; gueltigAb: string | null; jahr: number;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [datum, setDatum] = useState(vorher && gueltigAb ? gueltigAb : `${jahr}-04-01`);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    if (busy) return;
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch("/api/firma/ust-rhythmus", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rhythmus_gueltig_ab: datum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Umstellung fehlgeschlagen.");
      toast.success("Monatliche Abgabe eingerichtet. Frühere Quartale bleiben erhalten.");
      setOffen(false);
      router.refresh();
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Umstellung fehlgeschlagen.");
    } finally { setBusy(false); }
  }

  const terminKorrektur = vorher === "quartalsweise" && rhythmus === "monatlich";
  if (rhythmus !== "quartalsweise" && !terminKorrektur) return null;

  return <>
    {vorher && gueltigAb && <p className="text-sm text-muted-foreground">
      Monatliche Abgabe ab {gueltigAb.split("-").reverse().join(".")}. Frühere Zeiträume bleiben quartalsweise.
    </p>}
    <Button variant="outline" size="sm" onClick={() => setOffen(true)}>{terminKorrektur ? "Wechseltermin ändern" : "Abgaberhythmus ändern"}</Button>
    <Dialog open={offen} onOpenChange={(open) => { if (!busy) setOffen(open); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{terminKorrektur ? "Wechseltermin korrigieren" : "Auf monatliche Abgabe umstellen"}</DialogTitle>
          <DialogDescription>
            Wähle den Beginn laut Finanzamt. Vor diesem Datum bleiben die Quartale erhalten;
            ab diesem Datum gelten einzelne Monate. Exporte und Fristen verwenden denselben Wechseltermin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ust-rhythmus-ab">Monatlich ab</Label>
          <Input id="ust-rhythmus-ab" type="date" min="2000-01-01" max="2100-12-31"
            value={datum} onChange={(e) => setDatum(e.target.value)} disabled={busy} />
          <p className="text-sm text-muted-foreground">Wechsel zum 1. Januar, 1. April, 1. Juli oder 1. Oktober.</p>
        </div>
        {fehler && <p role="alert" className="text-sm text-destructive">{fehler}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOffen(false)}>Abbrechen</Button>
          <Button disabled={busy || !datum} onClick={speichern}>{busy ? "Wird gespeichert…" : terminKorrektur ? "Wechseltermin speichern" : "Auf monatlich umstellen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
