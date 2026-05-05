"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const wizardSchema = z.object({
  layout: z.enum(["lichtengros", "eisenkeil"]),
  preisauswahl: z.enum(["lichtengros", "eisenkeil", "listenpreis"]),
  preisAenderung: z.enum(["plus", "minus"]),
  preisProzent: z.coerce.number().min(0).max(100),
  waehrung: z.enum(["EUR", "CHF"]),
  sprache: z.literal("de"),
  produktIds: z.array(z.string().uuid()).nullable(),
  kundeId: z.string().uuid().nullable().optional(),
});

export type StartWizardJobInput = z.infer<typeof wizardSchema>;
export type StartWizardJobResult = { jobId?: string; error: string | null };

export async function startKatalogWizardJob(
  input: StartWizardJobInput,
): Promise<StartWizardJobResult> {
  const parsed = wizardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  if (parsed.data.produktIds && parsed.data.produktIds.length === 0) {
    return { error: "Bitte mindestens ein Produkt auswählen." };
  }

  const supabase = await createClient();

  // Wechselkurs zum Zeitpunkt des Jobs einfrieren (siehe Tech Design)
  const { data: einstellungen } = await supabase
    .from("katalog_einstellungen")
    .select("wechselkurs_eur_chf")
    .eq("id", 1)
    .single();
  const wechselkurs = Number(einstellungen?.wechselkurs_eur_chf ?? 1);
  if (parsed.data.waehrung === "CHF" && (!wechselkurs || wechselkurs <= 0)) {
    return { error: "Wechselkurs in Einstellungen fehlt — bitte zuerst pflegen." };
  }

  const { kundeId, ...parameterFields } = parsed.data;
  const parameter = {
    ...parameterFields,
    wechselkurs,
  };

  const { data: job, error } = await supabase
    .from("katalog_jobs")
    .insert({
      status: "queued",
      parameter: parameter as never,
      typ: "katalog",
      kunde_id: kundeId ?? null,
    })
    .select("id")
    .single();
  if (error || !job) return { error: error?.message ?? "Job-Anlage fehlgeschlagen" };

  revalidatePath("/export/katalog");
  if (kundeId) revalidatePath(`/kunden/${kundeId}/druckhistorie`);
  return { jobId: job.id, error: null };
}
