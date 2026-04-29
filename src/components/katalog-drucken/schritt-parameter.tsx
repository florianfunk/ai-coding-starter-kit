"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Layout,
  PreisSpur,
  Vorzeichen,
  Waehrung,
  WizardParameter,
} from "./types";
import { PREIS_SPUR_LABEL } from "./types";

type Props = {
  parameter: WizardParameter;
  onChange: (next: WizardParameter) => void;
  wechselkurs: number;
};

export function SchrittParameter({ parameter, onChange, wechselkurs }: Props) {
  const set = <K extends keyof WizardParameter>(key: K, value: WizardParameter[K]) =>
    onChange({ ...parameter, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Layout</Label>
        <RadioGroup
          value={parameter.layout}
          onValueChange={(v) => set("layout", v as Layout)}
          className="flex gap-6"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="eisenkeil" id="layout-eisenkeil" />
            Eisenkeil
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="lichtengros" id="layout-lichtengros" />
            Lichtengros
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Preisauswahl</Label>
        <Select
          value={parameter.preisauswahl}
          onValueChange={(v) => set("preisauswahl", v as PreisSpur)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="listenpreis">{PREIS_SPUR_LABEL.listenpreis}</SelectItem>
            <SelectItem value="lichtengros">{PREIS_SPUR_LABEL.lichtengros}</SelectItem>
            <SelectItem value="eisenkeil">{PREIS_SPUR_LABEL.eisenkeil}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Preisänderung</Label>
        <RadioGroup
          value={parameter.preisAenderung}
          onValueChange={(v) => set("preisAenderung", v as Vorzeichen)}
          className="flex gap-6"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="plus" id="paend-plus" />
            plus
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="minus" id="paend-minus" />
            minus
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prozent">Preisänderung in %</Label>
        <Input
          id="prozent"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={parameter.preisProzent}
          onChange={(e) => {
            const n = Number(e.target.value);
            set("preisProzent", Number.isFinite(n) ? n : 0);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Währung</Label>
        <RadioGroup
          value={parameter.waehrung}
          onValueChange={(v) => set("waehrung", v as Waehrung)}
          className="flex gap-6"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="EUR" id="waehr-eur" />
            EUR
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="CHF" id="waehr-chf" />
            CHF
            <span className="text-xs text-muted-foreground">(Kurs {wechselkurs.toFixed(4)})</span>
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>
          Sprache
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            in Entwicklung
          </span>
        </Label>
        <Select value="de" disabled>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
