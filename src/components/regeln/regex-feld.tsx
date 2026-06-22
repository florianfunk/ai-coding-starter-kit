"use client";

// PROJ-15 P1 — Regex-Feld mit Live-Validierung + Live-Probe für den
// Regel-Dialog.
//
// - Validiert das Muster live über `kompiliereWennSicher` aus der Regel-Engine
//   (gibt `null` zurück, wenn das Muster ungültig oder unsicher/ReDoS-gefährdet
//   ist — genau diese Muster werden serverseitig abgelehnt).
// - Zeigt das 200-Zeichen-Limit sichtbar an (Zähler + Warnung beim Überschreiten).
// - Bietet eine optionale Live-Probe gegen einen Beispieltext: trifft das
//   (gültige) Muster? Case-insensitiv, wie die Regel-Engine.

import { useMemo, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import {
  kompiliereWennSicher,
  MAX_REGEX_LAENGE,
} from "@/lib/classifier/regex-engine";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegexFeld({
  id,
  label,
  beschreibung,
  value,
  onChange,
  probePlaceholder,
}: {
  id: string;
  label: string;
  beschreibung?: string;
  value: string;
  onChange: (value: string) => void;
  probePlaceholder?: string;
}) {
  const [probe, setProbe] = useState("");

  const getrimmt = value.trim();
  const zuLang = value.length > MAX_REGEX_LAENGE;

  // Live-Validierung: leeres Muster ist neutral (keine Bedingung gesetzt).
  const regex = useMemo(
    () => (getrimmt.length > 0 ? kompiliereWennSicher(getrimmt) : null),
    [getrimmt],
  );
  const ungueltig = getrimmt.length > 0 && (regex === null || zuLang);

  const trifft =
    regex !== null && probe.length > 0 ? regex.test(probe) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            zuLang ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {value.length}/{MAX_REGEX_LAENGE}
        </span>
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={probePlaceholder ?? "z. B. ^STRIPE\\*.*"}
        aria-invalid={ungueltig}
        className={cn(ungueltig && "border-destructive")}
        spellCheck={false}
      />
      {beschreibung && !ungueltig && (
        <p className="text-xs text-muted-foreground">{beschreibung}</p>
      )}
      {ungueltig && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {zuLang
            ? `Höchstens ${MAX_REGEX_LAENGE} Zeichen erlaubt.`
            : "Ungültiges oder unsicheres Muster — wird beim Speichern abgelehnt."}
        </p>
      )}

      {getrimmt.length > 0 && !ungueltig && (
        <div className="mt-1.5 space-y-1.5 rounded-md bg-muted/50 p-2">
          <Label htmlFor={`${id}-probe`} className="text-xs">
            Vorschau — passt auf Beispiel?
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`${id}-probe`}
              value={probe}
              onChange={(e) => setProbe(e.target.value)}
              placeholder="Beispiel-Text eingeben…"
              className="h-8 text-sm"
              spellCheck={false}
            />
            {trifft === true && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 dark:text-green-500">
                <Check className="h-3.5 w-3.5" /> passt
              </span>
            )}
            {trifft === false && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                <X className="h-3.5 w-3.5" /> passt nicht
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
