"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { nextKundenNr } from "./kunden-nr-generator";
import {
  stammdatenSchema,
  preiseSchema,
  auswahlSchema,
  brancheSchema,
  datenblattJobSchema,
} from "./schemas";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === "" || out[key] === undefined) out[key] = null;
  }
  return out as T;
}

export async function suggestNextKundenNr(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("kunden").select("kunden_nr");
  return nextKundenNr((data ?? []).map((k) => k.kunden_nr as string));
}

// ----------------------------------------------------------------------------
// CRUD: Kunden
// ----------------------------------------------------------------------------

export type KundeActionResult = {
  ok: boolean;
  kundeId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function buildPayload(parsed: z.infer<typeof stammdatenSchema>) {
  return emptyToNull({
    kunden_nr: parsed.kunden_nr,
    firma: parsed.firma,
    ansprechpartner: parsed.ansprechpartner ?? null,
    email: parsed.email ?? null,
    telefon: parsed.telefon ?? null,
    website: parsed.website ?? null,
    strasse: parsed.strasse ?? null,
    plz: parsed.plz ?? null,
    ort: parsed.ort ?? null,
    land: parsed.land ?? null,
    standard_filiale: parsed.standard_filiale ?? null,
    notizen: parsed.notizen ?? null,
    status: parsed.status,
  });
}

async function syncBranchen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kundeId: string,
  brancheIds: string[],
) {
  await supabase.from("kunde_branche").delete().eq("kunde_id", kundeId);
  if (brancheIds.length > 0) {
    const rows = brancheIds.map((bid) => ({ kunde_id: kundeId, branche_id: bid }));
    const { error } = await supabase.from("kunde_branche").insert(rows);
    if (error) throw new Error(`Branchen-Zuordnung fehlgeschlagen: ${error.message}`);
  }
}

export async function createKunde(
  input: z.input<typeof stammdatenSchema>,
): Promise<KundeActionResult> {
  const parsed = stammdatenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { data: dup } = await supabase
    .from("kunden")
    .select("id, firma")
    .eq("kunden_nr", parsed.data.kunden_nr)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      fieldErrors: {
        kunden_nr: `Kunden-Nr. ${parsed.data.kunden_nr} ist bereits vergeben (${dup.firma})`,
      },
    };
  }

  const { data: created, error } = await supabase
    .from("kunden")
    .insert(buildPayload(parsed.data))
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      return {
        ok: false,
        fieldErrors: {
          kunden_nr: `Kunden-Nr. ${parsed.data.kunden_nr} ist bereits vergeben`,
        },
      };
    }
    return { ok: false, error: error?.message ?? "Anlegen fehlgeschlagen" };
  }

  try {
    await syncBranchen(supabase, created.id, parsed.data.branche_ids);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/kunden");
  return { ok: true, kundeId: created.id };
}

export async function updateKunde(
  id: string,
  input: z.input<typeof stammdatenSchema>,
): Promise<KundeActionResult> {
  const parsed = stammdatenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { data: dup } = await supabase
    .from("kunden")
    .select("id, firma")
    .eq("kunden_nr", parsed.data.kunden_nr)
    .neq("id", id)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      fieldErrors: {
        kunden_nr: `Kunden-Nr. ${parsed.data.kunden_nr} ist bereits vergeben (${dup.firma})`,
      },
    };
  }

  const { error } = await supabase
    .from("kunden")
    .update(buildPayload(parsed.data))
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        fieldErrors: {
          kunden_nr: `Kunden-Nr. ${parsed.data.kunden_nr} ist bereits vergeben`,
        },
      };
    }
    return { ok: false, error: error.message };
  }

  try {
    await syncBranchen(supabase, id, parsed.data.branche_ids);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/kunden");
  revalidatePath(`/kunden/${id}/stammdaten`);
  return { ok: true, kundeId: id };
}

export async function deleteKunde(id: string): Promise<KundeActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("kunden").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kunden");
  return { ok: true };
}

export async function setKundeStatus(
  id: string,
  status: "aktiv" | "archiviert",
): Promise<KundeActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("kunden").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kunden");
  revalidatePath(`/kunden/${id}/stammdaten`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Duplizieren
// ----------------------------------------------------------------------------

export async function duplicateKunde(id: string): Promise<KundeActionResult> {
  const supabase = await createClient();

  const { data: original, error: loadErr } = await supabase
    .from("kunden")
    .select("*")
    .eq("id", id)
    .single();
  if (loadErr || !original) {
    return { ok: false, error: loadErr?.message ?? "Original nicht gefunden" };
  }

  const newNr = await suggestNextKundenNr();

  const insert = {
    kunden_nr: newNr,
    firma: "",
    standard_filiale: original.standard_filiale,
    preis_spur: original.preis_spur,
    aufschlag_vorzeichen: original.aufschlag_vorzeichen,
    aufschlag_pct: original.aufschlag_pct,
    alle_produkte: original.alle_produkte,
    status: "aktiv" as const,
    land: original.land,
  };

  const { data: copy, error: insErr } = await supabase
    .from("kunden")
    .insert(insert)
    .select("id")
    .single();
  if (insErr || !copy) {
    return { ok: false, error: insErr?.message ?? "Anlegen der Kopie fehlgeschlagen" };
  }

  const { data: branchen } = await supabase
    .from("kunde_branche")
    .select("branche_id")
    .eq("kunde_id", id);
  if (branchen && branchen.length > 0) {
    await supabase
      .from("kunde_branche")
      .insert(branchen.map((b) => ({ kunde_id: copy.id, branche_id: b.branche_id })));
  }

  if (!original.alle_produkte) {
    const { data: produkte } = await supabase
      .from("kunde_produkt")
      .select("produkt_id")
      .eq("kunde_id", id);
    if (produkte && produkte.length > 0) {
      await supabase
        .from("kunde_produkt")
        .insert(produkte.map((p) => ({ kunde_id: copy.id, produkt_id: p.produkt_id })));
    }
  }

  revalidatePath("/kunden");
  return { ok: true, kundeId: copy.id };
}

// ----------------------------------------------------------------------------
// Auswahl (Whitelist)
// ----------------------------------------------------------------------------

export async function saveAuswahl(
  kundeId: string,
  input: z.input<typeof auswahlSchema>,
): Promise<KundeActionResult> {
  const parsed = auswahlSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { error: flagErr } = await supabase
    .from("kunden")
    .update({ alle_produkte: parsed.data.alle_produkte })
    .eq("id", kundeId);
  if (flagErr) return { ok: false, error: flagErr.message };

  if (parsed.data.alle_produkte) {
    await supabase.from("kunde_produkt").delete().eq("kunde_id", kundeId);
  } else {
    await supabase.from("kunde_produkt").delete().eq("kunde_id", kundeId);
    if (parsed.data.produkt_ids.length > 0) {
      const rows = parsed.data.produkt_ids.map((pid) => ({
        kunde_id: kundeId,
        produkt_id: pid,
      }));
      const { error } = await supabase.from("kunde_produkt").insert(rows);
      if (error) return { ok: false, error: error.message };
    }
  }

  revalidatePath(`/kunden/${kundeId}/auswahl`);
  return { ok: true, kundeId };
}

// ----------------------------------------------------------------------------
// Preise
// ----------------------------------------------------------------------------

export async function savePreise(
  kundeId: string,
  input: z.input<typeof preiseSchema>,
): Promise<KundeActionResult> {
  const parsed = preiseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kunden")
    .update({
      preis_spur: parsed.data.preis_spur,
      aufschlag_vorzeichen: parsed.data.aufschlag_vorzeichen,
      aufschlag_pct: parsed.data.aufschlag_pct,
    })
    .eq("id", kundeId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/kunden/${kundeId}/preise`);
  return { ok: true, kundeId };
}

// ----------------------------------------------------------------------------
// Branchen-CRUD
// ----------------------------------------------------------------------------

export async function createBranche(
  input: z.input<typeof brancheSchema>,
): Promise<KundeActionResult> {
  const parsed = brancheSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kunden_branchen")
    .insert({ name: parsed.data.name.trim() })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        fieldErrors: { name: `Branche "${parsed.data.name}" existiert bereits` },
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/kunden/branchen");
  return { ok: true, kundeId: data.id };
}

export async function updateBranche(
  id: string,
  input: z.input<typeof brancheSchema>,
): Promise<KundeActionResult> {
  const parsed = brancheSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kunden_branchen")
    .update({ name: parsed.data.name.trim() })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        fieldErrors: { name: `Branche "${parsed.data.name}" existiert bereits` },
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/kunden/branchen");
  return { ok: true };
}

export async function deleteBranche(id: string): Promise<KundeActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("kunde_branche")
    .select("*", { count: "exact", head: true })
    .eq("branche_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Branche wird von ${count} Kunde${count === 1 ? "" : "n"} genutzt — bitte zuerst dort entfernen.`,
    };
  }

  const { error } = await supabase.from("kunden_branchen").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/kunden/branchen");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Datenblatt-Job (typ='datenblatt') — Stub fuer Job-Erzeugung
// ----------------------------------------------------------------------------

export async function startDatenblattJobFuerKunde(
  input: z.input<typeof datenblattJobSchema>,
): Promise<{ jobId?: string; error?: string }> {
  const parsed = datenblattJobSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const supabase = await createClient();

  const { data: kunde } = await supabase
    .from("kunden")
    .select("preis_spur, aufschlag_vorzeichen, aufschlag_pct, firma, kunden_nr")
    .eq("id", parsed.data.kunde_id)
    .single();
  if (!kunde) return { error: "Kunde nicht gefunden" };

  const parameter = {
    typ: "datenblatt",
    produkt_id: parsed.data.produkt_id,
    preis_spur: kunde.preis_spur,
    aufschlag_vorzeichen: kunde.aufschlag_vorzeichen,
    aufschlag_pct: Number(kunde.aufschlag_pct),
    kunde_label: `${kunde.firma} (${kunde.kunden_nr})`,
  };

  const { data: job, error } = await supabase
    .from("katalog_jobs")
    .insert({
      status: "queued",
      typ: "datenblatt",
      kunde_id: parsed.data.kunde_id,
      produkt_id: parsed.data.produkt_id,
      parameter: parameter as never,
    })
    .select("id")
    .single();
  if (error || !job) return { error: error?.message ?? "Job-Anlage fehlgeschlagen" };

  revalidatePath(`/kunden/${parsed.data.kunde_id}/druckhistorie`);
  return { jobId: job.id };
}

// ----------------------------------------------------------------------------
// Navigation-Helper: anlegen + redirect
// ----------------------------------------------------------------------------

export async function createKundeAndRedirect(
  input: z.input<typeof stammdatenSchema>,
): Promise<KundeActionResult> {
  const result = await createKunde(input);
  if (!result.ok || !result.kundeId) return result;
  redirect(`/kunden/${result.kundeId}/stammdaten`);
}

// ----------------------------------------------------------------------------
// Internal
// ----------------------------------------------------------------------------

function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
