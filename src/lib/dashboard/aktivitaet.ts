// PROJ-27 (AC3): Aktivitäts-Feed "Was ist passiert?".
//
// Verdichtet die letzten audit_eintrag- und job_lauf-Einträge zu einer
// normalisierten, chronologisch absteigenden Liste für die UI.
//
// Geteilt in:
//   - baueAktivitaet(...)  REINE Mapping-/Merge-Logik (voll testbar)
//   - ladeAktivitaet(...)  DB-Load (owner-scoped, ruft baueAktivitaet)

import type { SupabaseClient } from "@supabase/supabase-js";

/** Grobe Kategorie eines Feed-Eintrags (für Icon/Filter in der UI). */
export type AktivitaetsArt =
  | "klassifizierung"
  | "sync"
  | "import"
  | "abschluss"
  | "sonstiges";

/** Normalisierter Feed-Eintrag. */
export interface AktivitaetsEintrag {
  /** Stabile ID (audit:<id> bzw. job:<id>). */
  id: string;
  art: AktivitaetsArt;
  /** Deutscher Titel für die Anzeige. */
  titel: string;
  /** ISO-Zeitstempel (created_at). */
  zeitpunkt: string;
}

/** Roh-Auszug eines audit_eintrag. */
export interface AuditRow {
  id: string;
  entitaet: string;
  aktion: string;
  created_at: string;
}

/** Roh-Auszug eines job_lauf. */
export interface JobRow {
  id: string;
  art: "paperless_sync" | "konto_import";
  status: "laeuft" | "fertig" | "fehler";
  created_at: string;
}

const FEED_LIMIT = 20;

/** Audit-aktion → (Art, Titel). Default: sonstiges. */
function mappeAudit(row: AuditRow): { art: AktivitaetsArt; titel: string } {
  switch (row.aktion) {
    case "klassifiziert":
      return { art: "klassifizierung", titel: "Buchung klassifiziert" };
    case "chat_umbuchen":
      return { art: "klassifizierung", titel: "Buchung im Chat umgebucht" };
    case "manuell_aufgeteilt":
      return { art: "klassifizierung", titel: "Buchung manuell aufgeteilt" };
    case "regel_aufgeteilt":
      return { art: "klassifizierung", titel: "Buchung per Regel aufgeteilt" };
    case "konsistenz_pass":
      return { art: "klassifizierung", titel: "Konsistenz-Pass ausgeführt" };
    case "lege_kategorie_an":
      return { art: "sonstiges", titel: "Kategorie angelegt" };
    case "kenntnis_aktualisiert":
      return { art: "sonstiges", titel: "Empfänger-Wissen aktualisiert" };
    case "buchungen_reset":
      return { art: "sonstiges", titel: "Buchungen zurückgesetzt" };
    case "belege_reset":
      return { art: "sonstiges", titel: "Belege zurückgesetzt" };
    case "alles_loeschen":
      return { art: "sonstiges", titel: "Alle Daten gelöscht" };
    case "explodiere_alles":
      return { art: "sonstiges", titel: "Daten neu aufgebaut" };
    default:
      return { art: "sonstiges", titel: `Aktion: ${row.aktion}` };
  }
}

/** job_lauf art/status → (Art, Titel). */
function mappeJob(row: JobRow): { art: AktivitaetsArt; titel: string } {
  const istImport = row.art === "konto_import";
  const art: AktivitaetsArt = istImport ? "import" : "sync";
  const name = istImport ? "Kontoauszug-Import" : "Paperless-Sync";
  switch (row.status) {
    case "laeuft":
      return { art, titel: `${name} läuft` };
    case "fertig":
      return { art, titel: `${name} abgeschlossen` };
    case "fehler":
      return { art, titel: `${name} fehlgeschlagen` };
    default:
      return { art, titel: name };
  }
}

/**
 * Reine Merge-/Mapping-Funktion: vereint Audit- und Job-Einträge zu einem
 * chronologisch absteigenden Feed (neueste zuerst), limitiert auf 20.
 */
export function baueAktivitaet(
  auditRows: readonly AuditRow[],
  jobRows: readonly JobRow[],
): AktivitaetsEintrag[] {
  const aus: AktivitaetsEintrag[] = [];

  for (const r of auditRows) {
    const m = mappeAudit(r);
    aus.push({
      id: `audit:${r.id}`,
      art: m.art,
      titel: m.titel,
      zeitpunkt: r.created_at,
    });
  }
  for (const r of jobRows) {
    const m = mappeJob(r);
    aus.push({
      id: `job:${r.id}`,
      art: m.art,
      titel: m.titel,
      zeitpunkt: r.created_at,
    });
  }

  return aus
    .sort((a, b) => (a.zeitpunkt < b.zeitpunkt ? 1 : a.zeitpunkt > b.zeitpunkt ? -1 : 0))
    .slice(0, FEED_LIMIT);
}

/**
 * Lädt owner-scoped die letzten ~30 audit_eintrag + letzte job_lauf und
 * verdichtet sie zum Top-20-Feed. Owner-Filter zusätzlich zur RLS.
 */
export async function ladeAktivitaet(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<AktivitaetsEintrag[]> {
  const [auditRes, jobRes] = await Promise.all([
    supabase
      .from("audit_eintrag")
      .select("id, entitaet, aktion, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("job_lauf")
      .select("id, art, status, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const auditRows = (auditRes.data ?? []) as AuditRow[];
  const jobRows = (jobRes.data ?? []) as JobRow[];
  return baueAktivitaet(auditRows, jobRows);
}
