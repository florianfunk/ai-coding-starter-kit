"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BulkUstResponse } from "@/app/api/buchungen/bulk-ust/route";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function SteuersatzBulkDialog({ ids, onClose, onAktualisiert }: {
  ids: string[];
  onClose: () => void;
  onAktualisiert: (ids: string[]) => void;
}) {
  const [satz, setSatz] = useState("");
  const [restIds, setRestIds] = useState(ids);
  const [aktualisiert, setAktualisiert] = useState(0);
  const [uebersprungen, setUebersprungen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const verarbeitet = ids.length - restIds.length;

  async function speichern() {
    if (busy || !satz || restIds.length === 0) return;
    setBusy(true);
    setFehler(null);
    const gespeichert: string[] = [];
    let anzahl = aktualisiert;
    let ausgelassen = uebersprungen;
    try {
      // Die bestehende API erlaubt bis zu 500 Buchungen pro Request.
      for (let start = 0; start < restIds.length; start += 500) {
        const block = restIds.slice(start, start + 500);
        const res = await fetch("/api/buchungen/bulk-ust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: block, ust_satz: satz === "kein" ? null : Number(satz) }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "Steuersätze konnten nicht gespeichert werden.");
        }
        const json = await res.json() as BulkUstResponse;
        const fehlend = new Set(json.uebersprungen);
        gespeichert.push(...block.filter((id) => !fehlend.has(id)));
        anzahl += json.aktualisiert;
        ausgelassen += json.uebersprungen.length;
        setAktualisiert(anzahl);
        setUebersprungen(ausgelassen);
        setRestIds(restIds.slice(start + block.length));
      }
      toast.success(`${anzahl} ${anzahl === 1 ? "Buchung aktualisiert" : "Buchungen aktualisiert"}.`);
      if (ausgelassen > 0) {
        toast.warning(`${ausgelassen} ${ausgelassen === 1 ? "Buchung wurde nicht gefunden oder ist" : "Buchungen wurden nicht gefunden oder sind"} nicht zugänglich.`);
      }
      onClose();
    } catch (error) {
      setFehler((error instanceof Error ? error.message : "Speichern fehlgeschlagen.") +
        " Bereits gespeicherte Änderungen bleiben erhalten. Du kannst die verbleibenden Buchungen erneut speichern.");
    } finally {
      // Auch nach einem Fehler neu laden: Ein Request kann teilweise gespeichert sein.
      onAktualisiert(gespeichert);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Steuersatz ändern</DialogTitle>
          <DialogDescription>
            Für {ids.length} ausgewählte {ids.length === 1 ? "Buchung" : "Buchungen"} wird der bisherige Steuersatz überschrieben.
            Die Buchungen werden als manuell bestätigt gespeichert. Kategorie und Klassifikation bleiben erhalten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bulk-steuersatz">Neuer Steuersatz</Label>
          <Select value={satz} onValueChange={setSatz} disabled={busy || verarbeitet > 0}>
            <SelectTrigger id="bulk-steuersatz"><SelectValue placeholder="Steuersatz wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="19">19 %</SelectItem>
              <SelectItem value="7">7 %</SelectItem>
              <SelectItem value="0">0 %</SelectItem>
              <SelectItem value="kein">Kein Steuersatz</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(busy || verarbeitet > 0) && <p role="status" className="text-sm text-muted-foreground">
          {verarbeitet} von {ids.length} Buchungen verarbeitet, {aktualisiert} aktualisiert{uebersprungen > 0 ? `, ${uebersprungen} übersprungen` : ""}.
        </p>}
        {fehler && <p role="alert" className="text-sm text-destructive">{fehler}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !satz || restIds.length === 0} onClick={speichern}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? "Wird gespeichert…" : "Steuersatz speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
