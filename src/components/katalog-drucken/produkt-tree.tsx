"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TriStateCheckbox } from "./tri-state-checkbox";
import type { BereichKnoten, KategorieKnoten, ProduktKnoten, TreeData } from "./types";
import type { useTreeSelection } from "./use-tree-selection";

type Selection = ReturnType<typeof useTreeSelection>;

type Props = {
  tree: TreeData;
  selection: Selection;
  search: string;
};

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-foreground">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function produktMatches(p: ProduktKnoten, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    p.artikelnummer.toLowerCase().includes(needle) ||
    p.name.toLowerCase().includes(needle)
  );
}

export function ProduktTree({ tree, selection, search }: Props) {
  // Sichtbarer Tree (gefiltert nach Suche)
  const visibleTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.trim();
    return tree
      .map((b) => ({
        ...b,
        kategorien: b.kategorien
          .map((k) => ({
            ...k,
            produkte: k.produkte.filter((p) => produktMatches(p, q)),
          }))
          .filter((k) => k.produkte.length > 0),
      }))
      .filter((b) => b.kategorien.length > 0);
  }, [tree, search]);

  // Bereiche default zu, beim Suchen automatisch alle auf
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-Expand bei Suche; danach kann der User wieder manuell togglen.
  useEffect(() => {
    if (search.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Auto-Expand-Pattern
      setExpanded(
        new Set([
          ...visibleTree.map((b) => b.id),
          ...visibleTree.flatMap((b) => b.kategorien.map((k) => k.id)),
        ]),
      );
    }
  }, [search, visibleTree]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (visibleTree.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Keine Produkte gefunden für „{search}“.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[420px] rounded-md border">
      <ul className="py-1">
        {visibleTree.map((bereich) => (
          <BereichRow
            key={bereich.id}
            bereich={bereich}
            selection={selection}
            expanded={expanded}
            toggleExpand={toggleExpand}
            search={search}
          />
        ))}
      </ul>
    </ScrollArea>
  );
}

function BereichRow({
  bereich,
  selection,
  expanded,
  toggleExpand,
  search,
}: {
  bereich: BereichKnoten;
  selection: Selection;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  search: string;
}) {
  const isOpen = expanded.has(bereich.id);
  const state = selection.bereichState(bereich);
  const counts = selection.bereichCounts(bereich);

  return (
    <li>
      <div className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold hover:bg-accent">
        <button
          type="button"
          aria-label={isOpen ? `Bereich ${bereich.name} einklappen` : `Bereich ${bereich.name} aufklappen`}
          onClick={() => toggleExpand(bereich.id)}
          className="grid place-content-center"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        <TriStateCheckbox
          state={state}
          onToggle={() => selection.toggleBereich(bereich)}
          ariaLabel={`Bereich ${bereich.name}`}
        />
        <button
          type="button"
          onClick={() => toggleExpand(bereich.id)}
          className="flex flex-1 items-center justify-between gap-2 text-left uppercase tracking-wide"
        >
          <span className="flex-1">{bereich.name}</span>
          <span
            className={cn(
              "tabular-nums text-xs",
              counts.selected === counts.total ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {counts.selected} / {counts.total}
          </span>
        </button>
      </div>
      {isOpen && (
        <ul className="ml-6 border-l border-border/60 pl-2">
          {bereich.kategorien.map((k) => (
            <KategorieRow
              key={k.id}
              kategorie={k}
              selection={selection}
              expanded={expanded}
              toggleExpand={toggleExpand}
              search={search}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function KategorieRow({
  kategorie,
  selection,
  expanded,
  toggleExpand,
  search,
}: {
  kategorie: KategorieKnoten;
  selection: Selection;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  search: string;
}) {
  const isOpen = expanded.has(kategorie.id);
  const state = selection.kategorieState(kategorie);
  const counts = selection.kategorieCounts(kategorie);

  return (
    <li>
      <div className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
        <button
          type="button"
          aria-label={isOpen ? `Kategorie ${kategorie.name} einklappen` : `Kategorie ${kategorie.name} aufklappen`}
          onClick={() => toggleExpand(kategorie.id)}
          className="grid place-content-center"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
        <TriStateCheckbox
          state={state}
          onToggle={() => selection.toggleKategorie(kategorie)}
          ariaLabel={`Kategorie ${kategorie.name}`}
        />
        <button
          type="button"
          onClick={() => toggleExpand(kategorie.id)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="flex-1">{kategorie.name}</span>
          <span
            className={cn(
              "tabular-nums text-xs",
              counts.selected === counts.total ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {counts.selected} / {counts.total}
          </span>
        </button>
      </div>
      {isOpen && (
        <ul className="ml-5 border-l border-border/40 pl-2">
          {kategorie.produkte.map((p) => (
            <ProduktRow key={p.id} produkt={p} selection={selection} search={search} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ProduktRow({
  produkt,
  selection,
  search,
}: {
  produkt: ProduktKnoten;
  selection: Selection;
  search: string;
}) {
  const isOn = selection.selected.has(produkt.id);
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-[13px] hover:bg-accent">
        <TriStateCheckbox
          state={isOn ? "checked" : "unchecked"}
          onToggle={() => selection.toggleProdukt(produkt.id)}
          ariaLabel={`Produkt ${produkt.artikelnummer}`}
        />
        <span className="font-mono text-xs text-muted-foreground">
          {highlight(produkt.artikelnummer, search)}
        </span>
        <span className="flex-1 truncate">{highlight(produkt.name, search)}</span>
      </label>
    </li>
  );
}
