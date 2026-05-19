// PROJ-4: Kontoauszug-Parser (Excel/CSV) — reine, testbare Funktionen.
//
// Verantwortung dieses Moduls:
// - Excel (.xlsx) UND CSV via SheetJS (XLSX.read) in eine Zeilen-Matrix lesen
// - Header-Zeile erkennen, Leer-/Summenzeilen ignorieren
// - KontoMapping (Spalte → Feld) anwenden
// - Beträge im DE-Format normalisieren (Tausender/Dezimal, Vorzeichen,
//   Soll/Haben, optionales Invertieren)
// - Datum aus DE-Formaten (TT.MM.JJJJ etc.) nach ISO (JJJJ-MM-TT)
// - stabilen Duplikat-Hash bilden (konto_id|datum|betrag|verwendungszweck)
//
// KEIN DB-/IO-Zugriff hier. Der API-Layer (api/konten/import) verwendet diese
// Funktionen und kümmert sich um Persistenz/Duplikaterkennung gegen die DB.

import * as XLSX from "xlsx";
import type { DatumFormat, KontoMapping } from "@/lib/types";

/** Eine normalisierte Buchungszeile (noch ohne DB-Felder/owner). */
export interface GeparsteBuchung {
  buchung_datum: string; // ISO JJJJ-MM-TT
  betrag: number; // EUR-Cent-genau als Number (2 Nachkommastellen)
  verwendungszweck: string | null;
  empfaenger: string | null;
  waehrung: string;
  duplikat_hash: string;
}

/** Eine Zeile, die nicht verarbeitet werden konnte (mit Begründung). */
export interface FehlerhafteZeile {
  zeile: number; // 1-basierter Index in der Quelldatei (inkl. Header)
  grund: string;
}

export interface ParseErgebnis {
  buchungen: GeparsteBuchung[];
  fehlerhaft: FehlerhafteZeile[];
  /** Erkannte Header-Spaltennamen (für UI-Mapping-Hilfe). */
  spalten: string[];
}

/** Roh-Matrix: Array von Zeilen, jede Zeile Array von Zellwerten als String. */
type RohMatrix = string[][];

/**
 * Liest einen Datei-Buffer (xlsx ODER csv) in eine String-Matrix.
 * SheetJS erkennt CSV/Excel automatisch anhand des Inhalts.
 */
export function leseMatrix(buffer: ArrayBuffer | Uint8Array): RohMatrix {
  const wb = XLSX.read(buffer, { type: "array", raw: false });
  const ersteName = wb.SheetNames[0];
  if (!ersteName) return [];
  const sheet = wb.Sheets[ersteName];
  // header:1 → Array-of-Arrays; defval sorgt für gleichmäßige Spaltenzahl.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });
  return rows.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
}

/** True, wenn die Zeile keine verwertbaren Daten enthält. */
function istLeerzeile(zeile: string[]): boolean {
  return zeile.every((z) => z.trim() === "");
}

/**
 * True, wenn die Zeile eine Summen-/Saldo-Zeile ist.
 * Heuristik: erste nicht-leere Zelle beginnt mit einem typischen Schlüsselwort
 * und die Zeile hat deutlich weniger befüllte Zellen als der Header.
 */
function istSummenzeile(zeile: string[]): boolean {
  const text = zeile
    .find((z) => z.trim() !== "")
    ?.toLowerCase()
    .trim();
  if (!text) return false;
  return (
    text.startsWith("summe") ||
    text.startsWith("saldo") ||
    text.startsWith("zwischensumme") ||
    text.startsWith("gesamt") ||
    text.startsWith("endsaldo") ||
    text.startsWith("anfangssaldo") ||
    text.startsWith("kontostand") ||
    text === "übertrag"
  );
}

/**
 * Findet die Header-Zeile: die erste Zeile, die mindestens zwei der im Mapping
 * referenzierten Spaltennamen enthält. Fallback: erste nicht-leere Zeile.
 */
function findeHeaderIndex(matrix: RohMatrix, mapping: KontoMapping): number {
  const gesucht = new Set(
    [
      mapping.datum,
      mapping.betrag,
      mapping.verwendungszweck,
      mapping.empfaenger,
      mapping.waehrung,
    ]
      .filter((s): s is string => !!s)
      .map((s) => s.toLowerCase().trim()),
  );

  for (let i = 0; i < matrix.length; i++) {
    const zeile = matrix[i];
    if (istLeerzeile(zeile)) continue;
    const treffer = zeile.filter((z) =>
      gesucht.has(z.toLowerCase().trim()),
    ).length;
    if (treffer >= 2 || (gesucht.size === 1 && treffer === 1)) return i;
  }
  // Fallback: erste nicht-leere Zeile
  for (let i = 0; i < matrix.length; i++) {
    if (!istLeerzeile(matrix[i])) return i;
  }
  return -1;
}

/**
 * Normalisiert einen Betrag aus diversen DE/EN-Schreibweisen zu einer Zahl
 * mit 2 Nachkommastellen.
 *
 * Unterstützt:
 * - DE-Format "1.234,56" (Tausenderpunkt, Dezimalkomma)
 * - EN-Format "1,234.56" und "1234.56"
 * - führendes/abschließendes Minus, Klammern "(123,45)" = negativ
 * - Währungssymbole/Buchstaben (€, EUR, USD) werden entfernt
 * - getrenntes Soll/Haben-Kennzeichen (S/H, Soll/Haben, +/-)
 *
 * @returns die normalisierte Zahl oder null, wenn nicht interpretierbar.
 */
export function normalisiereBetrag(
  roh: string,
  sollHaben?: string,
  invertieren = false,
): number | null {
  if (roh == null) return null;
  let s = String(roh).trim();
  if (s === "") return null;

  // Klammern = negativ (buchhalterische Schreibweise)
  let negativDurchKlammer = false;
  if (/^\(.*\)$/.test(s)) {
    negativDurchKlammer = true;
    s = s.slice(1, -1).trim();
  }

  // Vorzeichen merken, bevor Symbole entfernt werden
  const hatMinus = /-/.test(s) || /^minus/i.test(s);

  // Alles außer Ziffern, Punkt, Komma entfernen (Währung, Leerzeichen, Buchstaben)
  s = s.replace(/[^0-9.,]/g, "");
  if (s === "" || s === "." || s === ",") return null;

  const hatKomma = s.includes(",");
  const hatPunkt = s.includes(".");

  if (hatKomma && hatPunkt) {
    // Das zuletzt auftretende Trennzeichen ist das Dezimaltrennzeichen.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // DE: Punkt = Tausender, Komma = Dezimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // EN: Komma = Tausender, Punkt = Dezimal
      s = s.replace(/,/g, "");
    }
  } else if (hatKomma) {
    // Nur Komma vorhanden → Dezimaltrennzeichen DE
    s = s.replace(",", ".");
  }
  // Nur Punkt (oder gar keins): bereits als Dezimalpunkt interpretierbar.

  const zahl = Number(s);
  if (!Number.isFinite(zahl)) return null;

  let betrag = Math.abs(zahl);

  // Vorzeichen aus Soll/Haben-Kennzeichen ableiten
  let negativ = hatMinus || negativDurchKlammer;
  if (sollHaben != null) {
    const sh = String(sollHaben).trim().toLowerCase();
    if (sh === "s" || sh === "soll" || sh === "-" || sh === "debit") {
      negativ = true;
    } else if (sh === "h" || sh === "haben" || sh === "+" || sh === "credit") {
      negativ = false;
    }
  }

  if (negativ) betrag = -betrag;
  if (invertieren) betrag = -betrag;

  // Auf 2 Nachkommastellen runden (Cent-genau, vermeidet Float-Drift)
  return Math.round(betrag * 100) / 100;
}

/**
 * Parst ein Datum aus gängigen Formaten zu ISO (JJJJ-MM-TT).
 *
 * Unterstützt:
 * - DE: TT.MM.JJJJ, T.M.JJJJ, TT.MM.JJ, TT/MM/JJJJ, TT-MM-JJJJ
 * - US: M/D/YY, M/D/YYYY (z. B. MoneyMoney-Export)
 * - ISO: JJJJ-MM-TT (auch JJJJ/MM/TT, JJJJ.MM.TT)
 * - Excel-Serienzahl (Tage seit 1899-12-30)
 *
 * Mit `format`:
 * - "auto" (Default): DE wird bevorzugt; ist DE eindeutig ungültig
 *   (z. B. erster Teil ≤12, zweiter Teil >12), wird US versucht.
 * - "DE" / "US" / "ISO": erzwingt das jeweilige Layout.
 *
 * @returns ISO-String oder null bei unbekanntem/ungültigem Datum.
 */
export function normalisiereDatum(
  roh: string,
  format: DatumFormat = "auto",
): string | null {
  if (roh == null) return null;
  const s = String(roh).trim();
  if (s === "") return null;

  // Bereits ISO?
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return gueltigesDatum(+iso[1], +iso[2], +iso[3]) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }

  // Excel-Serienzahl (rein numerisch, plausibler Bereich 1..60000)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const seriennr = Number(s);
    if (seriennr > 0 && seriennr < 60000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + Math.round(seriennr) * 86400000);
      return formatIso(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
      );
    }
  }

  // Drei numerische Teile, getrennt durch . / -
  const m = s.match(/^(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const c = +m[3];
    const aRaw = m[1];
    const cRaw = m[3];

    // ISO-Layout (4-stelliges Jahr vorne): JJJJ-MM-TT
    if (aRaw.length === 4) {
      if (format === "auto" || format === "ISO") {
        if (gueltigesDatum(a, b, c)) return formatIso(a, b, c);
      }
      return null;
    }

    const jahr = cRaw.length === 2 ? c + (c < 70 ? 2000 : 1900) : c;

    if (format === "DE") {
      return gueltigesDatum(jahr, b, a) ? formatIso(jahr, b, a) : null;
    }
    if (format === "US") {
      return gueltigesDatum(jahr, a, b) ? formatIso(jahr, a, b) : null;
    }

    // auto: DE-Layout bevorzugen. Wenn DE ungültig, aber US gültig → US.
    if (gueltigesDatum(jahr, b, a)) return formatIso(jahr, b, a);
    if (gueltigesDatum(jahr, a, b)) return formatIso(jahr, a, b);
    return null;
  }

  return null;
}

function gueltigesDatum(jahr: number, monat: number, tag: number): boolean {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return false;
  if (jahr < 1900 || jahr > 2200) return false;
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  return (
    d.getUTCFullYear() === jahr &&
    d.getUTCMonth() === monat - 1 &&
    d.getUTCDate() === tag
  );
}

function formatIso(jahr: number, monat: number, tag: number): string {
  const mm = String(monat).padStart(2, "0");
  const tt = String(tag).padStart(2, "0");
  return `${jahr}-${mm}-${tt}`;
}

/**
 * Bildet einen stabilen, deterministischen Duplikat-Hash aus
 * (konto_id | datum | betrag | verwendungszweck).
 *
 * Eigenschaften:
 * - reihenfolge-/whitespace-stabil (Zweck wird getrimmt und auf Kleinbuchstaben
 *   normalisiert, Mehrfach-Whitespace kollabiert)
 * - betrag mit fester Genauigkeit (2 Nachkommastellen) als Schlüssel
 * - reine FNV-1a-Hashfunktion (keine externen Abhängigkeiten)
 */
export function bildeDuplikatHash(
  kontoId: string,
  datumIso: string,
  betrag: number,
  verwendungszweck: string | null,
): string {
  const zweck = (verwendungszweck ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const basis = [
    kontoId,
    datumIso,
    betrag.toFixed(2),
    zweck,
  ].join("|");
  return fnv1a(basis);
}

/** FNV-1a 64-bit (als Hex-String) — schnell, deterministisch, kollisionsarm. */
function fnv1a(str: string): string {
  // 64-bit über zwei 32-bit-Hälften (BigInt-frei für breite Kompatibilität).
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c & 0xff;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (c >>> 8) & 0xff;
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(h1) + hex(h2);
}

function holeSpalte(
  zeile: string[],
  idx: Map<string, number>,
  name: string | undefined,
): string {
  if (!name) return "";
  const i = idx.get(name.toLowerCase().trim());
  if (i == null) return "";
  return zeile[i] ?? "";
}

/**
 * Hauptfunktion: parst einen Datei-Buffer anhand des KontoMapping zu
 * normalisierten Buchungen. Reine Funktion (kein IO).
 *
 * @param buffer xlsx/csv als ArrayBuffer/Uint8Array
 * @param mapping Spalten→Feld-Vorlage des Kontos
 * @param kontoId Konto-ID für den Duplikat-Hash
 */
export function parseKontoauszug(
  buffer: ArrayBuffer | Uint8Array,
  mapping: KontoMapping,
  kontoId: string,
): ParseErgebnis {
  const buchungen: GeparsteBuchung[] = [];
  const fehlerhaft: FehlerhafteZeile[] = [];

  let matrix: RohMatrix;
  try {
    matrix = leseMatrix(buffer);
  } catch {
    return {
      buchungen: [],
      fehlerhaft: [{ zeile: 0, grund: "Datei konnte nicht gelesen werden" }],
      spalten: [],
    };
  }

  if (matrix.length === 0) {
    return { buchungen: [], fehlerhaft: [], spalten: [] };
  }

  const headerIdx = findeHeaderIndex(matrix, mapping);
  if (headerIdx < 0) {
    return {
      buchungen: [],
      fehlerhaft: [{ zeile: 0, grund: "Keine Header-Zeile erkennbar" }],
      spalten: [],
    };
  }

  const header = matrix[headerIdx];
  const spalten = header.filter((h) => h.trim() !== "");
  const spaltenIndex = new Map<string, number>();
  header.forEach((name, i) => {
    const key = name.toLowerCase().trim();
    if (key !== "" && !spaltenIndex.has(key)) spaltenIndex.set(key, i);
  });

  // Pflicht-Spalten müssen im Header existieren, sonst Mapping falsch.
  if (!spaltenIndex.has(mapping.datum.toLowerCase().trim())) {
    return {
      buchungen: [],
      fehlerhaft: [
        {
          zeile: headerIdx + 1,
          grund: `Datums-Spalte "${mapping.datum}" nicht in Datei gefunden`,
        },
      ],
      spalten,
    };
  }
  if (!spaltenIndex.has(mapping.betrag.toLowerCase().trim())) {
    return {
      buchungen: [],
      fehlerhaft: [
        {
          zeile: headerIdx + 1,
          grund: `Betrags-Spalte "${mapping.betrag}" nicht in Datei gefunden`,
        },
      ],
      spalten,
    };
  }

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const zeile = matrix[i];
    const zeilenNr = i + 1; // 1-basiert für Nutzer-Anzeige

    if (istLeerzeile(zeile)) continue;
    if (istSummenzeile(zeile)) continue;

    const rohDatum = holeSpalte(zeile, spaltenIndex, mapping.datum);
    const rohBetrag = holeSpalte(zeile, spaltenIndex, mapping.betrag);

    if (rohDatum.trim() === "" && rohBetrag.trim() === "") continue;

    const datum = normalisiereDatum(rohDatum, mapping.datum_format ?? "auto");
    if (!datum) {
      fehlerhaft.push({
        zeile: zeilenNr,
        grund: `Datum nicht interpretierbar: "${rohDatum}"`,
      });
      continue;
    }

    // Soll/Haben kann implizit über das Betragsvorzeichen kommen.
    const betrag = normalisiereBetrag(
      rohBetrag,
      undefined,
      mapping.betrag_vorzeichen_invertieren ?? false,
    );
    if (betrag === null) {
      fehlerhaft.push({
        zeile: zeilenNr,
        grund: `Betrag nicht interpretierbar: "${rohBetrag}"`,
      });
      continue;
    }

    const zweckRoh = holeSpalte(
      zeile,
      spaltenIndex,
      mapping.verwendungszweck,
    ).trim();
    const empfRoh = holeSpalte(zeile, spaltenIndex, mapping.empfaenger).trim();
    const waehrungRoh = holeSpalte(zeile, spaltenIndex, mapping.waehrung)
      .trim()
      .toUpperCase();

    const verwendungszweck = zweckRoh === "" ? null : zweckRoh;
    const empfaenger = empfRoh === "" ? null : empfRoh;
    const waehrung = waehrungRoh === "" ? "EUR" : waehrungRoh;

    buchungen.push({
      buchung_datum: datum,
      betrag,
      verwendungszweck,
      empfaenger,
      waehrung,
      duplikat_hash: bildeDuplikatHash(
        kontoId,
        datum,
        betrag,
        verwendungszweck,
      ),
    });
  }

  return { buchungen, fehlerhaft, spalten };
}
