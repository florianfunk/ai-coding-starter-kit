"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export type IconItem = {
  id: string;
  label: string;
  gruppe?: string | null;
  url?: string | null;
};

type Props = {
  icons: IconItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  /** Show remove buttons on selected icons (default: false) */
  showRemoveButtons?: boolean;
};

export function IconPicker({ icons, selectedIds, onToggle, showRemoveButtons = false }: Props) {
  const [search, setSearch] = useState("");

  const iconById = useMemo(() => new Map(icons.map((ic) => [ic.id, ic])), [icons]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredIcons = useMemo(() => {
    if (!normalizedSearch) return icons;
    return icons.filter(
      (ic) =>
        ic.label.toLowerCase().includes(normalizedSearch) ||
        (ic.gruppe ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [icons, normalizedSearch]);

  const grouped = useMemo(() => {
    const g: Record<string, IconItem[]> = {};
    for (const ic of filteredIcons) {
      const key = ic.gruppe ?? "Ohne Gruppe";
      if (!g[key]) g[key] = [];
      g[key].push(ic);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredIcons]);

  return (
    <div className="space-y-3">
      {/* Hidden inputs for form submission */}
      {[...selectedIds].map((id) => (
        <input key={id} type="hidden" name="icon_ids" value={id} />
      ))}

      {/* Search field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Icons durchsuchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selected icons preview */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground mb-2">Ausgewählt ({selectedIds.size}):</p>
          <div className="flex flex-wrap gap-2">
            {[...selectedIds].map((id) => {
              const ic = iconById.get(id);
              if (!ic) return null;
              return (
                <div key={id} className="relative group flex flex-col items-center gap-1">
                  <div className="h-14 w-14 rounded-lg border-2 border-primary bg-background flex items-center justify-center overflow-hidden">
                    {ic.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] font-bold">{ic.label}</span>
                    )}
                  </div>
                  {showRemoveButtons && (
                    <button
                      type="button"
                      onClick={() => onToggle(id)}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <span className="text-[10px] text-center w-14 truncate">{ic.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grouped icon grid */}
      <div className="rounded-lg border divide-y">
        {icons.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">
            Noch keine Icons angelegt.{" "}
            <a href="/icons/neu" className="underline">
              Jetzt welche anlegen &rarr;
            </a>
          </p>
        )}

        {icons.length > 0 && grouped.length === 0 && normalizedSearch && (
          <p className="p-4 text-sm text-muted-foreground text-center">
            Keine Icons gefunden fuer &bdquo;{search.trim()}&ldquo;
          </p>
        )}

        {grouped.map(([gruppe, items]) => (
          <div key={gruppe} className="p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {gruppe}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((ic) => {
                const on = selectedIds.has(ic.id);
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => onToggle(ic.id)}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${
                      on
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:border-primary/30 hover:bg-muted"
                    }`}
                    title={ic.label}
                  >
                    <div className="h-12 w-12 rounded border bg-background flex items-center justify-center overflow-hidden">
                      {ic.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <span className="text-[9px] font-bold px-1">{ic.label}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground w-12 truncate text-center">
                      {ic.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
