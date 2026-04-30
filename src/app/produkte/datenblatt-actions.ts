"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { compressImage } from "@/lib/image-compress";

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
