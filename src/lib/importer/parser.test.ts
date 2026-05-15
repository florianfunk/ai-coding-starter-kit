import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  normalisiereBetrag,
  normalisiereDatum,
  bildeDuplikatHash,
  parseKontoauszug,
} from "./parser";
import type { KontoMapping } from "@/lib/types";

// Hilfsfunktion: baut aus einer Zeilen-Matrix einen xlsx-Buffer (wie ein Upload).
function macheXlsx(rows: (string | number)[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Auszug");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

// Hilfsfunktion: CSV-Buffer (SheetJS erkennt CSV automatisch).
function macheCsv(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("normalisiereBetrag — DE/EN/Soll-Haben", () => {
  it("parst DE-Format mit Tausenderpunkt und Dezimalkomma", () => {
    expect(normalisiereBetrag("1.234,56")).toBe(1234.56);
  });

  it("parst einfaches DE-Dezimalkomma", () => {
    expect(normalisiereBetrag("42,90")).toBe(42.9);
  });

  it("parst EN-Format 1,234.56", () => {
    expect(normalisiereBetrag("1,234.56")).toBe(1234.56);
  });

  it("erkennt führendes Minus als negativen Betrag", () => {
    expect(normalisiereBetrag("-1.000,00")).toBe(-1000);
  });

  it("erkennt Klammern als negativen Betrag (Buchhalterstil)", () => {
    expect(normalisiereBetrag("(89,99)")).toBe(-89.99);
  });

  it("entfernt Währungssymbole", () => {
    expect(normalisiereBetrag("1.500,00 €")).toBe(1500);
    expect(normalisiereBetrag("EUR 250,00")).toBe(250);
  });

  it("wendet Soll-Kennzeichen (S) als negativ an", () => {
    expect(normalisiereBetrag("100,00", "S")).toBe(-100);
    expect(normalisiereBetrag("100,00", "Soll")).toBe(-100);
  });

  it("wendet Haben-Kennzeichen (H) als positiv an, auch bei Minus-Roh", () => {
    expect(normalisiereBetrag("100,00", "H")).toBe(100);
    expect(normalisiereBetrag("100,00", "Haben")).toBe(100);
  });

  it("invertiert das Vorzeichen, wenn invertieren=true", () => {
    expect(normalisiereBetrag("50,00", undefined, true)).toBe(-50);
    expect(normalisiereBetrag("-50,00", undefined, true)).toBe(50);
  });

  it("liefert null für nicht interpretierbare Werte", () => {
    expect(normalisiereBetrag("")).toBeNull();
    expect(normalisiereBetrag("k.A.")).toBeNull();
  });
});

describe("normalisiereDatum — DE-Formate → ISO", () => {
  it("parst TT.MM.JJJJ", () => {
    expect(normalisiereDatum("15.05.2026")).toBe("2026-05-15");
  });

  it("parst T.M.JJJJ (ohne führende Nullen)", () => {
    expect(normalisiereDatum("3.7.2025")).toBe("2025-07-03");
  });

  it("parst 2-stelliges Jahr TT.MM.JJ", () => {
    expect(normalisiereDatum("01.01.24")).toBe("2024-01-01");
  });

  it("parst TT/MM/JJJJ und TT-MM-JJJJ", () => {
    expect(normalisiereDatum("15/05/2026")).toBe("2026-05-15");
    expect(normalisiereDatum("15-05-2026")).toBe("2026-05-15");
  });

  it("akzeptiert bereits vorhandenes ISO-Datum", () => {
    expect(normalisiereDatum("2026-05-15")).toBe("2026-05-15");
  });

  it("parst Excel-Serienzahl", () => {
    // 45792 = 2025-05-15 (Tage seit 1899-12-30)
    expect(normalisiereDatum("45792")).toBe("2025-05-15");
  });

  it("lehnt ungültige Daten ab", () => {
    expect(normalisiereDatum("32.13.2026")).toBeNull();
    expect(normalisiereDatum("abc")).toBeNull();
    expect(normalisiereDatum("")).toBeNull();
  });
});

describe("bildeDuplikatHash — Stabilität", () => {
  it("erzeugt denselben Hash für identische Eingaben", () => {
    const a = bildeDuplikatHash("konto-1", "2026-05-15", -49.99, "REWE Markt");
    const b = bildeDuplikatHash("konto-1", "2026-05-15", -49.99, "REWE Markt");
    expect(a).toBe(b);
  });

  it("ist robust gegen Whitespace/Groß-Klein im Verwendungszweck", () => {
    const a = bildeDuplikatHash("k", "2026-05-15", 10, "Miete  Mai");
    const b = bildeDuplikatHash("k", "2026-05-15", 10, " miete mai ");
    expect(a).toBe(b);
  });

  it("unterscheidet sich bei abweichendem Betrag/Konto/Datum", () => {
    const basis = bildeDuplikatHash("k", "2026-05-15", 10, "x");
    expect(bildeDuplikatHash("k", "2026-05-15", 10.01, "x")).not.toBe(basis);
    expect(bildeDuplikatHash("k2", "2026-05-15", 10, "x")).not.toBe(basis);
    expect(bildeDuplikatHash("k", "2026-05-16", 10, "x")).not.toBe(basis);
  });

  it("behandelt null-Zweck stabil wie leeren String", () => {
    expect(bildeDuplikatHash("k", "2026-05-15", 1, null)).toBe(
      bildeDuplikatHash("k", "2026-05-15", 1, ""),
    );
  });
});

describe("parseKontoauszug — Header/Leer/Summen-Filter & Mapping", () => {
  const mapping: KontoMapping = {
    datum: "Buchungstag",
    betrag: "Betrag",
    verwendungszweck: "Verwendungszweck",
    empfaenger: "Empfänger",
    waehrung: "Währung",
  };

  it("parst eine xlsx-Datei und ignoriert Leer-/Summenzeilen", () => {
    const buf = macheXlsx([
      ["Mein Bankexport", "", "", "", ""], // Vorspann, wird übersprungen
      ["", "", "", "", ""], // Leerzeile
      ["Buchungstag", "Betrag", "Verwendungszweck", "Empfänger", "Währung"],
      ["15.05.2026", "-49,99", "REWE Einkauf", "REWE SE", "EUR"],
      ["", "", "", "", ""], // Leerzeile mittendrin
      ["16.05.2026", "1.200,00", "Gehalt", "Firma GmbH", "EUR"],
      ["Summe", "1.150,01", "", "", ""], // Summenzeile -> ignoriert
    ]);
    const erg = parseKontoauszug(buf, mapping, "konto-1");
    expect(erg.fehlerhaft).toHaveLength(0);
    expect(erg.buchungen).toHaveLength(2);
    expect(erg.buchungen[0]).toMatchObject({
      buchung_datum: "2026-05-15",
      betrag: -49.99,
      verwendungszweck: "REWE Einkauf",
      empfaenger: "REWE SE",
      waehrung: "EUR",
    });
    expect(erg.buchungen[0].duplikat_hash).toBeTruthy();
  });

  it("parst CSV mit denselben Regeln", () => {
    const csv =
      "Buchungstag;Betrag;Verwendungszweck;Empfänger;Währung\n" +
      "01.04.2026;-12,34;PayPal Zahlung;Shop;EUR\n" +
      ";;;;\n" +
      "Saldo;-12,34;;;\n";
    const erg = parseKontoauszug(macheCsv(csv), mapping, "konto-2");
    expect(erg.buchungen).toHaveLength(1);
    expect(erg.buchungen[0].betrag).toBe(-12.34);
    expect(erg.buchungen[0].buchung_datum).toBe("2026-04-01");
  });

  it("meldet Zeilen mit unlesbarem Datum als fehlerhaft, ohne Abbruch", () => {
    const buf = macheXlsx([
      ["Buchungstag", "Betrag", "Verwendungszweck", "Empfänger", "Währung"],
      ["kaputt", "-1,00", "Fehlerzeile", "X", "EUR"],
      ["15.05.2026", "-2,00", "OK-Zeile", "Y", "EUR"],
    ]);
    const erg = parseKontoauszug(buf, mapping, "k");
    expect(erg.buchungen).toHaveLength(1);
    expect(erg.fehlerhaft).toHaveLength(1);
    expect(erg.fehlerhaft[0].grund).toContain("Datum");
  });

  it("verwendet EUR als Standardwährung, wenn Spalte leer/fehlt", () => {
    const m: KontoMapping = { datum: "Datum", betrag: "Betrag" };
    const buf = macheXlsx([
      ["Datum", "Betrag"],
      ["15.05.2026", "-9,99"],
    ]);
    const erg = parseKontoauszug(buf, m, "k");
    expect(erg.buchungen[0].waehrung).toBe("EUR");
  });

  it("erkennt fehlende Pflicht-Spalte (falsches Mapping) als Fehler", () => {
    const m: KontoMapping = { datum: "Datum", betrag: "Umsatz" };
    const buf = macheXlsx([
      ["Datum", "Betrag"], // 'Umsatz' existiert nicht
      ["15.05.2026", "-9,99"],
    ]);
    const erg = parseKontoauszug(buf, m, "k");
    expect(erg.buchungen).toHaveLength(0);
    expect(erg.fehlerhaft[0].grund).toContain("Betrags-Spalte");
  });

  it("invertiert Beträge, wenn Mapping betrag_vorzeichen_invertieren=true", () => {
    const m: KontoMapping = {
      datum: "Datum",
      betrag: "Betrag",
      betrag_vorzeichen_invertieren: true,
    };
    const buf = macheXlsx([
      ["Datum", "Betrag"],
      ["15.05.2026", "100,00"],
    ]);
    const erg = parseKontoauszug(buf, m, "k");
    expect(erg.buchungen[0].betrag).toBe(-100);
  });
});
