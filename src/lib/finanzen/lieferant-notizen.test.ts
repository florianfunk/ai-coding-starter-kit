// PROJ-21 — Tests für die reine Notiz-Gruppierung & Vorschau.

import { describe, it, expect } from "vitest";
import {
  gruppiereNotizen,
  notizVorschau,
  type LieferantNotizRow,
} from "./lieferant-notizen";

function row(p: Partial<LieferantNotizRow>): LieferantNotizRow {
  return {
    id: p.id ?? "id-" + Math.round(p.erstellt_am ? 0 : 0),
    empfaenger_norm: p.empfaenger_norm ?? "aldi",
    rohwert_beispiel: p.rohwert_beispiel ?? null,
    inhalt: p.inhalt ?? "Text",
    erstellt_am: p.erstellt_am ?? "2026-01-01T00:00:00.000Z",
    aktualisiert_am:
      p.aktualisiert_am ?? p.erstellt_am ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("gruppiereNotizen", () => {
  it("gruppiert nach empfaenger_norm", () => {
    const g = gruppiereNotizen([
      row({ id: "1", empfaenger_norm: "aldi", inhalt: "A" }),
      row({ id: "2", empfaenger_norm: "aldi", inhalt: "B" }),
      row({ id: "3", empfaenger_norm: "adobe", inhalt: "C" }),
    ]);
    expect(g).toHaveLength(2);
    const aldi = g.find((x) => x.empfaenger_norm === "aldi");
    expect(aldi?.notizen).toHaveLength(2);
  });

  it("sortiert Notizen je Gruppe: neueste zuerst", () => {
    const g = gruppiereNotizen([
      row({ id: "alt", erstellt_am: "2026-01-01T00:00:00.000Z" }),
      row({ id: "neu", erstellt_am: "2026-03-01T00:00:00.000Z" }),
      row({ id: "mitte", erstellt_am: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(g[0].notizen.map((n) => n.id)).toEqual(["neu", "mitte", "alt"]);
  });

  it("sortiert Gruppen nach jüngstem aktualisiert_am absteigend", () => {
    const g = gruppiereNotizen([
      row({
        empfaenger_norm: "alt",
        aktualisiert_am: "2026-01-01T00:00:00.000Z",
      }),
      row({
        empfaenger_norm: "frisch",
        aktualisiert_am: "2026-06-01T00:00:00.000Z",
      }),
    ]);
    expect(g.map((x) => x.empfaenger_norm)).toEqual(["frisch", "alt"]);
  });

  it("nimmt Anzeigenamen aus der Map mit Vorrang", () => {
    const namen = new Map([["aldi", "ALDI SUED"]]);
    const g = gruppiereNotizen(
      [row({ empfaenger_norm: "aldi", rohwert_beispiel: "Aldi GmbH" })],
      namen,
    );
    expect(g[0].empfaenger_anzeige).toBe("ALDI SUED");
  });

  it("fällt auf rohwert_beispiel zurück, dann auf den norm-Schlüssel", () => {
    const mitRoh = gruppiereNotizen([
      row({ empfaenger_norm: "aldi", rohwert_beispiel: "Aldi GmbH" }),
    ]);
    expect(mitRoh[0].empfaenger_anzeige).toBe("Aldi GmbH");

    const ohne = gruppiereNotizen([
      row({ empfaenger_norm: "aldi", rohwert_beispiel: null }),
    ]);
    expect(ohne[0].empfaenger_anzeige).toBe("aldi");
  });

  it("liefert leeres Array bei keinen Notizen", () => {
    expect(gruppiereNotizen([])).toEqual([]);
  });
});

describe("notizVorschau", () => {
  it("lässt kurze Texte unverändert", () => {
    expect(notizVorschau("Adobe Lizenz")).toBe("Adobe Lizenz");
  });

  it("kürzt lange Texte mit Ellipse", () => {
    const lang = "x".repeat(200);
    const v = notizVorschau(lang, 80);
    expect(v.length).toBeLessThanOrEqual(80);
    expect(v.endsWith("…")).toBe(true);
  });

  it("normalisiert Whitespace", () => {
    expect(notizVorschau("  Adobe\n\n  Lizenz  ")).toBe("Adobe Lizenz");
  });
});
