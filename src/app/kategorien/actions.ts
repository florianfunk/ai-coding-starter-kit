"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  bereich_id: z.string().uuid("Bereich ist Pflicht"),
  name: z.string().min(1, "Name ist Pflicht").max(200),
  beschreibung: z.string().max(4000).optional().nullable(),
  sortierung: z.coerce.number().int().min(0).default(0),
  vorschaubild_path: z.string().optional().nullable(),
});

export type KategorieFormState = { error: string | null; fieldErrors?: Record<string, string> };

function parse(formData: FormData) {
  return schema.safeParse({
    bereich_id: formData.get("bereich_id"),
    name: formData.get("name"),
    beschreibung: formData.get("beschreibung") || null,
    sortierung: formData.get("sortierung") || 0,
    vorschaubild_path: (formData.get("vorschaubild_path") as string) || null,
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
    const rows = iconIds.map((icon_id) => ({ kategorie_id: kategorieId, icon_id }));
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

  revalidatePath("/kategorien");
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

  revalidatePath("/kategorien");
  revalidatePath(`/kategorien/${id}/bearbeiten`);
  redirect("/kategorien?toast=success&message=Kategorie+gespeichert");
}

export async function deleteKategorie(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { count } = await supabase.from("produkte").select("*", { count: "exact", head: true }).eq("kategorie_id", id);
  if ((count ?? 0) > 0) return { error: `${count} Produkte verweisen auf diese Kategorie.` };
  const { error } = await supabase.from("kategorien").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/kategorien");
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

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export async function uploadKategorieBild(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED.includes(file.type)) return { path: null, error: "Format nicht unterstützt." };
  if (file.size > 10 * 1024 * 1024) return { path: null, error: "Datei zu groß (max. 10 MB)." };
  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `kategorien/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, file, { contentType: file.type });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}
