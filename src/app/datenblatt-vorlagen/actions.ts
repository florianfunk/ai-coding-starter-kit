"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Slot } from "@/lib/datenblatt";

const slotSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  x_cm: z.number().min(0).max(100),
  y_cm: z.number().min(0).max(100),
  width_cm: z.number().min(0.5).max(100),
  height_cm: z.number().min(0.5).max(100),
  kind: z.enum(["image", "energielabel", "cutting"]),
});

const templateSchema = z.object({
  name: z.string().min(1, "Name ist Pflicht").max(200),
  beschreibung: z.string().max(1000).optional().nullable(),
  page_width_cm: z.coerce.number().min(5).max(100),
  page_height_cm: z.coerce.number().min(5).max(100),
  slots: z.array(slotSchema),
  sortierung: z.coerce.number().int().min(0).default(0),
});

export async function createTemplate(input: z.infer<typeof templateSchema>) {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültig", id: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("datenblatt_templates")
    .insert({ ...parsed.data, slots: parsed.data.slots, is_system: false })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Fehler", id: null };
  revalidatePath("/datenblatt-vorlagen");
  revalidateTag("datenblatt-templates", "max");
  return { error: null, id: data.id };
}

export async function updateTemplate(id: string, input: z.infer<typeof templateSchema>) {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültig" };
  const supabase = await createClient();

  // Prevent editing system templates' slots/name, but allow description
  const { data: existing } = await supabase.from("datenblatt_templates").select("is_system").eq("id", id).single();
  if (existing?.is_system) {
    return { error: "System-Vorlagen können nicht geändert werden." };
  }

  const { error } = await supabase
    .from("datenblatt_templates")
    .update({ ...parsed.data, slots: parsed.data.slots })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/datenblatt-vorlagen");
  revalidatePath(`/datenblatt-vorlagen/${id}`);
  revalidateTag("datenblatt-templates", "max");
  return { error: null };
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("datenblatt_templates").select("is_system").eq("id", id).single();
  if (existing?.is_system) return { error: "System-Vorlagen können nicht gelöscht werden." };

  // Check usage
  const { count } = await supabase.from("produkte").select("*", { count: "exact", head: true }).eq("datenblatt_template_id", id);
  if ((count ?? 0) > 0) return { error: `${count} Produkte verwenden diese Vorlage. Bitte erst umstellen.` };

  const { error } = await supabase.from("datenblatt_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/datenblatt-vorlagen");
  revalidateTag("datenblatt-templates", "max");
  return { error: null };
}

export async function duplicateTemplate(id: string) {
  const supabase = await createClient();
  const { data: src } = await supabase.from("datenblatt_templates").select("*").eq("id", id).single();
  if (!src) return { error: "Nicht gefunden", id: null };
  const { data, error } = await supabase
    .from("datenblatt_templates")
    .insert({
      name: `${src.name} (Kopie)`,
      beschreibung: src.beschreibung,
      is_system: false,
      page_width_cm: src.page_width_cm,
      page_height_cm: src.page_height_cm,
      slots: src.slots,
      sortierung: src.sortierung + 1,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Fehler", id: null };
  revalidatePath("/datenblatt-vorlagen");
  revalidateTag("datenblatt-templates", "max");
  return { error: null, id: data.id };
}
