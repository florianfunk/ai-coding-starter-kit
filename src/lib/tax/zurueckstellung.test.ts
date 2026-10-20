import { describe, expect, it } from "vitest";
import type { Buchung, Kategorie } from "@/lib/types";
import { berechneEuer } from "./euer";
import { berechneUstVa, type UstBuchung } from "./ust";
import { berechneJahresKennzahlen, type DashboardBuchung } from "@/lib/dashboard/aggregate";
import { berechneMonatsReihen } from "@/lib/dashboard/trend";

const kategorien = [
  { id: "income", typ: "einnahme", bezeichnung: "Erlöse" },
  { id: "expense", typ: "ausgabe", bezeichnung: "Software" },
] as Kategorie[];
const rows = [
  { id: "in", betrag: 1190, kategorie_id: "income" },
  { id: "out", betrag: -238, kategorie_id: "expense" },
].map((row) => ({ ...row, buchung_datum: "2025-05-01", klassifikation: "geschaeftlich",
  steuerrelevant: true, steuer_zurueckgestellt: false, ust_satz: 19, belegt: true, status: "auto_verbucht" }));

describe("Rückstellungen in Steuerberechnungen", () => {
  it.each([0, 1])("entfernt Einnahme/Ausgabe %i aus EÜR und USt und stellt die Wirkung nach Wiederaufnahme wieder her", (index) => {
    const aktiv = rows as unknown as Buchung[];
    const gehalten = aktiv.map((b, i) => ({ ...b, steuer_zurueckgestellt: i === index }));
    const erwartet = aktiv.filter((_, i) => i !== index);
    expect(berechneEuer(gehalten, kategorien, 2025, 1)).toEqual(berechneEuer(erwartet, kategorien, 2025, 1));
    const ust = (b: Buchung[]) => berechneUstVa(b as unknown as UstBuchung[], 2025, 2, "regelbesteuerung");
    expect(ust(gehalten)).toEqual(ust(erwartet));
    const wieder = gehalten.map((b) => ({ ...b, steuer_zurueckgestellt: false }));
    expect(berechneEuer(wieder, kategorien, 2025, 1)).toEqual(berechneEuer(aktiv, kategorien, 2025, 1));
    expect(ust(wieder)).toEqual(ust(aktiv));
  });
  it("zählt zurückgestellte unvollständige Buchungen nicht als Steuerwarnung", () => {
    const b = [{ ...rows[0], steuer_zurueckgestellt: true, kategorie_id: null, ust_satz: null }];
    expect(berechneEuer(b as unknown as Buchung[], kategorien, 2025, 1)).toEqual(berechneEuer([], kategorien, 2025, 1));
    expect(berechneUstVa(b as unknown as UstBuchung[], 2025, 2, "regelbesteuerung")).toEqual(berechneUstVa([], 2025, 2, "regelbesteuerung"));
  });
  it("berücksichtigt auch Steuerrelevant=Nein in der EÜR", () => {
    const b = rows.map((r) => ({ ...r, steuerrelevant: false })) as unknown as Buchung[];
    expect(berechneEuer(b, kategorien, 2025, 1)).toEqual(berechneEuer([], kategorien, 2025, 1));
  });
  it("entfernt zurückgestellte Zeilen aus Dashboard-Jahr und Monatsreihen", () => {
    const b = rows.map((r) => ({ ...r, steuer_zurueckgestellt: true })) as DashboardBuchung[];
    expect(berechneJahresKennzahlen(b, "2025-10-20", 1)).toEqual(berechneJahresKennzahlen([], "2025-10-20", 1));
    expect(berechneMonatsReihen(b, "2025-10-20", 1)).toEqual(berechneMonatsReihen([], "2025-10-20", 1));
  });
});
