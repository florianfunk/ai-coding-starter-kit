"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { startKatalogJob } from "./actions";

export function KatalogForm({ wechselkurs }: { wechselkurs: number }) {
  const router = useRouter();
  const [layout, setLayout] = useState<"lichtengros" | "eisenkeil">("lichtengros");
  const [preisauswahl, setPreisauswahl] = useState<"listenpreis" | "ek">("listenpreis");
  const [preisAenderung, setPreisAenderung] = useState<"plus" | "minus">("plus");
  const [preisProzent, setPreisProzent] = useState("0");
  const [waehrung, setWaehrung] = useState<"EUR" | "CHF">("EUR");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const r = await startKatalogJob({
        layout,
        preisauswahl,
        preisAenderung,
        preisProzent: Number(preisProzent) || 0,
        waehrung,
        wechselkurs,
      });
      if (r.error || !r.jobId) {
        toast.error(r.error ?? "Job konnte nicht gestartet werden");
        return;
      }
      toast.success("Katalog wird generiert…");
      router.refresh();
      // Render-Task in API-Route starten (läuft im Hintergrund, ohne auf Response zu warten)
      fetch(`/api/katalog-jobs/${r.jobId}/run`, { method: "POST" }).catch(() => {
        toast.error("Render-Task konnte nicht gestartet werden");
      });
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Katalog-Parameter</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div>
            <Label>Layout</Label>
            <div className="flex gap-2 mt-1">
              <Radio name="layout" value="lichtengros" checked={layout === "lichtengros"} onChange={() => setLayout("lichtengros")}>Lichtengros</Radio>
              <Radio name="layout" value="eisenkeil" checked={layout === "eisenkeil"} onChange={() => setLayout("eisenkeil")}>Eisenkeil</Radio>
            </div>
          </div>
          <div>
            <Label>Preisauswahl</Label>
            <select value={preisauswahl} onChange={(e) => setPreisauswahl(e.target.value as any)} className="w-full mt-1 rounded border px-2 py-2 bg-background">
              <option value="listenpreis">Listenpreis</option>
              <option value="ek">EK (Einkaufspreis)</option>
            </select>
          </div>
          <div>
            <Label>Preisänderung</Label>
            <div className="flex gap-2 mt-1">
              <Radio name="paend" value="plus" checked={preisAenderung === "plus"} onChange={() => setPreisAenderung("plus")}>plus</Radio>
              <Radio name="paend" value="minus" checked={preisAenderung === "minus"} onChange={() => setPreisAenderung("minus")}>minus</Radio>
            </div>
          </div>
          <div>
            <Label htmlFor="prozent">Preisänderung %</Label>
            <Input id="prozent" type="number" step="0.1" value={preisProzent} onChange={(e) => setPreisProzent(e.target.value)} />
          </div>
          <div>
            <Label>Währung</Label>
            <div className="flex gap-2 mt-1">
              <Radio name="waehr" value="EUR" checked={waehrung === "EUR"} onChange={() => setWaehrung("EUR")}>EUR</Radio>
              <Radio name="waehr" value="CHF" checked={waehrung === "CHF"} onChange={() => setWaehrung("CHF")}>CHF (Kurs {wechselkurs})</Radio>
            </div>
          </div>
          <div>
            <Label>Sprache</Label>
            <select disabled className="w-full mt-1 rounded border px-2 py-2 bg-background">
              <option>Deutsch</option>
            </select>
          </div>
        </div>
        <Button onClick={submit} disabled={pending}>{pending ? "Starte…" : "Katalog generieren"}</Button>
      </CardContent>
    </Card>
  );
}

function Radio({ children, ...props }: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1 text-sm">
      <input type="radio" {...props} />
      {children}
    </label>
  );
}
