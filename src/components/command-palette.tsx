"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  LayoutGrid,
  Layers,
  Package,
  Settings,
  FileDown,
  Search,
  Loader2,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SearchResults {
  bereiche: { id: string; name: string }[];
  kategorien: { id: string; name: string }[];
  produkte: { id: string; artikelnummer: string; name: string }[];
}

const EMPTY_RESULTS: SearchResults = {
  bereiche: [],
  kategorien: [],
  produkte: [],
};

export function CommandPalette({ onOpenRef }: { onOpenRef?: React.MutableRefObject<(() => void) | null> } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Expose setOpen to external callers via ref
  useEffect(() => {
    if (onOpenRef) {
      onOpenRef.current = () => setOpen(true);
      return () => { onOpenRef.current = null; };
    }
  }, [onOpenRef]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY_RESULTS);
      setLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [open]);

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (res.ok) {
        const data: SearchResults = await res.json();
        setResults(data);
      }
    } catch {
      // Silently fail — user will see empty results
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetchResults(value);
    }, 200);
  }

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  const hasQuery = query.trim().length > 0;
  const hasResults =
    results.produkte.length > 0 ||
    results.kategorien.length > 0 ||
    results.bereiche.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Suchen oder Aktion ausführen..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        {hasQuery && !hasResults && !loading && (
          <CommandEmpty>
            Keine Ergebnisse für &quot;{query}&quot;
          </CommandEmpty>
        )}

        {/* Search results: Produkte */}
        {hasQuery && results.produkte.length > 0 && (
          <CommandGroup heading="Produkte">
            {results.produkte.map((p) => (
              <CommandItem
                key={p.id}
                value={`produkt-${p.artikelnummer}-${p.name}`}
                onSelect={() => navigate(`/produkte/${p.id}`)}
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  {p.artikelnummer}
                </span>
                <span className="truncate">{p.name || "Ohne Name"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search results: Kategorien */}
        {hasQuery && results.kategorien.length > 0 && (
          <CommandGroup heading="Kategorien">
            {results.kategorien.map((k) => (
              <CommandItem
                key={k.id}
                value={`kategorie-${k.name}`}
                onSelect={() => navigate(`/kategorien/${k.id}`)}
              >
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{k.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search results: Bereiche */}
        {hasQuery && results.bereiche.length > 0 && (
          <CommandGroup heading="Bereiche">
            {results.bereiche.map((b) => (
              <CommandItem
                key={b.id}
                value={`bereich-${b.name}`}
                onSelect={() => navigate(`/bereiche/${b.id}`)}
              >
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{b.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Suche...</span>
          </div>
        )}

        {/* Quick actions — always visible */}
        <CommandGroup heading="Aktionen">
          <CommandItem
            value="neues-produkt-anlegen"
            onSelect={() => navigate("/produkte/neu")}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span>Neues Produkt anlegen</span>
          </CommandItem>
          <CommandItem
            value="neuer-bereich"
            onSelect={() => navigate("/bereiche/neu")}
          >
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <span>Neuer Bereich</span>
          </CommandItem>
          <CommandItem
            value="neue-kategorie"
            onSelect={() => navigate("/kategorien/neu")}
          >
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span>Neue Kategorie</span>
          </CommandItem>
          <CommandItem
            value="einstellungen-oeffnen"
            onSelect={() => navigate("/einstellungen")}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Einstellungen</span>
          </CommandItem>
          <CommandItem
            value="katalog-exportieren"
            onSelect={() => navigate("/export/katalog")}
          >
            <FileDown className="h-4 w-4 text-muted-foreground" />
            <span>Katalog exportieren</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Small trigger button for the header navigation */
function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-1.5 text-sm text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
      aria-label="Suche öffnen"
    >
      <Search className="h-4 w-4" />
      <span className="hidden md:inline">Suche</span>
      <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/60">
        <span className="text-xs">&#8984;</span>K
      </kbd>
    </button>
  );
}

/** Combined trigger + palette — shares state directly without synthetic events */
export function CommandPaletteWithTrigger() {
  const openRef = useRef<(() => void) | null>(null);
  return (
    <>
      <CommandPaletteTrigger onOpen={() => openRef.current?.()} />
      <CommandPalette onOpenRef={openRef} />
    </>
  );
}
