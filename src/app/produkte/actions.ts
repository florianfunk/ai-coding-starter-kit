"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";
import { compressImage } from "@/lib/image-compress";
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
  datenblatt_text_2: z.string().max(20000).optional().nullable(),
  datenblatt_text_3: z.string().max(20000).optional().nullable(),
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
    datenblatt_text: sanitizeRichTextHtml(formData.get("datenblatt_text") as string | null) || null,
    datenblatt_text_2: sanitizeRichTextHtml(formData.get("datenblatt_text_2") as string | null) || null,
    datenblatt_text_3: sanitizeRichTextHtml(formData.get("datenblatt_text_3") as string | null) || null,
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
  revalidateTag("dashboard", "max");
  redirect(`/produkte/${data.id}?toast=success&message=Produkt+angelegt`);
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

  await logAudit(supabase, { tableName: "produkte", recordId: id, action: "update", recordLabel: parsed.data.artikelnummer });

  revalidatePath("/produkte");
  revalidatePath(`/produkte/${id}`);
  revalidateTag("dashboard", "max");
  return { error: null };
}

const QUICK_EDIT_FIELDS = ["sortierung", "name", "artikel_bearbeitet"] as const;
type QuickEditField = (typeof QUICK_EDIT_FIELDS)[number];

export async function quickUpdateProdukt(
  id: string,
  field: string,
  value: string | number | boolean,
): Promise<{ error: string | null }> {
  if (!QUICK_EDIT_FIELDS.includes(field as QuickEditField)) {
    return { error: `Feld '${field}' ist nicht für Quick-Edit freigegeben.` };
  }

  // Treat empty string as null for nullable text fields
  const dbValue = field === "name" && value === "" ? null : value;

  const supabase = await createClient();
  const { error } = await supabase
    .from("produkte")
    .update({ [field]: dbValue })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit(supabase, { tableName: "produkte", recordId: id, action: "update", changes: { [field]: { old: null, new: dbValue } } });

  revalidatePath("/produkte");
  revalidateTag("dashboard", "max");
  return { error: null };
}

export async function bulkUpdateProdukte(
  ids: string[],
  action: string,
  value?: string,
): Promise<{ error: string | null; count: number }> {
  if (!ids.length) return { error: "Keine Produkte ausgewählt.", count: 0 };
  if (ids.length > 500) return { error: "Maximal 500 Produkte gleichzeitig.", count: 0 };

  // Validate all IDs are UUIDs
  const validIds = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (validIds.length !== ids.length) return { error: "Ungueltige Produkt-IDs.", count: 0 };

  // Validate value as UUID for kategorie change
  if (action === "change_kategorie" && value && !/^[0-9a-f-]{36}$/i.test(value)) {
    return { error: "Ungueltige Kategorie-ID.", count: 0 };
  }

  const supabase = await createClient();
  let error: string | null = null;
  let count = 0;

  if (action === "mark_done") {
    const { error: e, count: c } = await supabase
      .from("produkte")
      .update({ artikel_bearbeitet: true })
      .in("id", ids);
    error = e?.message ?? null;
    count = c ?? ids.length;
  } else if (action === "mark_undone") {
    const { error: e, count: c } = await supabase
      .from("produkte")
      .update({ artikel_bearbeitet: false })
      .in("id", ids);
    error = e?.message ?? null;
    count = c ?? ids.length;
  } else if (action === "change_kategorie") {
    if (!value) return { error: "Keine Kategorie angegeben.", count: 0 };
    const { error: e, count: c } = await supabase
      .from("produkte")
      .update({ kategorie_id: value })
      .in("id", ids);
    error = e?.message ?? null;
    count = c ?? ids.length;
  } else if (action === "delete") {
    const { error: e, count: c } = await supabase
      .from("produkte")
      .delete()
      .in("id", ids);
    error = e?.message ?? null;
    count = c ?? ids.length;
  } else {
    return { error: `Unbekannte Aktion: ${action}`, count: 0 };
  }

  for (const pid of ids) {
    await logAudit(supabase, { tableName: "produkte", recordId: pid, action: action === "delete" ? "delete" : "update", changes: action !== "delete" ? { bulk_action: { old: null, new: action } } : undefined });
  }

  revalidatePath("/produkte");
  return { error, count };
}

export async function deleteProdukt(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // Fetch label before deleting
  const { data: row } = await supabase.from("produkte").select("artikelnummer").eq("id", id).single();
  const { error } = await supabase.from("produkte").delete().eq("id", id);
  if (error) return { error: error.message };
  await logAudit(supabase, { tableName: "produkte", recordId: id, action: "delete", recordLabel: row?.artikelnummer ?? id });
  revalidatePath("/produkte");
  revalidateTag("dashboard", "max");
  redirect("/produkte?toast=success&message=Produkt+gel%C3%B6scht");
}

export async function duplicateProdukt(id: string): Promise<{ id?: string; error: string | null }> {
  const supabase = await createClient();
  const { data: src } = await supabase.from("produkte").select("*").eq("id", id).single();
  if (!src) return { error: "Produkt nicht gefunden." };

  // Build copy — strip auto-generated / system fields
  const copy = { ...src } as any;
  delete copy.id;
  delete copy.external_id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.created_by;
  delete copy.updated_by;
  delete copy.search_vector;
  copy.artikelnummer = `${src.artikelnummer}-KOPIE`;
  copy.artikel_bearbeitet = false;

  const { data, error } = await supabase.from("produkte").insert(copy).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") return { error: "Artikelnummer existiert bereits (evtl. bereits dupliziert)." };
    return { error: error?.message ?? "Fehler beim Duplizieren" };
  }

  // Copy produkt_icons (n:m) for the new product
  const { data: srcIcons } = await supabase
    .from("produkt_icons")
    .select("icon_id, sortierung")
    .eq("produkt_id", id);

  if (srcIcons && srcIcons.length > 0) {
    await supabase.from("produkt_icons").insert(
      srcIcons.map((row) => ({ produkt_id: data.id, icon_id: row.icon_id, sortierung: row.sortierung })),
    );
  }

  await logAudit(supabase, { tableName: "produkte", recordId: data.id, action: "create", recordLabel: copy.artikelnummer });

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
  const { buffer, contentType, extension } = await compressImage(file);
  const path = `produkte/${produktId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("produktbilder").upload(path, buffer, { contentType });
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

export async function reorderGalerieBilder(
  produktId: string,
  orderedImageIds: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Update sortierung for each image in the new order
  const updates = orderedImageIds.map((id, index) =>
    supabase
      .from("produkt_bilder")
      .update({ sortierung: index })
      .eq("id", id)
      .eq("produkt_id", produktId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}

export async function setHauptbild(
  produktId: string,
  storagePath: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("produkte")
    .update({ hauptbild_path: storagePath })
    .eq("id", produktId);

  if (error) return { error: error.message };

  revalidatePath(`/produkte/${produktId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Preis-Import
// ---------------------------------------------------------------------------

export type ImportPreiseRow = {
  artikelnummer: string;
  listenpreis?: number | null;
  ek_lichtengros?: number | null;
  ek_eisenkeil?: number | null;
  gueltig_ab?: string | null;
};

export type ImportPreiseResult = {
  imported: number;
  notFound: string[];
  error: string | null;
};

export async function importPreise(data: {
  rows: ImportPreiseRow[];
  deactivateOld: boolean;
}): Promise<ImportPreiseResult> {
  if (data.rows.length > 5000) {
    return { imported: 0, notFound: [], error: "Maximal 5000 Zeilen pro Import." };
  }

  // Validate no negative prices
  for (const row of data.rows) {
    if ((row.listenpreis != null && row.listenpreis < 0) ||
        (row.ek_lichtengros != null && row.ek_lichtengros < 0) ||
        (row.ek_eisenkeil != null && row.ek_eisenkeil < 0)) {
      return { imported: 0, notFound: [], error: "Negative Preise sind nicht erlaubt." };
    }
  }

  const supabase = await createClient();

  // Fetch all products to build artikelnummer -> id map
  const { data: produkte, error: fetchErr } = await supabase
    .from("produkte")
    .select("id, artikelnummer");

  if (fetchErr || !produkte) {
    return { imported: 0, notFound: [], error: fetchErr?.message ?? "Produkte konnten nicht geladen werden." };
  }

  const artNrToId: Record<string, string> = {};
  for (const p of produkte) {
    artNrToId[p.artikelnummer.trim().toLowerCase()] = p.id;
  }

  let imported = 0;
  const notFound: string[] = [];

  for (const row of data.rows) {
    const key = row.artikelnummer.trim().toLowerCase();
    const produktId = artNrToId[key];

    if (!produktId) {
      notFound.push(row.artikelnummer);
      continue;
    }

    // If deactivateOld: set existing active prices to inactive
    if (data.deactivateOld) {
      await supabase
        .from("preise")
        .update({ status: "inaktiv" })
        .eq("produkt_id", produktId)
        .eq("status", "aktiv");
    }

    // Insert new price record
    const insertData: Record<string, unknown> = {
      produkt_id: produktId,
      status: "aktiv",
    };

    if (row.listenpreis != null) insertData.listenpreis = row.listenpreis;
    if (row.ek_lichtengros != null) insertData.ek_lichtengros = row.ek_lichtengros;
    if (row.ek_eisenkeil != null) insertData.ek_eisenkeil = row.ek_eisenkeil;
    if (row.gueltig_ab) insertData.gueltig_ab = row.gueltig_ab;

    const { error: insertErr } = await supabase.from("preise").insert(insertData);

    if (!insertErr) {
      imported++;
    }
  }

  revalidatePath("/produkte");
  return { imported, notFound, error: null };
}

export type PreisMatchResult = {
  artikelnummer: string;
  produktId: string | null;
  produktName: string | null;
  alterListenpreis: number | null;
  alterEkLg: number | null;
  alterEkEk: number | null;
};

export async function matchArtikelnummern(
  artikelnummern: string[],
): Promise<{ matches: Record<string, PreisMatchResult>; error: string | null }> {
  const supabase = await createClient();

  // Fetch products matching the given artikelnummern
  const { data: produkte, error: fetchErr } = await supabase
    .from("produkte")
    .select("id, artikelnummer, name");

  if (fetchErr || !produkte) {
    return { matches: {}, error: fetchErr?.message ?? "Fehler beim Laden der Produkte." };
  }

  const artNrToProduct: Record<string, { id: string; name: string | null }> = {};
  for (const p of produkte) {
    artNrToProduct[p.artikelnummer.trim().toLowerCase()] = { id: p.id, name: p.name };
  }

  // Get current prices for matched products
  const matchedIds = artikelnummern
    .map((a) => artNrToProduct[a.trim().toLowerCase()]?.id)
    .filter(Boolean) as string[];

  const priceMap: Record<string, { listenpreis: number | null; ek_lichtengros: number | null; ek_eisenkeil: number | null }> = {};

  if (matchedIds.length > 0) {
    const { data: preise } = await supabase
      .from("preise")
      .select("produkt_id, listenpreis, ek_lichtengros, ek_eisenkeil")
      .in("produkt_id", matchedIds)
      .eq("status", "aktiv")
      .order("gueltig_ab", { ascending: false });

    if (preise) {
      for (const p of preise) {
        // Only keep the first (most recent) price per product
        if (!priceMap[p.produkt_id]) {
          priceMap[p.produkt_id] = {
            listenpreis: p.listenpreis,
            ek_lichtengros: p.ek_lichtengros,
            ek_eisenkeil: p.ek_eisenkeil,
          };
        }
      }
    }
  }

  const matches: Record<string, PreisMatchResult> = {};
  for (const artNr of artikelnummern) {
    const key = artNr.trim().toLowerCase();
    const product = artNrToProduct[key];
    if (product) {
      const prices = priceMap[product.id];
      matches[artNr] = {
        artikelnummer: artNr,
        produktId: product.id,
        produktName: product.name,
        alterListenpreis: prices?.listenpreis ?? null,
        alterEkLg: prices?.ek_lichtengros ?? null,
        alterEkEk: prices?.ek_eisenkeil ?? null,
      };
    } else {
      matches[artNr] = {
        artikelnummer: artNr,
        produktId: null,
        produktName: null,
        alterListenpreis: null,
        alterEkLg: null,
        alterEkEk: null,
      };
    }
  }

  return { matches, error: null };
}
