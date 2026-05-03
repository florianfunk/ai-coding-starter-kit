"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";
import { compressImage } from "@/lib/image-compress";
import {
  generateImage,
  editImage,
  ImageGenerationError,
  type ImageSize,
} from "@/lib/ai/image";

const bereichSchema = z.object({
  name: z.string().min(1, "Name ist Pflicht").max(200),
  beschreibung: z.string().max(2000).optional().nullable(),
  sortierung: z.coerce.number().int().min(0).default(0),
  seitenzahl: z.coerce.number().int().min(0).optional().nullable(),
  startseite: z.coerce.number().int().min(0).optional().nullable(),
  endseite: z.coerce.number().int().min(0).optional().nullable(),
  farbe: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Ungültige Hex-Farbe").optional().nullable().or(z.literal("").transform(() => null)),
  bild_path: z.string().optional().nullable(),
});

export type BereichFormState = { error: string | null; fieldErrors?: Record<string, string> };

function parseFormData(formData: FormData) {
  return bereichSchema.safeParse({
    name: formData.get("name"),
    beschreibung: sanitizeRichTextHtml(formData.get("beschreibung") as string | null) || null,
    sortierung: formData.get("sortierung") || 0,
    seitenzahl: formData.get("seitenzahl") || null,
    startseite: formData.get("startseite") || null,
    endseite: formData.get("endseite") || null,
    farbe: (formData.get("farbe") as string) || null,
    bild_path: (formData.get("bild_path") as string) || null,
  });
}

export async function createBereich(_prev: BereichFormState, formData: FormData): Promise<BereichFormState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen.", fieldErrors: flattenErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("bereiche").insert(parsed.data).select("id").single();
  if (error || !data) return { error: error?.message ?? "Fehler beim Anlegen" };
  await logAudit(supabase, { tableName: "bereiche", recordId: data.id, action: "create", recordLabel: parsed.data.name });
  revalidatePath("/bereiche");
  revalidateTag("bereiche", "max");
  revalidateTag("dashboard", "max");
  redirect("/bereiche?toast=success&message=Bereich+angelegt");
}

export async function updateBereich(id: string, _prev: BereichFormState, formData: FormData): Promise<BereichFormState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: "Bitte Eingaben prüfen.", fieldErrors: flattenErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("bereiche").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  await logAudit(supabase, { tableName: "bereiche", recordId: id, action: "update", recordLabel: parsed.data.name });
  revalidatePath("/bereiche");
  revalidatePath(`/bereiche/${id}`);
  revalidateTag("bereiche", "max");
  revalidateTag("dashboard", "max");
  redirect(`/bereiche/${id}?toast=success&message=Bereich+gespeichert`);
}

export async function deleteBereich(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Check for child kategorien
  const { count } = await supabase
    .from("kategorien")
    .select("*", { count: "exact", head: true })
    .eq("bereich_id", id);

  if ((count ?? 0) > 0) {
    return { error: `${count} Kategorien verweisen auf diesen Bereich. Bitte erst verschieben oder löschen.` };
  }

  // Fetch name before deleting
  const { data: row } = await supabase.from("bereiche").select("name").eq("id", id).single();
  const { error } = await supabase.from("bereiche").delete().eq("id", id);
  if (error) return { error: error.message };
  await logAudit(supabase, { tableName: "bereiche", recordId: id, action: "delete", recordLabel: row?.name ?? id });
  revalidatePath("/bereiche");
  revalidateTag("bereiche", "max");
  revalidateTag("dashboard", "max");
  return { error: null };
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadBereichBild(
  formData: FormData,
): Promise<{ path: string | null; error: string | null }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { path: null, error: "Format nicht unterstützt (JPG/PNG/WebP)." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { path: null, error: "Datei zu groß (max. 10 MB)." };
  }
  const supabase = await createClient();
  const { buffer, contentType, extension } = await compressImage(file);
  const path = `bereiche/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function reorderBereiche(orderedIds: string[]): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const updates = orderedIds.map((id, i) =>
    supabase.from("bereiche").update({ sortierung: (i + 1) * 10 }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  revalidatePath("/bereiche");
  revalidateTag("bereiche", "max");
  return { error: null };
}

function flattenErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}

// ----------------------------------------------------------------------------
// Bild-Tools für Bereich (analog zu Kategorien): Smart-Crop, Manual-Crop, KI-Bild,
// Pfad-Replace. Alle Bereich-Bilder werden im DIN-A4-Hochformat (210:297) genutzt.
// ----------------------------------------------------------------------------

/**
 * Persistiert einen neuen Storage-Pfad für `bild_path` direkt in der DB.
 * Wird vom KI-Enhance/Crop/AI-Image-Flow genutzt, damit die Änderung sofort
 * wirksam ist (ohne Formular-Submit).
 */
export async function replaceBereichBildPath(
  bereichId: string,
  newPath: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bereiche")
    .update({ bild_path: newPath })
    .eq("id", bereichId);
  if (error) return { error: error.message };
  revalidatePath(`/bereiche/${bereichId}/bearbeiten`);
  revalidatePath(`/bereiche/${bereichId}`);
  revalidatePath("/bereiche");
  revalidateTag("bereiche", "max");
  return { error: null };
}

// DIN A4: 210×297mm → bei 300dpi ca. 2480×3508. Wir wählen 1240×1754
// (≈150dpi) als guten Kompromiss zwischen Druck-Qualität und Dateigröße.
const BEREICH_A4 = { width: 1240, height: 1754 } as const;

const bereichCropSchema = z.object({
  path: z.string().min(1),
});

export type BereichCropResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function cropBereichBild(input: unknown): Promise<BereichCropResult> {
  const parsed = bereichCropSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Eingabe." };
  const { path } = parsed.data;

  const supabase = await createClient();
  const { data: download, error: dlErr } = await supabase.storage
    .from("produktbilder")
    .download(path);
  if (dlErr || !download) {
    return { ok: false, error: dlErr?.message ?? "Bild nicht gefunden." };
  }

  const inputBuffer = Buffer.from(await download.arrayBuffer());
  let croppedBuffer: Buffer;
  let contentType = "image/jpeg";
  let extension = "jpg";
  try {
    const meta = await sharp(inputBuffer).metadata();
    const pipeline = sharp(inputBuffer, { failOn: "none" })
      .rotate()
      .resize(BEREICH_A4.width, BEREICH_A4.height, {
        fit: "cover",
        position: sharp.strategy.attention,
      });

    if (meta.format === "png" && meta.hasAlpha) {
      croppedBuffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      contentType = "image/png";
      extension = "png";
    } else {
      croppedBuffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sharp-Fehler" };
  }

  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `bereiche/crop-a4-${Date.now()}-${rand}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}

const MANUAL_ASPECT_TOLERANCE = 0.02;
const A4_RATIO = 210 / 297;

const bereichCropManuellSchema = z.object({
  path: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export async function cropBereichBildManuell(input: unknown): Promise<BereichCropResult> {
  const parsed = bereichCropManuellSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Eingabe." };
  const { path, x, y, width, height } = parsed.data;

  const actualAspect = width / height;
  const aspectDelta = Math.abs(actualAspect - A4_RATIO) / A4_RATIO;
  if (aspectDelta > MANUAL_ASPECT_TOLERANCE) {
    return {
      ok: false,
      error: `Crop-Verhältnis ${actualAspect.toFixed(3)} weicht vom DIN-A4-Verhältnis ${A4_RATIO.toFixed(3)} ab.`,
    };
  }

  const supabase = await createClient();
  const { data: download, error: dlErr } = await supabase.storage
    .from("produktbilder")
    .download(path);
  if (dlErr || !download) {
    return { ok: false, error: dlErr?.message ?? "Bild nicht gefunden." };
  }
  const inputBuffer = Buffer.from(await download.arrayBuffer());

  const origMeta = await sharp(inputBuffer, { failOn: "none" }).metadata();
  const rotatedBuffer = await sharp(inputBuffer, { failOn: "none" }).rotate().toBuffer();
  const meta = await sharp(rotatedBuffer, { failOn: "none" }).metadata();
  const origWidth = meta.width ?? 0;
  const origHeight = meta.height ?? 0;
  if (origWidth === 0 || origHeight === 0) {
    return { ok: false, error: "Original-Bild konnte nicht gelesen werden." };
  }
  if (x + width > origWidth || y + height > origHeight) {
    return {
      ok: false,
      error: `Crop ausserhalb des Bilds (${x + width}×${y + height} > ${origWidth}×${origHeight}).`,
    };
  }

  let croppedBuffer: Buffer;
  let contentType = "image/jpeg";
  let extension = "jpg";
  try {
    const pipeline = sharp(rotatedBuffer, { failOn: "none" })
      .extract({ left: x, top: y, width, height })
      .resize(BEREICH_A4.width, BEREICH_A4.height, {
        fit: "cover",
        withoutEnlargement: false,
      });

    if (origMeta.format === "png" && origMeta.hasAlpha) {
      croppedBuffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      contentType = "image/png";
      extension = "png";
    } else {
      croppedBuffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sharp-Fehler" };
  }

  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `bereiche/crop-a4-manual-${Date.now()}-${rand}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}

// KI-Bild-Generierung — gpt-image-2 unterstützt nur 1024x1536 als hochkant-
// Format. Wir generieren in 1024x1536 (≈ 0.667) und schneiden dann mit
// Sharp/attention auf das A4-Verhältnis 1240x1754 (≈ 0.707). Cropping ist
// minimal, weil 1024x1536 bereits sehr nahe am A4-Format liegt.

const bereichAiImageGenSchema = z.object({
  userPrompt: z.string().min(3, "Prompt zu kurz").max(500, "Prompt zu lang"),
  referencePath: z.string().min(1).optional().nullable(),
});

const BEREICH_AI_SOURCE_SIZE: ImageSize = "1024x1536";

const bereichAiRateLimit = new Map<string, { count: number; resetAt: number }>();
const BEREICH_AI_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

function checkBereichAiRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = bereichAiRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    bereichAiRateLimit.set(key, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= BEREICH_AI_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

export async function generateBereichBildKi(
  input: unknown,
): Promise<BereichCropResult> {
  const parsed = bereichAiImageGenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  const { userPrompt, referencePath } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Nicht angemeldet." };
  }

  if (!checkBereichAiRateLimit(user.id)) {
    return {
      ok: false,
      error: "Limit erreicht (10 Bilder/Stunde). Bitte später erneut versuchen.",
    };
  }

  const { data: settings } = await supabase
    .from("ai_einstellungen")
    .select("openai_api_key")
    .eq("id", 1)
    .single();

  if (!settings?.openai_api_key) {
    return {
      ok: false,
      error: "Kein OpenAI-Key hinterlegt. Bitte in den Einstellungen → KI eintragen.",
    };
  }

  let referenceBuffer: Buffer | null = null;
  let referenceContentType = "image/jpeg";
  if (referencePath) {
    const { data: refDownload, error: refErr } = await supabase.storage
      .from("produktbilder")
      .download(referencePath);
    if (refErr || !refDownload) {
      return {
        ok: false,
        error: `Referenzbild nicht ladbar: ${refErr?.message ?? "unknown"}`,
      };
    }
    const rawRef = Buffer.from(await refDownload.arrayBuffer());
    try {
      referenceBuffer = await sharp(rawRef, { failOn: "none" })
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      referenceContentType = "image/jpeg";
    } catch (e) {
      return {
        ok: false,
        error: `Referenzbild verarbeiten fehlgeschlagen: ${e instanceof Error ? e.message : "Sharp-Fehler"}`,
      };
    }
  }

  let generated: { buffer: Buffer; contentType: string };
  try {
    if (referenceBuffer) {
      generated = await editImage({
        userPrompt,
        refBuffer: referenceBuffer,
        refContentType: referenceContentType,
        size: BEREICH_AI_SOURCE_SIZE,
        quality: "high",
        apiKey: settings.openai_api_key,
      });
    } else {
      generated = await generateImage({
        userPrompt,
        size: BEREICH_AI_SOURCE_SIZE,
        quality: "high",
        apiKey: settings.openai_api_key,
      });
    }
  } catch (e) {
    if (e instanceof ImageGenerationError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Generation fehlgeschlagen" };
  }

  let croppedBuffer: Buffer;
  try {
    croppedBuffer = await sharp(generated.buffer, { failOn: "none" })
      .resize(BEREICH_A4.width, BEREICH_A4.height, {
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Crop-Fehler" };
  }

  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `bereiche/ai-a4-${Date.now()}-${rand}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType: "image/jpeg" });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}
