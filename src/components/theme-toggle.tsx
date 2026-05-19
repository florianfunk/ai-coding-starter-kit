"use client";

/*
 * Editorial-Segmented-Control für Theme (Hell/System/Dunkel).
 * Entspricht .seg/.seg-btn aus dem Design-Bundle.
 */

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dunkel", Icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const aktiv = mounted ? (theme ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className="inline-flex rounded-md border p-0.5"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--line)",
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = aktiv === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className="flex h-6 w-7 items-center justify-center rounded-[4px] text-[12px] font-medium transition-colors"
            style={{
              background: selected ? "var(--surface)" : "transparent",
              color: selected ? "var(--text)" : "var(--text-muted)",
              boxShadow: selected ? "var(--shadow-1)" : "none",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
