import { describe, it, expect } from "vitest";
import { berechneUstVa, ELSTER_USTVA, type UstBuchung } from "./ust";

function b(over: Partial<UstBuchung> = {}): UstBuchung {
  return {
    id: "x",
    buchung_datum: "2026-03-10",
    betrag: 0,
    klassifikation: "geschaeftlich",
    steuerrelevant: true,
    ust_satz: 19,
    belegt: false,
    ...over,
  };
}

describe("berechneUstVa — Umsätze je Satz", () => {
  it("rechnet 19 % Brutto-Einnahme korrekt auf Netto/USt herunter", () => {
    const r = berechneUstVa(
      [b({ id: "e1", betrag: 1190, ust_satz: 19 })],
      2026,
      3,
      "regelbesteuerung",
    );
    const z19 = r.zeilen.find((z) => z.schluessel === "umsatz_19")!;
    expect(z19.betrag).toBe(1000);
    expect(z19.steuer).toBe(190);
    expect(z19.kennzahl).toBe(ELSTER_USTVA.umsatz_19.kennzahl);
    expect(r.summe.umsatzsteuer).toBe(190);
  });

  it("rechnet 7 % Einnahme korrekt", () => {
    const r = berechneUstVa(
      [b({ id: "e2", betrag: 107, ust_satz: 7 })],
      2026,
      3,
      "regelbesteuerung",
    );
    const z7 = r.zeilen.find((z) => z.schluessel === "umsatz_7")!;
    expect(z7.betrag).toBe(100);
    expect(z7.steuer).toBe(7);
  });

  it("0 % Umsatz erscheint als Bemessung ohne USt-Ausweis (separate Kz)", () => {
    const r = berechneUstVa(
      [b({ id: "e3", betrag: 500, ust_satz: 0 })],
      2026,
      3,
      "regelbesteuerung",
    );
    const z0 = r.zeilen.find((z) => z.schluessel === "umsatz_0")!;
    expect(z0.betrag).toBe(500);
    expect(z0.steuer).toBeNull();
    // Amtlicher USt-VA-Vordruck 2026: steuerpflichtige Umsätze zu 0 % = Kz 87.
    expect(z0.kennzahl).toBe("87");
    expect(z0.bezeichnung).not.toMatch(/steuerfrei|Reverse-Charge/i);
    expect(r.summe.umsatzsteuer).toBe(0);
  });
});

describe("berechneUstVa — Vorsteuer", () => {
  it("zieht Vorsteuer aus belegter Ausgabe ab und weist sie unter 'mit Beleg' aus", () => {
    const r = berechneUstVa(
      [b({ id: "a1", betrag: -119, ust_satz: 19, belegt: true })],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(r.summe.vorsteuer_abziehbar).toBe(19);
    expect(r.summe.vorsteuer_mit_beleg).toBe(19);
    expect(r.summe.vorsteuer_ohne_beleg).toBe(0);
    const zv = r.zeilen.find((z) => z.schluessel === "vorsteuer")!;
    expect(zv.buchung_ids).toEqual(["a1"]);
  });

  it("Vorsteuer ohne Beleg wird voll in Kz 66 angesetzt und separat ausgewiesen", () => {
    const r = berechneUstVa(
      [b({ id: "a2", betrag: -119, ust_satz: 19, belegt: false })],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(r.summe.vorsteuer_abziehbar).toBe(19);
    expect(r.summe.vorsteuer_mit_beleg).toBe(0);
    expect(r.summe.vorsteuer_ohne_beleg).toBe(19);
    expect(r.diagnostik.vorsteuer_ohne_beleg_anzahl).toBe(1);
    expect(r.diagnostik.vorsteuer_ohne_beleg_betrag).toBe(19);
    const zv = r.zeilen.find((z) => z.schluessel === "vorsteuer")!;
    expect(zv.buchung_ids).toEqual(["a2"]);
  });
});

describe("berechneUstVa — Filter & Zahllast", () => {
  it("schließt private/neutrale/unklare und nicht steuerrelevante aus", () => {
    const r = berechneUstVa(
      [
        b({ id: "p", betrag: 1190, klassifikation: "privat" }),
        b({ id: "n", betrag: 1190, klassifikation: "neutral" }),
        b({ id: "u", betrag: 1190, klassifikation: "unklar" }),
        b({ id: "ns", betrag: 1190, steuerrelevant: false }),
        b({ id: "ok", betrag: 1190, ust_satz: 19 }),
      ],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(r.diagnostik.beruecksichtigt_anzahl).toBe(1);
    expect(r.summe.umsatz_netto).toBe(1000);
  });

  it("Zahllast positiv = an FA, Erstattung negativ", () => {
    const zahllast = berechneUstVa(
      [b({ id: "e", betrag: 1190, ust_satz: 19 })],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(zahllast.summe.zahllast).toBe(190);

    const erstattung = berechneUstVa(
      [b({ id: "a", betrag: -1190, ust_satz: 19, belegt: true })],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(erstattung.summe.zahllast).toBe(-190);
  });

  it("verrechnet Storno/Gutschrift (negative Einnahme) innerhalb der Periode", () => {
    const r = berechneUstVa(
      [
        b({ id: "e", betrag: 1190, ust_satz: 19 }),
        // Gutschrift mit Beleg: mindert als negative Ausgabe-Logik nicht,
        // sondern als negativer Brutto → Vorsteuer-Pfad. Hier prüfen wir,
        // dass eine reine Einnahme + spätere belegte Korrektur konsistent
        // saldiert (USt 190 - VSt 19 = 171).
        b({ id: "g", betrag: -119, ust_satz: 19, belegt: true }),
      ],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(r.summe.umsatzsteuer).toBe(190);
    expect(r.summe.vorsteuer_abziehbar).toBe(19);
    expect(r.summe.zahllast).toBe(171);
  });

  it("zählt Buchungen ohne USt-Satz als ausgeschlossen", () => {
    const r = berechneUstVa(
      [b({ id: "k", betrag: 100, ust_satz: null })],
      2026,
      3,
      "regelbesteuerung",
    );
    expect(r.diagnostik.ohne_ust_satz_anzahl).toBe(1);
    expect(r.diagnostik.beruecksichtigt_anzahl).toBe(0);
  });
});

describe("berechneUstVa — Kleinunternehmer", () => {
  it("liefert Nullmeldung: keine USt, keine Vorsteuer, Hinweis gesetzt", () => {
    const r = berechneUstVa(
      [
        b({ id: "e", betrag: 1190, ust_satz: 19 }),
        b({ id: "a", betrag: -119, ust_satz: 19, belegt: true }),
      ],
      2026,
      3,
      "kleinunternehmer",
    );
    expect(r.kleinunternehmer).toBe(true);
    expect(r.hinweis).toMatch(/§ 19 UStG/);
    expect(r.summe.umsatzsteuer).toBe(0);
    expect(r.summe.vorsteuer_abziehbar).toBe(0);
    expect(r.summe.zahllast).toBe(0);
  });
});

describe("berechneUstVa — Rundung (Cent-genau, keine Float-Drift)", () => {
  it("rundet krumme Beträge kaufmännisch ohne Drift", () => {
    // 100 Einnahmen à 1,19 € (19 %) → je 1,00 netto, 0,19 USt.
    const buchungen = Array.from({ length: 100 }, (_, i) =>
      b({ id: `r${i}`, betrag: 1.19, ust_satz: 19 }),
    );
    const r = berechneUstVa(buchungen, 2026, 3, "regelbesteuerung");
    expect(r.summe.umsatz_netto).toBe(100);
    expect(r.summe.umsatzsteuer).toBeCloseTo(19, 5);
  });

  it("0,99 € Brutto zu 19 % rundet sauber (kein 0.8319...)", () => {
    const r = berechneUstVa(
      [b({ id: "c", betrag: 0.99, ust_satz: 19 })],
      2026,
      3,
      "regelbesteuerung",
    );
    const z19 = r.zeilen.find((z) => z.schluessel === "umsatz_19")!;
    // 0,99 / 1,19 = 0,8319... → 0,83 netto, 0,16 USt (0,83*0,19=0,1577→0,16)
    expect(z19.betrag).toBe(0.83);
    expect(z19.steuer).toBe(0.16);
  });
});
