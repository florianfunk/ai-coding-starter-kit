"use client";

// PROJ-14 — Zeitraum-Picker: zwei Popover-Kalender (von/bis) plus drei
// kompakte Schnellauswahl-Dropdowns (Jahr / Monat / Quartal) und einen
// "Alle Zeit"-Knopf. Werte sind ISO-Strings (YYYY-MM-DD) oder null.
//
// Bewusst kein Range-Calendar — getrennte Felder sind klarer, weil der
// Nutzer auch nur "ab" oder nur "bis" setzen können soll.
//
// Reichweite der Dropdowns:
//   - Jahre:    aktuelles + 5 vorherige  (Standard: jetzt-1 .. jetzt-5)
//   - Monate:   letzte 18 Monate inkl. dem aktuellen
//   - Quartale: letzte 8 Quartale inkl. dem aktuellen

import { useMemo } from "react";
import { format, parse } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Zeitraum {
  von: string | null;
  bis: string | null;
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fromIso(s: string | null): Date | undefined {
  if (!s) return undefined;
  return parse(s, "yyyy-MM-dd", new Date());
}

/** Vergleichshilfe: ist eine Range identisch zum aktuellen Value? */
function gleicheRange(a: Zeitraum, b: Zeitraum): boolean {
  return a.von === b.von && a.bis === b.bis;
}

interface DropdownOption {
  /** Eindeutiger Wert für den Select (z. B. "2026", "2026-04", "2026-Q2"). */
  value: string;
  label: string;
  range: Zeitraum;
}

/** Letzte N Jahre, inkl. dem aktuellen. */
function jahresOptionen(today: Date, anzahl: number): DropdownOption[] {
  const y = today.getFullYear();
  const out: DropdownOption[] = [];
  for (let i = 0; i < anzahl; i++) {
    const j = y - i;
    out.push({
      value: String(j),
      label: String(j),
      range: { von: `${j}-01-01`, bis: `${j}-12-31` },
    });
  }
  return out;
}

/** Letzte N Monate, neueste zuerst. Labels: "Dieser Monat", "Letzter Monat",
 *  dann "Mär 2026" usw. */
function monatsOptionen(today: Date, anzahl: number): DropdownOption[] {
  const monatsNamen = [
    "Jan",
    "Feb",
    "Mär",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dez",
  ];
  const out: DropdownOption[] = [];
  for (let i = 0; i < anzahl; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const value = `${y}-${String(m + 1).padStart(2, "0")}`;
    const sonder =
      i === 0 ? "Dieser Monat" : i === 1 ? "Letzter Monat" : null;
    const label = sonder
      ? `${sonder} (${monatsNamen[m]} ${y})`
      : `${monatsNamen[m]} ${y}`;
    out.push({
      value,
      label,
      range: { von: toIso(start), bis: toIso(end) },
    });
  }
  return out;
}

/** Letzte N Quartale, neueste zuerst. */
function quartalsOptionen(today: Date, anzahl: number): DropdownOption[] {
  const out: DropdownOption[] = [];
  const aktuellesQ = Math.floor(today.getMonth() / 3);
  for (let i = 0; i < anzahl; i++) {
    // Quartals-Offset abziehen
    const totalQ =
      today.getFullYear() * 4 + aktuellesQ - i;
    const y = Math.floor(totalQ / 4);
    const q = ((totalQ % 4) + 4) % 4;
    const start = new Date(y, q * 3, 1);
    const end = new Date(y, q * 3 + 3, 0);
    const value = `${y}-Q${q + 1}`;
    const label = `Q${q + 1} ${y}`;
    out.push({
      value,
      label,
      range: { von: toIso(start), bis: toIso(end) },
    });
  }
  return out;
}

const JAHRE_ZURUECK = 6; // aktuelles + 5 vorherige
const MONATE_ZURUECK = 18;
const QUARTALE_ZURUECK = 8;

const PLATZHALTER = "__none__";

export function ZeitraumPicker({
  value,
  onChange,
}: {
  value: Zeitraum;
  onChange: (z: Zeitraum) => void;
}) {
  const jahre = useMemo(
    () => jahresOptionen(new Date(), JAHRE_ZURUECK),
    [],
  );
  const monate = useMemo(
    () => monatsOptionen(new Date(), MONATE_ZURUECK),
    [],
  );
  const quartale = useMemo(
    () => quartalsOptionen(new Date(), QUARTALE_ZURUECK),
    [],
  );

  const vonDate = fromIso(value.von);
  const bisDate = fromIso(value.bis);

  // Aktuell selektierter Eintrag pro Dropdown (oder PLATZHALTER, wenn die
  // Range zu keinem der Einträge passt — z. B. weil der Nutzer manuell
  // Datepicker benutzt hat).
  const aktivesJahr =
    jahre.find((o) => gleicheRange(o.range, value))?.value ?? PLATZHALTER;
  const aktiverMonat =
    monate.find((o) => gleicheRange(o.range, value))?.value ?? PLATZHALTER;
  const aktivesQuartal =
    quartale.find((o) => gleicheRange(o.range, value))?.value ?? PLATZHALTER;

  const istAlleZeit = value.von === null && value.bis === null;

  function setzeAusDropdown(opt: DropdownOption | undefined) {
    if (opt) onChange(opt.range);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatumFeld
        id="von"
        ariaLabel="Von-Datum"
        date={vonDate}
        onSelect={(d) => onChange({ ...value, von: d ? toIso(d) : null })}
      />
      <span className="text-sm text-muted-foreground">–</span>
      <DatumFeld
        id="bis"
        ariaLabel="Bis-Datum"
        date={bisDate}
        onSelect={(d) => onChange({ ...value, bis: d ? toIso(d) : null })}
      />
      <span
        aria-hidden
        className="ml-1 hidden h-6 w-px bg-border sm:inline-block"
      />
      <Select
        value={aktivesJahr}
        onValueChange={(v) =>
          setzeAusDropdown(jahre.find((o) => o.value === v))
        }
      >
        <SelectTrigger
          aria-label="Jahr"
          className="h-8 w-[110px] text-sm tabular-nums"
        >
          <SelectValue placeholder="Jahr" />
        </SelectTrigger>
        <SelectContent>
          {aktivesJahr === PLATZHALTER ? (
            <SelectItem value={PLATZHALTER} disabled>
              Jahr wählen…
            </SelectItem>
          ) : null}
          {jahre.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={aktiverMonat}
        onValueChange={(v) =>
          setzeAusDropdown(monate.find((o) => o.value === v))
        }
      >
        <SelectTrigger
          aria-label="Monat"
          className="h-8 w-[180px] text-sm"
        >
          <SelectValue placeholder="Monat" />
        </SelectTrigger>
        <SelectContent>
          {aktiverMonat === PLATZHALTER ? (
            <SelectItem value={PLATZHALTER} disabled>
              Monat wählen…
            </SelectItem>
          ) : null}
          {monate.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={aktivesQuartal}
        onValueChange={(v) =>
          setzeAusDropdown(quartale.find((o) => o.value === v))
        }
      >
        <SelectTrigger
          aria-label="Quartal"
          className="h-8 w-[130px] text-sm tabular-nums"
        >
          <SelectValue placeholder="Quartal" />
        </SelectTrigger>
        <SelectContent>
          {aktivesQuartal === PLATZHALTER ? (
            <SelectItem value={PLATZHALTER} disabled>
              Quartal wählen…
            </SelectItem>
          ) : null}
          {quartale.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={istAlleZeit ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 px-2.5 text-xs",
          !istAlleZeit && "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange({ von: null, bis: null })}
      >
        Alle Zeit
      </Button>
    </div>
  );
}

function DatumFeld({
  id,
  ariaLabel,
  date,
  onSelect,
}: {
  id: string;
  ariaLabel: string;
  date: Date | undefined;
  onSelect: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-label={ariaLabel}
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-[130px] justify-start gap-2 text-left font-normal tabular-nums",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {date ? format(date, "dd.MM.yyyy") : "—"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          locale={de}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
