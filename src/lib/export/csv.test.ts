// PROJ-11: Tests für den CSV-/DATEV-/ELSTER-Export.
import { describe, it, expect } from "vitest";
import {
  csvFeld,
  formatBetragDe,
  formatDatumDe,
  buchungenAlsCsv,
  elsterKennzahlenAlsCsv,
  BUCHUNG_CSV_SPALTEN,
  ELSTER_CSV_SPALTEN,
  UTF8_BOM,
  CSV_TRENNZEICHEN,
  CSV_ZEILENENDE,
  type BuchungsExportZeile,
  type ElsterKennzahlZeile,
} from "./csv";
import { ELSTER_USTVA } from "@/lib/tax/ust";

describe("csvFeld (Quoting)", () => {
  it("quotet ein Feld mit Trennzeichen", () => {
    expect(csvFeld("Rewe; Markt")).toBe('"Rewe; Markt"');
  });

  it("quotet ein Feld mit Zeilenumbruch", () => {
    expect(csvFeld("Zeile1\nZeile2")).toBe('"Zeile1\nZeile2"');
    expect(csvFeld("Zeile1\r\nZeile2")).toBe('"Zeile1\r\nZeile2"');
  });

  it("verdoppelt enthaltene Anführungszeichen", () => {
    expect(csvFeld('Er sagte "Hallo"')).toBe('"Er sagte ""Hallo"""');
  });

  it("liefert leeren String für null/undefined/leer (kein leeres Quote-Paar)", () => {
    expect(csvFeld(null)).toBe("");
    expect(csvFeld(undefined)).toBe("");
    expect(csvFeld("")).toBe("");
  });

  it("lässt harmlose Felder unverändert (kein unnötiges Quoting)", () => {
    expect(csvFeld("Bürobedarf")).toBe("Bürobedarf");
  });
});

describe("formatBetragDe (Betrag-Format)", () => {
  it("formatiert positive Beträge mit Komma und 2 Stellen", () => {
    expect(formatBetragDe(1234.5)).toBe("1234,50");
    expect(formatBetragDe(0)).toBe("0,00");
    expect(formatBetragDe(7)).toBe("7,00");
  });

  it("formatiert negative Beträge mit Vorzeichen", () => {
    expect(formatBetragDe(-19.99)).toBe("-19,99");
  });

  it("rundet Float-Artefakte cent-genau", () => {
    expect(formatBetragDe(0.1 + 0.2)).toBe("0,30");
    expect(formatBetragDe(2.005)).toBe("2,01");
  });
});

describe("formatDatumDe", () => {
  it("wandelt ISO in TT.MM.JJJJ", () => {
    expect(formatDatumDe("2026-03-09")).toBe("09.03.2026");
    expect(formatDatumDe("2026-03-09T12:00:00Z")).toBe("09.03.2026");
  });

  it("liefert leeren String für null/leer", () => {
    expect(formatDatumDe(null)).toBe("");
    expect(formatDatumDe("")).toBe("");
  });
});

const BEISPIEL_ZEILEN: BuchungsExportZeile[] = [
  {
    datum: "2026-02-15",
    betrag: 1190,
    konto: "Umsatzerlöse 19%",
    gegenkonto: "Geschäftskonto",
    ust_satz: 19,
    beleg_referenz: "RE-2026-001",
    buchungstext: "Beratungsleistung",
  },
  {
    datum: "2026-02-20",
    betrag: -59.5,
    konto: "Bürobedarf",
    gegenkonto: "Kreditkarte; Visa",
    ust_satz: 7,
    beleg_referenz: "",
    buchungstext: 'Papier "extra weiß"\nNachbestellung',
  },
];

describe("buchungenAlsCsv (Schema, Encoding, BOM)", () => {
  const csv = buchungenAlsCsv(BEISPIEL_ZEILEN);

  it("beginnt mit UTF-8-BOM", () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it("nutzt Semikolon als Trennzeichen und CRLF als Zeilenende", () => {
    const zeilen = csv.slice(UTF8_BOM.length).split(CSV_ZEILENENDE);
    expect(zeilen[0].split(CSV_TRENNZEICHEN)).toEqual([
      ...BUCHUNG_CSV_SPALTEN,
    ]);
  });

  it("schreibt die Kopfzeile in definierter Spaltenreihenfolge", () => {
    const kopf = csv.slice(UTF8_BOM.length).split(CSV_ZEILENENDE)[0];
    expect(kopf).toBe(
      "Datum;Betrag;Soll/Haben;Konto;Gegenkonto;USt-Satz;Beleg-Referenz;Buchungstext",
    );
  });

  it("setzt Soll/Haben anhand des Vorzeichens", () => {
    const datenzeilen = csv
      .slice(UTF8_BOM.length)
      .split(CSV_ZEILENENDE)
      .filter((z) => z.length > 0)
      .slice(1);
    expect(datenzeilen[0].split(";")[2]).toBe("S"); // Einnahme
    expect(datenzeilen[1].startsWith("20.02.2026;-59,50;H;")).toBe(true);
  });

  it("quotet Felder mit Trennzeichen, Quote und Zeilenumbruch korrekt", () => {
    expect(csv).toContain('"Kreditkarte; Visa"');
    expect(csv).toContain('"Papier ""extra weiß""\nNachbestellung"');
  });

  it("lässt leere Beleg-Referenz als echtes Leerfeld", () => {
    // ...;7 %;;"Papier... → zwischen USt-Satz und Buchungstext ein Leerfeld
    expect(csv).toContain(";7 %;;");
  });

  it("endet mit Zeilenende und schneidet nichts ab (alle Zeilen vorhanden)", () => {
    expect(csv.endsWith(CSV_ZEILENENDE)).toBe(true);
    const datenzeilen = csv
      .slice(UTF8_BOM.length)
      .split(CSV_ZEILENENDE)
      .filter((z) => z.length > 0);
    expect(datenzeilen.length).toBe(1 + BEISPIEL_ZEILEN.length);
  });

  it("erzeugt nur Kopfzeile bei leerer Eingabe (kein leerer Export)", () => {
    const leer = buchungenAlsCsv([]);
    const zeilen = leer
      .slice(UTF8_BOM.length)
      .split(CSV_ZEILENENDE)
      .filter((z) => z.length > 0);
    expect(zeilen.length).toBe(1);
  });
});

describe("elsterKennzahlenAlsCsv", () => {
  const zeilen: ElsterKennzahlZeile[] = [
    {
      kennzahl: "81",
      bezeichnung: "Umsätze zu 19 %",
      betrag: 1000,
      steuer: 190,
    },
    {
      kennzahl: "66",
      bezeichnung: "Abziehbare Vorsteuer",
      betrag: 50,
      steuer: null,
    },
  ];
  const csv = elsterKennzahlenAlsCsv(zeilen);

  it("hat BOM, Kopf und definierte Spalten", () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const kopf = csv.slice(UTF8_BOM.length).split(CSV_ZEILENENDE)[0];
    expect(kopf.split(";")).toEqual([...ELSTER_CSV_SPALTEN]);
  });

  it("schreibt leeren Steuerbetrag als Leerfeld (nicht 0,00)", () => {
    expect(csv).toContain("66;Abziehbare Vorsteuer;50,00;");
    expect(csv).not.toContain("66;Abziehbare Vorsteuer;50,00;0,00");
  });

  it("formatiert Betrag und Steuer im DE-Format", () => {
    expect(csv).toContain("81;Umsätze zu 19 %;1000,00;190,00");
  });
});

describe("ELSTER-Feldmap-Vollständigkeit (Stammdaten-Konsistenz)", () => {
  it("enthält alle erwarteten USt-VA-Schlüssel mit Kennzahl + Bezeichnung", () => {
    const erwartet = [
      "umsatz_19",
      "umsatz_7",
      "umsatz_0",
      "vorsteuer",
      "zahllast",
    ] as const;
    for (const key of erwartet) {
      const feld = ELSTER_USTVA[key];
      expect(feld).toBeDefined();
      expect(feld.kennzahl).toMatch(/^\d+$/);
      expect(feld.bezeichnung.length).toBeGreaterThan(0);
    }
    expect(Object.keys(ELSTER_USTVA).sort()).toEqual([...erwartet].sort());
  });

  it("hat eindeutige Kennzahlen (keine doppelten Feldnummern)", () => {
    const kz = Object.values(ELSTER_USTVA).map((f) => f.kennzahl);
    expect(new Set(kz).size).toBe(kz.length);
  });
});
