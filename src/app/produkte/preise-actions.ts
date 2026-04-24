"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PreisSpur = "lichtengros" | "eisenkeil" | "listenpreis";

export type PreisRow = {
  id: string;
  produkt_id: string;
  spur: PreisSpur;
  gueltig_ab: string;
  preis: number;
  quelle: string;
  created_at: string;
};

export type AddPreisInput = {
  spur: PreisSpur;
  gueltig_ab: string;
  preis: number;
};

export type UpdatePreisInput = {
  gueltig_ab: string;
  preis: number;
};

const spurEnum = z.enum(["lichtengros", "eisenkeil", "listenpreis"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const preisSchema = z.number().min(0, "Preis darf nicht negativ sein");

const addSchema = z.object({
  spur: spurEnum,
  gueltig_ab: dateSchema,
  preis: preisSchema,
});

const updateSchema = z.object({
  gueltig_ab: dateSchema,
  preis: preisSchema,
});

export async function addPreis(
  produktId: string,
  input: AddPreisInput,
): Promise<{ error: string | null; preis: PreisRow | null }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe", preis: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("preise")
    .insert({
      produkt_id: produktId,
      spur: parsed.data.spur,
      gueltig_ab: parsed.data.gueltig_ab,
      preis: parsed.data.preis,
      quelle: "manuell",
    })
    .select("id, produkt_id, spur, gueltig_ab, preis, quelle, created_at")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Preis konnte nicht gespeichert werden", preis: null };
  }

  revalidatePath(`/produkte/${produktId}`);
  return { error: null, preis: data as PreisRow };
}

export async function updatePreis(
  preisId: string,
  produktId: string,
  input: UpdatePreisInput,
): Promise<{ error: string | null; preis: PreisRow | null }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe", preis: null };
  }

  const supabase = await createClient();

  const { data: current, error: loadErr } = await supabase
    .from("preise")
    .select("quelle")
    .eq("id", preisId)
    .single();
  if (loadErr || !current) {
    return { error: loadErr?.message ?? "Preis nicht gefunden", preis: null };
  }

  const neueQuelle = current.quelle.startsWith("import:") && !current.quelle.includes("(manuell geändert)")
    ? `${current.quelle} (manuell geändert)`
    : current.quelle;

  const { data, error } = await supabase
    .from("preise")
    .update({
      gueltig_ab: parsed.data.gueltig_ab,
      preis: parsed.data.preis,
      quelle: neueQuelle,
    })
    .eq("id", preisId)
    .select("id, produkt_id, spur, gueltig_ab, preis, quelle, created_at")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Preis konnte nicht aktualisiert werden", preis: null };
  }

  revalidatePath(`/produkte/${produktId}`);
  return { error: null, preis: data as PreisRow };
}

export async function deletePreis(
  preisId: string,
  produktId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("preise").delete().eq("id", preisId);
  if (error) return { error: error.message };
  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}
