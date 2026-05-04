/**
 * PROJ-46 — Server-seitige Übersetzungs-Logik für ein einzelnes Produkt.
 *
 * Lädt das Produkt, ermittelt die Quelltexte, ruft die LLM-API auf und
 * schreibt die `*_it`-Spalten direkt in die DB. Wird verwendet von:
 *   - POST /api/ai/uebersetzen-bulk-item (Bulk-Wizard)
 *   - updateProdukt (Auto-Trigger nach Save)
 *
 * Trennt Auth/HTTP von der eigentlichen Übersetzungs-Pipeline, damit
 * `updateProdukt` keinen fetch-Roundtrip an die eigene API braucht.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateUebersetzung,
  UebersetzenError,
} from "./uebersetzen";
import { AI_PROVIDERS, isValidModel, type AiProvider } from "./models";
import {
  TRANSLATABLE_FIELDS,
  type TranslatableField,
} from "@/lib/i18n/translatable-fields";

export interface UebersetzeProduktOptions {
  /** Wenn true, werden Felder mit bereits gefülltem `*_it` übersprungen. */
  nurLeere?: boolean;
  /** Optional: nur diese DE-Schlüssel berücksichtigen. Default: alle. */
  felder?: string[];
}

export interface UebersetzeProduktResult {
  written: number;
  skipped: number;
}

export class UebersetzeProduktError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function uebersetzeProdukt(
  supabase: SupabaseClient,
  produktId: string,
  options: UebersetzeProduktOptions = {},
): Promise<UebersetzeProduktResult> {
  const candidates: readonly TranslatableField[] = options.felder
    ? TRANSLATABLE_FIELDS.filter((f) => options.felder!.includes(f.de))
    : TRANSLATABLE_FIELDS;

  if (candidates.length === 0) {
    return { written: 0, skipped: 0 };
  }

  const selectCols = [
    "id",
    ...candidates.map((f) => f.de),
    ...candidates.map((f) => f.it),
  ].join(", ");

  const { data: produkt, error: prodErr } = await supabase
    .from("produkte")
    .select(selectCols)
    .eq("id", produktId)
    .single<Record<string, unknown>>();

  if (prodErr || !produkt) {
    throw new UebersetzeProduktError("Produkt nicht gefunden.", 404);
  }

  const quelltexte: Record<string, string> = {};
  let skipped = 0;
  for (const f of candidates) {
    const de = String(produkt[f.de] ?? "").trim();
    if (!de) {
      skipped += 1;
      continue;
    }
    if (options.nurLeere) {
      const itExisting = String(produkt[f.it] ?? "").trim();
      if (itExisting) {
        skipped += 1;
        continue;
      }
    }
    if (de.length > f.maxLen) {
      skipped += 1;
      continue;
    }
    quelltexte[f.de] = de;
  }

  if (Object.keys(quelltexte).length === 0) {
    return { written: 0, skipped };
  }

  const { data: settings } = await supabase
    .from("ai_einstellungen")
    .select("ai_provider, ai_model, openai_api_key, anthropic_api_key")
    .eq("id", 1)
    .single();

  if (!settings) {
    throw new UebersetzeProduktError("KI-Einstellungen nicht gefunden.", 500);
  }
  const provider = settings.ai_provider as AiProvider;
  if (!AI_PROVIDERS.includes(provider)) {
    throw new UebersetzeProduktError("Ungültiger Provider.", 500);
  }
  const model = settings.ai_model;
  if (!model || !isValidModel(provider, model)) {
    throw new UebersetzeProduktError("Ungültiges Modell.", 500);
  }
  const apiKey =
    provider === "openai" ? settings.openai_api_key : settings.anthropic_api_key;
  if (!apiKey) {
    throw new UebersetzeProduktError(
      `Kein API-Key für ${provider === "openai" ? "OpenAI" : "Anthropic"} hinterlegt.`,
      412,
    );
  }

  let result: { uebersetzungen: Record<string, string> };
  try {
    result = await generateUebersetzung(
      { quelltexte, zielsprache: "it" },
      { provider, model, apiKey },
    );
  } catch (e) {
    if (e instanceof UebersetzenError) {
      throw new UebersetzeProduktError(e.message, e.status);
    }
    throw new UebersetzeProduktError(
      e instanceof Error ? e.message : "Unbekannter Fehler.",
      500,
    );
  }

  const update: Record<string, string | null> = {};
  let written = 0;
  for (const f of candidates) {
    const value = result.uebersetzungen[f.de];
    if (typeof value === "string" && value.trim().length > 0) {
      update[f.it] = value;
      written += 1;
    }
  }

  if (written > 0) {
    const { error: upErr } = await supabase
      .from("produkte")
      .update(update)
      .eq("id", produktId);
    if (upErr) {
      throw new UebersetzeProduktError(upErr.message, 500);
    }
  }

  return { written, skipped };
}
