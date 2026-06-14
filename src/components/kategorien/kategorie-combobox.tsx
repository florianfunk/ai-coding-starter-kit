"use client";

// Durchsuchbare Kategorie-Auswahl (Combobox) als Ersatz für die langen
// <Select>-Dropdowns. Tippen filtert die Liste live — kein Scrollen mehr durch
// den ganzen EÜR-Kontenrahmen. Wird überall verwendet, wo eine Steuerkategorie
// gewählt wird (Entscheidungs-Dialog, Regel-Dialog, Inline-Zellen, Filter).
//
// Flexibel:
//   - `gruppiert` gruppiert nach Typ (Einnahmen/Ausgaben/Privat/Neutral)
//   - `vorabOptionen` für führende Sonderfälle (z. B. „Keine Kategorie",
//     „Alle Kategorien", „Ohne Kategorie")
//   - `triggerInhalt` für reichere Trigger (z. B. mit Typ-Badge in Tabellen)

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { KategorieTyp } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface KategorieComboboxOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
}

export interface KategorieVorabOption {
  value: string;
  label: string;
}

const TYP_LABELS: Record<KategorieTyp, string> = {
  einnahme: "Einnahmen",
  ausgabe: "Ausgaben",
  privat: "Privat",
  neutral: "Neutral",
};

const TYP_REIHENFOLGE: KategorieTyp[] = [
  "einnahme",
  "ausgabe",
  "privat",
  "neutral",
];

interface KategorieComboboxProps {
  kategorien: KategorieComboboxOption[];
  /** Aktuell gewählter Wert: Kategorie-ID oder ein `vorabOptionen`-Wert. */
  value: string;
  onChange: (value: string) => void;
  /** Führende Sonderoptionen (z. B. „Keine Kategorie"). */
  vorabOptionen?: KategorieVorabOption[];
  /** Nach Typ gruppieren (Default: true). */
  gruppiert?: boolean;
  /** Trigger-Text, wenn nichts gewählt ist. */
  placeholder?: string;
  suchePlaceholder?: string;
  /** Text, wenn die Suche nichts findet. */
  leerText?: string;
  triggerClassName?: string;
  /** Eigener Trigger-Inhalt (überschreibt das Label), z. B. mit Badge. */
  triggerInhalt?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function KategorieCombobox({
  kategorien,
  value,
  onChange,
  vorabOptionen = [],
  gruppiert = true,
  placeholder = "Kategorie wählen…",
  suchePlaceholder = "Kategorie suchen…",
  leerText = "Keine Kategorie gefunden.",
  triggerClassName,
  triggerInhalt,
  id,
  disabled,
  ariaLabel,
}: KategorieComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const aktuellesLabel = React.useMemo(() => {
    const vorab = vorabOptionen.find((o) => o.value === value);
    if (vorab) return vorab.label;
    return kategorien.find((k) => k.id === value)?.bezeichnung ?? null;
  }, [value, vorabOptionen, kategorien]);

  const gruppen = React.useMemo(() => {
    const map: Record<KategorieTyp, KategorieComboboxOption[]> = {
      einnahme: [],
      ausgabe: [],
      privat: [],
      neutral: [],
    };
    for (const k of kategorien) map[k.typ]?.push(k);
    for (const typ of TYP_REIHENFOLGE) {
      map[typ].sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung));
    }
    return map;
  }, [kategorien]);

  function waehle(v: string) {
    onChange(v);
    setOpen(false);
  }

  function renderItem(opt: { value: string; label: string }) {
    return (
      <CommandItem
        key={opt.value}
        // cmdk filtert über `value` — Label + Wert, damit die Suche greift.
        value={`${opt.label} ${opt.value}`}
        onSelect={() => waehle(opt.value)}
      >
        <Check
          className={cn(
            "h-4 w-4",
            value === opt.value ? "opacity-100" : "opacity-0",
          )}
        />
        <span className="truncate">{opt.label}</span>
      </CommandItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            !aktuellesLabel && !triggerInhalt && "text-muted-foreground",
            triggerClassName,
          )}
        >
          {triggerInhalt ?? (
            <span className="truncate">{aktuellesLabel ?? placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
      >
        <Command>
          <CommandInput placeholder={suchePlaceholder} />
          <CommandList>
            <CommandEmpty>{leerText}</CommandEmpty>
            {vorabOptionen.length > 0 && (
              <CommandGroup>{vorabOptionen.map(renderItem)}</CommandGroup>
            )}
            {gruppiert ? (
              TYP_REIHENFOLGE.map((typ) =>
                gruppen[typ].length === 0 ? null : (
                  <CommandGroup key={typ} heading={TYP_LABELS[typ]}>
                    {gruppen[typ].map((k) =>
                      renderItem({ value: k.id, label: k.bezeichnung }),
                    )}
                  </CommandGroup>
                ),
              )
            ) : (
              <CommandGroup>
                {kategorien.map((k) =>
                  renderItem({ value: k.id, label: k.bezeichnung }),
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
