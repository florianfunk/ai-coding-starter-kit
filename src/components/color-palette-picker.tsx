"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FARBPALETTE, findFarbeByHex } from "@/lib/farbpalette";
import { cn } from "@/lib/utils";
import { Check, Palette } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (hex: string | null) => void;
};

export function ColorPalettePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(value ?? "");
  const currentFarbe = findFarbeByHex(value);

  function select(hex: string) {
    onChange(hex.toUpperCase());
    setCustom(hex.toUpperCase());
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setCustom("");
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="gap-2 min-w-[180px] justify-start">
            <span
              className="h-5 w-5 rounded border shrink-0"
              style={{ backgroundColor: value ?? "transparent" }}
            />
            <span className="flex-1 text-left font-mono text-sm">
              {currentFarbe?.name ?? value ?? "Farbe wählen"}
            </span>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-4" align="start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Farbpalette
            </p>
            <div className="grid grid-cols-8 gap-1.5">
              {FARBPALETTE.map((farbe) => {
                const isActive = value?.toUpperCase() === farbe.hex.toUpperCase();
                return (
                  <button
                    key={farbe.hex}
                    type="button"
                    onClick={() => select(farbe.hex)}
                    title={`${farbe.name} · ${farbe.hex}`}
                    className={cn(
                      "relative aspect-square rounded-[8px] border transition-all hover:scale-110 hover:shadow-md",
                      isActive
                        ? "border-foreground ring-2 ring-foreground/30"
                        : "border-border/60 hover:border-foreground/30",
                    )}
                    style={{ backgroundColor: farbe.hex }}
                    aria-label={farbe.name}
                  >
                    {isActive && <Check className="h-3.5 w-3.5 text-foreground absolute inset-0 m-auto drop-shadow-sm" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t space-y-2">
              <p className="text-xs text-muted-foreground">Oder eigener Hex-Wert:</p>
              <div className="flex gap-2">
                <Input
                  placeholder="#FFE4E1"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(custom)) select(custom);
                  }}
                >
                  Übernehmen
                </Button>
              </div>
              {value && (
                <Button type="button" variant="ghost" size="sm" onClick={clear} className="w-full">
                  Keine Farbe
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div
        className="rounded-lg border h-10 w-24 flex items-center justify-center text-xs text-muted-foreground shrink-0"
        style={{ backgroundColor: value ?? undefined }}
      >
        {!value && "Keine"}
      </div>
    </div>
  );
}
