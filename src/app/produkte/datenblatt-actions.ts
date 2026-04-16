"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setDatenblattTemplate(produktId: string, templateId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("produkte").update({ datenblatt_template_id: templateId }).eq("id", produktId);
  if (error) return { error: error.message };
  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
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

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export async function uploadSlotBild(formData: FormData) {
  const file = formData.get("file") as File | null;
  const produktId = String(formData.get("produkt_id") ?? "");
  if (!file || file.size === 0) return { path: null, error: "Keine Datei." };
  if (!ALLOWED.includes(file.type)) return { path: null, error: "Format nicht unterstützt." };
  if (file.size > 10 * 1024 * 1024) return { path: null, error: "Datei zu groß." };
  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `produkte/${produktId}/datenblatt/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, file, { contentType: file.type });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}
