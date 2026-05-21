// PROJ-17 — Gemeinsamer Tool-Kontext fuer Lese- + Schreib-Tools.
//
// Sowohl Lese- als auch Schreib-Tools werden mit demselben Context-Objekt
// gebaut. Der Context enthaelt:
//  - supabase: Auth-Cookie-Client (RLS aktiv) — Service-Role NIE.
//  - ownerId : Auth-User-ID aus getApiUser().
//  - konversationId / nachrichtId: ausschliesslich fuer Schreib-Tools
//      noetig (Aktions-Vorschlaege werden mit Referenz auf die Nachricht
//      angelegt). Bei der LLM-Tool-Definition kennen wir die nachrichtId
//      noch nicht — wir reichen sie ueber eine `setze`-Closure herein,
//      sobald die Assistant-Nachricht in der DB liegt.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChatToolContext {
  supabase: SupabaseClient;
  ownerId: string;
  konversationId: string;
  /**
   * Setzt der Stream-Handler unmittelbar nach dem Einfuegen der Assistant-
   * Nachricht. Schreib-Tools brauchen die Referenz, um chat_aktion-Eintraege
   * an die richtige Nachricht zu haengen. Bis dahin ist das Feld null —
   * Schreib-Tool-Aufrufe vor dem Setzen sind ein Bug und werfen.
   */
  nachrichtIdRef: { current: string | null };
}
