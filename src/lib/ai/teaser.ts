import { buildSystemPrompt, buildUserPrompt, type BuildPromptInput } from "./prompts";
import type { AiProvider } from "./models";

export interface GenerateTeaserConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export class TeaserError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function generateTeaser(
  input: BuildPromptInput,
  config: GenerateTeaserConfig,
): Promise<string> {
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
  config: GenerateTeaserConfig,
): Promise<string> {
  // GPT-5-Modelle brauchen mehr Tokens (Reasoning verbraucht Budget).
  const isGpt5 = config.model.startsWith("gpt-5");
  const maxTokens = isGpt5 ? 2000 : 600;

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
    throw new TeaserError(`OpenAI: ${errText}`, res.status);
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
    const used = data.usage?.completion_tokens ?? 0;
    throw new TeaserError(
      `OpenAI: Leere Antwort (finish_reason="${reason}", tokens=${used}). ${
        reason === "length"
          ? "Token-Limit war zu niedrig — bitte erneut versuchen."
          : "Modell hat keinen Text geliefert."
      }`,
    );
  }
  return stripWrappingQuotes(text);
}

async function callAnthropic(
  system: string,
  user: string,
  config: GenerateTeaserConfig,
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
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new TeaserError(`Anthropic: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new TeaserError("Anthropic: Leere Antwort.");
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
