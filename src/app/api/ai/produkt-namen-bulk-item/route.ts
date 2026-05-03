import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateProduktNamen, ProduktNamenError } from "@/lib/ai/produkt-namen";
import { AI_PROVIDERS, isValidModel, type AiProvider } from "@/lib/ai/models";
import { ALL_PRODUKT_FIELDS } from "@/app/produkte/fields";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  id: z.string().uuid(),
  zusatzHinweis: z.string().max(500).optional().nullable(),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT_PER_HOUR = 500;
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
      { error: "Limit erreicht (500 Anfragen / Stunde). Bitte später erneut versuchen." },
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

  const { data: produkt, error: prodErr } = await supabase
    .from("produkte")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  if (prodErr || !produkt) {
    return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }

  const [{ data: bereich }, { data: kategorie }] = await Promise.all([
    produkt.bereich_id
      ? supabase.from("bereiche").select("name").eq("id", produkt.bereich_id).single()
      : Promise.resolve({ data: null as { name: string } | null }),
    produkt.kategorie_id
      ? supabase.from("kategorien").select("name").eq("id", produkt.kategorie_id).single()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const tech: Record<string, string> = {};
  for (const f of ALL_PRODUKT_FIELDS) {
    const v = (produkt as Record<string, unknown>)[f.col];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s === "false") continue;
    const label = f.unit ? `${f.label} (${f.unit})` : f.label;
    tech[label] = s;
  }

  const { data: settings } = await supabase
    .from("ai_einstellungen")
    .select("ai_provider, ai_model, openai_api_key, anthropic_api_key")
    .eq("id", 1)
    .single();

  if (!settings) {
    return NextResponse.json({ error: "KI-Einstellungen nicht gefunden." }, { status: 500 });
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
        error: `Kein API-Key für ${provider === "openai" ? "OpenAI" : "Anthropic"} hinterlegt.`,
      },
      { status: 412 },
    );
  }

  try {
    const suggested = await generateProduktNamen(
      {
        artikelnummer: produkt.artikelnummer,
        bereichName: bereich?.name ?? null,
        kategorieName: kategorie?.name ?? null,
        infoKurz: produkt.info_kurz ?? null,
        technischeDaten: Object.keys(tech).length > 0 ? tech : null,
        zusatzHinweis: parsed.data.zusatzHinweis ?? null,
      },
      { provider, model, apiKey },
    );
    return NextResponse.json({
      id: produkt.id,
      current: {
        name: produkt.name ?? "",
        datenblatt_titel: produkt.datenblatt_titel ?? "",
      },
      suggested,
    });
  } catch (e) {
    if (e instanceof ProduktNamenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler." },
      { status: 500 },
    );
  }
}
