"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { compressImage } from "@/lib/image-compress";

const schema = z.object({
  label: z.string().min(1, "Name ist Pflicht").max(80),
  gruppe: z.string().max(60).optional().nullable().or(z.literal("").transform(() => null)),
  sortierung: z.coerce.number().int().min(0).default(0),
  symbol_path: z.string().optional().nullable(),
  show_as_symbol: z.coerce.boolean().default(false),
});

export type IconFormState = { error: string | null; fieldErrors?: Record<string, string> };

function flat(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}

function parse(formData: FormData) {
  return schema.safeParse({
    label: formData.get("label"),
    gruppe: formData.get("gruppe") || null,
    sortierung: formData.get("sortierung") || 0,
    symbol_path: (formData.get("symbol_path") as string) || null,
    show_as_symbol: formData.get("show_as_symbol") === "on",
  });
}

export async function createIcon(_p: IconFormState, formData: FormData): Promise<IconFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Bitte prüfen.", fieldErrors: flat(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("icons").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/icons");
  return { error: null };
}

export async function updateIcon(id: string, _p: IconFormState, formData: FormData): Promise<IconFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Bitte prüfen.", fieldErrors: flat(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("icons").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/icons");
  return { error: null };
}

export async function bulkSetShowAsSymbol(
  ids: string[],
  value: boolean,
): Promise<{ error: string | null; updated: number }> {
  if (!ids.length) return { error: null, updated: 0 };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("icons")
    .update({ show_as_symbol: value }, { count: "exact" })
    .in("id", ids);
  if (error) return { error: error.message, updated: 0 };
  revalidatePath("/icons");
  return { error: null, updated: count ?? 0 };
}

export async function deleteIcon(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Check if icon is used
  const [{ count: katCount }, { count: prodCount }] = await Promise.all([
    supabase.from("kategorie_icons").select("*", { count: "exact", head: true }).eq("icon_id", id),
    supabase.from("produkt_icons").select("*", { count: "exact", head: true }).eq("icon_id", id),
  ]);
  const total = (katCount ?? 0) + (prodCount ?? 0);
  if (total > 0) {
    return { error: `Icon wird noch verwendet (${katCount ?? 0} Kategorien, ${prodCount ?? 0} Produkte). Bitte erst entfernen.` };
  }

  const { error } = await supabase.from("icons").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/icons");
  return { error: null };
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf"];

export async function uploadIconBild(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED.includes(file.type)) {
    return { path: null, error: "Format nicht unterstützt (PNG/JPG/SVG/PDF)." };
  }
  if (file.size > 5 * 1024 * 1024) return { path: null, error: "Datei zu groß (max. 5 MB)." };
  const supabase = await createClient();
  const { buffer, contentType, extension } = await compressImage(file);
  const path = `icons/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, buffer, {
    contentType,
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}
