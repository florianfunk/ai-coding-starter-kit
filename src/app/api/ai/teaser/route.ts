import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateTeaser, TeaserError } from "@/lib/ai/teaser";
import {
  AI_PROVIDERS,
  isValidModel,
  type AiProvider,
} from "@/lib/ai/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  entityType: z.enum(["bereich", "kategorie", "produkt"]),
  entityName: z.string().min(1).max(300),
  entityContext: z.string().max(4000).optional().nullable(),
  zusatzHinweis: z.string().max(500).optional().nullable(),
  laenge: z.enum(["kurz", "mittel", "lang"]).default("mittel"),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

function checkRateLimit(key: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + HOUR_MS });
    return { ok: true, remaining: LIMIT_PER_HOUR - 1 };
  }
  if (entry.count >= LIMIT_PER_HOUR) {
    return { ok: false, remaining: 0 };
  }
  entry.count++;
  return { ok: true, remaining: LIMIT_PER_HOUR - entry.count };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const rl = checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Limit erreicht (60 Anfragen / Stunde). Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." },
      { status: 400 },
    );
  }

  const { data: settings } = await supabase
    .from("ai_einstellungen")
    .select("ai_provider, ai_model, openai_api_key, anthropic_api_key")
    .eq("id", 1)
    .single();

  if (!settings) {
    return NextResponse.json(
      { error: "KI-Einstellungen nicht gefunden." },
      { status: 500 },
    );
  }

  const provider = settings.ai_provider as AiProvider;
  if (!AI_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: "Ungültiger Provider in den Einstellungen." },
      { status: 500 },
    );
  }

  const model = settings.ai_model;
  if (!model || !isValidModel(provider, model)) {
    return NextResponse.json(
      { error: "Ungültiges Modell in den Einstellungen." },
      { status: 500 },
    );
  }

  const apiKey =
    provider === "openai"
      ? settings.openai_api_key
      : settings.anthropic_api_key;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: `Kein API-Key für ${provider === "openai" ? "OpenAI" : "Anthropic"} hinterlegt. Bitte in den Einstellungen → KI eintragen.`,
      },
      { status: 412 },
    );
  }

  try {
    const teaser = await generateTeaser(parsed.data, { provider, model, apiKey });
    return NextResponse.json({ teaser });
  } catch (e) {
    if (e instanceof TeaserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler." },
      { status: 500 },
    );
  }
}
