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

const schema = z.object({
  bereich_id: z.string().uuid("Bereich ist Pflicht"),
  name: z.string().min(1, "Name ist Pflicht").max(200),
  beschreibung: z.string().max(4000).optional().nullable(),
  sortierung: z.coerce.number().int().min(0).default(0),
  bild1_path: z.string().optional().nullable(),
  bild2_path: z.string().optional().nullable(),
  bild3_path: z.string().optional().nullable(),
  bild4_path: z.string().optional().nullable(),
  spalte_1: z.string().optional().nullable(),
  spalte_2: z.string().optional().nullable(),
  spalte_3: z.string().optional().nullable(),
  spalte_4: z.string().optional().nullable(),
  spalte_5: z.string().optional().nullable(),
  spalte_6: z.string().optional().nullable(),
  spalte_7: z.string().optional().nullable(),
  spalte_8: z.string().optional().nullable(),
  spalte_9: z.string().optional().nullable(),
});

export type KategorieFormState = { error: string | null; fieldErrors?: Record<string, string> };

function parse(formData: FormData) {
  const spaltenVal = (k: string) => {
    const v = (formData.get(k) as string) || null;
    return v && v !== "__leer__" ? v : null;
  };
  return schema.safeParse({
    bereich_id: formData.get("bereich_id"),
    name: formData.get("name"),
    beschreibung: sanitizeRichTextHtml(formData.get("beschreibung") as string | null) || null,
    sortierung: formData.get("sortierung") || 0,
    bild1_path: (formData.get("bild1_path") as string) || null,
    bild2_path: (formData.get("bild2_path") as string) || null,
    bild3_path: (formData.get("bild3_path") as string) || null,
    bild4_path: (formData.get("bild4_path") as string) || null,
    spalte_1: spaltenVal("spalte_1"),
    spalte_2: spaltenVal("spalte_2"),
    spalte_3: spaltenVal("spalte_3"),
    spalte_4: spaltenVal("spalte_4"),
    spalte_5: spaltenVal("spalte_5"),
    spalte_6: spaltenVal("spalte_6"),
    spalte_7: spaltenVal("spalte_7"),
    spalte_8: spaltenVal("spalte_8"),
    spalte_9: spaltenVal("spalte_9"),
  });
}

function flat(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}

async function setIcons(supabase: Awaited<ReturnType<typeof createClient>>, kategorieId: string, iconIds: string[]) {
  await supabase.from("kategorie_icons").delete().eq("kategorie_id", kategorieId);
  if (iconIds.length) {
    const rows = iconIds.map((icon_id, i) => ({ kategorie_id: kategorieId, icon_id, sortierung: i }));
    await supabase.from("kategorie_icons").insert(rows);
  }
}

export async function createKategorie(_p: KategorieFormState, formData: FormData): Promise<KategorieFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Bitte Eingaben prüfen.", fieldErrors: flat(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("kategorien").insert(parsed.data).select("id").single();
  if (error || !data) return { error: error?.message ?? "Fehler beim Anlegen" };

  const iconIds = formData.getAll("icon_ids").map(String).filter(Boolean);
  await setIcons(supabase, data.id, iconIds);

  await logAudit(supabase, { tableName: "kategorien", recordId: data.id, action: "create", recordLabel: parsed.data.name });

  revalidatePath("/kategorien");
  revalidateTag("kategorien", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("bereich-counts", "max");
  redirect("/kategorien?toast=success&message=Kategorie+angelegt");
}

export async function updateKategorie(id: string, _p: KategorieFormState, formData: FormData): Promise<KategorieFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Bitte Eingaben prüfen.", fieldErrors: flat(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("kategorien").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  const iconIds = formData.getAll("icon_ids").map(String).filter(Boolean);
  await setIcons(supabase, id, iconIds);

  await logAudit(supabase, { tableName: "kategorien", recordId: id, action: "update", recordLabel: parsed.data.name });

  revalidatePath("/kategorien");
  revalidatePath(`/kategorien/${id}`);
  revalidatePath(`/kategorien/${id}/bearbeiten`);
  revalidateTag("kategorien", "max");
  revalidateTag("dashboard", "max");
  redirect(`/kategorien/${id}?toast=success&message=Kategorie+gespeichert`);
}

export async function deleteKategorie(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { count } = await supabase.from("produkte").select("*", { count: "exact", head: true }).eq("kategorie_id", id);
  if ((count ?? 0) > 0) return { error: `${count} Produkte verweisen auf diese Kategorie.` };
  const { data: row } = await supabase.from("kategorien").select("name").eq("id", id).single();
  const { error } = await supabase.from("kategorien").delete().eq("id", id);
  if (error) return { error: error.message };
  await logAudit(supabase, { tableName: "kategorien", recordId: id, action: "delete", recordLabel: row?.name ?? id });
  revalidatePath("/kategorien");
  revalidateTag("kategorien", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("bereich-counts", "max");
  return { error: null };
}

export async function reorderKategorien(orderedIds: string[]): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const updates = orderedIds.map((id, i) =>
    supabase.from("kategorien").update({ sortierung: (i + 1) * 10 }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  revalidatePath("/kategorien");
  return { error: null };
}

const KATEGORIE_BILD_SLOTS = ["bild1_path", "bild2_path", "bild3_path", "bild4_path"] as const;
type KategorieBildSlot = (typeof KATEGORIE_BILD_SLOTS)[number];

/**
 * Persistiert einen neuen Storage-Pfad für einen Kategorie-Bild-Slot
 * (bild1..bild4) direkt in der DB. Wird vom KI-Enhance-Button genutzt,
 * damit die Änderung sofort wirksam ist (ohne Formular-Submit).
 */
export async function replaceKategorieBildPath(
  kategorieId: string,
  slot: string,
  newPath: string,
): Promise<{ error: string | null }> {
  if (!KATEGORIE_BILD_SLOTS.includes(slot as KategorieBildSlot)) {
    return { error: `Unbekannter Slot: ${slot}` };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("kategorien")
    .update({ [slot]: newPath })
    .eq("id", kategorieId);
  if (error) return { error: error.message };
  revalidatePath(`/kategorien/${kategorieId}/bearbeiten`);
  revalidatePath("/kategorien");
  return { error: null };
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export async function uploadKategorieBild(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED.includes(file.type)) return { path: null, error: "Format nicht unterstützt." };
  if (file.size > 10 * 1024 * 1024) return { path: null, error: "Datei zu groß (max. 10 MB)." };
  const supabase = await createClient();
  const { buffer, contentType, extension } = await compressImage(file);
  const path = `kategorien/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, buffer, { contentType });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

// ----------------------------------------------------------------------------
// Smart-Crop für Kategorie-Bilder (PROJ-40)
// ----------------------------------------------------------------------------
// Schneidet ein bestehendes Bild auf das Ziel-Aspect-Ratio des Slots zu —
// "wide" (5:1, breit) oder "tall" (1:2, hochkant). Nutzt Sharps Attention-
// Strategie: das Bild wird auf die längere Achse skaliert und dann auf den
// "interessantesten" Bereich zugeschnitten (kontrastreichste Region). Das
// Original wird *nicht* gelöscht — der Pfad bleibt erhalten, der Aufrufer
// kann zwischen Original und Zuschnitt wechseln.

const cropAspectMap = {
  wide: { width: 1500, height: 300, label: "5:1 (breit)" },
  tall: { width: 600, height: 1200, label: "1:2 (hochkant)" },
} as const;

const cropSchema = z.object({
  path: z.string().min(1),
  aspect: z.enum(["wide", "tall"]),
});

export type KategorieCropResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function cropKategorieBild(input: unknown): Promise<KategorieCropResult> {
  const parsed = cropSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Eingabe." };
  const { path, aspect } = parsed.data;

  const supabase = await createClient();

  const { data: download, error: dlErr } = await supabase.storage
    .from("produktbilder")
    .download(path);
  if (dlErr || !download) {
    return { ok: false, error: dlErr?.message ?? "Bild nicht gefunden." };
  }

  const inputBuffer = Buffer.from(await download.arrayBuffer());
  const { width, height } = cropAspectMap[aspect];

  let croppedBuffer: Buffer;
  let contentType = "image/jpeg";
  let extension = "jpg";
  try {
    const pipeline = sharp(inputBuffer, { failOn: "none" })
      .rotate()
      .resize(width, height, {
        fit: "cover",
        position: sharp.strategy.attention,
      });

    // PNG → PNG (für Transparenz), sonst JPEG
    const meta = await sharp(inputBuffer).metadata();
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

  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `${dir ? dir + "/" : ""}crop-${aspect}-${Date.now()}-${rand}.${extension}`;

  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}

// PROJ-41: Manuelles Crop mit Pfleger-definierten Koordinaten -------------
//
// Schneidet exakt das uebergebene Pixel-Rechteck aus dem Original aus und
// skaliert es auf die Slot-Zielaufloesung. Original bleibt erhalten.
// Aspect-Toleranz schuetzt vor Client-Manipulation: das gelieferte Crop
// muss innerhalb +/- 2% des Slot-Aspect liegen.

const MANUAL_ASPECT_TOLERANCE = 0.02;

const cropManuellSchema = z.object({
  path: z.string().min(1),
  aspect: z.enum(["wide", "tall"]),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export async function cropKategorieBildManuell(input: unknown): Promise<KategorieCropResult> {
  const parsed = cropManuellSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Eingabe." };
  const { path, aspect, x, y, width, height } = parsed.data;

  // Aspect-Toleranz pruefen
  const targetAspect = aspect === "wide" ? 5 / 1 : 1 / 2;
  const actualAspect = width / height;
  const aspectDelta = Math.abs(actualAspect - targetAspect) / targetAspect;
  if (aspectDelta > MANUAL_ASPECT_TOLERANCE) {
    return {
      ok: false,
      error: `Crop-Verhältnis ${actualAspect.toFixed(2)} weicht vom Soll-Verhältnis ${targetAspect.toFixed(2)} ab.`,
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

  // PROJ-41 Hotfix: EXIF-Auto-Rotation einmalig materialisieren, BEVOR
  // wir Metadata oder Extract aufrufen. sharp.metadata() liest die rohen
  // (vor-EXIF-Rotation) Pixel-Dimensionen — wenn der Browser jedoch das
  // EXIF-rotierte Bild zeigt, beziehen sich die Client-Coords darauf.
  // Lösung: Original rotiert in einen Zwischen-Buffer schreiben und auf
  // diesem die Dims + Extract berechnen. Format/Alpha kommen aus dem
  // Original-Buffer (rotation entfernt EXIF-Hint nicht aus dem Format).
  const origMeta = await sharp(inputBuffer, { failOn: "none" }).metadata();
  const rotatedBuffer = await sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .toBuffer();
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

  const { width: targetWidth, height: targetHeight } = cropAspectMap[aspect];

  let croppedBuffer: Buffer;
  let contentType = "image/jpeg";
  let extension = "jpg";
  try {
    // Auf dem bereits rotierten Buffer arbeiten — keine erneute .rotate() nötig.
    const pipeline = sharp(rotatedBuffer, { failOn: "none" })
      .extract({ left: x, top: y, width, height })
      .resize(targetWidth, targetHeight, {
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

  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `${dir ? dir + "/" : ""}crop-${aspect}-manual-${Date.now()}-${rand}.${extension}`;

  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}

// ----------------------------------------------------------------------------
// PROJ-42: KI-Bild-Generierung via gpt-image-2
// ----------------------------------------------------------------------------
// gpt-image-2 unterstützt nur Aspect-Ratios bis max. 3:1. Für unsere extremen
// Slot-Formate (5:1 wide / 1:2 tall) generieren wir das nächst-passende
// Format (1536×1024 / 1024×1536) und schneiden danach mit Sharp/attention
// auf die finale Slot-Größe (1500×300 / 600×1200) zu.

const aiImageGenSchema = z.object({
  aspect: z.enum(["wide", "tall"]),
  userPrompt: z.string().min(3, "Prompt zu kurz").max(500, "Prompt zu lang"),
  /** Optional: Pfad eines bestehenden Slot-Bilds, das als Referenz dient. */
  referencePath: z.string().min(1).optional().nullable(),
});

const AI_GEN_SOURCE_SIZE: Record<"wide" | "tall", ImageSize> = {
  wide: "1536x1024",
  tall: "1024x1536",
};

const aiRateLimit = new Map<string, { count: number; resetAt: number }>();
const AI_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

function checkAiRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = aiRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    aiRateLimit.set(key, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= AI_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

export async function generateKategorieBildKi(
  input: unknown,
): Promise<KategorieCropResult> {
  const parsed = aiImageGenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  const { aspect, userPrompt, referencePath } = parsed.data;

  // Rate-Limit (KI-Bilder sind teuer ~$0.17/Stück bei high quality)
  if (!checkAiRateLimit("global")) {
    return {
      ok: false,
      error: "Limit erreicht (10 Bilder/Stunde). Bitte später erneut versuchen.",
    };
  }

  const supabase = await createClient();

  // OpenAI-Key aus den AI-Einstellungen ziehen (PROJ-39)
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

  // Wenn ein Referenzbild übergeben wurde: Edit-Modus mit Storage-Download.
  // Das Referenzbild ist normalerweise das aktuelle Slot-Bild, das wir auf
  // max. 2048px Kante runterskalieren — gpt-image-2 akzeptiert nur Kanten
  // ≤ 3840px und der Upload soll schnell gehen.
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
      // Auf max. 2048×2048 (contain) skalieren — schneller Upload, hält Aspect
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

  // 1) Bild generieren — entweder pure Generation oder Edit mit Referenz
  let generated: { buffer: Buffer; contentType: string };
  try {
    if (referenceBuffer) {
      generated = await editImage({
        userPrompt,
        refBuffer: referenceBuffer,
        refContentType: referenceContentType,
        size: AI_GEN_SOURCE_SIZE[aspect],
        quality: "high",
        apiKey: settings.openai_api_key,
      });
    } else {
      generated = await generateImage({
        userPrompt,
        size: AI_GEN_SOURCE_SIZE[aspect],
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

  // 2) Auf Slot-Aspect zuschneiden (1500×300 / 600×1200) via attention
  const { width: targetWidth, height: targetHeight } = cropAspectMap[aspect];

  let croppedBuffer: Buffer;
  try {
    croppedBuffer = await sharp(generated.buffer, { failOn: "none" })
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Crop-Fehler" };
  }

  // 3) In Storage hochladen
  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `kategorien/ai-${aspect}-${Date.now()}-${rand}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType: "image/jpeg" });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}
