"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { compressImage } from "@/lib/image-compress";
import {
  generateImage,
  editImage,
  ImageGenerationError,
  type ImageSize,
} from "@/lib/ai/image";

/**
 * PROJ-38: Vorlage wechseln und vorhandene Slot-Bilder anhand kind+position
 * automatisch in die neue Vorlage uebernehmen.
 *
 * Rueckgabe:
 *   - error?: Fehlermeldung
 *   - mapped: wieviele Slot-Bilder konnten uebernommen werden
 *   - total:  wieviele Slots hat die neue Vorlage gesamt
 */
export async function setDatenblattTemplate(produktId: string, templateId: string | null) {
  const supabase = await createClient();

  // 1. Aktuelle Vorlage des Produkts lesen (fuer Mapping)
  const { data: produkt } = await supabase
    .from("produkte")
    .select("datenblatt_template_id")
    .eq("id", produktId)
    .single();
  const oldTemplateId = produkt?.datenblatt_template_id ?? null;

  // 2. Neue Vorlagen-ID setzen
  const { error: updErr } = await supabase
    .from("produkte")
    .update({ datenblatt_template_id: templateId })
    .eq("id", produktId);
  if (updErr) return { error: updErr.message, mapped: 0, total: 0 };

  // 3. Slot-Bilder uebernehmen (nur wenn beide Vorlagen verschieden + neue Vorlage gesetzt)
  let mapped = 0;
  let total = 0;
  if (templateId && oldTemplateId && templateId !== oldTemplateId) {
    const [{ data: oldT }, { data: newT }] = await Promise.all([
      supabase.from("datenblatt_templates").select("slots").eq("id", oldTemplateId).single(),
      supabase.from("datenblatt_templates").select("slots").eq("id", templateId).single(),
    ]);
    type SlotRef = { id: string; kind: string; position?: string };
    const oldSlots: SlotRef[] = (oldT?.slots as SlotRef[]) ?? [];
    const newSlots: SlotRef[] = (newT?.slots as SlotRef[]) ?? [];
    total = newSlots.length;

    if (oldSlots.length > 0 && newSlots.length > 0) {
      // Bestehende Slot-Bilder der alten Vorlage laden
      const { data: oldSlotImages } = await supabase
        .from("produkt_datenblatt_slots")
        .select("slot_id, storage_path")
        .eq("produkt_id", produktId)
        .eq("template_id", oldTemplateId);

      const oldPathById = new Map<string, string>();
      for (const r of oldSlotImages ?? []) {
        if (r.storage_path) oldPathById.set(r.slot_id, r.storage_path);
      }

      // Mapping: alter Slot (kind+position) → neuer Slot (kind+position)
      const upserts: Array<{ produkt_id: string; template_id: string; slot_id: string; storage_path: string }> = [];
      for (const newSlot of newSlots) {
        if (!newSlot.position) continue;
        const matchOld = oldSlots.find(
          (o) => o.kind === newSlot.kind && o.position === newSlot.position,
        );
        if (!matchOld) continue;
        const oldPath = oldPathById.get(matchOld.id);
        if (!oldPath) continue;
        upserts.push({
          produkt_id: produktId,
          template_id: templateId,
          slot_id: newSlot.id,
          storage_path: oldPath,
        });
      }

      if (upserts.length > 0) {
        const { error: upErr } = await supabase
          .from("produkt_datenblatt_slots")
          .upsert(upserts, { onConflict: "produkt_id,template_id,slot_id" });
        if (!upErr) mapped = upserts.length;
      }
    }
  } else if (templateId) {
    // Vorlage erstmals gesetzt — nur die Slot-Anzahl der neuen Vorlage zaehlen
    const { data: newT } = await supabase
      .from("datenblatt_templates")
      .select("slots")
      .eq("id", templateId)
      .single();
    total = ((newT?.slots as unknown[]) ?? []).length;
  }

  revalidatePath(`/produkte/${produktId}`);
  return { error: null, mapped, total };
}

export async function setSlotBild(produktId: string, templateId: string, slotId: string, storagePath: string | null) {
  const supabase = await createClient();
  if (storagePath === null) {
    const { error } = await supabase
      .from("produkt_datenblatt_slots")
      .delete()
      .eq("produkt_id", produktId).eq("template_id", templateId).eq("slot_id", slotId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("produkt_datenblatt_slots")
      .upsert({ produkt_id: produktId, template_id: templateId, slot_id: slotId, storage_path: storagePath }, {
        onConflict: "produkt_id,template_id,slot_id",
      });
    if (error) return { error: error.message };
  }
  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}

/** Liefert eine signed URL zu einem Pfad im Bucket `produktbilder` (1h). */
export async function getSlotBildSignedUrl(path: string): Promise<{ url: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("produktbilder").createSignedUrl(path, 60 * 60);
  return { url: data?.signedUrl ?? null };
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export async function uploadSlotBild(formData: FormData) {
  const file = formData.get("file") as File | null;
  const produktId = String(formData.get("produkt_id") ?? "");
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED.includes(file.type)) return { path: null, error: "Format nicht unterstützt." };
  if (file.size > 10 * 1024 * 1024) return { path: null, error: "Datei zu groß." };
  const supabase = await createClient();
  const { buffer, contentType, extension } = await compressImage(file);
  const path = `produkte/${produktId}/datenblatt/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, buffer, { contentType });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

// ----------------------------------------------------------------------------
// Bild-Tools für Produktbilder (Hauptbild + Datenblatt-Bilder).
// Alle Operationen arbeiten im Quadrat-Format (1024×1024) — passt zu Hauptbild,
// Detail-Bildern, Zeichnungen und Energielabel.
// ----------------------------------------------------------------------------

const PRODUKT_BILD_COLUMNS = [
  "hauptbild_path",
  "bild_detail_1_path",
  "bild_detail_2_path",
  "bild_zeichnung_1_path",
  "bild_zeichnung_2_path",
  "bild_zeichnung_3_path",
  "bild_energielabel_path",
] as const;
type ProduktBildColumn = (typeof PRODUKT_BILD_COLUMNS)[number];

/**
 * Persistiert einen neuen Storage-Pfad direkt in einer Bild-Spalte des Produkts.
 * Wird für Crop/KI-Bild/Mediathek-Replace im Bearbeiten-Modus genutzt, damit die
 * Änderung sofort wirksam ist (ohne Form-Submit).
 */
export async function replaceProduktBildPath(
  produktId: string,
  column: string,
  newPath: string,
): Promise<{ error: string | null }> {
  if (!PRODUKT_BILD_COLUMNS.includes(column as ProduktBildColumn)) {
    return { error: `Unbekannte Spalte: ${column}` };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("produkte")
    .update({ [column]: newPath })
    .eq("id", produktId);
  if (error) return { error: error.message };
  revalidatePath(`/produkte/${produktId}`);
  revalidatePath(`/produkte/${produktId}/bearbeiten`);
  return { error: null };
}

const PRODUKT_SQUARE = { width: 1024, height: 1024 } as const;

const produktCropSchema = z.object({
  path: z.string().min(1),
});

export type ProduktCropResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/** Smart-Crop auf 1:1 (1024×1024) via sharp.attention. Original bleibt erhalten. */
export async function cropProduktBild(input: unknown): Promise<ProduktCropResult> {
  const parsed = produktCropSchema.safeParse(input);
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
      .resize(PRODUKT_SQUARE.width, PRODUKT_SQUARE.height, {
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

  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "produkte";
  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `${dir}/crop-square-${Date.now()}-${rand}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}

const PRODUKT_MANUAL_ASPECT_TOLERANCE = 0.02;

const produktCropManuellSchema = z.object({
  path: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** Manuelles Crop auf 1:1 mit Pfleger-Koordinaten. Aspect-Toleranz ±2 %. */
export async function cropProduktBildManuell(input: unknown): Promise<ProduktCropResult> {
  const parsed = produktCropManuellSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Eingabe." };
  const { path, x, y, width, height } = parsed.data;

  const actualAspect = width / height;
  const aspectDelta = Math.abs(actualAspect - 1);
  if (aspectDelta > PRODUKT_MANUAL_ASPECT_TOLERANCE) {
    return {
      ok: false,
      error: `Crop-Verhältnis ${actualAspect.toFixed(3)} weicht vom 1:1-Verhältnis ab.`,
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
      .resize(PRODUKT_SQUARE.width, PRODUKT_SQUARE.height, {
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

  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "produkte";
  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `${dir}/crop-square-manual-${Date.now()}-${rand}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, croppedBuffer, { contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}

// KI-Bild-Generierung — gpt-image-2 1024×1024 nativ, kein Nach-Crop nötig.

const produktAiImageGenSchema = z.object({
  userPrompt: z.string().min(3, "Prompt zu kurz").max(500, "Prompt zu lang"),
  referencePath: z.string().min(1).optional().nullable(),
});

const PRODUKT_AI_SOURCE_SIZE: ImageSize = "1024x1024";

const produktAiRateLimit = new Map<string, { count: number; resetAt: number }>();
const PRODUKT_AI_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

function checkProduktAiRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = produktAiRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    produktAiRateLimit.set(key, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= PRODUKT_AI_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

export async function generateProduktBildKi(input: unknown): Promise<ProduktCropResult> {
  const parsed = produktAiImageGenSchema.safeParse(input);
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

  if (!checkProduktAiRateLimit(user.id)) {
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
        size: PRODUKT_AI_SOURCE_SIZE,
        quality: "high",
        apiKey: settings.openai_api_key,
      });
    } else {
      generated = await generateImage({
        userPrompt,
        size: PRODUKT_AI_SOURCE_SIZE,
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

  // gpt-image-2 liefert bereits 1024×1024 — wir re-encoden nur als JPEG
  // (kompakter als PNG, gut für Produktfotos).
  let outBuffer: Buffer;
  try {
    outBuffer = await sharp(generated.buffer, { failOn: "none" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Encoding-Fehler" };
  }

  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `produkte/ai-square-${Date.now()}-${rand}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("produktbilder")
    .upload(newPath, outBuffer, { contentType: "image/jpeg" });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  return { ok: true, path: newPath };
}
