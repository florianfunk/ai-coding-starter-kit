// PROJ-10: Einkommensteuer-Vorschau — REINE deterministische Schätzung.
//
// Keine KI. Tarif nach §32a EStG, jahresabhängig aus `est_tarif`-Stammdaten
// (Grundfreibetrag, Progressionszonen, Soli-Satz/-Freigrenze). Die Zonen sind
// als gestaffelte Polynome 2. Grades modelliert — exakt die amtliche
// §32a-Struktur:
//
//   Zone 1 (Grundfreibetrag):  ESt = 0
//   Zone 2/3 (Progression):    ESt = (a*y + b) * y          mit y = (zvE - u)/10000
//   Zone 4/5 (Proportional):   ESt = m * zvE - c            (linearer Spitzensatz)
//
// Splitting-Verfahren (Zusammenveranlagung): Tarif auf das halbe zvE anwenden,
// Ergebnis verdoppeln (§32a Abs.5 EStG). Negatives zvE → Steuer 0.
//
// Cent-genaue, reproduzierbare Berechnung. Der amtliche Tarif rundet das zvE
// vor Anwendung auf volle Euro ab (§32a Abs.1 Satz 5 EStG) — das bilden wir ab.

/** Eine Tarifzone des §32a-Tarifs (gestaffelt, ISO-serialisierbar). */
export interface EstTarifZone {
  /** Untergrenze des zvE-Bereichs in EUR (inklusiv). */
  ab: number;
  /**
   * Berechnungsart innerhalb der Zone:
   * - "null": keine Steuer (Grundfreibetrag-Zone)
   * - "progression": ESt = (a * y + b) * y + d, y = (zvE - basis) / 10000
   * - "linear": ESt = m * zvE - c
   */
  art: "null" | "progression" | "linear";
  /** Progression: Koeffizient a (quadratischer Term). */
  a?: number;
  /** Progression: Koeffizient b (linearer Term). */
  b?: number;
  /** Progression: konstanter Sockel d (EUR, kumuliert aus Vorzonen). */
  d?: number;
  /** Progression: Bezugsgröße (zvE - basis) für y. */
  basis?: number;
  /** Linear: Grenzsteuersatz m (z. B. 0.42 / 0.45). */
  m?: number;
  /** Linear: Abzugskonstante c (EUR). */
  c?: number;
}

/** Vollständige ESt-Tarif-Stammdaten eines Jahres. */
export interface EstTarif {
  jahr: number;
  /** Grundfreibetrag in EUR (steuerfrei). */
  grundfreibetrag: number;
  /** Aufsteigend nach `ab` sortierte Progressions-/Proportionalzonen. */
  zonen: EstTarifZone[];
  /** Solidaritätszuschlag-Satz (z. B. 0.055). */
  soli_satz: number;
  /**
   * Soli-Freigrenze auf die festgesetzte ESt. Bis zu dieser Bemessungs-ESt
   * fällt kein Soli an (Einzelveranlagung; bei Zusammenveranlagung verdoppelt).
   */
  soli_freigrenze: number;
}

export type Veranlagung = "einzel" | "zusammen";

/** Eingabeparameter der ESt-Schätzung (bereits validiert/normalisiert). */
export interface EstEingabe {
  /** Veranlagungszeitraum (Jahr). */
  jahr: number;
  /** EÜR-Gewinn des Jahres (kann negativ = Verlust sein). */
  euer_gewinn: number;
  /** Grobe weitere Einkünfte (z. B. nichtselbstständig); >= 0. */
  weitere_einkuenfte: number;
  /** Geleistete ESt-Vorauszahlungen; >= 0. */
  vorauszahlungen: number;
  veranlagung: Veranlagung;
  /** Optionaler Klartext für den Fallback-Hinweis (z. B. "2026"). */
  jahrFallbackInfo?: string;
}

/** Vollständiges, deterministisches Schätzergebnis. */
export interface EstErgebnis {
  jahr: number;
  veranlagung: Veranlagung;
  /** Verwendeter Tarif kam aus DB-Stammdaten (false = Fallback-Seed). */
  tarif_aus_db: boolean;
  /** Zu versteuerndes Einkommen vor Abrundung (EÜR-Gewinn + weitere). */
  zu_versteuerndes_einkommen: number;
  /** zvE nach amtlicher Abrundung auf volle Euro (Bemessungsgrundlage). */
  bemessungsgrundlage: number;
  /** Geschätzte tarifliche Einkommensteuer (amtlich auf volle Euro abgerundet). */
  einkommensteuer: number;
  /** Geschätzter Solidaritätszuschlag (cent-genau). */
  soli: number;
  /** ESt + Soli. */
  gesamtbelastung: number;
  /** Effektiver Steuersatz bezogen auf das zvE (0..1), 0 wenn zvE <= 0. */
  effektiver_steuersatz: number;
  /** Grenzsteuersatz am zvE (0..1), 0 in der Nullzone. */
  grenzsteuersatz: number;
  /** Geleistete Vorauszahlungen. */
  vorauszahlungen: number;
  /**
   * Voraussichtliche Abschlusszahlung (positiv) bzw. Erstattung (negativ):
   * Gesamtbelastung − Vorauszahlungen.
   */
  abschlusszahlung: number;
  /** Nicht-verbindlicher Hinweis (z. B. Verlust, Fallback-Tarif). */
  hinweise: string[];
}

/**
 * Cent-genaue kaufmännische Rundung.
 *
 * Eigenständige lokale Hilfsfunktion (KEIN Import aus euer.ts, um
 * Race-Conditions mit der parallelen Implementierung zu vermeiden — identische
 * Semantik wie dort: symmetrisch, halbe Cent vom Nullpunkt weg).
 */
export function rundeCent(betrag: number): number {
  const sign = betrag < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(betrag) * 100 + Number.EPSILON)) / 100;
}

/**
 * Amtliche Abrundung des zu versteuernden Einkommens auf volle Euro
 * (§32a Abs.1 Satz 5 EStG). Negatives zvE → 0.
 */
function abrundenZvE(zve: number): number {
  if (zve <= 0) return 0;
  return Math.floor(zve);
}

/** Findet die für ein zvE maßgebliche Tarifzone (höchste passende `ab`). */
function findeZone(tarif: EstTarif, zve: number): EstTarifZone {
  let treffer = tarif.zonen[0];
  for (const z of tarif.zonen) {
    if (zve >= z.ab) treffer = z;
    else break;
  }
  return treffer;
}

/**
 * Tarifliche ESt für ein (bereits abgerundetes) Einzel-zvE nach §32a.
 * Liefert den Formelwert; die gesetzliche Euro-Abrundung erfolgt am Aufrufer.
 */
function tariflicheEstEinzel(tarif: EstTarif, zve: number): number {
  if (zve <= tarif.grundfreibetrag) return 0;
  const z = findeZone(tarif, zve);
  if (z.art === "null") return 0;
  if (z.art === "linear") {
    const m = z.m ?? 0;
    const c = z.c ?? 0;
    return Math.max(0, m * zve - c);
  }
  // Progression: (a * y + b) * y + d, y = (zve - basis) / 10000.
  const a = z.a ?? 0;
  const b = z.b ?? 0;
  const d = z.d ?? 0;
  const basis = z.basis ?? tarif.grundfreibetrag;
  const y = (zve - basis) / 10000;
  return Math.max(0, (a * y + b) * y + d);
}

/**
 * Grenzsteuersatz (Ableitung des Tarifs) an einem Einzel-zvE.
 * Progression: dE/dzvE = (2a*y + b) / 10000. Linear: m. Null: 0.
 */
function grenzsatzEinzel(tarif: EstTarif, zve: number): number {
  if (zve <= tarif.grundfreibetrag) return 0;
  const z = findeZone(tarif, zve);
  if (z.art === "null") return 0;
  if (z.art === "linear") return z.m ?? 0;
  const a = z.a ?? 0;
  const b = z.b ?? 0;
  const basis = z.basis ?? tarif.grundfreibetrag;
  const y = (zve - basis) / 10000;
  return (2 * a * y + b) / 10000;
}

/**
 * Solidaritätszuschlag mit Freigrenze und Milderungszone (§4 SolzG).
 *
 * - Bis zur Freigrenze (Einzel; bei Zusammenveranlagung verdoppelt): 0.
 * - Darüber: max. soli_satz * ESt, jedoch gemildert auf 11,9 % des
 *   Betrags, um den die ESt die Freigrenze übersteigt (gesetzliche
 *   Milderungszone, verhindert Sprung an der Grenze).
 */
function berechneSoli(
  tarif: EstTarif,
  estGesamt: number,
  veranlagung: Veranlagung,
): number {
  const freigrenze =
    veranlagung === "zusammen"
      ? tarif.soli_freigrenze * 2
      : tarif.soli_freigrenze;
  if (estGesamt <= freigrenze) return 0;
  const voll = tarif.soli_satz * estGesamt;
  const gemildert = 0.119 * (estGesamt - freigrenze);
  return Math.max(0, Math.min(voll, gemildert));
}

/**
 * Berechnet die ESt-Schätzung deterministisch.
 *
 * @param tarif       Tarif-Stammdaten des Jahres (DB oder Seed-Fallback).
 * @param eingabe     Bereits validierte Eingabeparameter.
 * @param tarifAusDb  true = Tarif kam aus `est_tarif`; false = Seed-Fallback.
 */
export function berechneEst(
  tarif: EstTarif,
  eingabe: EstEingabe,
  tarifAusDb: boolean,
): EstErgebnis {
  const hinweise: string[] = [];

  const zve = rundeCent(eingabe.euer_gewinn + eingabe.weitere_einkuenfte);
  if (eingabe.euer_gewinn < 0) {
    hinweise.push(
      "Der EÜR-Gewinn ist negativ (Verlust). Eine etwaige Verlust-" +
        "berücksichtigung (Verlustvor-/rücktrag) ist hier nicht abgebildet — " +
        "bitte steuerlich prüfen lassen.",
    );
  }
  if (!tarifAusDb) {
    hinweise.push(
      `Für ${eingabe.jahrFallbackInfo ?? "dieses Jahr"} ist kein gepflegter ` +
        "ESt-Tarif hinterlegt. Es wird der zuletzt bekannte Standardtarif " +
        `(${tarif.jahr}) verwendet — die Schätzung kann dadurch abweichen.`,
    );
  }

  const bemessung = abrundenZvE(zve);

  let est: number;
  let grenz: number;
  if (eingabe.veranlagung === "zusammen") {
    // Splitting: Tarif auf halbes zvE, Ergebnis x2 (§32a Abs.5 EStG).
    const halb = abrundenZvE(bemessung / 2);
    est = Math.floor(tariflicheEstEinzel(tarif, halb)) * 2;
    grenz = grenzsatzEinzel(tarif, halb);
  } else {
    est = Math.floor(tariflicheEstEinzel(tarif, bemessung));
    grenz = grenzsatzEinzel(tarif, bemessung);
  }
  const estGerundet = est;
  const soli = rundeCent(
    berechneSoli(tarif, estGerundet, eingabe.veranlagung),
  );
  const gesamt = rundeCent(estGerundet + soli);

  const effektiv = bemessung > 0 ? estGerundet / bemessung : 0;
  const abschluss = rundeCent(gesamt - eingabe.vorauszahlungen);

  return {
    jahr: eingabe.jahr,
    veranlagung: eingabe.veranlagung,
    tarif_aus_db: tarifAusDb,
    zu_versteuerndes_einkommen: zve,
    bemessungsgrundlage: bemessung,
    einkommensteuer: estGerundet,
    soli,
    gesamtbelastung: gesamt,
    effektiver_steuersatz: effektiv,
    grenzsteuersatz: grenz,
    vorauszahlungen: eingabe.vorauszahlungen,
    abschlusszahlung: abschluss,
    hinweise,
  };
}

// --- Seed-Stammdaten (Fallback, falls kein est_tarif in DB) --------------
//
// Quelle: §32a EStG i. d. F. für die jeweiligen Veranlagungszeiträume
// (amtliche Tarifformeln). Die Progressionszonen werden als (a*y+b)*y+d
// modelliert. Werte vollständig deterministisch, keine Schätzung im Tarif
// selbst — nur die Anwendung auf einen geschätzten Gewinn ist „Vorschau".

/** §32a-Tarif 2024 (Grundfreibetrag 11.604 €). */
const TARIF_2024: EstTarif = {
  jahr: 2024,
  grundfreibetrag: 11604,
  soli_satz: 0.055,
  soli_freigrenze: 18130,
  zonen: [
    { ab: 0, art: "null" },
    // Zone 2: 11.605 – 17.005 €  (y = (zvE - 11604)/10000)
    { ab: 11605, art: "progression", a: 922.98, b: 1400, d: 0, basis: 11604 },
    // Zone 3: 17.006 – 66.760 €  (y = (zvE - 17005)/10000), Sockel ESt(17005)
    {
      ab: 17006,
      art: "progression",
      a: 181.19,
      b: 2397,
      d: 1025.38,
      basis: 17005,
    },
    // Zone 4: 66.761 – 277.825 €  (42 %, c = 10602.13)
    { ab: 66761, art: "linear", m: 0.42, c: 10602.13 },
    // Zone 5: ab 277.826 €  (45 %, c = 18936.88)
    { ab: 277826, art: "linear", m: 0.45, c: 18936.88 },
  ],
};

/** §32a-Tarif 2025 (Grundfreibetrag 12.096 €). */
const TARIF_2025: EstTarif = {
  jahr: 2025,
  grundfreibetrag: 12096,
  soli_satz: 0.055,
  soli_freigrenze: 19950,
  zonen: [
    { ab: 0, art: "null" },
    // Zone 2: 12.097 – 17.443 €
    { ab: 12097, art: "progression", a: 932.3, b: 1400, d: 0, basis: 12096 },
    // Zone 3: 17.444 – 68.480 €  (Sockel ESt(17443))
    {
      ab: 17444,
      art: "progression",
      a: 176.64,
      b: 2397,
      d: 1015.13,
      basis: 17443,
    },
    // Zone 4: 68.481 – 277.825 €  (42 %, c = 10911.92)
    { ab: 68481, art: "linear", m: 0.42, c: 10911.92 },
    // Zone 5: ab 277.826 €  (45 %, c = 19246.67)
    { ab: 277826, art: "linear", m: 0.45, c: 19246.67 },
  ],
};

/** §32a-Tarif 2026 (Grundfreibetrag 12.348 €). */
const TARIF_2026: EstTarif = {
  jahr: 2026,
  grundfreibetrag: 12348,
  soli_satz: 0.055,
  soli_freigrenze: 20350,
  zonen: [
    { ab: 0, art: "null" },
    // Zone 2: 12.349 – 17.799 €
    { ab: 12349, art: "progression", a: 914.51, b: 1400, d: 0, basis: 12348 },
    // Zone 3: 17.800 – 69.878 €
    {
      ab: 17800,
      art: "progression",
      a: 173.1,
      b: 2397,
      d: 1034.87,
      basis: 17799,
    },
    // Zone 4: 69.879 – 277.825 €
    { ab: 69879, art: "linear", m: 0.42, c: 11135.63 },
    // Zone 5: ab 277.826 €
    { ab: 277826, art: "linear", m: 0.45, c: 19470.38 },
  ],
};

/** Alle hinterlegten Seed-Tarife, jahresweise. */
const SEED_TARIFE: Readonly<Record<number, EstTarif>> = {
  2024: TARIF_2024,
  2025: TARIF_2025,
  2026: TARIF_2026,
};

/**
 * Liefert den Seed-Tarif zu einem Jahr (exakt, falls vorhanden) bzw. den
 * zuletzt bekannten Tarif als Fallback.
 *
 * @returns `{ tarif, exakt }` — `exakt=false` signalisiert Fallback.
 */
export function seedTarif(jahr: number): { tarif: EstTarif; exakt: boolean } {
  const exakt = SEED_TARIFE[jahr];
  if (exakt) return { tarif: exakt, exakt: true };
  // Zuletzt bekanntes Jahr <= angefragtem Jahr, sonst ältester bekannter.
  const jahre = Object.keys(SEED_TARIFE)
    .map(Number)
    .sort((x, y) => x - y);
  const kleinerGleich = jahre.filter((j) => j <= jahr);
  const gewaehlt =
    kleinerGleich.length > 0
      ? kleinerGleich[kleinerGleich.length - 1]
      : jahre[0];
  return { tarif: SEED_TARIFE[gewaehlt], exakt: false };
}
