"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProduktTree } from "./produkt-tree";
import type { TreeData } from "./types";
import type { useTreeSelection } from "./use-tree-selection";

type Props = {
  tree: TreeData;
  selection: ReturnType<typeof useTreeSelection>;
  search: string;
  onSearchChange: (value: string) => void;
};

export function SchrittInhalt({ tree, selection, search, onSearchChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Suche Artikelnr. oder Name…"
            className="pl-8"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={selection.selectAll}>
          Alle auswählen
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={selection.selectNone}>
          Alle abwählen
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={selection.invert}>
          Auswahl umkehren
        </Button>
      </div>
      <ProduktTree tree={tree} selection={selection} search={search} />
    </div>
  );
}
