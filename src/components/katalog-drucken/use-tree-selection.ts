"use client";

import { useCallback, useMemo, useState } from "react";
import type { BereichKnoten, KategorieKnoten, TreeData } from "./types";

export type CheckState = "checked" | "unchecked" | "indeterminate";

export type Counts = {
  selected: number;
  total: number;
  bereiche: number;
  kategorien: number;
};

function bereichProduktIds(b: BereichKnoten): string[] {
  return b.kategorien.flatMap((k) => k.produkte.map((p) => p.id));
}

function kategorieProduktIds(k: KategorieKnoten): string[] {
  return k.produkte.map((p) => p.id);
}

function allProduktIds(tree: TreeData): string[] {
  return tree.flatMap((b) => bereichProduktIds(b));
}

/**
 * Set-basierte Tree-Auswahl. Wahre Auswahl liegt nur in `selected: Set<produkt_id>`.
 * Bereich/Kategorie-State wird live abgeleitet — kein State-Drift möglich.
 */
export function useTreeSelection(tree: TreeData) {
  const allIds = useMemo(() => allProduktIds(tree), [tree]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allIds));

  const setMany = useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const toggleProdukt = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleKategorie = useCallback((k: KategorieKnoten) => {
    const ids = kategorieProduktIds(k);
    const allOn = ids.every((id) => selected.has(id));
    setMany(ids, !allOn);
  }, [selected, setMany]);

  const toggleBereich = useCallback((b: BereichKnoten) => {
    const ids = bereichProduktIds(b);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setMany(ids, !allOn);
  }, [selected, setMany]);

  const selectAll = useCallback(() => setSelected(new Set(allIds)), [allIds]);
  const selectNone = useCallback(() => setSelected(new Set()), []);
  const setSelection = useCallback(
    (ids: string[]) => setSelected(new Set(ids.filter((id) => allIds.includes(id)))),
    [allIds],
  );
  const invert = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of allIds) if (!prev.has(id)) next.add(id);
      return next;
    });
  }, [allIds]);

  const kategorieState = useCallback((k: KategorieKnoten): CheckState => {
    const ids = kategorieProduktIds(k);
    if (ids.length === 0) return "unchecked";
    let on = 0;
    for (const id of ids) if (selected.has(id)) on++;
    if (on === 0) return "unchecked";
    if (on === ids.length) return "checked";
    return "indeterminate";
  }, [selected]);

  const bereichState = useCallback((b: BereichKnoten): CheckState => {
    const ids = bereichProduktIds(b);
    if (ids.length === 0) return "unchecked";
    let on = 0;
    for (const id of ids) if (selected.has(id)) on++;
    if (on === 0) return "unchecked";
    if (on === ids.length) return "checked";
    return "indeterminate";
  }, [selected]);

  const kategorieCounts = useCallback((k: KategorieKnoten) => {
    const ids = kategorieProduktIds(k);
    let on = 0;
    for (const id of ids) if (selected.has(id)) on++;
    return { selected: on, total: ids.length };
  }, [selected]);

  const bereichCounts = useCallback((b: BereichKnoten) => {
    const ids = bereichProduktIds(b);
    let on = 0;
    for (const id of ids) if (selected.has(id)) on++;
    return { selected: on, total: ids.length };
  }, [selected]);

  const counts: Counts = useMemo(() => {
    const total = allIds.length;
    const sel = selected.size;
    let bereiche = 0;
    let kategorien = 0;
    for (const b of tree) {
      const ids = bereichProduktIds(b);
      const onB = ids.some((id) => selected.has(id));
      if (onB) bereiche++;
      for (const k of b.kategorien) {
        const onK = k.produkte.some((p) => selected.has(p.id));
        if (onK) kategorien++;
      }
    }
    return { selected: sel, total, bereiche, kategorien };
  }, [tree, selected, allIds]);

  /**
   * Liefert das, was im Job persistiert wird:
   *   null = "alle Produkte" (volle Auswahl, default-äquivalent)
   *   string[] = explizite Whitelist
   */
  const toJobValue = useCallback((): string[] | null => {
    if (selected.size === allIds.length) return null;
    return Array.from(selected);
  }, [selected, allIds]);

  return {
    selected,
    counts,
    toggleProdukt,
    toggleKategorie,
    toggleBereich,
    selectAll,
    selectNone,
    setSelection,
    invert,
    bereichState,
    kategorieState,
    bereichCounts,
    kategorieCounts,
    toJobValue,
  };
}
