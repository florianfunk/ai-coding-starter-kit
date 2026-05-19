import { describe, it, expect, vi } from "vitest";
import {
  entscheideBuchung,
  klassifiziereBuchung,
  ManuellBestaetigtError,
  DEFAULT_CONFIG,
  type BuchungFuerPipeline,
} from "./pipeline";
import {
  LlmKlassifiziererError,
  type LlmErgebnis,
  type KategorieOption,
} from "./llm";
import type { Lernregel } from "@/lib/types";

function buchung(p: Partial<BuchungFuerPipeline> = {}): BuchungFuerPipeline {
  return {
    id: p.id ?? "b1",
    konto_id: p.konto_id ?? "k1",
    betrag: p.betrag ?? -50,
    verwendungszweck: p.verwendungszweck ?? "Testzweck",
    empfaenger: p.empfaenger ?? "Test GmbH",
    status: p.status ?? "offen",
  };
}

function regel(p: Partial<Lernregel>): Lernregel {
  return {
    id: p.id ?? "r1",
    bezeichnung: "Regel",
    bedingung: p.bedingung ?? {},
    aktion: p.aktion ?? {},
    prioritaet: p.prioritaet ?? 100,
    aktiv: p.aktiv ?? true,
    treffer_zaehler: 0,
  };
}

const kategorien: KategorieOption[] = [
  { id: "kat-soft", bezeichnung: "Software", typ: "ausgabe" },
];

function llmOk(over: Partial<LlmErgebnis> = {}): LlmErgebnis {
  return {
    klassifikation: "geschaeftlich",
    steuerrelevant: true,
    kategorie_id: "kat-soft",
    ust_satz: 19,
    begruendung: "Software-Abo, betrieblich.",
    konfidenz: 0.95,
    ...over,
  };
}

describe("entscheideBuchung — Regel-Vorrang", () => {
  it("Regeltreffer → auto_verbucht, quelle 'regel'", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "test gmbh" },
      aktion: { kategorie_id: "kat-soft", klassifikation: "geschaeftlich" },
    });
    const { ergebnis } = entscheideBuchung(buchung(), [r], llmOk());
    expect(ergebnis.status).toBe("auto_verbucht");
    expect(ergebnis.quelle).toBe("regel");
    expect(ergebnis.regel_id).toBe("r1");
    expect(ergebnis.steuerrelevant).toBe(true);
  });

  it("privat-Regel setzt steuerrelevant=false", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "test gmbh" },
      aktion: { klassifikation: "privat" },
    });
    const { ergebnis } = entscheideBuchung(buchung(), [r], null);
    expect(ergebnis.klassifikation).toBe("privat");
    expect(ergebnis.steuerrelevant).toBe(false);
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("Regelkonflikt → zur_pruefung mit pruef_grund 'regelkonflikt'", () => {
    const a = regel({
      id: "a",
      bedingung: { empfaenger_muster: "test" },
      aktion: { klassifikation: "geschaeftlich" },
    });
    const b = regel({
      id: "b",
      bedingung: { zweck_muster: "test" },
      aktion: { klassifikation: "privat" },
    });
    const { ergebnis } = entscheideBuchung(buchung(), [a, b], null);
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("regelkonflikt");
  });
});

describe("entscheideBuchung — Konfidenz & Ausreißer", () => {
  it("KI >= Schwellwert + Kategorie → auto_verbucht", () => {
    const { ergebnis } = entscheideBuchung(buchung(), [], llmOk());
    expect(ergebnis.status).toBe("auto_verbucht");
    expect(ergebnis.quelle).toBe("ki");
    expect(ergebnis.kategorie_id).toBe("kat-soft");
  });

  it("KI unter Schwellwert → zur_pruefung", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({ konfidenz: 0.4 }),
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("konfidenz_unter_schwellwert");
  });

  it("KI hohe Konfidenz aber keine Kategorie → zur_pruefung", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({ kategorie_id: null }),
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("keine_kategorie");
  });

  it("klassifikation 'unklar' → zur_pruefung", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({ klassifikation: "unklar" }),
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("klassifikation_unklar");
  });

  it("Ausreißer-Betrag → zur_pruefung trotz hoher Konfidenz", () => {
    const { ergebnis } = entscheideBuchung(
      buchung({ betrag: -5000 }),
      [],
      llmOk(),
      DEFAULT_CONFIG,
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("ausreisser_betrag");
  });

  it("Ausreißer auch bei Regeltreffer → zur_pruefung", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "test" },
      aktion: { kategorie_id: "kat-soft", klassifikation: "geschaeftlich" },
    });
    const { ergebnis } = entscheideBuchung(
      buchung({ betrag: 9000 }),
      [r],
      null,
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("ausreisser_betrag");
  });

  it("konfigurierbarer Schwellwert wird respektiert", () => {
    const { ergebnis } = entscheideBuchung(buchung(), [], llmOk({ konfidenz: 0.7 }), {
      konfidenz_schwellwert: 0.6,
      betrag_limit: 2000,
    });
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("kein LLM-Ergebnis (Ausfall) → zur_pruefung, kein Datenverlust", () => {
    const { ergebnis, audit } = entscheideBuchung(buchung(), [], null);
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("ki_nicht_verfuegbar");
    expect(audit.aktion).toBe("klassifiziert");
  });
});

describe("entscheideBuchung — Schutz manuell bestätigter Buchungen", () => {
  it("wirft ManuellBestaetigtError bei status 'manuell_bestaetigt'", () => {
    expect(() =>
      entscheideBuchung(
        buchung({ status: "manuell_bestaetigt" }),
        [],
        llmOk(),
      ),
    ).toThrow(ManuellBestaetigtError);
  });
});

describe("klassifiziereBuchung — Orchestrierung & LLM-Fallback", () => {
  it("ruft das LLM NICHT auf, wenn eine Regel greift", async () => {
    const llmFn = vi.fn();
    const r = regel({
      bedingung: { empfaenger_muster: "test gmbh" },
      aktion: { kategorie_id: "kat-soft", klassifikation: "geschaeftlich" },
    });
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [r],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
    );
    expect(llmFn).not.toHaveBeenCalled();
    expect(ergebnis.quelle).toBe("regel");
  });

  it("nutzt das LLM, wenn keine Regel greift", async () => {
    const llmFn = vi.fn().mockResolvedValue(llmOk());
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
    );
    expect(llmFn).toHaveBeenCalledOnce();
    expect(ergebnis.quelle).toBe("ki");
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("LLM-Ausfall → Fallback zur_pruefung (kein Raten)", async () => {
    const llmFn = vi
      .fn()
      .mockRejectedValue(new LlmKlassifiziererError("LLM down"));
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("ki_nicht_verfuegbar");
    expect(ergebnis.klassifikation).toBeNull();
  });

  it("unerwarteter Fehler im LLM wird durchgereicht", async () => {
    const llmFn = vi.fn().mockRejectedValue(new Error("Bug"));
    await expect(
      klassifiziereBuchung(
        buchung(),
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
      ),
    ).rejects.toThrow("Bug");
  });

  it("überspringt manuell bestätigte Buchungen (wirft Error)", async () => {
    const llmFn = vi.fn();
    await expect(
      klassifiziereBuchung(
        buchung({ status: "manuell_bestaetigt" }),
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
      ),
    ).rejects.toThrow(ManuellBestaetigtError);
    expect(llmFn).not.toHaveBeenCalled();
  });

  it("Web-Retry: bei niedriger Konfidenz wird recherchiert und LLM erneut befragt", async () => {
    const llmFn = vi
      .fn()
      .mockResolvedValueOnce(
        llmOk({ konfidenz: 0.4, klassifikation: "unklar", kategorie_id: null }),
      )
      .mockResolvedValueOnce(
        llmOk({ konfidenz: 0.92, klassifikation: "geschaeftlich" }),
      );
    const rechercheFn = vi.fn().mockResolvedValue({
      query: "Acme GmbH Deutschland Unternehmen Branche",
      treffer: [
        {
          titel: "Acme GmbH",
          beschreibung: "Software-Anbieter aus Berlin.",
          url: "https://acme.example",
        },
      ],
    });
    const { ergebnis, audit } = await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
    );
    expect(rechercheFn).toHaveBeenCalledOnce();
    expect(llmFn).toHaveBeenCalledTimes(2);
    expect(ergebnis.status).toBe("auto_verbucht");
    expect(ergebnis.konfidenz).toBe(0.92);
    expect(audit.details.web_recherche).toMatchObject({ genutzt: true });
  });

  it("Web-Retry liefert keinen Mehrwert → Original-Ergebnis bleibt", async () => {
    const erster = llmOk({
      konfidenz: 0.5,
      klassifikation: "unklar",
      kategorie_id: null,
    });
    const llmFn = vi
      .fn()
      .mockResolvedValueOnce(erster)
      .mockResolvedValueOnce(
        llmOk({ konfidenz: 0.52, klassifikation: "unklar", kategorie_id: null }),
      );
    const rechercheFn = vi.fn().mockResolvedValue({
      query: "Unbekannt",
      treffer: [
        { titel: "Unklar", beschreibung: "Keine eindeutige Information.", url: "https://x" },
      ],
    });
    const { ergebnis } = await klassifiziereBuchung(
      buchung({ empfaenger: "Unbekannt" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
    );
    expect(rechercheFn).toHaveBeenCalledOnce();
    // Original behalten (Konfidenz-Gewinn unter 0.05, Kategorie weiter fehlend)
    expect(ergebnis.konfidenz).toBe(0.5);
    expect(ergebnis.status).toBe("zur_pruefung");
  });

  it("Web-Retry abgeschaltet → keine Recherche", async () => {
    const llmFn = vi
      .fn()
      .mockResolvedValueOnce(
        llmOk({ konfidenz: 0.4, klassifikation: "unklar", kategorie_id: null }),
      );
    const rechercheFn = vi.fn();
    await klassifiziereBuchung(
      buchung(),
      [],
      kategorien,
      { ...DEFAULT_CONFIG, web_recherche_aktiv: false },
      llmFn,
      rechercheFn,
    );
    expect(rechercheFn).not.toHaveBeenCalled();
    expect(llmFn).toHaveBeenCalledOnce();
  });

  it("Web-Recherche liefert null (kein API-Key) → kein Retry, Original bleibt", async () => {
    const llmFn = vi
      .fn()
      .mockResolvedValueOnce(
        llmOk({ konfidenz: 0.4, klassifikation: "unklar", kategorie_id: null }),
      );
    const rechercheFn = vi.fn().mockResolvedValue(null);
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
    );
    expect(rechercheFn).toHaveBeenCalledOnce();
    expect(llmFn).toHaveBeenCalledOnce();
    expect(ergebnis.konfidenz).toBe(0.4);
  });
});
