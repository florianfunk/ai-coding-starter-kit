import { describe, it, expect } from "vitest";
import { normalisiereEmpfaenger } from "./normalize";

describe("normalisiereEmpfaenger — Payment-Praefixe", () => {
  it("strippt STRIPE* am Anfang", () => {
    expect(normalisiereEmpfaenger("STRIPE*ACME LTD")).toBe("acme");
  });

  it("strippt STRIPE *<space> als Trenner", () => {
    expect(normalisiereEmpfaenger("STRIPE *ACME")).toBe("acme");
  });

  it("strippt PADDLE.NET* (laenger gewinnt vor PADDLE)", () => {
    expect(normalisiereEmpfaenger("PADDLE.NET*ACME")).toBe("acme");
  });

  it("strippt PADDLE * mit Space-Trenner", () => {
    expect(normalisiereEmpfaenger("PADDLE *ACME")).toBe("acme");
  });

  it("strippt PAYPAL * vor dem eigentlichen Empfaenger", () => {
    expect(normalisiereEmpfaenger("PAYPAL *NETFLIX")).toBe("netflix");
  });

  it("strippt PP* (kurz, gross)", () => {
    expect(normalisiereEmpfaenger("PP*Acme Inc")).toBe("acme");
  });

  it("strippt SQ * (Square-Format)", () => {
    expect(normalisiereEmpfaenger("SQ *Coffee Shop")).toBe("coffee shop");
  });

  it("strippt SP * (Stripe-Variante)", () => {
    expect(normalisiereEmpfaenger("SP *Acme")).toBe("acme");
  });

  it("strippt IZ* (iZettle)", () => {
    expect(normalisiereEmpfaenger("IZ*Backstube Mueller")).toBe(
      "backstube mueller",
    );
  });

  it("strippt mehrere Praefixe hintereinander (selten, aber moeglich)", () => {
    expect(normalisiereEmpfaenger("STRIPE*PAYPAL *NETFLIX")).toBe("netflix");
  });

  it("ist case-insensitive bei den Praefixen", () => {
    expect(normalisiereEmpfaenger("stripe*ACME")).toBe("acme");
    expect(normalisiereEmpfaenger("Stripe *Acme")).toBe("acme");
  });

  it("strippt KEIN Wort, das nur zufaellig mit Praefix-Buchstaben beginnt", () => {
    // "SPAREN" startet mit "SP", aber ohne Trennzeichen → kein Strip
    expect(normalisiereEmpfaenger("SPAREN GmbH")).toBe("sparen");
    // "PPDirekt" — ohne Trenner kein Strip
    expect(normalisiereEmpfaenger("PPDirekt")).toBe("ppdirekt");
  });
});

describe("normalisiereEmpfaenger — Rechtsformen", () => {
  it("entfernt GmbH am Ende", () => {
    expect(normalisiereEmpfaenger("Mueller GmbH")).toBe("mueller");
  });

  it("entfernt UG", () => {
    expect(normalisiereEmpfaenger("Beispiel UG")).toBe("beispiel");
  });

  it("entfernt 'UG (haftungsbeschränkt)' als ganzen Block", () => {
    expect(normalisiereEmpfaenger("Beispiel UG (haftungsbeschränkt)")).toBe(
      "beispiel",
    );
  });

  it("entfernt AG am Ende", () => {
    expect(normalisiereEmpfaenger("Deutsche Bank AG")).toBe("deutsche bank");
  });

  it("entfernt KG", () => {
    expect(normalisiereEmpfaenger("Schmitt KG")).toBe("schmitt");
  });

  it("entfernt OHG", () => {
    expect(normalisiereEmpfaenger("Schulze OHG")).toBe("schulze");
  });

  it("entfernt GbR", () => {
    expect(normalisiereEmpfaenger("Mueller & Schulze GbR")).toBe(
      "mueller & schulze",
    );
  });

  it("entfernt e.K. (mit Punkten)", () => {
    expect(normalisiereEmpfaenger("Hans Mueller e.K.")).toBe("hans mueller");
  });

  it("entfernt Inc., Ltd., LLC", () => {
    expect(normalisiereEmpfaenger("Acme Inc.")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme Ltd.")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme LLC")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme LLP")).toBe("acme");
  });

  it("entfernt Inc und Ltd auch ohne Punkt", () => {
    expect(normalisiereEmpfaenger("Acme Inc")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme Ltd")).toBe("acme");
  });

  it("entfernt B.V. / BV / S.A. / SA", () => {
    expect(normalisiereEmpfaenger("Acme B.V.")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme BV")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme S.A.")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme SA")).toBe("acme");
  });

  it("entfernt Co. und Corp.", () => {
    expect(normalisiereEmpfaenger("Acme Co.")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme Corp.")).toBe("acme");
  });

  it("entfernt doppelte Rechtsformen (Acme GmbH KG)", () => {
    expect(normalisiereEmpfaenger("Acme GmbH KG")).toBe("acme");
  });

  it("frisst NICHT 'AG' aus 'Agentur'", () => {
    expect(normalisiereEmpfaenger("Agentur Schmitt")).toBe("agentur schmitt");
  });

  it("frisst NICHT 'KG' aus 'KGaA-Stiftung' (Wortgrenze)", () => {
    // KGaA-Stiftung ist ein Konstrukt — 'KG' ist hier kein eigenes Wort.
    expect(normalisiereEmpfaenger("KGaA-Stiftung")).toBe("kgaa-stiftung");
  });

  it("entfernt 'GmbH' wenn mitten im Namen mit Komma ('Acme, GmbH, USA')", () => {
    // Komma als Trenner — "GmbH" zwischen Kommas, "USA" bleibt.
    expect(normalisiereEmpfaenger("Acme, GmbH, USA")).toBe("acme, , usa");
  });

  it("entfernt 'DE' als Laendercode-Suffix, wenn davor noch ein Wort steht", () => {
    // PROJ-15 (2026-05-20, Backfill-Verfeinerung): "DE" am Ende wird ab
    // jetzt als Laendercode entfernt, sofern davor noch mindestens ein
    // Wort steht. Vorherige Auslegung ("acme de" bleibt) ist aufgehoben.
    expect(normalisiereEmpfaenger("ACME LTD DE")).toBe("acme");
  });

  it("laesst einzelnes 'DE' / 'EU' als Empfaengernamen unangetastet", () => {
    // Wenn der gesamte Empfaenger nur aus dem Code besteht, wird er nicht
    // verschluckt — `\S+\s+CODE$` greift nicht, weil davor kein Wort steht.
    expect(normalisiereEmpfaenger("DE")).toBe("de");
    expect(normalisiereEmpfaenger("EU")).toBe("eu");
  });
});

describe("normalisiereEmpfaenger — End-Klammern", () => {
  it("entfernt '(Berlin)' am Ende", () => {
    expect(normalisiereEmpfaenger("Acme Ltd. (Berlin)")).toBe("acme");
  });

  it("entfernt '(DE)' am Ende", () => {
    expect(normalisiereEmpfaenger("Acme GmbH (DE)")).toBe("acme");
  });

  it("entfernt zwei aufeinanderfolgende Klammern '(DE) (Berlin)'", () => {
    expect(normalisiereEmpfaenger("Acme GmbH (DE) (Berlin)")).toBe("acme");
  });

  it("entfernt Klammer-Inhalte, die nach Wegfall der Rechtsform am Ende stehen", () => {
    // Nach Entfernen von 'GmbH' steht '(Tochter)' am Ende → faellt auch weg.
    // (Konsistente Auslegung von 'Klammer-Inhalte am Ende' aus der Spec.)
    expect(normalisiereEmpfaenger("Acme (Tochter) GmbH")).toBe("acme");
  });

  it("behaelt Klammern in der Mitte, wenn danach noch Inhalt steht", () => {
    expect(normalisiereEmpfaenger("Acme (Tochter) Software")).toBe(
      "acme (tochter) software",
    );
  });
});

describe("normalisiereEmpfaenger — Umlaute & Sonderzeichen", () => {
  it("behaelt Umlaute und macht sie locale-aware lowercase", () => {
    expect(normalisiereEmpfaenger("Müller-Lüdenscheidt GmbH")).toBe(
      "müller-lüdenscheidt",
    );
  });

  it("behaelt das Eszett (ß)", () => {
    expect(normalisiereEmpfaenger("Straßen-Bau GmbH")).toBe("straßen-bau");
  });

  it("entfernt fuehrende und nachgelagerte Sonderzeichen", () => {
    expect(normalisiereEmpfaenger("---Acme GmbH---")).toBe("acme");
  });

  it("kollabiert Mehrfach-Whitespace", () => {
    expect(normalisiereEmpfaenger("Acme   GmbH    Co.")).toBe("acme");
  });

  it("behaelt Bindestriche im Inneren", () => {
    expect(normalisiereEmpfaenger("E-Commerce-Shop")).toBe("e-commerce-shop");
  });
});

describe("normalisiereEmpfaenger — Kombi: Praefix + Rechtsform + Klammer", () => {
  it("STRIPE*ACME LTD == Acme Ltd. (Berlin) (Spec-Beispiel)", () => {
    const a = normalisiereEmpfaenger("STRIPE*ACME LTD");
    const b = normalisiereEmpfaenger("Acme Ltd. (Berlin)");
    expect(a).toBe("acme");
    expect(b).toBe("acme");
    expect(a).toBe(b);
  });

  it("PADDLE.NET*Acme GmbH (DE) == Acme GmbH", () => {
    expect(normalisiereEmpfaenger("PADDLE.NET*Acme GmbH (DE)")).toBe("acme");
    expect(normalisiereEmpfaenger("Acme GmbH")).toBe("acme");
  });

  it("PAYPAL *Mueller-Lüdenscheidt GmbH (Berlin) entfernt alles drumherum", () => {
    expect(
      normalisiereEmpfaenger("PAYPAL *Mueller-Lüdenscheidt GmbH (Berlin)"),
    ).toBe("mueller-lüdenscheidt");
  });
});

describe("normalisiereEmpfaenger — Edge Cases", () => {
  it("null → leerer String", () => {
    expect(normalisiereEmpfaenger(null)).toBe("");
  });

  it("undefined → leerer String", () => {
    expect(normalisiereEmpfaenger(undefined)).toBe("");
  });

  it("leerer String → leerer String", () => {
    expect(normalisiereEmpfaenger("")).toBe("");
  });

  it("nur Whitespace → leerer String", () => {
    expect(normalisiereEmpfaenger("   ")).toBe("");
    expect(normalisiereEmpfaenger("\t \n")).toBe("");
  });

  it("nur Sonderzeichen → leerer String", () => {
    expect(normalisiereEmpfaenger("***---***")).toBe("");
  });

  it("nur eine Rechtsform → leerer String", () => {
    expect(normalisiereEmpfaenger("GmbH")).toBe("");
  });

  it("sehr lange Strings werden korrekt verarbeitet", () => {
    const lang = "Acme " + "x".repeat(1000) + " GmbH";
    const out = normalisiereEmpfaenger(lang);
    expect(out.startsWith("acme")).toBe(true);
    expect(out.endsWith("x")).toBe(true);
    expect(out.includes("gmbh")).toBe(false);
  });

  it("Nicht-String-Inputs wie number sind defensiv abgefangen", () => {
    // Defensiv: TypeScript verhindert das eigentlich, aber Laufzeit ist robust.
    // @ts-expect-error — defensiver Laufzeit-Test
    expect(normalisiereEmpfaenger(42)).toBe("");
    // @ts-expect-error — defensiver Laufzeit-Test
    expect(normalisiereEmpfaenger({})).toBe("");
  });
});

describe("Reale Daten aus dem Backfill (2026-05-20)", () => {
  // Diese Cases stammen aus dem ersten Dry-Run gegen 425 reale Buchungen.
  // Top-10-Aufkommen + zwei kuratierte Edge-Cases (Klarna, American Express,
  // enercity). Erwartungen wurden vom Inhaber abgesegnet.
  //
  // Offene Entscheidungen / Annahmen:
  // - American Express: Konzern-Marker. "Europe" am Ende ist generisch und
  //   wuerde auch durch Laendercode-/Adress-Logik allein nicht weichen
  //   (kein DE/EU-Token). Daher Verdichtung auf "american express".
  // - Skandia/Strato/Klarna/enercity: aufgenommen in KONZERN_MARKER, weil
  //   nach Rechtsform-/Adress-Entfernung haeufig Branchenklartext
  //   ("Lebensversicherung", "Bank") oder restliche Adress-Reste
  //   uebrig bleiben, die wir aggressiv kuerzen wollen.
  // - "Aktiengesellschaft" als ausgeschriebenes Synonym fuer "AG" jetzt in
  //   der RECHTSFORMEN-Liste.
  it.each([
    [
      "PayPal Europe S.a.r.l. et Cie S.C.A 22-24 Boulevard Royal, 2449 Luxembourg",
      "paypal",
    ],
    ["PayPal (Europe) S.a r.l. et Cie, S.C.A.", "paypal"],
    ["Amazon Payments Europe S.C.A.", "amazon"],
    ["Amazon Payments Europe S.C.A. DE", "amazon"],
    ["Amazon Business EU Sarl", "amazon"],
    ["Amazon Business EU Sarl DE", "amazon"],
    ["Amazon Digital Germany GmbH", "amazon"],
    ["Amazon Digital Germany Gmbh", "amazon"],
    [
      "Skandia Lebensversicherung Aktiengesellschaft Dornhofstr. 36",
      "skandia",
    ],
    ["Strato GmbH Otto-Ostrowski-Strase 7, 10249 Berlin", "strato"],
    ["Klarna Bank AB Sveavagen 46", "klarna"],
    ["American Express Europe", "american express"],
    ["enercity / enercity Aktiengesellschaft Ihmeplatz 2", "enercity"],
  ])("normalisiert %s zu %s", (input, erwartet) => {
    expect(normalisiereEmpfaenger(input)).toBe(erwartet);
  });

  it("ist idempotent fuer alle realen Backfill-Cases", () => {
    const cases = [
      "PayPal Europe S.a.r.l. et Cie S.C.A 22-24 Boulevard Royal, 2449 Luxembourg",
      "PayPal (Europe) S.a r.l. et Cie, S.C.A.",
      "Amazon Payments Europe S.C.A.",
      "Amazon Payments Europe S.C.A. DE",
      "Amazon Business EU Sarl",
      "Amazon Business EU Sarl DE",
      "Amazon Digital Germany GmbH",
      "Amazon Digital Germany Gmbh",
      "Skandia Lebensversicherung Aktiengesellschaft Dornhofstr. 36",
      "Strato GmbH Otto-Ostrowski-Strase 7, 10249 Berlin",
      "Klarna Bank AB Sveavagen 46",
      "American Express Europe",
      "enercity / enercity Aktiengesellschaft Ihmeplatz 2",
    ];
    for (const c of cases) {
      const ein = normalisiereEmpfaenger(c);
      const zwei = normalisiereEmpfaenger(ein);
      expect(zwei).toBe(ein);
    }
  });
});

describe("normalisiereEmpfaenger — Idempotenz", () => {
  it("ist idempotent fuer reale Beispiele", () => {
    const beispiele = [
      "STRIPE*ACME LTD",
      "Acme Ltd. (Berlin)",
      "PAYPAL *NETFLIX",
      "Müller-Lüdenscheidt GmbH",
      "ACME LTD DE",
      "PADDLE.NET*Acme GmbH (DE)",
      "Hans Mueller e.K.",
      "Deutsche Bank AG",
      "Mueller & Schulze GbR",
      "Straßen-Bau GmbH",
    ];
    for (const e of beispiele) {
      const ein = normalisiereEmpfaenger(e);
      const zwei = normalisiereEmpfaenger(ein);
      expect(zwei).toBe(ein);
    }
  });

  it("ist idempotent fuer 10 pseudo-zufaellige Strings", () => {
    // Deterministischer Pseudo-Zufallsgenerator (Mulberry32) — keine
    // Test-Flakiness, aber breite Abdeckung.
    let seed = 0xDEADBEEF;
    const rand = (): number => {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzäöüß0123456789 *.,-()";
    for (let i = 0; i < 10; i++) {
      const len = 5 + Math.floor(rand() * 40);
      let s = "";
      for (let j = 0; j < len; j++) {
        s += alphabet[Math.floor(rand() * alphabet.length)];
      }
      const ein = normalisiereEmpfaenger(s);
      const zwei = normalisiereEmpfaenger(ein);
      expect(zwei).toBe(ein);
    }
  });
});
