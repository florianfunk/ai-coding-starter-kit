/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTreeSelection } from "./use-tree-selection";
import type { TreeData } from "./types";

const TREE: TreeData = [
  {
    id: "b1",
    name: "LED STRIP",
    kategorien: [
      {
        id: "k1",
        name: "RGB+RGBW+CCT",
        produkte: [
          { id: "p1", artikelnummer: "BL-1", name: "Strip 1" },
          { id: "p2", artikelnummer: "BL-2", name: "Strip 2" },
        ],
      },
      {
        id: "k2",
        name: "NEON FLEX",
        produkte: [{ id: "p3", artikelnummer: "BL-3", name: "Strip 3" }],
      },
    ],
  },
  {
    id: "b2",
    name: "LED DRIVER",
    kategorien: [
      {
        id: "k3",
        name: "CV",
        produkte: [{ id: "p4", artikelnummer: "DR-1", name: "Driver 1" }],
      },
    ],
  },
];

describe("useTreeSelection", () => {
  it("startet mit allem ausgewählt und liefert null als JobValue", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    expect(result.current.counts.selected).toBe(4);
    expect(result.current.counts.total).toBe(4);
    expect(result.current.toJobValue()).toBeNull();
  });

  it("toggleProdukt entfernt einzelnes Produkt → Set wird zur Whitelist", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.toggleProdukt("p1"));
    expect(result.current.counts.selected).toBe(3);
    const job = result.current.toJobValue();
    expect(job).not.toBeNull();
    expect(new Set(job!)).toEqual(new Set(["p2", "p3", "p4"]));
  });

  it("Bereich-Status ist indeterminate, wenn nicht alle Kinder gewählt", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.toggleProdukt("p1"));
    expect(result.current.bereichState(TREE[0])).toBe("indeterminate");
    expect(result.current.kategorieState(TREE[0].kategorien[0])).toBe("indeterminate");
    expect(result.current.kategorieState(TREE[0].kategorien[1])).toBe("checked");
  });

  it("toggleBereich schaltet alle Produkte des Bereichs aus", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.toggleBereich(TREE[0]));
    expect(result.current.counts.selected).toBe(1); // nur p4 in b2
    expect(result.current.bereichState(TREE[0])).toBe("unchecked");
    expect(result.current.bereichState(TREE[1])).toBe("checked");
  });

  it("toggleKategorie wirkt nur auf eine Kategorie", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.toggleKategorie(TREE[0].kategorien[0]));
    expect(result.current.kategorieState(TREE[0].kategorien[0])).toBe("unchecked");
    expect(result.current.kategorieState(TREE[0].kategorien[1])).toBe("checked");
    expect(result.current.bereichState(TREE[0])).toBe("indeterminate");
  });

  it("selectNone leert die Auswahl, selectAll füllt wieder", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.selectNone());
    expect(result.current.counts.selected).toBe(0);
    act(() => result.current.selectAll());
    expect(result.current.counts.selected).toBe(4);
  });

  it("invert dreht die Auswahl um", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.toggleProdukt("p1"));
    act(() => result.current.toggleProdukt("p2"));
    expect(result.current.counts.selected).toBe(2);
    act(() => result.current.invert());
    expect(result.current.counts.selected).toBe(2);
    const job = result.current.toJobValue();
    expect(new Set(job!)).toEqual(new Set(["p1", "p2"]));
  });

  it("counts liefert nur Bereiche/Kategorien mit ≥1 ausgewähltem Produkt", () => {
    const { result } = renderHook(() => useTreeSelection(TREE));
    act(() => result.current.toggleBereich(TREE[0]));
    expect(result.current.counts.bereiche).toBe(1);
    expect(result.current.counts.kategorien).toBe(1);
  });
});
