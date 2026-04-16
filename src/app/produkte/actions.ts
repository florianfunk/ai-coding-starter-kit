"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ALL_PRODUKT_FIELDS } from "./fields";

const baseSchema = z.object({
  artikelnummer: z.string().min(1, "Artikelnummer ist Pflicht").max(120),
  bereich_id: z.string().uuid("Bereich Pflicht"),
  kategorie_id: z.string().uuid("Kategorie Pflicht"),
  name: z.string().max(300).optional().nullable(),
  sortierung: z.coerce.number().int().min(0).default(0),
  artikel_bearbeitet: z.coerce.boolean().default(false),
  hauptbild_path: z.string().optional().nullable(),
  datenblatt_titel: z.string().max(300).optional().nullable(),
  datenblatt_text: z.string().max(20000).optional().nullable(),
});

export type ProduktFormState = { error: string | null; fieldErrors?: Record<string, string> };

function flat(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] = i.message;
  return out;
}

function parseTechFields(formData: FormData): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of ALL_PRODUKT_FIELDS) {
    const v = formData.get(f.col);
    if (v == null || v === "") {
      out[f.col] = null;
    } else if (f.type === "number") {
      const n = Number(String(v).replace(",", "."));
      out[f.col] = Number.isFinite(n) ? n : null;
    } else if (f.type === "bool") {
      out[f.col] = v === "true" || v === "on" || v === "1";
    } else {
      out[f.col] = String(v);
    }
  }
  return out;
}

function parseBase(formData: FormData) {
  return baseSchema.safeParse({
    artikelnummer: formData.get("artikelnummer"),
    bereich_id: formData.get("bereich_id"),
    kategorie_id: formData.get("kategorie_id"),
    name: formData.get("name") || null,
    sortierung: formData.get("sortierung") || 0,
    artikel_bearbeitet: formData.get("artikel_bearbeitet") === "on",
    hauptbild_path: (formData.get("hauptbild_path") as string) || null,
    datenblatt_titel: formData.get("datenblatt_titel") || null,
    datenblatt_text: formData.get("datenblatt_text") || null,
  });
}

async function setProduktIcons(supabase: Awaited<ReturnType<typeof createClient>>, produktId: string, iconIds: string[]) {
  await supabase.from("produkt_icons").delete().eq("produkt_id", produktId);
  if (iconIds.length) {
    await supabase.from("produkt_icons").insert(
      iconIds.map((icon_id, i) => ({ produkt_id: produktId, icon_id, sortierung: i })),
    );
  }
}

export async function createProdukt(_p: ProduktFormState, formData: FormData): Promise<ProduktFormState> {
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: "Bitte Eingaben prüfen.", fieldErrors: flat(parsed.error) };
  const supabase = await createClient();

  const tech = parseTechFields(formData);
  const { data, error } = await supabase.from("produkte")
    .insert({ ...parsed.data, ...tech })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message?.includes("duplicate") || error?.code === "23505") {
      return { error: "Artikelnummer existiert bereits.", fieldErrors: { artikelnummer: "Bereits vergeben" } };
    }
    return { error: error?.message ?? "Fehler beim Anlegen" };
  }

  const iconIds = formData.getAll("icon_ids").map(String).filter(Boolean);
  await setProduktIcons(supabase, data.id, iconIds);

  revalidatePath("/produkte");
  redirect(`/produkte/${data.id}`);
}

export async function updateProdukt(id: string, _p: ProduktFormState, formData: FormData): Promise<ProduktFormState> {
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: "Bitte Eingaben prüfen.", fieldErrors: flat(parsed.error) };

  const supabase = await createClient();
  const tech = parseTechFields(formData);
  const { error } = await supabase.from("produkte").update({ ...parsed.data, ...tech }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Artikelnummer existiert bereits.", fieldErrors: { artikelnummer: "Bereits vergeben" } };
    return { error: error.message };
  }

  const iconIds = formData.getAll("icon_ids").map(String).filter(Boolean);
  await setProduktIcons(supabase, id, iconIds);

  revalidatePath("/produkte");
  revalidatePath(`/produkte/${id}`);
  return { error: null };
}

export async function deleteProdukt(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("produkte").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/produkte");
  redirect("/produkte");
}

export async function duplicateProdukt(id: string): Promise<{ id?: string; error: string | null }> {
  const supabase = await createClient();
  const { data: src } = await supabase.from("produkte").select("*").eq("id", id).single();
  if (!src) return { error: "Produkt nicht gefunden." };
  const copy = { ...src } as any;
  delete copy.id; delete copy.external_id; delete copy.created_at; delete copy.updated_at;
  delete copy.created_by; delete copy.updated_by; delete copy.search_vector;
  copy.artikelnummer = `${src.artikelnummer}-copy`;
  copy.artikel_bearbeitet = false;
  const { data, error } = await supabase.from("produkte").insert(copy).select("id").single();
  if (error || !data) return { error: error?.message ?? "Duplikat fehlgeschlagen" };
  revalidatePath("/produkte");
  return { id: data.id, error: null };
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export async function uploadProduktBild(formData: FormData) {
  const file = formData.get("file") as File | null;
  const produktId = String(formData.get("produkt_id") ?? "main");
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED.includes(file.type)) return { path: null, error: "Format nicht unterstützt." };
  if (file.size > 10 * 1024 * 1024) return { path: null, error: "Datei zu groß." };
  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `produkte/${produktId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, file, { contentType: file.type });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function addGalerieBild(produktId: string, storagePath: string, altText: string | null) {
  const supabase = await createClient();
  const { count } = await supabase.from("produkt_bilder").select("*", { count: "exact", head: true }).eq("produkt_id", produktId);
  const { error } = await supabase.from("produkt_bilder")
    .insert({ produkt_id: produktId, storage_path: storagePath, sortierung: count ?? 0, alt_text: altText });
  if (error) return { error: error.message };
  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}

export async function deleteGalerieBild(bildId: string, produktId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("produkt_bilder").delete().eq("id", bildId);
  if (error) return { error: error.message };
  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}
