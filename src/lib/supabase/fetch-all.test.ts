import { describe, expect, it, vi } from "vitest";
import { ladeNachBloecken } from "./fetch-all";

describe("ladeNachBloecken", () => {
  it("zerlegt große Werte-Arrays in Blöcke und konkateniert Ergebnisse", async () => {
    const werte = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const bloecke: number[] = [];
    const { data, error } = await ladeNachBloecken(
      werte,
      (block) => {
        bloecke.push(block.length);
        return Promise.resolve({
          data: block.map((v) => ({ id: v })),
          error: null,
        });
      },
      100,
    );
    expect(error).toBeNull();
    expect(bloecke).toEqual([100, 100, 50]); // 3 Blöcke
    expect(data).toHaveLength(250);
    expect(data[0]).toEqual({ id: "id-0" });
    expect(data[249]).toEqual({ id: "id-249" });
  });

  it("macht keinen Request bei leerer Werteliste", async () => {
    const baue = vi.fn();
    const { data, error } = await ladeNachBloecken([], baue);
    expect(baue).not.toHaveBeenCalled();
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it("bricht beim ersten Block-Fehler ab und liefert bisherige Daten + Fehler", async () => {
    const werte = Array.from({ length: 30 }, (_, i) => i);
    let aufrufe = 0;
    const { data, error } = await ladeNachBloecken(
      werte,
      () => {
        aufrufe++;
        return Promise.resolve({ data: null, error: { message: "boom" } });
      },
      10,
    );
    expect(aufrufe).toBe(1); // nach erstem Fehler kein weiterer Block
    expect(error).toEqual({ message: "boom" });
    expect(data).toEqual([]);
  });

  it("hält einen Einzelblock unter der Blockgröße zusammen", async () => {
    const werte = ["a", "b", "c"];
    const { data } = await ladeNachBloecken(
      werte,
      (block) => Promise.resolve({ data: block, error: null }),
      100,
    );
    expect(data).toEqual(["a", "b", "c"]);
  });
});
