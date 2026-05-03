import type { AiProvider } from "./models";

export interface ProduktNamenInput {
  artikelnummer: string;
  bereichName?: string | null;
  kategorieName?: string | null;
  infoKurz?: string | null;
  technischeDaten?: Record<string, string> | null;
  zusatzHinweis?: string | null;
}

export interface ProduktNamenResult {
  bezeichnung: string;
  titel: string;
}

export interface GenerateProduktNamenConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export class ProduktNamenError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function buildSystemPrompt(): string {
  return [
    "Du bist Produkt-Texter für LICHT.ENGROS / Eisenkeil, einen deutschen B2B-Großhandel für professionelle Beleuchtung (LED-Strips, Profile, Leuchten, Treiber).",
    "Deine Aufgabe: Aus den vorhandenen technischen Daten eines Produkts zwei Texte erzeugen — eine kompakte Bezeichnung für Produktlisten und einen Datenblatt-Titel für die PDF-Headline.",
    "",
    "BEZEICHNUNG (für Tabellen, Suche, Listen):",
    "- Knapp und technisch, 40 bis 60 Zeichen.",
    "- Wichtigste technische Eckdaten in einer Zeile, getrennt durch Leerzeichen.",
    "- Beispiele: 'LED-Stripe 24V 14,4 W/m 4000K IP20', 'Einbaustrahler 7W 3000K 38° IP54'.",
    "",
    "TITEL (für PDF-Headline):",
    "- Produktname-orientiert, 30 bis 50 Zeichen.",
    "- Wenn ein Modellname/Marke aus dem Kontext hervorgeht, diesen aufgreifen, sonst eine sprechende Produkt-Kategorie.",
    "- Beispiele: 'STEPLIGHT — Treppenleuchte 3W warmweiß', 'LED-Stripe Pro 24V — IP20'.",
    "",
    "WICHTIG:",
    "- Bezeichnung darf nicht wortgleich zum Titel sein.",
    "- Stil: sachlich-modern, präzise, kein Marketing-Geschwurbel, keine Superlative, keine Anführungszeichen.",
    "- Antworte ausschließlich als JSON-Objekt: {\"bezeichnung\": \"...\", \"titel\": \"...\"}.",
    "- Keine Einleitung, kein Markdown, keine Code-Fences.",
  ].join("\n");
}

function buildUserPrompt(input: ProduktNamenInput): string {
  const parts: string[] = [`Artikelnummer: ${input.artikelnummer}`];
  if (input.bereichName?.trim()) parts.push(`Bereich: ${input.bereichName.trim()}`);
  if (input.kategorieName?.trim()) parts.push(`Kategorie: ${input.kategorieName.trim()}`);
  if (input.infoKurz?.trim()) parts.push(`Info-Zeile: ${input.infoKurz.trim()}`);
  if (input.technischeDaten && Object.keys(input.technischeDaten).length > 0) {
    const lines = Object.entries(input.technischeDaten)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => `  - ${k}: ${v}`);
    if (lines.length > 0) {
      parts.push("Technische Daten:\n" + lines.join("\n"));
    }
  }
  if (input.zusatzHinweis?.trim()) parts.push(`Zusatz-Hinweis: ${input.zusatzHinweis.trim()}`);
  parts.push("Erzeuge Bezeichnung und Titel als JSON-Objekt.");
  return parts.join("\n\n");
}

export async function generateProduktNamen(
  input: ProduktNamenInput,
  config: GenerateProduktNamenConfig,
): Promise<ProduktNamenResult> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(input);

  const raw =
    config.provider === "openai"
      ? await callOpenAi(system, user, config)
      : await callAnthropic(system, user, config);

  return parseResult(raw);
}

async function callOpenAi(
  system: string,
  user: string,
  config: GenerateProduktNamenConfig,
): Promise<string> {
  const isGpt5 = config.model.startsWith("gpt-5");
  const maxTokens = isGpt5 ? 2000 : 400;

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
    throw new ProduktNamenError(`OpenAI: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    const reason = choice?.finish_reason ?? "unknown";
    throw new ProduktNamenError(
      `OpenAI: Leere Antwort (finish_reason="${reason}").`,
    );
  }
  return text;
}

async function callAnthropic(
  system: string,
  user: string,
  config: GenerateProduktNamenConfig,
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
    throw new ProduktNamenError(`Anthropic: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ProduktNamenError("Anthropic: Leere Antwort.");
  return text;
}

function parseResult(raw: string): ProduktNamenResult {
  let text = raw.trim();
  // Code-Fences entfernen, falls das Modell sie trotz Vorgabe ausgibt
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
      throw new ProduktNamenError("KI-Antwort enthält kein gültiges JSON.");
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new ProduktNamenError("KI-Antwort enthält kein gültiges JSON.");
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ProduktNamenError("KI-Antwort ist kein Objekt.");
  }
  const obj = parsed as Record<string, unknown>;
  const bezeichnung = typeof obj.bezeichnung === "string" ? obj.bezeichnung.trim() : "";
  const titel = typeof obj.titel === "string" ? obj.titel.trim() : "";
  if (!bezeichnung || !titel) {
    throw new ProduktNamenError("KI-Antwort enthält keine Felder 'bezeichnung' und 'titel'.");
  }
  return {
    bezeichnung: stripWrappingQuotes(bezeichnung),
    titel: stripWrappingQuotes(titel),
  };
}

function stripWrappingQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("„") && t.endsWith("“"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
