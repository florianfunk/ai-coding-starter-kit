// PROJ-17 — Tests fuer baueSystemPrompt.
//
// Wir pruefen, dass:
//   - Sprache (Deutsch) im Prompt steht
//   - heutiges Datum als TT.MM.JJJJ enthalten ist
//   - Tool-Klassen-Trennung erklaert wird
//   - Profil-Block bei null/leer NICHT auftaucht
//   - Profil-Block mit Inhalten korrekt eingebettet wird

import { describe, expect, it } from "vitest";
import { baueSystemPrompt } from "./system-prompt";
import type { MeinProfil } from "@/lib/classifier/profil";

function leeresProfil(): MeinProfil {
  return {
    arbeitgeber: [],
    familie: [],
    eigene_konten: [],
    adresse: null,
  } as unknown as MeinProfil;
}

describe("baueSystemPrompt", () => {
  it("nennt STEUERAGENT und Sprache Deutsch", () => {
    const p = baueSystemPrompt(null);
    expect(p).toContain("STEUERAGENT");
    expect(p).toContain("Deutsch");
  });

  it("enthaelt Datum im TT.MM.JJJJ-Format", () => {
    const p = baueSystemPrompt(null);
    expect(p).toMatch(/Heutiges Datum: \d{2}\.\d{2}\.\d{4}/);
  });

  it("erklaert die Trennung zwischen Lese- und Schreib-Tools", () => {
    const p = baueSystemPrompt(null);
    expect(p).toContain("Lese-Tools");
    expect(p).toContain("Schreib-Tools");
    expect(p).toMatch(/NIE direkt aus/);
  });

  it("listet alle 11 Lese-Tools beim Namen", () => {
    const p = baueSystemPrompt(null);
    for (const tool of [
      "suche_buchungen",
      "aggregat_kategorien",
      "cockpit_kennzahlen",
      "wiederkehrende_buchungen",
      "pruefliste",
      "umsatzsteuer_stand",
      "buchung_details",
      "empfaenger_kenntnis_lookup",
      "lernregeln_liste",
      "mein_profil_kontext",
      "kategorien_liste",
    ]) {
      expect(p).toContain(tool);
    }
  });

  it("listet alle 10 Schreib-Tools beim Namen", () => {
    const p = baueSystemPrompt(null);
    for (const tool of [
      "lege_kategorie_an",
      "aendere_kategorie",
      "loesche_kategorie",
      "bucheBuchungenUm",
      "manuell_bestaetige_buchungen",
      "lege_lernregel_an",
      "aendere_lernregel",
      "loesche_lernregel",
      "setze_empfaenger_kenntnis",
      "loesche_empfaenger_kenntnis",
    ]) {
      expect(p).toContain(tool);
    }
  });

  it("ohne Profil: kein Profil-Block", () => {
    const p = baueSystemPrompt(null);
    expect(p).not.toContain("## Profil-Kontext");
  });

  it("mit leerem Profil: kein Profil-Block", () => {
    const p = baueSystemPrompt(leeresProfil());
    expect(p).not.toContain("## Profil-Kontext");
  });

  it("mit Arbeitgeber im Profil: Profil-Block taucht auf", () => {
    const profil: MeinProfil = {
      arbeitgeber: [
        {
          name: "Acme AG",
          name_normalisiert: "acme ag",
          aktiv_von: null,
          aktiv_bis: null,
        },
      ],
      familie: [],
      eigene_konten: [],
      adresse: null,
    } as unknown as MeinProfil;
    const p = baueSystemPrompt(profil);
    expect(p).toContain("## Profil-Kontext");
    expect(p).toContain("Acme AG");
  });
});
