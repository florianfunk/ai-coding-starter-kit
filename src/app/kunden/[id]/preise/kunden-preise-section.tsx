"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { savePreise } from "../../actions";

type Spur = "lichtengros" | "eisenkeil" | "listenpreis";
type Vorzeichen = "plus" | "minus";

type VorschauZeile = {
  id: string;
  artikelnummer: string;
  name: string;
  lichtengros: number | null;
  eisenkeil: number | null;
  listenpreis: number | null;
};

type Props = {
  kundeId: string;
  initial: {
    preis_spur: Spur;
    aufschlag_vorzeichen: Vorzeichen;
    aufschlag_pct: number;
  };
  vorschau: VorschauZeile[];
};

const FORMAT_EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function effektiv(
  base: number | null,
  vorzeichen: Vorzeichen,
  pct: number,
): number | null {
  if (base == null) return null;
  const factor = 1 + (vorzeichen === "plus" ? 1 : -1) * (pct / 100);
  let val = base * factor;
  if (!Number.isFinite(val)) return null;
  if (val < 0) val = 0;
  return Math.round(val * 100) / 100;
}

export function KundenPreiseSection({ kundeId, initial, vorschau }: Props) {
  const router = useRouter();
  const [spur, setSpur] = useState<Spur>(initial.preis_spur);
  const [vz, setVz] = useState<Vorzeichen>(initial.aufschlag_vorzeichen);
  const [pct, setPct] = useState<number>(initial.aufschlag_pct);
  const [pending, startTransition] = useTransition();

  const dirty =
    spur !== initial.preis_spur ||
    vz !== initial.aufschlag_vorzeichen ||
    pct !== initial.aufschlag_pct;

  function handleSave() {
    startTransition(async () => {
      const result = await savePreise(kundeId, {
        preis_spur: spur,
        aufschlag_vorzeichen: vz,
        aufschlag_pct: pct,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Preise gespeichert");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preisspur</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={spur} onValueChange={(v) => setSpur(v as Spur)} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="lichtengros" />
              Lichtengros-Preis
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="eisenkeil" />
              Eisenkeil-Preis
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="listenpreis" />
              Listenpreis
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aufschlag / Rabatt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Vorzeichen</Label>
              <RadioGroup
                value={vz}
                onValueChange={(v) => setVz(v as Vorzeichen)}
                className="mt-2 flex gap-3"
              >
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="plus" />+
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="minus" />−
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="pct">Prozent</Label>
              <Input
                id="pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-28"
              />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Im Katalog-Wizard kann der Aufschlag pro Druck noch überschrieben werden — hier
            ist der Default für diesen Kunden.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorschau (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {vorschau.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Produkte in der Auswahl — bitte zuerst im Auswahl-Tab Produkte
              hinzufügen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Artikelnr.</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead className="w-32 text-right">Basispreis</TableHead>
                  <TableHead className="w-32 text-right">Effektivpreis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vorschau.map((p) => {
                  const base = p[spur];
                  const eff = effektiv(base, vz, pct);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.artikelnummer}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right text-xs">
                        {base != null ? FORMAT_EUR.format(base) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {eff != null ? FORMAT_EUR.format(eff) : "auf Anfrage"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex gap-2 border-t bg-background px-6 py-3">
        <Button onClick={handleSave} disabled={!dirty || pending}>
          <Save className="h-4 w-4" />
          {pending ? "Speichere…" : "Preise speichern"}
        </Button>
      </div>
    </div>
  );
}
