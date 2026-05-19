// Realdatei-Smoke-Test gegen den in `data/` abgelegten MoneyMoney-Export.
// Stellt sicher, dass der Parser den echten Q1-2026-Bankexport durchläuft.
//
// HINWEIS: Datei ist gitignored bzw. liegt nur lokal; Test überspringt sich
// selbst, wenn die Datei nicht vorhanden ist (CI-/Onboarding-freundlich).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { parseKontoauszug } from "./parser";
import type { KontoMapping } from "@/lib/types";

const DATEI = path.join(
  process.cwd(),
  "data/Geschäftsgiro Business-Giro Ko Q1.xls",
);

describe.skipIf(!existsSync(DATEI))(
  "Realdatei — MoneyMoney Q1-2026 Bankexport",
  () => {
    const mapping: KontoMapping = {
      datum: "Datum",
      betrag: "Betrag",
      verwendungszweck: "Verwendungszweck",
      empfaenger: "Name",
      waehrung: "Währung",
      datum_format: "US",
    };

    it("parst alle Zeilen ohne Fehler", () => {
      const buf = readFileSync(DATEI);
      const erg = parseKontoauszug(buf, mapping, "konto-real");
      expect(erg.fehlerhaft).toHaveLength(0);
      expect(erg.buchungen.length).toBeGreaterThan(400);
      // ISO-Daten im Q1-2026-Bereich
      for (const b of erg.buchungen) {
        expect(b.buchung_datum).toMatch(/^2026-0[123]-\d{2}$/);
        expect(b.waehrung).toBe("EUR");
      }
    });
  },
);
