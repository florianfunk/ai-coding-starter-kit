"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  upscaleImage,
  removeBackground,
  downloadReplicateOutput,
} from "@/lib/replicate";

// ----------------------------------------------------------------------------
// AI-Einstellungen: Replicate-Token speichern
// ----------------------------------------------------------------------------

const aiSchema = z.object({
  replicate_token: z.string().max(200).optional().nullable(),
});

export type AiFormState = { error: string | null };

export async function updateAiEinstellungen(_p: AiFormState, formData: FormData): Promise<AiFormState> {
  const parsed = aiSchema.safeParse({
    replicate_token: (formData.get("replicate_token") as string) || null,
  });
  if (!parsed.success) return { error: "Eingabe ungültig." };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_einstellungen").update(parsed.data).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/einstellungen");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Bild-Enhance: Upscale oder BG-Removal
// ----------------------------------------------------------------------------

const enhanceSchema = z.object({
  bucket: z.enum(["produktbilder", "assets"]),
  path: z.string().min(1),
  operation: z.enum(["upscale", "remove-bg"]),
  /**
   * Wenn true, wird das Original nach erfolgreichem Upload des Ergebnisses
   * aus dem Storage gelöscht. Default: false (Aufrufer entscheidet selbst,
   * wann das Original weg kann — z.B. erst nach Formular-Submit).
   */
  deleteOriginal: z.boolean().optional().default(false),
});

export type EnhanceResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Läuft ein Bild durch Replicate (Upscale oder BG-Removal), lädt das Ergebnis
 * ins selbe Bucket hoch und gibt den neuen Storage-Pfad zurück. Der Aufrufer
 * muss den Pfad in der jeweiligen DB-Spalte persistieren.
 *
 * `deleteOriginal` sollte nur true sein, wenn der neue Pfad direkt von einer
 * Persist-Action geschrieben wird (Galerie/Kategorie/Logos). Bei Form-State-
 * Kontexten (Datenblatt-Slots) bleibt das Original stehen, damit beim Abbruch
 * des Formulars keine Referenz auf eine gelöschte Datei entsteht.
 *
 * Fehler werden als `{ ok: false, error }` zurückgegeben (statt throw), damit
 * die echte Replicate-Fehlermeldung im UI ankommt statt Next.js' generischer
 * "An error occurred" in Production.
 */
export async function enhanceBild(input: unknown): Promise<EnhanceResult> {
  const parsed = enhanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Eingabe." };
  const { bucket, path, operation, deleteOriginal } = parsed.data;

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Nicht angemeldet." };

  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (!signed?.signedUrl) return { ok: false, error: "Signed URL konnte nicht erstellt werden." };

  let outputUrl: string;
  try {
    outputUrl = operation === "upscale"
      ? await upscaleImage(signed.signedUrl)
      : await removeBackground(signed.signedUrl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Replicate-Fehler" };
  }

  let downloaded: { buffer: Buffer; contentType: string };
  try {
    downloaded = await downloadReplicateOutput(outputUrl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Download fehlgeschlagen" };
  }

  const suffix = operation === "upscale" ? "upscaled" : "nobg";
  const ext = downloaded.contentType.includes("png") ? "png"
    : downloaded.contentType.includes("webp") ? "webp"
    : "jpg";
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const rand = Math.random().toString(36).slice(2, 8);
  const newPath = `${dir ? dir + "/" : ""}${Date.now()}-${rand}-${suffix}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(newPath, downloaded.buffer, { contentType: downloaded.contentType });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  if (deleteOriginal) {
    await supabase.storage.from(bucket).remove([path]);
  }

  return { ok: true, path: newPath };
}
