import { describe, it, expect } from "vitest";
import {
  normalizeBaseUrl,
  normalizeAmountString,
  parseBetragAusText,
  inhaltHash,
  toIsoDate,
  buildDocumentsUrl,
  betragAusCustomFields,
  mapDocumentToBeleg,
  type PaperlessRawDocument,
  type PaperlessLookups,
} from "./client";

describe("normalizeBaseUrl", () => {
  it("entfernt trailing slashes", () => {
    expect(normalizeBaseUrl("https://p.example.com///")).toBe(
      "https://p.example.com",
    );
    expect(normalizeBaseUrl("https://p.example.com")).toBe(
      "https://p.example.com",
    );
  });
});

describe("normalizeAmountString", () => {
  it("parst deutsches Format 1.234,56", () => {
    expect(normalizeAmountString("1.234,56")).toBe(1234.56);
  });
  it("parst englisches Format 1,234.56", () => {
    expect(normalizeAmountString("1,234.56")).toBe(1234.56);
  });
  it("parst einfaches Komma 99,90", () => {
    expect(normalizeAmountString("99,90")).toBe(99.9);
  });
  it("parst negativen Betrag", () => {
    expect(normalizeAmountString("-50,00")).toBe(-50);
  });
  it("liefert null bei Unsinn", () => {
    expect(normalizeAmountString("abc")).toBeNull();
  });
});

describe("parseBetragAusText", () => {
  it("erkennt Betrag nahe Schlüsselwort", () => {
    expect(
      parseBetragAusText("Rechnung\nGesamtbetrag: 1.190,00 EUR\nDanke"),
    ).toBe(1190);
  });
  it("erkennt 'Summe'", () => {
    expect(parseBetragAusText("Summe 42,00")).toBe(42);
  });
  it("liefert null ohne Schlüsselwort/Betrag", () => {
    expect(parseBetragAusText("Nur Text ohne Zahlen")).toBeNull();
  });
  it("liefert null bei null-Input", () => {
    expect(parseBetragAusText(null)).toBeNull();
  });
});

describe("toIsoDate", () => {
  it("normalisiert ISO-Timestamp auf JJJJ-MM-TT", () => {
    expect(toIsoDate("2026-05-15T12:34:56Z")).toBe("2026-05-15");
  });
  it("normalisiert reines Datum", () => {
    expect(toIsoDate("2026-05-15")).toBe("2026-05-15");
  });
  it("liefert null bei ungültigem Datum", () => {
    expect(toIsoDate("kein-datum")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe("inhaltHash", () => {
  const base = {
    paperless_id: 1,
    titel: "Rechnung",
    beleg_datum: "2026-05-15",
    korrespondent: "Telekom",
    betrag: 99.9,
    ocr_text: "Inhalt",
  };
  it("ist deterministisch", () => {
    expect(inhaltHash(base)).toBe(inhaltHash({ ...base }));
  });
  it("ändert sich bei Inhaltsänderung", () => {
    expect(inhaltHash(base)).not.toBe(
      inhaltHash({ ...base, betrag: 100 }),
    );
  });
  it("ist ein 64-stelliger Hex-String (sha256)", () => {
    expect(inhaltHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildDocumentsUrl", () => {
  it("baut URL mit Pagination ohne Filter", () => {
    const u = buildDocumentsUrl("https://p.example.com/", {}, 2);
    expect(u).toContain("https://p.example.com/api/documents/");
    expect(u).toContain("page=2");
    expect(u).toContain("page_size=100");
  });
  it("setzt Datums-/Tag-/Korrespondent-Filter", () => {
    const u = buildDocumentsUrl(
      "https://p.example.com",
      {
        von: "2026-01-01",
        bis: "2026-12-31",
        tag: "Steuer",
        korrespondent: "Telekom",
      },
      1,
    );
    expect(u).toContain("created__date__gte=2026-01-01");
    expect(u).toContain("created__date__lte=2026-12-31");
    expect(u).toContain("tags__name__icontains=Steuer");
    expect(u).toContain("correspondent__name__icontains=Telekom");
  });
  it("setzt Speicherpfad-Filter (storage_path)", () => {
    const u = buildDocumentsUrl(
      "https://p.example.com",
      { speicherpfad: "Rechnungen" },
      1,
    );
    expect(u).toContain("storage_path__name__icontains=Rechnungen");
  });
  it("ohne Speicherpfad kein storage_path-Parameter", () => {
    const u = buildDocumentsUrl("https://p.example.com", {}, 1);
    expect(u).not.toContain("storage_path");
  });
});

describe("betragAusCustomFields", () => {
  it("findet numerischen Wert", () => {
    expect(
      betragAusCustomFields([{ field: 1, value: 250.5 }]),
    ).toBe(250.5);
  });
  it("parst String-Wert", () => {
    expect(
      betragAusCustomFields([{ field: 1, value: "1.234,56" }]),
    ).toBe(1234.56);
  });
  it("liefert null ohne brauchbares Feld", () => {
    expect(betragAusCustomFields(null)).toBeNull();
    expect(
      betragAusCustomFields([{ field: 1, value: "kein betrag" }]),
    ).toBeNull();
  });
});

describe("mapDocumentToBeleg", () => {
  const lookups: PaperlessLookups = {
    correspondents: new Map([[10, "Telekom"]]),
    documentTypes: new Map([[20, "Rechnung"]]),
    tags: new Map([
      [30, "Steuer"],
      [31, "2026"],
    ]),
  };

  it("mappt vollständiges Dokument auf Status 'importiert'", () => {
    const doc: PaperlessRawDocument = {
      id: 5,
      title: "  Telekom Rechnung  ",
      created: "2026-05-01T00:00:00Z",
      created_date: "2026-05-02",
      added: null,
      correspondent: 10,
      document_type: 20,
      tags: [30, 31, 99],
      content: "Rechnung\nGesamtbetrag: 119,00 EUR",
    };
    const b = mapDocumentToBeleg(doc, lookups, "https://p.example.com/");
    expect(b.paperless_id).toBe(5);
    expect(b.titel).toBe("Telekom Rechnung");
    expect(b.beleg_datum).toBe("2026-05-02");
    expect(b.korrespondent).toBe("Telekom");
    expect(b.dokumenttyp).toBe("Rechnung");
    expect(b.tags).toEqual(["Steuer", "2026"]); // ID 99 nicht auflösbar -> raus
    expect(b.betrag).toBe(119);
    expect(b.quell_link).toBe("https://p.example.com/documents/5/");
    expect(b.status).toBe("importiert");
    expect(b.inhalt_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("markiert Dokument ohne Datum/Betrag als 'unvollstaendig'", () => {
    const doc: PaperlessRawDocument = {
      id: 6,
      title: null,
      created: null,
      created_date: null,
      added: null,
      correspondent: null,
      document_type: null,
      tags: [],
      content: "Kein erkennbarer Betrag hier",
    };
    const b = mapDocumentToBeleg(doc, lookups, "https://p.example.com");
    expect(b.status).toBe("unvollstaendig");
    expect(b.beleg_datum).toBeNull();
    expect(b.betrag).toBeNull();
    expect(b.titel).toBeNull();
  });

  it("bevorzugt Custom-Field-Betrag vor OCR-Parsing", () => {
    const doc: PaperlessRawDocument = {
      id: 7,
      title: "X",
      created: "2026-05-01",
      created_date: "2026-05-01",
      added: null,
      correspondent: null,
      document_type: null,
      tags: [],
      content: "Gesamtbetrag: 50,00",
      custom_fields: [{ field: 1, value: 333.33 }],
    };
    const b = mapDocumentToBeleg(doc, lookups, "https://p.example.com");
    expect(b.betrag).toBe(333.33);
  });
});
