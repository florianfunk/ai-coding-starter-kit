import { describe, expect, it, vi } from "vitest";
import { mapMitLimit } from "./map-mit-limit";

/** Kleine Promise-basierte Verzoegerung fuer deterministische Concurrency-Tests. */
function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

describe("mapMitLimit", () => {
  it("verarbeitet alle Items und ordnet Ergebnisse index-stabil zu", async () => {
    const items = [1, 2, 3, 4, 5];
    const { ergebnisse, gestartet, abgebrochen } = await mapMitLimit(
      items,
      2,
      async (x) => x * 10,
    );
    expect(ergebnisse).toEqual([10, 20, 30, 40, 50]);
    expect(gestartet).toBe(5);
    expect(abgebrochen).toBe(false);
  });

  it("ordnet Ergebnisse korrekt zu, auch wenn Worker in anderer Reihenfolge fertig werden", async () => {
    // Item 0 ist am langsamsten, Item 4 am schnellsten -> Fertigstellung
    // umgekehrt zur Eingabe. Ergebnis muss trotzdem index-stabil sein.
    const items = [0, 1, 2, 3, 4];
    const { ergebnisse } = await mapMitLimit(items, 5, async (x) => {
      await delay((5 - x) * 5);
      return `r${x}`;
    });
    expect(ergebnisse).toEqual(["r0", "r1", "r2", "r3", "r4"]);
  });

  it("haelt das Concurrency-Limit ein (max. gleichzeitige Worker)", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let aktiv = 0;
    let maxAktiv = 0;
    await mapMitLimit(items, 4, async (x) => {
      aktiv += 1;
      maxAktiv = Math.max(maxAktiv, aktiv);
      await delay(5);
      aktiv -= 1;
      return x;
    });
    expect(maxAktiv).toBeLessThanOrEqual(4);
    // Bei 20 Items und Limit 4 sollte das Limit auch tatsaechlich erreicht
    // werden (sonst waere "<= 4" trivial erfuellt).
    expect(maxAktiv).toBe(4);
  });

  it("limit > anzahl items: nie mehr Worker als Items gleichzeitig", async () => {
    const items = [1, 2, 3];
    let aktiv = 0;
    let maxAktiv = 0;
    const { ergebnisse } = await mapMitLimit(items, 10, async (x) => {
      aktiv += 1;
      maxAktiv = Math.max(maxAktiv, aktiv);
      await delay(5);
      aktiv -= 1;
      return x;
    });
    expect(maxAktiv).toBeLessThanOrEqual(3);
    expect(ergebnisse).toEqual([1, 2, 3]);
  });

  it("leere Liste: liefert leeres Ergebnis, ruft Worker nie auf", async () => {
    const worker = vi.fn(async (x: number) => x);
    const { ergebnisse, gestartet, abgebrochen } = await mapMitLimit(
      [],
      5,
      worker,
    );
    expect(ergebnisse).toEqual([]);
    expect(gestartet).toBe(0);
    expect(abgebrochen).toBe(false);
    expect(worker).not.toHaveBeenCalled();
  });

  it("limit < 1 wird auf 1 normalisiert (kein Deadlock, serielle Abarbeitung)", async () => {
    const items = [1, 2, 3];
    let aktiv = 0;
    let maxAktiv = 0;
    const { ergebnisse } = await mapMitLimit(items, 0, async (x) => {
      aktiv += 1;
      maxAktiv = Math.max(maxAktiv, aktiv);
      await delay(2);
      aktiv -= 1;
      return x;
    });
    expect(maxAktiv).toBe(1);
    expect(ergebnisse).toEqual([1, 2, 3]);
  });

  it("sollAbbrechen: startet keine neuen Tasks mehr, beendet laufende sauber", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const verarbeitet: number[] = [];
    let count = 0;
    const { gestartet, abgebrochen, ergebnisse } = await mapMitLimit(
      items,
      2,
      async (x) => {
        await delay(2);
        verarbeitet.push(x);
        return x;
      },
      {
        // Nach 6 gestarteten Items abbrechen.
        sollAbbrechen: () => {
          count += 1;
          // count zaehlt Aufrufe VOR jedem Start; ab dem 7. Start abbrechen.
          return count > 6;
        },
      },
    );
    expect(abgebrochen).toBe(true);
    // Hoechstens 6 Items gestartet; alle gestarteten haben ein Ergebnis.
    expect(gestartet).toBeLessThanOrEqual(6);
    expect(ergebnisse.length).toBe(gestartet);
    // Alle gestarteten Items wurden auch wirklich zu Ende verarbeitet.
    expect(verarbeitet.length).toBe(gestartet);
    // Ergebnis-Praefix ist index-stabil und vollstaendig befuellt.
    for (let i = 0; i < gestartet; i++) {
      expect(ergebnisse[i]).toBe(i);
    }
  });

  it("sofortiger Abbruch vor dem ersten Item: nichts gestartet", async () => {
    const worker = vi.fn(async (x: number) => x);
    const { gestartet, abgebrochen, ergebnisse } = await mapMitLimit(
      [1, 2, 3],
      3,
      worker,
      { sollAbbrechen: () => true },
    );
    expect(gestartet).toBe(0);
    expect(abgebrochen).toBe(true);
    expect(ergebnisse).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("ein Worker-Fehler reisst nicht alles ab — Fehler propagiert nach Drain", async () => {
    const items = [1, 2, 3, 4];
    const begonnen: number[] = [];
    await expect(
      mapMitLimit(items, 2, async (x) => {
        begonnen.push(x);
        await delay(2);
        if (x === 2) throw new Error("boom bei 2");
        return x;
      }),
    ).rejects.toThrow("boom bei 2");
    // Bereits begonnene Worker liefen zu Ende (kein verwaister Worker).
    expect(begonnen.length).toBeGreaterThanOrEqual(2);
  });

  it("Worker-Fehler wird vom per-Item-try/catch im Aufrufer abgefangen (kein Reissen)", async () => {
    // Simuliert das Nutzungsmuster im Klassifizierungs-Job: jeder Worker
    // faengt seine eigenen Fehler ab und meldet sie als Teil-Ergebnis.
    const items = [1, 2, 3, 4, 5];
    const { ergebnisse } = await mapMitLimit(items, 2, async (x) => {
      try {
        if (x === 3) throw new Error("nur intern");
        return { ok: true, x };
      } catch (e) {
        return { ok: false, x, fehler: (e as Error).message };
      }
    });
    expect(ergebnisse).toHaveLength(5);
    expect(ergebnisse[2]).toEqual({ ok: false, x: 3, fehler: "nur intern" });
    expect(ergebnisse[0]).toEqual({ ok: true, x: 1 });
  });

  it("Concurrency-Stresstest: Limit eingehalten bei vielen Items mit Jitter", async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    let aktiv = 0;
    let maxAktiv = 0;
    const { ergebnisse, gestartet } = await mapMitLimit(items, 5, async (x) => {
      aktiv += 1;
      maxAktiv = Math.max(maxAktiv, aktiv);
      await delay(Math.floor(Math.random() * 5));
      aktiv -= 1;
      return x * 2;
    });
    expect(maxAktiv).toBe(5);
    expect(gestartet).toBe(100);
    expect(ergebnisse[99]).toBe(198);
    expect(ergebnisse[0]).toBe(0);
  });
});
