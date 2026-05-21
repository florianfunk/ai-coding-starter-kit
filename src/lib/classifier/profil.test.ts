// PROJ-16 — Tests fuer die Profil-Helper.

import { describe, it, expect } from "vitest";
import {
  formatiereProfilFuerLlm,
  istArbeitgeber,
  istFamilienmitglied,
  normalisiereProfilName,
  profilHatInhalt,
  type MeinProfil,
} from "./profil";

const LEER: MeinProfil = {
  arbeitgeber: [],
  familie: [],
  adresse: null,
  eigene_konten: [],
};

const VOLLSTAENDIG: MeinProfil = {
  arbeitgeber: [
    {
      name: "Accenture GmbH",
      name_normalisiert: "accenture",
      aktiv_von: "2024-01-01",
      aktiv_bis: null,
    },
  ],
  familie: [
    {
      name: "Anna Mustermann",
      name_normalisiert: "anna mustermann",
      rolle: "ehepartner",
      auch_geschaeftspartner: false,
    },
  ],
  adresse: {
    strasse: "Musterstraße 1",
    plz: "10115",
    ort: "Berlin",
    land: "DE",
  },
  eigene_konten: [
    {
      id: "00000000-0000-0000-0000-000000000001",
      bezeichnung: "Geschäftskonto",
      iban: "DE89370400440532013000",
    },
  ],
};

describe("profilHatInhalt", () => {
  it("liefert false fuer leeres und null-Profil", () => {
    expect(profilHatInhalt(null)).toBe(false);
    expect(profilHatInhalt(undefined)).toBe(false);
    expect(profilHatInhalt(LEER)).toBe(false);
  });

  it("liefert true wenn Arbeitgeber vorhanden", () => {
    expect(profilHatInhalt({ ...LEER, arbeitgeber: VOLLSTAENDIG.arbeitgeber })).toBe(
      true,
    );
  });

  it("liefert true wenn Adresse PLZ enthaelt", () => {
    expect(
      profilHatInhalt({
        ...LEER,
        adresse: { strasse: null, plz: "10115", ort: null, land: "DE" },
      }),
    ).toBe(true);
  });
});

describe("formatiereProfilFuerLlm", () => {
  it("liefert leeren String fuer leeres/null-Profil", () => {
    expect(formatiereProfilFuerLlm(null)).toBe("");
    expect(formatiereProfilFuerLlm(LEER)).toBe("");
  });

  it("enthaelt Arbeitgeber-, Wohnort-, Familien- und Konten-Block", () => {
    const text = formatiereProfilFuerLlm(VOLLSTAENDIG);
    expect(text).toContain("Arbeitgeber:");
    expect(text).toContain("Accenture GmbH");
    expect(text).toContain("Wohnort:");
    expect(text).toContain("10115");
    expect(text).toContain("Berlin");
    expect(text).toContain("Familienmitglieder:");
    expect(text).toContain("Anna Mustermann");
    expect(text).toContain("Eigene Bankkonten:");
    expect(text).toContain("Geschäftskonto");
  });

  it("rendert Zeitraum bei Arbeitgeber", () => {
    const text = formatiereProfilFuerLlm(VOLLSTAENDIG);
    expect(text).toMatch(/Accenture GmbH \(2024-01-01/);
  });

  it("zeigt Land NICHT wenn DE (Default)", () => {
    const text = formatiereProfilFuerLlm(VOLLSTAENDIG);
    // Block enthaelt PLZ + Ort, aber kein „DE" als separates Land-Token.
    expect(text).toContain("Wohnort: 10115 Berlin");
  });

  it("zeigt Land bei Nicht-DE-Adresse", () => {
    const text = formatiereProfilFuerLlm({
      ...VOLLSTAENDIG,
      adresse: { strasse: null, plz: "1010", ort: "Wien", land: "AT" },
    });
    expect(text).toContain("AT");
  });
});

describe("istFamilienmitglied", () => {
  it("matcht normalisierten Namen exakt", () => {
    expect(istFamilienmitglied(VOLLSTAENDIG, "anna mustermann")).toBe(true);
  });

  it("matcht case-insensitiv", () => {
    expect(istFamilienmitglied(VOLLSTAENDIG, "Anna Mustermann")).toBe(true);
  });

  it("liefert false bei unbekanntem Namen", () => {
    expect(istFamilienmitglied(VOLLSTAENDIG, "frank xyz")).toBe(false);
  });

  it("liefert false bei null/leerem Empfaenger oder null-Profil", () => {
    expect(istFamilienmitglied(null, "anna mustermann")).toBe(false);
    expect(istFamilienmitglied(VOLLSTAENDIG, null)).toBe(false);
    expect(istFamilienmitglied(VOLLSTAENDIG, "")).toBe(false);
  });
});

describe("istArbeitgeber", () => {
  it("matcht Arbeitgeber ohne Datum (gilt immer)", () => {
    expect(istArbeitgeber(VOLLSTAENDIG, "accenture")).toBe(true);
  });

  it("matcht Arbeitgeber innerhalb des aktiven Zeitraums", () => {
    expect(istArbeitgeber(VOLLSTAENDIG, "accenture", "2024-06-01")).toBe(true);
  });

  it("liefert false wenn das Datum vor aktiv_von liegt", () => {
    expect(istArbeitgeber(VOLLSTAENDIG, "accenture", "2023-01-01")).toBe(false);
  });

  it("liefert false wenn das Datum nach aktiv_bis liegt", () => {
    const p: MeinProfil = {
      ...VOLLSTAENDIG,
      arbeitgeber: [
        {
          name: "Old Job",
          name_normalisiert: "old job",
          aktiv_von: "2020-01-01",
          aktiv_bis: "2022-12-31",
        },
      ],
    };
    expect(istArbeitgeber(p, "old job", "2023-01-01")).toBe(false);
  });

  it("matcht Arbeitgeber ganz ohne Datums-Grenzen (gilt immer)", () => {
    const p: MeinProfil = {
      ...VOLLSTAENDIG,
      arbeitgeber: [
        {
          name: "Permanent",
          name_normalisiert: "permanent",
          aktiv_von: null,
          aktiv_bis: null,
        },
      ],
    };
    expect(istArbeitgeber(p, "permanent", "1999-01-01")).toBe(true);
    expect(istArbeitgeber(p, "permanent", "2099-01-01")).toBe(true);
  });

  it("liefert false bei null-Profil oder leerem Empfaenger", () => {
    expect(istArbeitgeber(null, "accenture")).toBe(false);
    expect(istArbeitgeber(VOLLSTAENDIG, "")).toBe(false);
    expect(istArbeitgeber(VOLLSTAENDIG, null)).toBe(false);
  });
});

describe("normalisiereProfilName", () => {
  it("normalisiert gleich wie normalisiereEmpfaenger (Rechtsform-Strip, lower)", () => {
    expect(normalisiereProfilName("Accenture GmbH")).toBe("accenture");
  });

  it("entfernt PayPal-Praefix", () => {
    expect(normalisiereProfilName("PAYPAL *NETFLIX")).toBe("netflix");
  });

  it("ist idempotent", () => {
    const einmal = normalisiereProfilName("Beispiel GmbH");
    const zweimal = normalisiereProfilName(einmal);
    expect(zweimal).toBe(einmal);
  });
});
