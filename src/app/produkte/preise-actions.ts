"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PreisInput = {
  gueltig_ab: string;
  ek: number | null;
  listenpreis: number;
  deactivateOthers: boolean;
};

const schema = z.object({
  gueltig_ab: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum erforderlich"),
  ek: z.number().min(0).nullable(),
  listenpreis: z.number().min(0, "Listenpreis ≥ 0"),
  deactivateOthers: z.boolean(),
});

export async function addPreis(produktId: string, input: PreisInput) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültig", preis: null };

  const supabase = await createClient();

  if (parsed.data.deactivateOthers) {
    await supabase.from("preise").update({ status: "inaktiv" }).eq("produkt_id", produktId).eq("status", "aktiv");
  }

  const { data, error } = await supabase
    .from("preise")
    .insert({
      produkt_id: produktId,
      gueltig_ab: parsed.data.gueltig_ab,
      ek: parsed.data.ek,
      listenpreis: parsed.data.listenpreis,
      status: "aktiv",
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Fehler", preis: null };
  revalidatePath(`/produkte/${produktId}`);
  return { error: null, preis: data };
}

export async function deletePreis(preisId: string, produktId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("preise").delete().eq("id", preisId);
  if (error) return { error: error.message };
  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}
