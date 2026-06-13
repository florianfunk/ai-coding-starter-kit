// PROJ-17 — Streaming-Endpoint fuer eine neue Chat-Nachricht.
//
// POST /api/chat/[konversation_id]/nachricht
// Body: { inhalt: string }
//
// Ablauf:
//   1) Auth + Validation
//   2) Konversation laden (Owner-Check)
//   3) Profil laden (PROJ-16) — fuer den System-Prompt
//   4) User-Nachricht in DB einfuegen
//   5) Historie der letzten N Nachrichten laden (truncate auf 8)
//   6) Assistant-Nachricht-Stub anlegen (so haben Schreib-Tools schon eine
//      nachricht_id, an die sie ihre chat_aktion-Eintraege haengen koennen)
//   7) Tools-Set bauen (Lese + Schreib) mit Context inkl. nachricht_id-Ref
//   8) streamText() rufen — toTextStreamResponse() ist die HTTP-Antwort
//   9) onFinish: Assistant-Nachricht in DB mit Inhalt + tool_calls +
//      tool_results + Token-Counts aktualisieren. Wenn Konversations-Titel
//      noch 'Neuer Chat' ist: Auto-Titel-Job triggern (best-effort).

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  streamText,
  stepCountIs,
  createGateway,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeAiKey } from "@/lib/admin/ai-key";
import { holeProfil } from "@/lib/classifier/profil";
import { baueSystemPrompt } from "@/lib/chat/system-prompt";
import { baueLeseTools } from "@/lib/chat/tools-lese";
import { baueSchreibTools } from "@/lib/chat/tools-schreib";
import type { ChatToolContext } from "@/lib/chat/tool-context";
import { autoTitel } from "@/lib/chat/konversation";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const postSchema = z.object({
  inhalt: z.string().min(1).max(8000),
});

/** Wieviele letzte Nachrichten max. in den LLM-Context. */
const HISTORIE_LIMIT = 8;

/** Max. Tool-Roundtrips pro Antwort. */
const MAX_STEPS = 6;

/**
 * Maximale Anzahl Output-Tokens pro Antwort (Spec PROJ-17, Token-Budgets).
 *
 * Begrenzt die Kosten pro Antwort und verhindert, dass eine ueberlange
 * Antwort am Vercel-Serverless-10-s-Timeout abreisst und die Assistant-
 * Nachricht als leerer Stub in der DB stehen bleibt.
 */
const MAX_OUTPUT_TOKENS = 4096;

function waehleProvider(key: string, modell: string): LanguageModel {
  if (key.startsWith("sk-ant-")) {
    const anthropic = createAnthropic({ apiKey: key });
    const normalisiert = modell.replace(/^anthropic\//, "").replace(/\./g, "-");
    return anthropic(normalisiert);
  }
  const gateway = createGateway({ apiKey: key });
  return gateway(modell);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ konversation_id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { konversation_id } = await params;
  if (!UUID.test(konversation_id)) {
    return NextResponse.json({ error: "Ungueltige ID." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen." },
      { status: 422 },
    );
  }
  const { inhalt } = parsed.data;

  const supabase = await createClient();

  // 1) Konversation laden + Owner-Check.
  const { data: kData } = await supabase
    .from("chat_konversation")
    .select("id, titel")
    .eq("owner_id", user.id)
    .eq("id", konversation_id)
    .maybeSingle();
  if (!kData) {
    return NextResponse.json(
      { error: "Konversation nicht gefunden." },
      { status: 404 },
    );
  }
  const konversation = kData as { id: string; titel: string };

  // 2) LLM-Key + Modell aufloesen.
  const { key, model: modelSlug } = await ladeAiKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Kein LLM-Key konfiguriert. Bitte im Admin-Bereich oder per Env setzen.",
      },
      { status: 503 },
    );
  }
  const llmModel = waehleProvider(key, modelSlug);

  // 3) Profil laden (best-effort).
  const profil = await holeProfil(supabase, user.id).catch(() => null);

  // 4) User-Nachricht persistieren.
  const { data: userInsRaw, error: userInsErr } = await supabase
    .from("chat_nachricht")
    .insert({
      owner_id: user.id,
      konversation_id,
      rolle: "user",
      inhalt,
    })
    .select("id, created_at")
    .single();
  if (userInsErr || !userInsRaw) {
    return NextResponse.json(
      { error: "User-Nachricht konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  // 5) Historie der letzten N Nachrichten laden (inkl. der gerade
  //    eingefuegten User-Nachricht — wir brauchen sie als letzte Message).
  const { data: histRaw } = await supabase
    .from("chat_nachricht")
    .select("rolle, inhalt, created_at")
    .eq("owner_id", user.id)
    .eq("konversation_id", konversation_id)
    .order("created_at", { ascending: false })
    .limit(HISTORIE_LIMIT * 2); // wir filtern Tool-Nachrichten raus, daher Reserve

  type HistRow = { rolle: "user" | "assistant" | "tool" | "system"; inhalt: string };
  const hist = ((histRaw ?? []) as HistRow[])
    .filter((m) => m.rolle === "user" || m.rolle === "assistant")
    .filter((m) => m.inhalt.trim().length > 0)
    .reverse() // jetzt aelteste zuerst
    .slice(-HISTORIE_LIMIT);

  const messages: ModelMessage[] = hist.map((m) => ({
    role: m.rolle === "user" ? "user" : "assistant",
    content: m.inhalt,
  }));

  // 6) Assistant-Nachricht-Stub anlegen, damit Schreib-Tools sie verlinken
  //    koennen.
  const { data: asstInsRaw, error: asstInsErr } = await supabase
    .from("chat_nachricht")
    .insert({
      owner_id: user.id,
      konversation_id,
      rolle: "assistant",
      inhalt: "",
    })
    .select("id")
    .single();
  if (asstInsErr || !asstInsRaw) {
    return NextResponse.json(
      { error: "Assistant-Stub konnte nicht angelegt werden." },
      { status: 500 },
    );
  }
  const assistantNachrichtId = (asstInsRaw as { id: string }).id;

  // 7) Tool-Context + Tools bauen.
  const toolCtx: ChatToolContext = {
    supabase,
    ownerId: user.id,
    konversationId: konversation_id,
    nachrichtIdRef: { current: assistantNachrichtId },
  };
  const tools = {
    ...baueLeseTools(toolCtx),
    ...baueSchreibTools(toolCtx),
  };

  // 8) streamText() — onFinish persistiert die Antwort.
  const systemPrompt = baueSystemPrompt(profil);

  const result = streamText({
    model: llmModel,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    onFinish: async (event) => {
      // event hat: text, toolCalls, toolResults, finishReason, usage, steps ...
      const text = typeof event.text === "string" ? event.text : "";

      // BUG-FIX: event.toolCalls ist NUR der letzte Step.
      // Tool-Calls werden im vorletzten Step gemacht, im letzten Step
      // formuliert das LLM die Antwort. Wir sammeln daher ueber ALLE
      // Steps hinweg, damit chat_nachricht.tool_calls die Wahrheit
      // widerspiegelt (UI-Badges + spaetere Audit-Spur).
      type StepLike = {
        toolCalls?: unknown[];
        toolResults?: unknown[];
      };
      const alleSteps = (event.steps ?? []) as StepLike[];
      const toolCalls = alleSteps.flatMap((s) => s.toolCalls ?? []);
      const toolResults = alleSteps.flatMap((s) => s.toolResults ?? []);
      const usage = event.usage as
        | { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number }
        | undefined;
      const tokens_in =
        usage?.inputTokens ?? usage?.promptTokens ?? null;
      const tokens_out =
        usage?.outputTokens ?? usage?.completionTokens ?? null;

      // Antwort persistieren.
      await supabase
        .from("chat_nachricht")
        .update({
          inhalt: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : null,
          tool_results: toolResults.length > 0 ? toolResults : null,
          tokens_in,
          tokens_out,
        })
        .eq("id", assistantNachrichtId)
        .eq("owner_id", user.id);

      // Konversation anstupsen.
      await supabase
        .from("chat_konversation")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", konversation_id)
        .eq("owner_id", user.id);

      // Auto-Titel, wenn noch 'Neuer Chat'.
      if (konversation.titel === "Neuer Chat" && text.length > 0) {
        const neuerTitel = await autoTitel([
          { rolle: "user", inhalt },
          { rolle: "assistant", inhalt: text },
        ]).catch(() => null);
        if (neuerTitel) {
          await supabase
            .from("chat_konversation")
            .update({ titel: neuerTitel })
            .eq("id", konversation_id)
            .eq("owner_id", user.id);
        }
      }
    },
    onError: async ({ error }) => {
      const msg =
        error instanceof Error ? error.message : "Unbekannter LLM-Fehler";
      // Wir markieren die Assistant-Nachricht mit einer kurzen Fehler-Notiz,
      // damit der Verlauf konsistent bleibt.
      await supabase
        .from("chat_nachricht")
        .update({
          inhalt: `_Antwort fehlgeschlagen: ${msg}_`,
        })
        .eq("id", assistantNachrichtId)
        .eq("owner_id", user.id);
    },
  });

  // Plain-Text-Stream zurueck — das Frontend rendert Tokens direkt als Text.
  // tool_calls / aktionen werden nach Stream-Ende per GET nachgeladen.
  return result.toTextStreamResponse({
    headers: {
      "X-Chat-Assistant-Id": assistantNachrichtId,
    },
  });
}
