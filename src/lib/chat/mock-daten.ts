// PROJ-17 — Kompat-Wrapper, der die `mock*`-Funktions-Signaturen erhaelt,
// aber gegen die echten API-Endpunkte (`./api.ts`) ruft.
//
// Hintergrund: die Frontend-Komponenten wurden in einer fruehen Iteration
// gegen `mock*`-Funktionen geschrieben. Jetzt, wo das Backend steht, ersetzen
// wir die Bodies. Die Komponenten bleiben unangefasst und bekommen echte
// Daten ueber HTTP.
//
// Async/Sync-Anpassung: die Mocks waren teilweise synchron. Wo das nicht
// mehr geht (Netzwerk), passen wir die Komponente an (`chat-page-inhalt.tsx`
// + `page.tsx`). Diese Datei haelt nur das ein, was Komponenten heute
// erwarten — Streaming-Generator + Aktions-Calls.

import {
  abrecheAktionApi,
  bestaetigeAktionApi,
  sendeNachrichtStream,
} from "./api";
import type { ChatAktion, ChatNachricht, ToolBadge } from "./typen";

/**
 * Echter Token-Stream gegen das Backend.
 *
 * Wichtige Aenderung gegenueber dem Mock: wir BRAUCHEN jetzt die
 * konversation_id, weil der Endpoint pro Konversation streamt.
 * Die aufrufende Komponente reicht sie als zweites Argument durch.
 */
export async function* mockAntwortStream(
  eingabe: string,
  konversation_id: string,
): AsyncIterable<string> {
  for await (const chunk of sendeNachrichtStream(konversation_id, eingabe)) {
    yield chunk;
  }
}

/**
 * Nach Stream-Ende: holt die finale Nachricht (inkl. Tool-Calls + Aktion)
 * aus dem Backend und liefert die UI-Felder zurueck. Frueher hat die
 * Heuristik im Mock daraus Tool-Badges + Aktions-Vorschlaege gemacht; jetzt
 * kommen die Daten aus der DB.
 *
 * Ergebnis: das ZULETZT eingefuegte Assistant-Eintrag-Tool-Set + (optional)
 * der zugehoerige chat_aktion-Eintrag.
 */
export async function mockNachrichtenNachtrag(
  konversation_id: string,
): Promise<{
  tools: ToolBadge[];
  aktion: ChatAktion | null;
  inhalt: string | null;
  id: string | null;
}> {
  const { holeNachrichtenApi } = await import("./api");
  const nachrichten = await holeNachrichtenApi(konversation_id);
  const letzte = [...nachrichten]
    .reverse()
    .find((n) => n.rolle === "assistant");
  if (!letzte) {
    return { tools: [], aktion: null, inhalt: null, id: null };
  }
  return {
    tools: letzte.tools,
    aktion: letzte.aktion,
    inhalt: letzte.inhalt,
    id: letzte.id,
  };
}

/** Bestaetigt eine Aktion ueber den echten Endpoint. */
export async function mockAktionBestaetigen(
  aktion_id: string,
  konversation_id: string,
): Promise<
  { ok: true; ausgefuehrt_am: string } | { ok: false; fehler: string }
> {
  return await bestaetigeAktionApi(konversation_id, aktion_id);
}

/** Bricht eine Aktion ab. */
export async function mockAktionAbbrechen(
  aktion_id: string,
  konversation_id: string,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  return await abrecheAktionApi(konversation_id, aktion_id);
}

/**
 * Liefert die Beispielfragen-Bubbles. Statisch — kein Backend noetig.
 */
export function mockBeispielfragen(): string[] {
  return [
    "Wie viel habe ich diesen Monat für Software ausgegeben?",
    "Zeig mir alle Buchungen von Amazon im März",
    "Wie viel Umsatzsteuer schulde ich aktuell?",
    "Welche Buchungen sind noch in der Prüfliste?",
    "Welche Abos kosten mich am meisten?",
    "Hat sich mein Einkommen seit Januar verändert?",
  ];
}

// Re-Exports fuer Komponenten, die das hier importieren.
export type { ChatAktion, ChatNachricht, ToolBadge };
