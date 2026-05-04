import { describe, expect, it } from "vitest";
import { decideAutoTranslateKeys } from "./auto-translate-decider";

/** Helper: baut Vorher/Nachher-Maps für bestimmte Felder. Alle anderen
 *  TRANSLATABLE_FIELDS werden mit leeren Strings befüllt, damit sie nicht
 *  als „geändert" gewertet werden. */
function snap(vals: Record<string, string>) {
  return vals;
}

describe("decideAutoTranslateKeys", () => {
  it("liefert leeres Array, wenn nichts geändert wurde", () => {
    const v = snap({ name: "LED-Stripe", name_it: "Striscia LED" });
    const p = snap({ name: "LED-Stripe", name_it: "Striscia LED" });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual([]);
  });

  it("triggert Übersetzung wenn DE geändert und IT unverändert (Bug-1-Regression)", () => {
    // Klassisches Bug-1-Szenario: Produkt hat bereits IT, User ändert nur DE.
    // Hidden Input schickt das alte IT mit. Auto-Trigger muss trotzdem laufen.
    const v = snap({
      name: "LED-Stripe",
      name_it: "Striscia LED",
    });
    const p = snap({
      name: "LED-Stripe NEU",
      name_it: "Striscia LED", // unverändert (Hidden Input echo)
    });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual(["name"]);
  });

  it("überspringt Feld wenn IT manuell editiert wurde (Override-Schutz)", () => {
    const v = snap({
      name: "LED-Stripe",
      name_it: "Striscia LED",
    });
    const p = snap({
      name: "LED-Stripe NEU",
      name_it: "Striscia LED MANUELL", // User hat IT auch geändert
    });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual([]);
  });

  it("wertet auch leere DE-Felder als 'unverändert' wenn vorher leer", () => {
    const v = snap({ name: "", name_it: "" });
    const p = snap({ name: "", name_it: "" });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual([]);
  });

  it("triggert beim Erstellen — leere Vorher-Werte + neue DE-Eingabe", () => {
    // Use-Case createProdukt: emptyVorher mit leeren Strings, frische DE-Eingabe.
    const v = snap({
      name: "",
      name_it: "",
      datenblatt_titel: "",
      datenblatt_titel_it: "",
    });
    const p = snap({
      name: "LED-Stripe Neu",
      name_it: "", // User hat nur DE eingegeben, IT leer gelassen
      datenblatt_titel: "Streifen",
      datenblatt_titel_it: "",
    });
    const result = decideAutoTranslateKeys({ vorher: v, parsedData: p });
    expect(result).toContain("name");
    expect(result).toContain("datenblatt_titel");
  });

  it("überspringt beim Erstellen wenn User DE und IT eingegeben hat", () => {
    const v = snap({ name: "", name_it: "" });
    const p = snap({
      name: "LED-Stripe",
      name_it: "Striscia LED",
    });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual([]);
  });

  it("ignoriert reine Whitespace-Änderungen (trim-Vergleich)", () => {
    const v = snap({ name: "LED-Stripe", name_it: "Striscia LED" });
    const p = snap({ name: "  LED-Stripe  ", name_it: "Striscia LED" });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual([]);
  });

  it("behandelt null/undefined wie leeren String", () => {
    const v: Record<string, unknown> = {
      name: null,
      name_it: undefined,
    };
    const p: Record<string, unknown> = {
      name: "LED-Stripe",
      name_it: "",
    };
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual(["name"]);
  });

  it("erkennt mehrere geänderte Felder gleichzeitig", () => {
    const v = snap({
      name: "Alt",
      name_it: "Vecchio",
      datenblatt_titel: "Alt-Titel",
      datenblatt_titel_it: "Vecchio-Titolo",
      info_kurz: "Alt-Info",
      info_kurz_it: "Vecchio-Info",
    });
    const p = snap({
      name: "Neu",
      name_it: "Vecchio", // unverändert → wird übersetzt
      datenblatt_titel: "Neu-Titel",
      datenblatt_titel_it: "Neuer-Titolo-MANUELL", // verändert → übersprungen
      info_kurz: "Neu-Info",
      info_kurz_it: "Vecchio-Info", // unverändert → wird übersetzt
    });
    const result = decideAutoTranslateKeys({ vorher: v, parsedData: p });
    expect(result).toContain("name");
    expect(result).toContain("info_kurz");
    expect(result).not.toContain("datenblatt_titel");
  });

  it("triggert Übersetzung wenn DE geleert wird (newDe=='') ", () => {
    // Edge: User löscht DE-Inhalt komplett. Übersetzer wird gerufen, schreibt
    // dann leeres IT (uebersetzeProdukt überspringt leere DE-Quellen → IT
    // bleibt unverändert). Aber die Decider-Logik markiert es korrekt als
    // „geändert" — der Translator entscheidet dann separat.
    const v = snap({ name: "LED-Stripe", name_it: "Striscia LED" });
    const p = snap({ name: "", name_it: "Striscia LED" });
    expect(decideAutoTranslateKeys({ vorher: v, parsedData: p })).toEqual(["name"]);
  });
});
