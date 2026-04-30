/**
 * Wrapper für OpenAIs gpt-image-2 (Bild-Generierung).
 *
 * gpt-image-2 wurde am 21.04.2026 released und ist OpenAIs aktuelles Bild-
 * generation-Modell. Endpoint: POST /v1/images/generations.
 *
 * Wir nutzen es ohne SDK (analog zu teaser.ts) — die API ist eine simple
 * REST-Request, ein zusätzliches npm-Package wäre Overhead.
 */

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits";
const MODEL = "gpt-image-2";

/**
 * Standard-Stil-Wrapper für Katalog-Produktbilder.
 * Wird IMMER um den User-Prompt gepackt — der Pfleger gibt nur das Motiv ein.
 */
export const STUDIO_PROMPT_PREFIX = [
  "Studio-Produktfoto in höchster Qualität für einen professionellen Beleuchtungs-Katalog.",
  "Sauberer weißer bzw. neutraler Hintergrund, professionelle Studiobeleuchtung, scharf, detailreich, fotorealistisch.",
  "Kein Text, keine Wasserzeichen, kein Logo, keine Personen außer wenn ausdrücklich gewünscht.",
  "Motiv:",
].join(" ");

/**
 * Stil-Wrapper für den Edit-Modus (Referenzbild vorhanden).
 * Bittet das Modell, das Referenzbild als Vorlage für Komposition/Motiv zu nutzen,
 * aber Studio-Qualität zu erzeugen.
 */
export const STUDIO_EDIT_PREFIX = [
  "Erstelle ein neues Studio-Produktfoto in höchster Qualität für einen professionellen Beleuchtungs-Katalog,",
  "basierend auf dem beigefügten Referenzbild als Vorlage für Motiv, Produkt und Bildaufbau.",
  "Sauberer weißer bzw. neutraler Hintergrund, professionelle Studiobeleuchtung, scharf, detailreich, fotorealistisch.",
  "Kein Text, keine Wasserzeichen, kein Logo, keine Personen außer wenn ausdrücklich gewünscht.",
  "Anweisung:",
].join(" ");

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "2048x2048";
export type ImageQuality = "low" | "medium" | "high" | "auto";

export interface GenerateImageInput {
  /** Roh-Prompt vom User (Motiv-Beschreibung). Wird automatisch mit Stil-Prefix gewrappt. */
  userPrompt: string;
  size: ImageSize;
  quality?: ImageQuality;
  apiKey: string;
}

export class ImageGenerationError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * Generiert ein Bild via gpt-image-2 und gibt einen Buffer zurück (PNG/JPEG-Bytes).
 * Der Caller ist dafür verantwortlich, das Bild zu speichern oder weiterzuverarbeiten
 * (z.B. mit Sharp auf Slot-Aspect zuzuschneiden).
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<{ buffer: Buffer; contentType: string }> {
  const fullPrompt = `${STUDIO_PROMPT_PREFIX} ${input.userPrompt.trim()}`;

  const res = await fetch(OPENAI_IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: fullPrompt,
      size: input.size,
      quality: input.quality ?? "high",
      n: 1,
      response_format: "b64_json",
    }),
    // Generation kann bis 60s dauern — Vercel Functions haben 300s default,
    // wir setzen lokales fetch nicht weiter ab.
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new ImageGenerationError(`gpt-image-2: ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    data?: { b64_json?: string }[];
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new ImageGenerationError("gpt-image-2: Leere Antwort (kein b64_json).");
  }

  // Default contentType ist PNG — gpt-image-2 liefert PNG.
  return { buffer: Buffer.from(b64, "base64"), contentType: "image/png" };
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

// ----------------------------------------------------------------------------
// Edit-Modus: gpt-image-2 mit Referenzbild
// ----------------------------------------------------------------------------
// /v1/images/edits nimmt das Referenzbild via multipart/form-data und nutzt
// es als Komposition/Motiv-Vorlage. Anders als generations gibt der Endpoint
// keine `response_format`-Option, sondern liefert immer base64 zurück.

export interface EditImageInput {
  /** Roh-Prompt vom User (Anweisung). Wird mit STUDIO_EDIT_PREFIX gewrappt. */
  userPrompt: string;
  /** Referenzbild (Original-Buffer aus dem Slot). */
  refBuffer: Buffer;
  /** MIME-Type des Referenzbilds (image/png, image/jpeg, image/webp). */
  refContentType: string;
  size: ImageSize;
  quality?: ImageQuality;
  apiKey: string;
}

export async function editImage(
  input: EditImageInput,
): Promise<{ buffer: Buffer; contentType: string }> {
  const fullPrompt = `${STUDIO_EDIT_PREFIX} ${input.userPrompt.trim()}`;

  const ext = input.refContentType.includes("png")
    ? "png"
    : input.refContentType.includes("webp")
      ? "webp"
      : "jpg";
  const refFile = new File([new Uint8Array(input.refBuffer)], `reference.${ext}`, {
    type: input.refContentType,
  });

  const fd = new FormData();
  fd.append("model", MODEL);
  fd.append("prompt", fullPrompt);
  fd.append("image[]", refFile);
  fd.append("size", input.size);
  fd.append("quality", input.quality ?? "high");
  fd.append("n", "1");

  const res = await fetch(OPENAI_IMAGE_EDIT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      // Content-Type wird automatisch von FormData inkl. boundary gesetzt
    },
    body: fd,
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new ImageGenerationError(`gpt-image-2 (edit): ${errText}`, res.status);
  }

  const data = (await res.json()) as {
    data?: { b64_json?: string }[];
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new ImageGenerationError("gpt-image-2 (edit): Leere Antwort (kein b64_json).");
  }

  return { buffer: Buffer.from(b64, "base64"), contentType: "image/png" };
}
