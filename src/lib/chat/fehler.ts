// Sichere Fehlerbehandlung für KI-Chat-Tools (Hardening, P4).
//
// DB-/Provider-Detailfehler dürfen NICHT an das LLM (und damit in den Chat)
// gelangen: Supabase-Fehlertexte können Tabellen-/Spalten-/Constraint-Namen
// oder andere interne Details preisgeben. Wir loggen das Detail strukturiert
// serverseitig und geben dem LLM nur eine generische, fachliche Meldung.

const STANDARD_MELDUNG =
  "Die Daten konnten gerade nicht geladen werden. Bitte später erneut versuchen.";

/** Extrahiert einen Detailtext aus beliebigem Fehlerwert (nur fürs Logging). */
function detailText(detail: unknown): string {
  if (detail instanceof Error) return detail.message;
  if (
    typeof detail === "object" &&
    detail !== null &&
    "message" in detail &&
    typeof (detail as { message: unknown }).message === "string"
  ) {
    return (detail as { message: string }).message;
  }
  return String(detail);
}

/**
 * Loggt den konkreten Fehler strukturiert serverseitig und liefert dem LLM
 * eine generische Meldung im erwarteten `{ fehler }`-Format zurück.
 *
 * @param werkzeug  Name des Tools (für die Server-Log-Zuordnung).
 * @param detail    Der echte Fehler (Supabase-Error o. Ä.) — nur fürs Log.
 * @param generisch Optionale fachliche Meldung an den Nutzer (kein Detail-Leak).
 */
export function werkzeugFehler(
  werkzeug: string,
  detail: unknown,
  generisch: string = STANDARD_MELDUNG,
): { fehler: string } {
  console.error(
    JSON.stringify({
      ereignis: "chat_tool_fehler",
      werkzeug,
      detail: detailText(detail),
    }),
  );
  return { fehler: generisch };
}
