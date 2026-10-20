import { describe, expect, it } from "vitest";
import { steuerZurueckstellungSchema } from "./steuer-zurueckstellung";

describe("Steuerliche Rückstellung", () => {
  it("verlangt einen nichtleeren Grund und einen bekannten Ausgangsstand", () => {
    for (const grund of ["", "   ", "x".repeat(1001)]) {
      expect(steuerZurueckstellungSchema.safeParse({ aktion: "zurueckstellen", grund, erwartet_am: null }).success).toBe(false);
    }
    expect(steuerZurueckstellungSchema.safeParse({ aktion: "zurueckstellen", grund: "Strittig" }).success).toBe(false);
  });
  it("trimmt den Grund und erlaubt Wiederaufnahme mit exaktem Timestamp", () => {
    expect(steuerZurueckstellungSchema.parse({ aktion: "zurueckstellen", grund: " Rechnung strittig ", erwartet_am: null })).toMatchObject({ grund: "Rechnung strittig" });
    expect(steuerZurueckstellungSchema.safeParse({ aktion: "wiederaufnehmen", erwartet_am: "2026-10-20T15:10:00.123456+00:00" }).success).toBe(true);
  });
  it("nimmt keine Kategorie- oder Klassifikationsänderungen an", () => {
    expect(steuerZurueckstellungSchema.safeParse({ aktion: "wiederaufnehmen", erwartet_am: null, klassifikation: "privat" }).success).toBe(false);
  });
});
