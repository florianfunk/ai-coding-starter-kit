"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
    beschreibung: formData.get("beschreibung") || null,
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
  const { error } = await supabase.from("bereiche").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/bereiche");
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
  revalidatePath("/bereiche");
  revalidatePath(`/bereiche/${id}`);
  redirect("/bereiche?toast=success&message=Bereich+gespeichert");
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

  const { error } = await supabase.from("bereiche").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/bereiche");
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
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `bereiche/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

function flattenErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}
