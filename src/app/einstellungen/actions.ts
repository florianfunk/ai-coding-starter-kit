"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const filialeSchema = z.object({
  marke: z.enum(["lichtengros", "eisenkeil"]),
  name: z.string().min(1, "Name ist Pflicht"),
  land: z.string().max(10).optional().nullable(),
  adresse: z.string().max(2000).optional().nullable(),
  telefon: z.string().max(60).optional().nullable(),
  fax: z.string().max(60).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  sortierung: z.coerce.number().int().min(0).default(0),
});

export type FilialeFormState = { error: string | null; fieldErrors?: Record<string, string> };

function flat(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}

function parseFiliale(formData: FormData) {
  return filialeSchema.safeParse({
    marke: formData.get("marke"),
    name: formData.get("name"),
    land: formData.get("land") || null,
    adresse: formData.get("adresse") || null,
    telefon: formData.get("telefon") || null,
    fax: formData.get("fax") || null,
    email: formData.get("email") || null,
    sortierung: formData.get("sortierung") || 0,
  });
}

export async function createFiliale(_p: FilialeFormState, formData: FormData): Promise<FilialeFormState> {
  const parsed = parseFiliale(formData);
  if (!parsed.success) return { error: "Bitte prüfen.", fieldErrors: flat(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("filialen").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/einstellungen");
  return { error: null };
}

export async function updateFiliale(id: string, _p: FilialeFormState, formData: FormData): Promise<FilialeFormState> {
  const parsed = parseFiliale(formData);
  if (!parsed.success) return { error: "Bitte prüfen.", fieldErrors: flat(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("filialen").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/einstellungen");
  return { error: null };
}

export async function deleteFiliale(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("filialen").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/einstellungen");
  return { error: null };
}

const katalogSchema = z.object({
  copyright_lichtengros: z.string().max(4000).optional().nullable(),
  copyright_eisenkeil: z.string().max(4000).optional().nullable(),
  gueltig_bis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("").transform(() => null)),
  wechselkurs_eur_chf: z.coerce.number().min(0).default(1),
});

export async function updateKatalogEinstellungen(_p: FilialeFormState, formData: FormData): Promise<FilialeFormState> {
  const parsed = katalogSchema.safeParse({
    copyright_lichtengros: formData.get("copyright_lichtengros") || null,
    copyright_eisenkeil: formData.get("copyright_eisenkeil") || null,
    gueltig_bis: formData.get("gueltig_bis") || null,
    wechselkurs_eur_chf: formData.get("wechselkurs_eur_chf") || 1,
  });
  if (!parsed.success) return { error: "Eingabe ungültig.", fieldErrors: flat(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("katalog_einstellungen").update(parsed.data).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/einstellungen");
  return { error: null };
}

const ASSET_FIELDS = [
  "cover_vorne_path", "cover_hinten_path",
  "logo_lichtengros_dunkel", "logo_lichtengros_hell",
  "logo_eisenkeil_dunkel", "logo_eisenkeil_hell",
  "logo_lichtstudio",
] as const;
type AssetField = (typeof ASSET_FIELDS)[number];

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export async function uploadAsset(formData: FormData) {
  const file = formData.get("file") as File | null;
  const field = String(formData.get("field") ?? "") as AssetField;
  if (!file || file.size === 0) return { error: "Keine Datei.", path: null };
  if (!ALLOWED.includes(file.type)) return { error: "Format nicht unterstützt.", path: null };
  if (file.size > 10 * 1024 * 1024) return { error: "Datei zu groß.", path: null };
  if (!ASSET_FIELDS.includes(field)) return { error: "Unbekanntes Feld.", path: null };

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${field}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type });
  if (error) return { error: error.message, path: null };
  // Update the singleton row
  await supabase.from("katalog_einstellungen").update({ [field]: path }).eq("id", 1);
  revalidatePath("/einstellungen");
  return { error: null, path };
}
