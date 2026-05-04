/**
 * PROJ-46 — POST /api/ai/uebersetzen
 *
 * Übersetzt eine Auswahl deutscher Produkttexte ins Italienische und gibt
 * die Vorschläge zurück. Schreibt **nicht** in die DB — der Aufrufer (Modal)
 * sammelt die Vorschläge, der User reviewt sie, der reguläre Save schreibt
 * sie in die `*_it`-Spalten.
 *
 * Auth: Session-User; Rate-Limit: 60 Anfragen / Stunde / User.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  generateUebersetzung,
  UebersetzenError,
} from "@/lib/ai/uebersetzen";
import { AI_PROVIDERS, isValidModel, type AiProvider } from "@/lib/ai/models";
import {
  TRANSLATABLE_DE_KEYS,
  TRANSLATABLE_BY_DE,
} from "@/lib/i18n/translatable-fields";

export const dynamic = "force-dynamic";
// Übersetzung mehrerer Felder eines Produkts kann mit Reasoning-Modellen wie
// gpt-5-mini 60 s deutlich überschreiten — vor allem wenn datenblatt_text
// (Rich-HTML) lang ist. Vercel Fluid Compute erlaubt bis 300 s.
export const maxDuration = 300;

// Wir akzeptieren nur DE-Schlüssel aus der zentralen Whitelist — verhindert,
// dass beliebige Spalten übersetzt werden.
const FieldKey = z.enum(TRANSLATABLE_DE_KEYS as [string, ...string[]]);

const bodySchema = z.object({
  produktId: z.string().uuid().nullable(),
  zielsprache: z.literal("it"),
  felder: z.array(FieldKey).min(1).max(20),
  quelltexte: z.record(z.string(), z.string().max(20000)),
  nurLeere: z.boolean().optional().default(false),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

function checkRateLimit(key: string): { ok: boolean } {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + HOUR_MS });
    return { ok: true };
  }
  if (entry.count >= LIMIT_PER_HOUR) return { ok: false };
  entry.count++;
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  if (!checkRateLimit(user.id).ok) {
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

  // Bauen der Quelltexte: nur Felder, die in `felder` stehen UND einen
  // nicht-leeren deutschen Text mitliefern. Eingaben außerhalb der Whitelist
  // werden durch das `FieldKey`-Schema oben bereits abgewiesen.
  const quelltexte: Record<string, string> = {};
  for (const key of parsed.data.felder) {
    const txt = (parsed.data.quelltexte[key] ?? "").trim();
    if (!txt) continue;
    // Per-Feld Längenlimit aus der zentralen Definition
    const def = TRANSLATABLE_BY_DE[key];
    if (def && txt.length > def.maxLen) {
      return NextResponse.json(
        {
          error: `Feld "${key}" ist zu lang (${txt.length} > ${def.maxLen} Zeichen).`,
        },
        { status: 400 },
      );
    }
    quelltexte[key] = txt;
  }

  if (Object.keys(quelltexte).length === 0) {
    return NextResponse.json({ uebersetzungen: {} });
  }

  // Provider/Modell/Key aus den AI-Einstellungen
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
    return NextResponse.json({ error: "Ungültiger Provider." }, { status: 500 });
  }
  const model = settings.ai_model;
  if (!model || !isValidModel(provider, model)) {
    return NextResponse.json({ error: "Ungültiges Modell." }, { status: 500 });
  }
  const apiKey =
    provider === "openai" ? settings.openai_api_key : settings.anthropic_api_key;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: `Kein API-Key für ${provider === "openai" ? "OpenAI" : "Anthropic"} hinterlegt. Bitte in den Einstellungen → KI eintragen.`,
      },
      { status: 412 },
    );
  }

  try {
    const result = await generateUebersetzung(
      { quelltexte, zielsprache: "it" },
      { provider, model, apiKey },
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UebersetzenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler." },
      { status: 500 },
    );
  }
}
