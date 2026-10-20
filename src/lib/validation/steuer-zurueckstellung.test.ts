import { describe, expect, it } from "vitest";
import { steuerZurueckstellungSchema } from "./steuer-zurueckstellung";

describe("Steuerliche Rückstellung", () => {
  it("verlangt einen nichtleeren Grund und einen bekannten Ausgangsstand", () => {
    for (const grund of ["", "   ", "x".repeat(1001)]) {
      expect(steuerZurueckstellungSchema.safeParse({ aktion: "zurueckstellen", grund, erwartete_version: 0 }).success).toBe(false);
    }
    expect(steuerZurueckstellungSchema.safeParse({ aktion: "zurueckstellen", grund: "Strittig" }).success).toBe(false);
  });
  it("trimmt den Grund und erlaubt Wiederaufnahme mit fortlaufender Version", () => {
    expect(steuerZurueckstellungSchema.parse({ aktion: "zurueckstellen", grund: " Rechnung strittig ", erwartete_version: 0 })).toMatchObject({ grund: "Rechnung strittig" });
    expect(steuerZurueckstellungSchema.safeParse({ aktion: "wiederaufnehmen", erwartete_version: 2 }).success).toBe(true);
  });
  it("nimmt keine Kategorie- oder Klassifikationsänderungen an", () => {
    expect(steuerZurueckstellungSchema.safeParse({ aktion: "wiederaufnehmen", erwartete_version: 0, klassifikation: "privat" }).success).toBe(false);
  });
});
