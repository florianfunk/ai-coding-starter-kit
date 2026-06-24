// PROJ-34: Reine Helfer für die Command-Palette-Volltextsuche.
//
// Hier liegt alles, was OHNE DB testbar ist:
//   - Eingabe-Normalisierung (trim, Längen-Gate)
//   - Betrag-Erkennung (ist die Eingabe eine Zahl? → exakte Betrag-Suche)
//   - ILIKE-Pattern-Bau (Wildcard-Escaping → keine Injection über % / _)
//   - Mapping DB-Row → Ergebnis-DTO
//
// Die eigentliche DB-Query lebt in der Route (src/app/api/suche/route.ts),
// damit dieser Modul-Teil reiner, schnell testbarer Code bleibt.

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Mindest-Querylänge: darunter keine (teure) Suche. */
export const MIN_QUERY_LEN = 2;

/** Top-N je Gruppe (Buchungen / Empfänger). */
export const SUCHE_LIMIT = 8;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface SucheBuchungDTO {
  id: string;
  buchung_datum: string;
  betrag: number;
  empfaenger: string | null;
  verwendungszweck: string | null;
}

export interface SucheEmpfaengerDTO {
  /** Anzeigename (Rohwert, falls vorhanden, sonst normalisierter Wert). */
  name: string;
  /** Normalisierter Wert — für die gefilterte Sprungansicht. */
  normalisiert: string;
  /** Anzahl Buchungen mit diesem Empfänger im geladenen Fenster. */
  anzahl: number;
}

export interface SucheResponse {
  buchungen: SucheBuchungDTO[];
  empfaenger: SucheEmpfaengerDTO[];
}

// ---------------------------------------------------------------------------
// Eingabe-Normalisierung
// ---------------------------------------------------------------------------

/** Trimmt die Eingabe und kappt überlange Strings (DoS-Schutz). */
export function normalisiereQuery(roh: string | null | undefined): string {
  return (roh ?? "").trim().slice(0, 100);
}

/** Querylänge ausreichend für eine Suche? */
export function istSuchbar(q: string): boolean {
  return q.length >= MIN_QUERY_LEN;
}

// ---------------------------------------------------------------------------
// Betrag-Erkennung
// ---------------------------------------------------------------------------

/**
 * Erkennt, ob die Eingabe als Betrag gemeint ist, und liefert den Zahlwert.
 * Akzeptiert deutsche (1.234,56) und englische (1234.56) Schreibweise sowie
 * einfache Dezimalzahlen. Liefert null, wenn es keine reine Zahl ist.
 *
 * Wir suchen sowohl auf den positiven als auch den negativen Betrag, weil
 * Ausgaben negativ gespeichert sind — der Nutzer tippt aber meist "12,90".
 */
export function erkenneBetrag(q: string): number | null {
  const s = q.trim();
  if (s.length === 0) return null;

  // Nur Ziffern, Trenner, Vorzeichen erlaubt — sonst ist es Text.
  if (!/^-?[\d.,]+$/.test(s)) return null;

  let normalized = s;
  const hatKomma = s.includes(",");
  const hatPunkt = s.includes(".");

  if (hatKomma && hatPunkt) {
    // Letztes Trennzeichen entscheidet über den Dezimaltrenner.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // Deutsch: Punkt = Tausender, Komma = Dezimal.
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Englisch: Komma = Tausender, Punkt = Dezimal.
      normalized = s.replace(/,/g, "");
    }
  } else if (hatKomma) {
    // Nur Komma → Dezimaltrenner.
    normalized = s.replace(",", ".");
  }
  // Nur Punkt → bereits gültig (kann Dezimal sein); mehrfache Punkte als
  // Tausendertrenner würden hier zu NaN führen → fängt der isFinite-Check ab.

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// ILIKE-Pattern
// ---------------------------------------------------------------------------

/**
 * Escapt LIKE-Sonderzeichen (% _ \) in der Eingabe, sodass der Nutzer keine
 * Wildcards einschleusen kann, und packt %…% drumherum. Der Supabase-Client
 * parametrisiert den Wert selbst (keine SQL-Injection) — dieses Escaping
 * verhindert nur, dass z. B. "%" als "alles matchen" interpretiert wird.
 */
export function ilikePattern(q: string): string {
  const escaped = q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

// ---------------------------------------------------------------------------
// Mapping DB → DTO
// ---------------------------------------------------------------------------

export interface BuchungRow {
  id: string;
  buchung_datum: string;
  betrag: number | string | null;
  empfaenger: string | null;
  verwendungszweck: string | null;
}

/** Mappt eine rohe Buchungs-Row auf das schlanke Such-DTO. */
export function mapeBuchung(row: BuchungRow): SucheBuchungDTO {
  const betrag =
    typeof row.betrag === "number" ? row.betrag : Number(row.betrag ?? 0);
  return {
    id: row.id,
    buchung_datum: row.buchung_datum,
    betrag: Number.isFinite(betrag) ? betrag : 0,
    empfaenger: row.empfaenger ?? null,
    verwendungszweck: row.verwendungszweck ?? null,
  };
}

export interface EmpfaengerRow {
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
}

/**
 * Aggregiert Empfänger-Rows zu distinct Empfängern (nach
 * empfaenger_normalisiert), zählt die Treffer und nimmt den ersten nicht-leeren
 * Rohwert als Anzeigenamen. Liefert nach Häufigkeit absteigend, gekappt auf
 * `limit`. Rows ohne normalisierten Wert werden übersprungen.
 */
export function aggregiereEmpfaenger(
  rows: ReadonlyArray<EmpfaengerRow>,
  limit: number = SUCHE_LIMIT,
): SucheEmpfaengerDTO[] {
  const map = new Map<string, SucheEmpfaengerDTO>();
  for (const r of rows) {
    const norm = (r.empfaenger_normalisiert ?? "").trim();
    if (norm.length === 0) continue;
    const vorhanden = map.get(norm);
    if (vorhanden) {
      vorhanden.anzahl += 1;
      if (!vorhanden.name && r.empfaenger) vorhanden.name = r.empfaenger;
    } else {
      map.set(norm, {
        name: (r.empfaenger ?? "").trim() || norm,
        normalisiert: norm,
        anzahl: 1,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de-DE"))
    .slice(0, limit);
}

/** Leere Antwort (für q<2 Zeichen oder fehlende Treffer). */
export function leereAntwort(): SucheResponse {
  return { buchungen: [], empfaenger: [] };
}
