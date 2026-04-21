"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";
import { compressImage } from "@/lib/image-compress";

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
  revalidatePath(`/kategorien/${id}/bearbeiten`);
  revalidateTag("kategorien", "max");
  revalidateTag("dashboard", "max");
  redirect("/kategorien?toast=success&message=Kategorie+gespeichert");
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
  const { buffer, contentType, extension } = await compressImage(file);
  const path = `kategorien/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, buffer, { contentType });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}
