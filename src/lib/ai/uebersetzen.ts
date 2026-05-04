/**
 * PROJ-46 — Italienische Übersetzung für Datenblatt-Felder.
 *
 * Provider-agnostischer Übersetzer (OpenAI Chat Completions / Anthropic Messages).
 * Erwartet eine Map von Feld-Schlüsseln auf deutsche Quelltexte und liefert
 * eine Map mit den italienischen Übersetzungen zurück. Technische Begriffe
 * (CRI, IP, K, Lumen, LED) bleiben unverändert; HTML-Tags werden erhalten.
 */
import type { AiProvider } from "./models";

export type Zielsprache = "it";

export interface UebersetzenInput {
  /** Schlüssel = DE-Spalte, Wert = deutscher Text. Leere Werte vorher filtern. */
  quelltexte: Record<string, string>;
  zielsprache: Zielsprache;
}

export interface UebersetzenResult {
  /** Schlüssel wie in `quelltexte`. Werte sind italienische Übersetzungen. */
  uebersetzungen: Record<string, string>;
}

export interface UebersetzenConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export class UebersetzenError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const SPRACH_NAME: Record<Zielsprache, string> = {
  it: "Italienisch",
};

/** Pure Funktion — exportiert für Unit-Tests. */
export function buildSystemPrompt(zielsprache: Zielsprache): string {
  return [
    `Du bist Fachübersetzer für die deutsche Beleuchtungs-Branche (LED-Strips, Profile, Leuchten, Treiber).`,
    `Übersetze die folgenden Produkttexte einer Datenblatt-Spezifikation **ins ${SPRACH_NAME[zielsprache]}**.`,
    "",
    "Regeln:",
    "1. Technische Begriffe bleiben **unverändert**: CRI, IP, K (Kelvin), V, W, Lumen/lm, LED, RGB, RGBW, SDCM, UGR, IK, Ra, DALI, KNX, DMX, PWM, IP20, IP65, IP67, 2700K, 4000K, etc.",
    "2. Maßeinheiten bleiben unverändert (mm, cm, m, kg, g, °C, Hz, Hz/s, h).",
    "3. Marken- und Modellnamen bleiben unverändert (z.B. STEPLIGHT, NEONFLEX, PROFLEX).",
    "4. HTML-Tags **exakt** beibehalten: <p>, </p>, <strong>, </strong>, <em>, </em>, <u>, </u>, <ul>, <ol>, <li>, <br>. Nur den Text-Inhalt übersetzen.",
    "5. Zeilenumbrüche im Original beibehalten.",
    "6. Keine Anführungszeichen außerhalb des Originals hinzufügen.",
    "7. Keine erklärenden Zusätze, keine Code-Fences, keine Einleitung.",
    "",
    "Antworte ausschließlich als JSON-Objekt der Form:",
    `{"uebersetzungen": {"feldname": "italienischer Text", ...}}`,
    "Verwende **dieselben Schlüssel** wie in der Eingabe.",
  ].join("\n");
}

/** Pure Funktion — exportiert für Unit-Tests. */
export function buildUserPrompt(input: UebersetzenInput): string {
  const lines: string[] = [
    `Übersetze die folgenden Felder ins ${SPRACH_NAME[input.zielsprache]}:`,
    "",
  ];
  for (const [key, text] of Object.entries(input.quelltexte)) {
    lines.push(`### ${key}`);
    lines.push(text);
    lines.push("");
  }
  lines.push("Antworte mit dem JSON-Objekt wie spezifiziert.");
  return lines.join("\n");
}

export async function generateUebersetzung(
  input: UebersetzenInput,
  config: UebersetzenConfig,
): Promise<UebersetzenResult> {
  const keys = Object.keys(input.quelltexte);
  if (keys.length === 0) {
    return { uebersetzungen: {} };
  }
  const system = buildSystemPrompt(input.zielsprache);
  const user = buildUserPrompt(input);

  const raw =
    config.provider === "openai"
      ? await callOpenAi(system, user, config)
      : await callAnthropic(system, user, config);

  return parseResult(raw, keys);
}

async function callOpenAi(
  system: string,
  user: string,
  config: UebersetzenConfig,
): Promise<string> {
  // Übersetzungen können HTML-Blöcke (datenblatt_text) enthalten — Token-Budget
  // muss die Quelle ungefähr 1:1 unterbringen können. GPT-5 reasoning-Modelle
  // verbrauchen zusätzliches Budget vor der eigentlichen Antwort.
  const isGpt5 = config.model.startsWith("gpt-5");
  const maxTokens = isGpt5 ? 8000 : 4000;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new UebersetzenError(`OpenAI: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    const reason = choice?.finish_reason ?? "unknown";
    throw new UebersetzenError(`OpenAI: Leere Antwort (finish_reason="${reason}").`);
  }
  return text;
}

async function callAnthropic(
  system: string,
  user: string,
  config: UebersetzenConfig,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new UebersetzenError(`Anthropic: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new UebersetzenError("Anthropic: Leere Antwort.");
  return text;
}

/** Pure Funktion — exportiert für Unit-Tests.
 *
 *  `expectedKeys` schränkt das Ergebnis auf die angeforderten Felder ein
 *  (Modell-Halluzinationen mit zusätzlichen Schlüsseln werden ignoriert).
 *  Fehlende Schlüssel werden als leerer String zurückgegeben. */
export function parseResult(
  raw: string,
  expectedKeys: string[],
): UebersetzenResult {
  let text = raw.trim();
  // Code-Fences entfernen (falls Modell sie trotz Vorgabe ausgibt)
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fallback: erstes JSON-Objekt aus dem Text fischen
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new UebersetzenError("KI-Antwort enthält kein gültiges JSON.");
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new UebersetzenError("KI-Antwort enthält kein gültiges JSON.");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UebersetzenError("KI-Antwort ist kein Objekt.");
  }

  // Toleriert beide Formen: { uebersetzungen: {...} } oder direkt {...}.
  // Manche Modelle ignorieren den Wrapper trotz Prompt.
  const obj = parsed as Record<string, unknown>;
  const inner =
    obj.uebersetzungen && typeof obj.uebersetzungen === "object"
      ? (obj.uebersetzungen as Record<string, unknown>)
      : obj;

  const out: Record<string, string> = {};
  for (const key of expectedKeys) {
    const v = inner[key];
    out[key] = typeof v === "string" ? v : "";
  }
  return { uebersetzungen: out };
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
