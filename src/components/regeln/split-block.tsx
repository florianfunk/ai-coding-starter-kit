"use client";

// PROJ-15 P1 — Split-Block für den Regel-Dialog.
//
// Erlaubt eine Aufteilung der Buchung in einen geschäftlichen und einen
// privaten Anteil (z. B. „Handy-Vertrag 70 % geschäftlich / 30 % privat").
// Spiegelt die Backend-Form `aktion.split` (anteil_geschaeftlich/anteil_privat
// in 0..1, Summe = 1) und bietet:
//   - Schalter zum Aktivieren des Splits (schließt einfache Kategorie/USt/
//     Klassifikation aus — der Dialog blendet diese dann aus),
//   - 0–100 %-Slider für den geschäftlichen Anteil (privat = Rest),
//   - Live-Vorschau der beiden Anteile (Prozent + Beträge bei Beispielbetrag),
//   - je einen Kategorie-Picker für die geschäftliche und private Seite,
//   - optionalen USt-Satz für den geschäftlichen Teil.

import type { Kategorie } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UST_OPTIONEN = [
  { value: "none", label: "— nicht setzen —" },
  { value: "0", label: "0 %" },
  { value: "7", label: "7 %" },
  { value: "19", label: "19 %" },
];

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export interface SplitBlockValues {
  /** Geschäftlicher Anteil in Prozent (0–100). Privat = 100 − dieser Wert. */
  anteilGeschaeftlichProzent: number;
  kategorieGeschaeftlich: string; // "none" | uuid
  kategoriePrivat: string; // "none" | uuid
  ustSatzGeschaeftlich: string; // "none" | "0" | "7" | "19"
}

export function SplitBlock({
  aktiv,
  onAktivChange,
  values,
  onChange,
  kategorien,
  /** Optionaler Beispielbetrag (€) für die Live-Vorschau. */
  beispielBetrag,
}: {
  aktiv: boolean;
  onAktivChange: (aktiv: boolean) => void;
  values: SplitBlockValues;
  onChange: (next: SplitBlockValues) => void;
  kategorien: Kategorie[];
  beispielBetrag?: number;
}) {
  const geschaeftlich = Math.min(
    100,
    Math.max(0, Math.round(values.anteilGeschaeftlichProzent)),
  );
  const privat = 100 - geschaeftlich;

  const hatBeispiel =
    typeof beispielBetrag === "number" && Number.isFinite(beispielBetrag);
  const betrag = hatBeispiel ? Math.abs(beispielBetrag as number) : 0;
  const betragGeschaeftlich = (betrag * geschaeftlich) / 100;
  const betragPrivat = (betrag * privat) / 100;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Aufteilen (Split)</p>
          <p className="text-xs text-muted-foreground">
            Buchung in geschäftlich/privat splitten — z. B. Handy oder Kfz.
          </p>
        </div>
        <Switch
          checked={aktiv}
          onCheckedChange={onAktivChange}
          aria-label="Split aktivieren"
        />
      </div>

      {aktiv && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="split-slider">Geschäftlicher Anteil</Label>
              <span className="text-sm font-medium tabular-nums">
                {geschaeftlich} %
              </span>
            </div>
            <Slider
              id="split-slider"
              aria-label="Geschäftlicher Anteil in Prozent"
              min={0}
              max={100}
              step={5}
              value={[geschaeftlich]}
              onValueChange={(v) =>
                onChange({
                  ...values,
                  anteilGeschaeftlichProzent: v[0] ?? 0,
                })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Geschäftlich</p>
              <p className="font-medium tabular-nums">
                {geschaeftlich} %
                {hatBeispiel && (
                  <span className="text-muted-foreground">
                    {" "}
                    = {eur.format(betragGeschaeftlich)}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Privat</p>
              <p className="font-medium tabular-nums">
                {privat} %
                {hatBeispiel && (
                  <span className="text-muted-foreground">
                    {" "}
                    = {eur.format(betragPrivat)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {!hatBeispiel && (
            <p className="text-xs text-muted-foreground">
              Beträge in der Vorschau erscheinen, sobald ein Beispielbetrag
              vorliegt.
            </p>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Kategorie geschäftlicher Teil</Label>
              <KategorieCombobox
                kategorien={kategorien}
                value={values.kategorieGeschaeftlich}
                onChange={(v) =>
                  onChange({ ...values, kategorieGeschaeftlich: v })
                }
                vorabOptionen={[{ value: "none", label: "— nicht setzen —" }]}
                inDialog
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie privater Teil</Label>
              <KategorieCombobox
                kategorien={kategorien}
                value={values.kategoriePrivat}
                onChange={(v) => onChange({ ...values, kategoriePrivat: v })}
                vorabOptionen={[{ value: "none", label: "— nicht setzen —" }]}
                inDialog
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="split-ust">USt-Satz geschäftlicher Teil</Label>
              <Select
                value={values.ustSatzGeschaeftlich}
                onValueChange={(v) =>
                  onChange({ ...values, ustSatzGeschaeftlich: v })
                }
              >
                <SelectTrigger id="split-ust">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UST_OPTIONEN.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
