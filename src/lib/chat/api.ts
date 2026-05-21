// PROJ-17 — Echter API-Client fuer den Chat (ersetzt mock-daten.ts).
//
// Die Funktions-Signaturen entsprechen den `mock*`-Funktionen aus der
// Frontend-Iteration, sodass die UI-Komponenten unveraendert bleiben.
// Reale Endpoints:
//   GET    /api/chat/konversationen
//   POST   /api/chat/konversationen
//   GET    /api/chat/[id]
//   PATCH  /api/chat/[id]
//   DELETE /api/chat/[id]
//   POST   /api/chat/[id]/nachricht                 (Text-Stream)
//   POST   /api/chat/[id]/aktion/[aktion_id]/bestaetigen
//   POST   /api/chat/[id]/aktion/[aktion_id]/abbrechen
//
// Hinweis zum Stream: das Backend nutzt `result.toTextStreamResponse()` aus
// AI SDK v6 — also einen Plain-Text-Stream der Assistant-Tokens. Tool-Calls
// und Aktions-Vorschlaege werden NACH Stream-Ende ueber `mockNachrichten`
// (jetzt `holeNachrichten`) per GET nachgeladen.

import type {
  ChatAktion,
  ChatAktionStatus,
  ChatKonversation,
  ChatNachricht,
  ChatNachrichtRolle,
  ToolBadge,
  VorherNachherZeile,
} from "./typen";

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/** Wirft, wenn die Response nicht erfolgreich ist (mit Server-Fehlertext). */
async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  let msg = `${response.status} ${response.statusText}`;
  try {
    const body = await response.json();
    if (body?.error) msg = body.error;
  } catch {
    // ignore
  }
  throw new Error(msg);
}

function mapBackendKonversation(b: {
  id: string;
  titel: string;
  erstellt_am: string;
  aktualisiert_am: string;
  vorschau: string | null;
}): ChatKonversation {
  return {
    id: b.id,
    titel: b.titel,
    erstellt_am: b.erstellt_am,
    aktualisiert_am: b.aktualisiert_am,
    vorschau: b.vorschau,
  };
}

/** Wandelt Backend-Tool-Call-Eintraege in UI-Tool-Badges um. */
function mapToolBadges(toolCalls: unknown, toolResults: unknown): ToolBadge[] {
  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const results = Array.isArray(toolResults) ? toolResults : [];
  return calls.map((c) => {
    const rec = c as { toolName?: string; input?: unknown; args?: unknown };
    const name = rec.toolName ?? "tool";
    const parameter =
      (rec.input as Record<string, unknown> | undefined) ??
      (rec.args as Record<string, unknown> | undefined) ??
      {};
    // Passendes Result suchen (nach Position).
    const idx = calls.indexOf(c);
    const result = results[idx];
    const zusammen = kurzZusammenfassung(result);
    return { name, parameter, ergebnis_zusammenfassung: zusammen };
  });
}

function kurzZusammenfassung(result: unknown): string {
  if (!result || typeof result !== "object") return "—";
  const rec = result as Record<string, unknown>;
  const out = rec.output ?? rec.result ?? rec;
  if (!out || typeof out !== "object") return "—";
  const o = out as Record<string, unknown>;
  if (typeof o.fehler === "string") return `Fehler: ${o.fehler}`;
  if (typeof o.anzahl === "number") return `${o.anzahl} Treffer`;
  if (Array.isArray(o.buchungen)) return `${o.buchungen.length} Buchungen`;
  if (Array.isArray(o.kategorien)) return `${o.kategorien.length} Kategorien`;
  if (typeof o.zahllast === "number") {
    return `USt-Zahllast: ${o.zahllast.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
  }
  if (typeof o.aktion_id === "string") return `Vorschlag angelegt: ${o.aktion_id.slice(0, 8)}…`;
  return "OK";
}

function mapAktion(a: {
  id: string;
  aktion: string;
  parameter: Record<string, unknown>;
  vorschau: string;
  vorher_nachher: unknown;
  status: ChatAktionStatus;
  aktualisiert_am: string;
  fehler_text: string | null;
}): ChatAktion {
  const titel = aktionsTitel(a.aktion, a.parameter);
  const vnRaw = Array.isArray(a.vorher_nachher) ? a.vorher_nachher : null;
  const vorher_nachher: VorherNachherZeile[] | null = vnRaw
    ? vnRaw
        .filter(
          (z): z is Record<string, unknown> =>
            typeof z === "object" && z !== null,
        )
        .map((z, i) => ({
          id: String(z.id ?? `zeile-${i}`),
          datum: String(z.datum ?? ""),
          empfaenger: String(z.empfaenger ?? ""),
          betrag: String(z.betrag ?? ""),
          vorher: String(z.vorher ?? ""),
          nachher: String(z.nachher ?? ""),
        }))
    : null;
  return {
    id: a.id,
    aktion: a.aktion,
    titel,
    vorschau: a.vorschau,
    parameter: a.parameter,
    vorher_nachher,
    status: a.status,
    ausgefuehrt_am:
      a.status === "confirmed" || a.status === "cancelled"
        ? a.aktualisiert_am
        : null,
    fehler_text: a.fehler_text,
  };
}

function aktionsTitel(name: string, parameter: Record<string, unknown>): string {
  switch (name) {
    case "lege_kategorie_an":
      return `Neue Kategorie: ${parameter.bezeichnung ?? ""}`;
    case "aendere_kategorie":
      return "Kategorie ändern";
    case "loesche_kategorie":
      return "Kategorie löschen";
    case "bucheBuchungenUm": {
      const ids = parameter.buchung_ids as unknown;
      const n = Array.isArray(ids) ? ids.length : 0;
      return `${n} Buchung${n === 1 ? "" : "en"} umbuchen`;
    }
    case "manuell_bestaetige_buchungen": {
      const ids = parameter.buchung_ids as unknown;
      const n = Array.isArray(ids) ? ids.length : 0;
      return `${n} Buchung${n === 1 ? "" : "en"} bestätigen`;
    }
    case "lege_lernregel_an":
      return `Neue Lernregel: ${parameter.bezeichnung ?? ""}`;
    case "aendere_lernregel":
      return "Lernregel ändern";
    case "loesche_lernregel":
      return "Lernregel löschen";
    case "setze_empfaenger_kenntnis":
      return `Empfänger-Kenntnis setzen: ${parameter.empfaenger_norm ?? ""}`;
    case "loesche_empfaenger_kenntnis":
      return `Empfänger-Kenntnis löschen: ${parameter.empfaenger_norm ?? ""}`;
    default:
      return name;
  }
}

// ---------------------------------------------------------------------------
// Konversationen
// ---------------------------------------------------------------------------

export async function holeKonversationenApi(): Promise<ChatKonversation[]> {
  const res = await check(await fetch("/api/chat/konversationen"));
  const json = (await res.json()) as { konversationen: ChatKonversation[] };
  return (json.konversationen ?? []).map(mapBackendKonversation);
}

export async function legeKonversationApi(
  titel?: string,
): Promise<ChatKonversation> {
  const res = await check(
    await fetch("/api/chat/konversationen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(titel ? { titel } : {}),
    }),
  );
  const json = (await res.json()) as { konversation: ChatKonversation };
  return mapBackendKonversation(json.konversation);
}

export async function umbenenneKonversationApi(
  konversation_id: string,
  titel: string,
): Promise<void> {
  await check(
    await fetch(`/api/chat/${konversation_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel }),
    }),
  );
}

export async function loescheKonversationApi(
  konversation_id: string,
): Promise<void> {
  await check(
    await fetch(`/api/chat/${konversation_id}`, { method: "DELETE" }),
  );
}

// ---------------------------------------------------------------------------
// Nachrichten + Aktionen einer Konversation
// ---------------------------------------------------------------------------

interface BackendNachricht {
  id: string;
  konversation_id: string;
  rolle: ChatNachrichtRolle | "system";
  inhalt: string;
  tool_calls: unknown;
  tool_results: unknown;
  erstellt_am: string;
}
interface BackendAktion {
  id: string;
  konversation_id: string;
  nachricht_id: string;
  aktion: string;
  parameter: Record<string, unknown>;
  vorschau: string;
  vorher_nachher: unknown;
  status: ChatAktionStatus;
  fehler_text: string | null;
  audit_eintrag_id: string | null;
  erstellt_am: string;
  aktualisiert_am: string;
}

export async function holeNachrichtenApi(
  konversation_id: string,
): Promise<ChatNachricht[]> {
  const res = await check(await fetch(`/api/chat/${konversation_id}`));
  const json = (await res.json()) as {
    nachrichten: BackendNachricht[];
    aktionen: BackendAktion[];
  };
  // Mehrere Aktionen pro Nachricht moeglich — das LLM kann in einer
  // Antwort mehrere Schreib-Tools aufrufen. Wir sammeln pro nachricht_id
  // alle und sortieren chronologisch (erstellt_am aufsteigend).
  const aktionenJeNachricht = new Map<string, BackendAktion[]>();
  const sortiert = [...(json.aktionen ?? [])].sort((a, b) =>
    (a.erstellt_am ?? "").localeCompare(b.erstellt_am ?? ""),
  );
  for (const a of sortiert) {
    const liste = aktionenJeNachricht.get(a.nachricht_id) ?? [];
    liste.push(a);
    aktionenJeNachricht.set(a.nachricht_id, liste);
  }
  return (json.nachrichten ?? [])
    .filter((n): n is BackendNachricht =>
      ["user", "assistant", "tool"].includes(n.rolle),
    )
    .map((n) => ({
      id: n.id,
      konversation_id: n.konversation_id,
      rolle: n.rolle as ChatNachrichtRolle,
      inhalt: n.inhalt,
      tools:
        n.rolle === "assistant"
          ? mapToolBadges(n.tool_calls, n.tool_results)
          : [],
      aktionen: (aktionenJeNachricht.get(n.id) ?? []).map(mapAktion),
      erstellt_am: n.erstellt_am,
    }));
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/**
 * Sendet eine User-Nachricht und yieldet den Token-Stream der Assistant-
 * Antwort als String-Chunks. Wirft bei nicht-ok Response.
 */
export async function* sendeNachrichtStream(
  konversation_id: string,
  inhalt: string,
): AsyncIterable<string> {
  const res = await fetch(`/api/chat/${konversation_id}/nachricht`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inhalt }),
  });
  if (!res.ok || !res.body) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    yield decoder.decode(value, { stream: true });
  }
}

// ---------------------------------------------------------------------------
// Aktionen — Confirm-Flow
// ---------------------------------------------------------------------------

export async function bestaetigeAktionApi(
  konversation_id: string,
  aktion_id: string,
): Promise<{ ok: true; ausgefuehrt_am: string } | { ok: false; fehler: string }> {
  const res = await fetch(
    `/api/chat/${konversation_id}/aktion/${aktion_id}/bestaetigen`,
    { method: "POST" },
  );
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    return { ok: false, fehler: msg };
  }
  const json = (await res.json()) as { ausgefuehrt_am: string };
  return { ok: true, ausgefuehrt_am: json.ausgefuehrt_am };
}

export async function abrecheAktionApi(
  konversation_id: string,
  aktion_id: string,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const res = await fetch(
    `/api/chat/${konversation_id}/aktion/${aktion_id}/abbrechen`,
    { method: "POST" },
  );
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    return { ok: false, fehler: msg };
  }
  return { ok: true };
}

/**
 * "Neuen Vorschlag generieren" — wird vom UI aufgerufen, wenn der Nutzer auf
 * einem error-Vorschlag den Button klickt. Legt einen frischen chat_aktion-
 * Eintrag (status='pending_confirm') + eine neue Assistant-Nachricht an.
 *
 * Achtung: Der alte error-Vorschlag bleibt erhalten (Audit-Spur).
 */
export async function aktionNeuerVorschlagApi(
  konversation_id: string,
  aktion_id: string,
): Promise<
  | { ok: true; neue_aktion_id: string; neue_nachricht_id: string }
  | { ok: false; fehler: string }
> {
  const res = await fetch(
    `/api/chat/${konversation_id}/aktion/${aktion_id}/neuer-vorschlag`,
    { method: "POST" },
  );
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    return { ok: false, fehler: msg };
  }
  const json = (await res.json()) as {
    neue_aktion_id: string;
    neue_nachricht_id: string;
  };
  return {
    ok: true,
    neue_aktion_id: json.neue_aktion_id,
    neue_nachricht_id: json.neue_nachricht_id,
  };
}

// ---------------------------------------------------------------------------
// Beispielfragen (statisch — kein Backend)
// ---------------------------------------------------------------------------

export function beispielfragen(): string[] {
  return [
    "Wie viel habe ich diesen Monat für Software ausgegeben?",
    "Zeig mir alle Buchungen von Amazon im März",
    "Wie viel Umsatzsteuer schulde ich aktuell?",
    "Welche Buchungen sind noch in der Prüfliste?",
    "Welche Abos kosten mich am meisten?",
    "Hat sich mein Einkommen seit Januar verändert?",
  ];
}
