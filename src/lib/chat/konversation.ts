// PROJ-17 — Konversations-/Nachrichten-Service.
//
// Reine Service-Schicht: keine HTTP-Konstrukte, kein Auth — die API-Routen
// holen den Owner ueber getApiUser() und reichen ihn hier herein.
// RLS deckt die Tabellen zusaetzlich ab; wir filtern dennoch explizit auf
// owner_id (Defense-in-Depth + klare Fehlermeldungen).

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "ai";
import type { LanguageModel } from "ai";
import { ladeAiKey } from "@/lib/admin/ai-key";

// ---------------------------------------------------------------------------
// Typen — eng am DB-Schema, aber im Frontend-Format (snake_case JSON).
// ---------------------------------------------------------------------------

export interface KonversationRow {
  id: string;
  titel: string;
  erstellt_am: string;
  aktualisiert_am: string;
  vorschau: string | null;
}

export interface NachrichtRow {
  id: string;
  konversation_id: string;
  rolle: "user" | "assistant" | "tool" | "system";
  inhalt: string;
  tool_calls: unknown;
  tool_results: unknown;
  tokens_in: number | null;
  tokens_out: number | null;
  erstellt_am: string;
}

export interface AktionRow {
  id: string;
  konversation_id: string;
  nachricht_id: string;
  aktion: string;
  parameter: Record<string, unknown>;
  vorschau: string;
  vorher_nachher: unknown;
  status: "pending_confirm" | "confirmed" | "cancelled" | "error";
  audit_eintrag_id: string | null;
  fehler_text: string | null;
  erstellt_am: string;
  aktualisiert_am: string;
}

// ---------------------------------------------------------------------------
// Konversationen
// ---------------------------------------------------------------------------

export async function holeKonversationen(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<KonversationRow[]> {
  const { data } = await supabase
    .from("chat_konversation")
    .select("id, titel, created_at, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(200);

  // Vorschau-Spalte aus letzter Nachricht zusammensetzen — in einem
  // zweiten Query (alle letzten Nachrichten in einem Schwung).
  if (!data || data.length === 0) return [];
  const ids = data.map((k) => (k as { id: string }).id);

  // Wir holen die juengste user/assistant-Nachricht je Konversation.
  // Pragmatisch: alle Nachrichten der gefundenen Konversationen,
  // dann in JS reduzieren.
  const { data: nData } = await supabase
    .from("chat_nachricht")
    .select("konversation_id, rolle, inhalt, created_at")
    .in("konversation_id", ids)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1000);
  const vorschau = new Map<string, string>();
  for (const n of (nData ?? []) as Array<{
    konversation_id: string;
    rolle: string;
    inhalt: string;
  }>) {
    if (vorschau.has(n.konversation_id)) continue;
    if (n.rolle === "user" || n.rolle === "assistant") {
      vorschau.set(n.konversation_id, n.inhalt.slice(0, 160));
    }
  }

  return data.map((k) => {
    const row = k as {
      id: string;
      titel: string;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      titel: row.titel,
      erstellt_am: row.created_at,
      aktualisiert_am: row.updated_at,
      vorschau: vorschau.get(row.id) ?? null,
    };
  });
}

export async function holeKonversation(
  supabase: SupabaseClient,
  ownerId: string,
  konversationId: string,
): Promise<{
  konversation: KonversationRow;
  nachrichten: NachrichtRow[];
  aktionen: AktionRow[];
} | null> {
  const { data: kData } = await supabase
    .from("chat_konversation")
    .select("id, titel, created_at, updated_at")
    .eq("owner_id", ownerId)
    .eq("id", konversationId)
    .maybeSingle();
  if (!kData) return null;
  const k = kData as {
    id: string;
    titel: string;
    created_at: string;
    updated_at: string;
  };

  const [nRes, aRes] = await Promise.all([
    supabase
      .from("chat_nachricht")
      .select(
        "id, konversation_id, rolle, inhalt, tool_calls, tool_results, tokens_in, tokens_out, created_at",
      )
      .eq("owner_id", ownerId)
      .eq("konversation_id", konversationId)
      .order("created_at", { ascending: true })
      .limit(2000),
    supabase
      .from("chat_aktion")
      .select(
        "id, konversation_id, nachricht_id, aktion, parameter, vorschau, vorher_nachher, status, audit_eintrag_id, fehler_text, created_at, updated_at",
      )
      .eq("owner_id", ownerId)
      .eq("konversation_id", konversationId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  type NRaw = {
    id: string;
    konversation_id: string;
    rolle: NachrichtRow["rolle"];
    inhalt: string;
    tool_calls: unknown;
    tool_results: unknown;
    tokens_in: number | null;
    tokens_out: number | null;
    created_at: string;
  };
  type ARaw = {
    id: string;
    konversation_id: string;
    nachricht_id: string;
    aktion: string;
    parameter: Record<string, unknown>;
    vorschau: string;
    vorher_nachher: unknown;
    status: AktionRow["status"];
    audit_eintrag_id: string | null;
    fehler_text: string | null;
    created_at: string;
    updated_at: string;
  };
  const nachrichten = ((nRes.data ?? []) as NRaw[]).map<NachrichtRow>((n) => ({
    id: n.id,
    konversation_id: n.konversation_id,
    rolle: n.rolle,
    inhalt: n.inhalt,
    tool_calls: n.tool_calls,
    tool_results: n.tool_results,
    tokens_in: n.tokens_in,
    tokens_out: n.tokens_out,
    erstellt_am: n.created_at,
  }));
  const aktionen = ((aRes.data ?? []) as ARaw[]).map<AktionRow>((a) => ({
    id: a.id,
    konversation_id: a.konversation_id,
    nachricht_id: a.nachricht_id,
    aktion: a.aktion,
    parameter: a.parameter,
    vorschau: a.vorschau,
    vorher_nachher: a.vorher_nachher,
    status: a.status,
    audit_eintrag_id: a.audit_eintrag_id,
    fehler_text: a.fehler_text,
    erstellt_am: a.created_at,
    aktualisiert_am: a.updated_at,
  }));

  return {
    konversation: {
      id: k.id,
      titel: k.titel,
      erstellt_am: k.created_at,
      aktualisiert_am: k.updated_at,
      vorschau: null,
    },
    nachrichten,
    aktionen,
  };
}

export async function legeKonversationAn(
  supabase: SupabaseClient,
  ownerId: string,
  titel: string = "Neuer Chat",
): Promise<KonversationRow | null> {
  const { data, error } = await supabase
    .from("chat_konversation")
    .insert({ owner_id: ownerId, titel })
    .select("id, titel, created_at, updated_at")
    .single();
  if (error || !data) return null;
  const k = data as {
    id: string;
    titel: string;
    created_at: string;
    updated_at: string;
  };
  return {
    id: k.id,
    titel: k.titel,
    erstellt_am: k.created_at,
    aktualisiert_am: k.updated_at,
    vorschau: null,
  };
}

export async function loescheKonversation(
  supabase: SupabaseClient,
  ownerId: string,
  konversationId: string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("chat_konversation")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId)
    .eq("id", konversationId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function aktualisiereTitel(
  supabase: SupabaseClient,
  ownerId: string,
  konversationId: string,
  titel: string,
): Promise<boolean> {
  const trimmed = titel.trim();
  if (!trimmed) return false;
  const { error } = await supabase
    .from("chat_konversation")
    .update({ titel: trimmed.slice(0, 200) })
    .eq("owner_id", ownerId)
    .eq("id", konversationId);
  return !error;
}

// ---------------------------------------------------------------------------
// Nachrichten
// ---------------------------------------------------------------------------

export interface SpeichereNachrichtEingabe {
  konversation_id: string;
  owner_id: string;
  rolle: "user" | "assistant" | "tool" | "system";
  inhalt: string;
  tool_calls?: unknown;
  tool_results?: unknown;
  tokens_in?: number | null;
  tokens_out?: number | null;
}

export async function speichereNachricht(
  supabase: SupabaseClient,
  daten: SpeichereNachrichtEingabe,
): Promise<NachrichtRow | null> {
  const { data, error } = await supabase
    .from("chat_nachricht")
    .insert({
      owner_id: daten.owner_id,
      konversation_id: daten.konversation_id,
      rolle: daten.rolle,
      inhalt: daten.inhalt,
      tool_calls: daten.tool_calls ?? null,
      tool_results: daten.tool_results ?? null,
      tokens_in: daten.tokens_in ?? null,
      tokens_out: daten.tokens_out ?? null,
    })
    .select(
      "id, konversation_id, rolle, inhalt, tool_calls, tool_results, tokens_in, tokens_out, created_at",
    )
    .single();
  if (error || !data) return null;
  // Konversation "anstupsen" (updated_at neu setzen → Sidebar-Sortierung).
  await supabase
    .from("chat_konversation")
    .update({ updated_at: new Date().toISOString() })
    .eq("owner_id", daten.owner_id)
    .eq("id", daten.konversation_id);

  const n = data as {
    id: string;
    konversation_id: string;
    rolle: NachrichtRow["rolle"];
    inhalt: string;
    tool_calls: unknown;
    tool_results: unknown;
    tokens_in: number | null;
    tokens_out: number | null;
    created_at: string;
  };
  return {
    id: n.id,
    konversation_id: n.konversation_id,
    rolle: n.rolle,
    inhalt: n.inhalt,
    tool_calls: n.tool_calls,
    tool_results: n.tool_results,
    tokens_in: n.tokens_in,
    tokens_out: n.tokens_out,
    erstellt_am: n.created_at,
  };
}

// ---------------------------------------------------------------------------
// Auto-Titel
// ---------------------------------------------------------------------------

/**
 * Generiert einen 3-6-Wort-Titel aus dem ersten User/Assistant-Paar einer
 * Konversation. Eigener kurzer LLM-Call (generateText) — separat vom Haupt-
 * Stream, damit der Nutzer den Stream nicht durch den Titel-Call verlangsamt
 * fuehlt. Sicher gegen LLM-Aussetzer: bei Fehler → "Neuer Chat" bleibt.
 */
export async function autoTitel(
  messages: Array<{ rolle: "user" | "assistant"; inhalt: string }>,
): Promise<string | null> {
  const { key, model } = await ladeAiKey();
  if (!key) return null;
  const prov = waehleProvider(key, model);

  const kontext = messages
    .slice(0, 4)
    .map(
      (m) => `${m.rolle === "user" ? "Nutzer" : "Assistent"}: ${m.inhalt.slice(0, 600)}`,
    )
    .join("\n\n");

  try {
    const { text } = await generateText({
      model: prov,
      system:
        "Du erzeugst sehr kurze, deutsche Titel (3-6 Woerter) fuer Buchhaltungs-Chats. Keine Anfuehrungszeichen, kein Punkt am Ende. Beispiele: 'Software-Ausgaben Mai 2026', 'Amazon-Buchungen Maerz', 'Abos und Vertragspflege'. Antworte NUR mit dem Titel.",
      prompt: `Erzeuge einen 3-6-Wort-Titel fuer diesen Chat:\n\n${kontext}`,
    });
    const sauber = text.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\.$/, "");
    if (!sauber || sauber.length > 80) return null;
    return sauber;
  } catch {
    return null;
  }
}

function waehleProvider(key: string, modell: string): LanguageModel {
  if (key.startsWith("sk-ant-")) {
    const anthropic = createAnthropic({ apiKey: key });
    const normalisiert = modell.replace(/^anthropic\//, "").replace(/\./g, "-");
    return anthropic(normalisiert);
  }
  const gateway = createGateway({ apiKey: key });
  return gateway(modell);
}
