// PROJ-17 — Frontend-Typen fuer den KI-Chat.
//
// Hier liegen die UI-orientierten Datenformen. Der Backend-Agent kann
// diese Typen spaeter an die DB-Tabellen-Schemata (chat_konversation,
// chat_nachricht, chat_aktion) angleichen; die Feldnamen sind hier
// bewusst nah am Backend gehalten, damit der Mapping-Aufwand minimal ist.

export type ChatNachrichtRolle = "user" | "assistant" | "tool";

export type ChatAktionStatus =
  | "pending_confirm"
  | "confirmed"
  | "cancelled"
  | "error";

export interface ToolBadge {
  /** Name des Tools, z. B. "suche_buchungen". */
  name: string;
  /** Tool-Parameter, wie ans LLM gegeben (zur Inspektion). */
  parameter: Record<string, unknown>;
  /**
   * Kurze, Klartext-Zusammenfassung des Tool-Ergebnisses, fuer das
   * Popover. Das volle Rohergebnis kommt vom Backend separat.
   */
  ergebnis_zusammenfassung: string;
}

export interface VorherNachherZeile {
  id: string;
  datum: string;
  empfaenger: string;
  betrag: string;
  vorher: string;
  nachher: string;
}

export interface ChatAktion {
  id: string;
  /** Tool-Name, z. B. "bucheBuchungenUm". */
  aktion: string;
  /** Kurztitel fuer die Karte ("3 Buchungen umbuchen"). */
  titel: string;
  /** Klartext-Vorschau, 1-2 Saetze. */
  vorschau: string;
  /** Original Tool-Parameter (fuer Audit + Confirm-Endpoint). */
  parameter: Record<string, unknown>;
  /** Optionale Vorher/Nachher-Tabelle. */
  vorher_nachher: VorherNachherZeile[] | null;
  status: ChatAktionStatus;
  ausgefuehrt_am: string | null;
  fehler_text: string | null;
}

export interface ChatNachricht {
  id: string;
  konversation_id: string;
  rolle: ChatNachrichtRolle;
  inhalt: string;
  tools: ToolBadge[];
  /**
   * Alle Aktions-Vorschlaege, die unter dieser Nachricht angezeigt werden
   * (chronologisch sortiert). Das LLM kann mehrere Schreib-Tools in einer
   * Antwort aufrufen — jeder Aufruf erzeugt einen eigenen `chat_aktion`-
   * Eintrag, und wir rendern alle Karten untereinander.
   */
  aktionen: ChatAktion[];
  erstellt_am: string;
}

export interface ChatKonversation {
  id: string;
  titel: string;
  erstellt_am: string;
  aktualisiert_am: string;
  /** Vorschau der letzten Nachricht. */
  vorschau: string | null;
}
