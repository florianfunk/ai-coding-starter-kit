/**
 * KI-Hilfe: bestehenden Anwendungstext eines Datenblatts auf eine
 * Zeichengrenze kürzen. Behält Inhalt und Tonalität, kürzt redundante
 * Formulierungen, fasst Aufzählungen zusammen.
 *
 * Nutzt dieselbe OpenAI/Anthropic-Pipeline wie /lib/ai/teaser.ts.
 */
import type { AiProvider } from "./models";

export interface ShortenTextConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export interface ShortenTextInput {
  text: string;
  maxChars: number;
  productName?: string | null;
}

export class ShortenError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function buildSystemPrompt(): string {
  return [
    "Du bist ein technischer Redakteur für Beleuchtungsprodukte (LED-Strips, Profile, Driver).",
    "Aufgabe: gegebenen Anwendungs-/Hinweistext kürzen, sodass er unter ein vorgegebenes Zeichenlimit passt.",
    "Regeln:",
    "- Inhalt vollständig bewahren — keine sicherheitsrelevanten Hinweise weglassen.",
    "- Sachlicher, technischer Ton. Keine Marketingfloskeln, keine Anrede des Lesers.",
    "- Aufzählungen zusammenfassen, redundante Erklärungen entfernen, Sätze straffen.",
    "- Deutsche Rechtschreibung und Fachterminologie beibehalten (z. B. Konstantspannungsnetzteil, Schutzart).",
    "- Keine Markdown-Auszeichnung, kein HTML, keine Bullet-Listen — reiner Fließtext.",
    "- Antworte ausschließlich mit dem gekürzten Text, ohne Vorbemerkung oder Anführungszeichen.",
  ].join("\n");
}

function buildUserPrompt(input: ShortenTextInput): string {
  const target = Math.max(200, Math.min(2000, input.maxChars));
  const lines: string[] = [];
  if (input.productName) {
    lines.push(`Produkt: ${input.productName.trim()}`);
  }
  lines.push(`Zeichenlimit: maximal ${target} Zeichen (Leerzeichen mitgezählt).`);
  lines.push("");
  lines.push("Originaltext:");
  lines.push(input.text.trim());
  lines.push("");
  lines.push(`Schreibe den Text auf maximal ${target} Zeichen um.`);
  return lines.join("\n");
}

export async function shortenText(
  input: ShortenTextInput,
  config: ShortenTextConfig,
): Promise<string> {
  if (!input.text?.trim()) {
    throw new ShortenError("Kein Text zum Kürzen übergeben.", 400);
  }
  const system = buildSystemPrompt();
  const user = buildUserPrompt(input);

  if (config.provider === "openai") {
    return callOpenAi(system, user, config);
  }
  return callAnthropic(system, user, config);
}

async function callOpenAi(
  system: string,
  user: string,
  config: ShortenTextConfig,
): Promise<string> {
  const isGpt5 = config.model.startsWith("gpt-5");
  const maxTokens = isGpt5 ? 3000 : 1200;

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
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new ShortenError(`OpenAI: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: {
      message?: { content?: string };
      finish_reason?: string;
    }[];
    usage?: { completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    const reason = choice?.finish_reason ?? "unknown";
    throw new ShortenError(
      `OpenAI: Leere Antwort (finish_reason="${reason}").`,
    );
  }
  return stripWrappingQuotes(text);
}

async function callAnthropic(
  system: string,
  user: string,
  config: ShortenTextConfig,
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
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new ShortenError(`Anthropic: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ShortenError("Anthropic: Leere Antwort.");
  return stripWrappingQuotes(text);
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

function stripWrappingQuotes(s: string): string {
  const trimmed = s.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("„") && trimmed.endsWith("“"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
