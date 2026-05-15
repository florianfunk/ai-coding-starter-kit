// PROJ-11: CSV-/DATEV-ähnlicher Buchungsexport + ELSTER-Kennzahl-Export.
//
// REINE Funktionen — keine DB, keine Next-Abhängigkeit, voll testbar.
//
// Definiertes Schema & Encoding für Kanzleisoftware-Import:
// - Trennzeichen: Semikolon (DATEV/„deutsches CSV"-Konvention; Excel-DE
//   öffnet so ohne Spaltenzerfall, da Komma im Dezimaltrenner steckt).
// - Zeilenende: CRLF (Windows/DATEV-Erwartung).
// - Encoding-Marker: UTF-8-BOM, damit Umlaute in Excel/DATEV korrekt sind.
// - Beträge: deutsches Format mit Komma als Dezimaltrennzeichen, 2 Stellen,
//   ohne Tausenderpunkt (maschinenlesbar & DE-kompatibel).
// - Quoting: RFC-4180-ähnlich — ein Feld wird in doppelte Anführungszeichen
//   gesetzt, sobald es das Trennzeichen, ein Anführungszeichen oder einen
//   Zeilenumbruch enthält; enthaltene Anführungszeichen werden verdoppelt.

/** Konfiguriertes Export-Format (zentral, damit reproduzierbar). */
export const CSV_TRENNZEICHEN = ";";
export const CSV_ZEILENENDE = "\r\n";
/** UTF-8 Byte Order Mark — signalisiert Excel/DATEV die Kodierung. */
export const UTF8_BOM = "﻿";

/** Soll/Haben-Kennzeichen im DATEV-Sinn (S = Soll, H = Haben). */
export type SollHaben = "S" | "H";

/**
 * Ein normalisierter Buchungssatz für den Export. Bewusst entkoppelt vom
 * DB-Typ, damit Schema & Reihenfolge hier verbindlich definiert sind.
 */
export interface BuchungsExportZeile {
  /** ISO-Datum yyyy-mm-dd (wird zu TT.MM.JJJJ formatiert). */
  datum: string;
  /** Betrag in Euro, vorzeichenbehaftet (> 0 Einnahme, < 0 Ausgabe). */
  betrag: number;
  /** Kategorie-/Kontobezeichnung (EÜR-Konto). */
  konto: string;
  /** Gegenkonto (z. B. Bankkonto-Bezeichnung). */
  gegenkonto: string;
  /** USt-Satz in Prozent (0 | 7 | 19) oder null. */
  ust_satz: number | null;
  /** Beleg-Referenz(en), bereits zu einem String zusammengefasst. */
  beleg_referenz: string;
  /** Buchungstext (Verwendungszweck/Empfänger). */
  buchungstext: string;
}

/** Spaltenüberschriften — verbindliche Reihenfolge des Exportschemas. */
export const BUCHUNG_CSV_SPALTEN = [
  "Datum",
  "Betrag",
  "Soll/Haben",
  "Konto",
  "Gegenkonto",
  "USt-Satz",
  "Beleg-Referenz",
  "Buchungstext",
] as const;

/** Eine ELSTER-Kennzahl-Zeile (Feldnummer → Wert) für den Übertrag. */
export interface ElsterKennzahlZeile {
  /** ELSTER-Kennzahl, z. B. "81". */
  kennzahl: string;
  /** Klartext-Bezeichnung. */
  bezeichnung: string;
  /** Bemessungsgrundlage bzw. Betrag in Euro. */
  betrag: number;
  /** Steuerbetrag in Euro, sofern für die Kennzahl relevant, sonst null. */
  steuer: number | null;
}

export const ELSTER_CSV_SPALTEN = [
  "Kennzahl",
  "Bezeichnung",
  "Betrag",
  "Steuer",
] as const;

/**
 * Quoting nach RFC-4180-Logik. `null`/`undefined` → leeres Feld (ohne
 * Quotes), damit leere Werte nicht als `""` erscheinen.
 */
export function csvFeld(wert: string | null | undefined): string {
  if (wert === null || wert === undefined || wert === "") return "";
  const muss =
    wert.includes(CSV_TRENNZEICHEN) ||
    wert.includes('"') ||
    wert.includes("\n") ||
    wert.includes("\r");
  if (!muss) return wert;
  return `"${wert.replace(/"/g, '""')}"`;
}

/** Deutsches Betragsformat: 1234.5 → "1234,50" (kein Tausenderpunkt). */
export function formatBetragDe(betrag: number): string {
  // Cent-genau runden, um Float-Artefakte (z. B. 0.1+0.2) zu vermeiden.
  const sign = betrag < 0 ? "-" : "";
  const cent = Math.round(Math.abs(betrag) * 100);
  const euro = Math.floor(cent / 100);
  const rest = String(cent % 100).padStart(2, "0");
  return `${sign}${euro},${rest}`;
}

/** ISO yyyy-mm-dd → TT.MM.JJJJ. Ungültig/leer → unverändert/"". */
export function formatDatumDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** USt-Satz → Anzeige ("19 %", "" wenn null). */
function formatUstSatz(satz: number | null): string {
  if (satz === null || satz === undefined) return "";
  return `${satz} %`;
}

/** Baut eine CSV-Zeile aus bereits stringifizierten Feldern. */
function csvZeile(felder: ReadonlyArray<string | null | undefined>): string {
  return felder.map(csvFeld).join(CSV_TRENNZEICHEN);
}

/**
 * Erzeugt den Buchungsexport (CSV/DATEV-ähnlich) als String inkl. BOM.
 * Reihenfolge der Zeilen wird NICHT verändert (Aufrufer sortiert).
 */
export function buchungenAlsCsv(zeilen: BuchungsExportZeile[]): string {
  const kopf = csvZeile([...BUCHUNG_CSV_SPALTEN]);
  const body = zeilen.map((z) =>
    csvZeile([
      formatDatumDe(z.datum),
      formatBetragDe(z.betrag),
      z.betrag < 0 ? "H" : "S",
      z.konto,
      z.gegenkonto,
      formatUstSatz(z.ust_satz),
      z.beleg_referenz,
      z.buchungstext,
    ]),
  );
  return UTF8_BOM + [kopf, ...body].join(CSV_ZEILENENDE) + CSV_ZEILENENDE;
}

/**
 * Erzeugt den ELSTER-Kennzahl-Export (Feldnummer → Wert) als CSV inkl. BOM.
 * Leerer Steuerbetrag bleibt leer (statt "0,00"), um „nicht relevant" von
 * „null Euro" zu unterscheiden.
 */
export function elsterKennzahlenAlsCsv(zeilen: ElsterKennzahlZeile[]): string {
  const kopf = csvZeile([...ELSTER_CSV_SPALTEN]);
  const body = zeilen.map((z) =>
    csvZeile([
      z.kennzahl,
      z.bezeichnung,
      formatBetragDe(z.betrag),
      z.steuer === null || z.steuer === undefined
        ? ""
        : formatBetragDe(z.steuer),
    ]),
  );
  return UTF8_BOM + [kopf, ...body].join(CSV_ZEILENENDE) + CSV_ZEILENENDE;
}
