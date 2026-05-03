"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  id?: string;
  name: string;
  type?: "text" | "number";
  step?: string;
  defaultValue?: string;
  options: string[];
  placeholder?: string;
  className?: string;
}

/** Input + Dropdown-Liste, die IMMER alle Optionen zeigt — keine
 *  Filterung beim Tippen (im Gegensatz zu nativem <datalist>). Custom-Werte
 *  sind weiterhin per Tipp-Eingabe erlaubt. */
export function OptionsCombo({
  id,
  name,
  type = "text",
  step,
  defaultValue = "",
  options,
  placeholder,
  className,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Klick außerhalb schließt das Popover
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectOption(opt: string) {
    setValue(opt);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && activeIndex >= 0) {
      e.preventDefault();
      selectOption(options[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        step={step}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="pr-9"
        autoComplete="off"
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        aria-label="Optionen anzeigen"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && options.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                i === activeIndex ? "bg-accent" : "hover:bg-accent/60"
              } ${opt === value ? "font-medium" : ""}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
