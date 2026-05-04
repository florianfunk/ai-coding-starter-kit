"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit, logAuditMany } from "@/lib/audit";
import { sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";
import { ALL_PRODUKT_FIELDS } from "./fields";
import { TRANSLATABLE_FIELDS } from "@/lib/i18n/translatable-fields";
import { decideAutoTranslateKeys } from "@/lib/i18n/auto-translate-decider";
import { uebersetzeProdukt } from "@/lib/ai/uebersetzen-produkt";

const MARKE_VALUES = ["lichtengros", "eisenkeil"] as const;

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
  achtung_text: z.string().max(5000).optional().nullable(),
  // PROJ-36: Datenblatt-Felder
  info_kurz: z.string().max(500).optional().nullable(),
  marken: z.array(z.enum(MARKE_VALUES)).min(1, "Mindestens eine Marke wählen"),
  bild_detail_1_path: z.string().optional().nullable(),
  bild_detail_2_path: z.string().optional().nullable(),
  bild_zeichnung_1_path: z.string().optional().nullable(),
  bild_zeichnung_2_path: z.string().optional().nullable(),
  bild_zeichnung_3_path: z.string().optional().nullable(),
  bild_energielabel_path: z.string().optional().nullable(),
  vollstaendig_sections: z.array(z.string().max(50)).max(20).default([]),
  // PROJ-46: Italienische Übersetzung — Spiegel-Spalten
  name_it: z.string().max(300).optional().nullable(),
  datenblatt_titel_it: z.string().max(300).optional().nullable(),
  info_kurz_it: z.string().max(500).optional().nullable(),
  treiber_it: z.string().max(1000).optional().nullable(),
  datenblatt_text_it: z.string().max(20000).optional().nullable(),
  achtung_text_it: z.string().max(5000).optional().nullable(),
  bild_detail_1_text_it: z.string().max(500).optional().nullable(),
  bild_detail_2_text_it: z.string().max(500).optional().nullable(),
  bild_detail_3_text_it: z.string().max(500).optional().nullable(),
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
  const marken = formData.getAll("marken").map(String).filter(Boolean);
  const vollstaendigSections = formData
    .getAll("vollstaendig_sections")
    .map(String)
    .filter(Boolean);
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
    achtung_text: sanitizeRichTextHtml(formData.get("achtung_text") as string | null) || null,
    info_kurz: formData.get("info_kurz") || null,
    marken,
    bild_detail_1_path: (formData.get("bild_detail_1_path") as string) || null,
    bild_detail_2_path: (formData.get("bild_detail_2_path") as string) || null,
    bild_zeichnung_1_path: (formData.get("bild_zeichnung_1_path") as string) || null,
    bild_zeichnung_2_path: (formData.get("bild_zeichnung_2_path") as string) || null,
    bild_zeichnung_3_path: (formData.get("bild_zeichnung_3_path") as string) || null,
    bild_energielabel_path: (formData.get("bild_energielabel_path") as string) || null,
    vollstaendig_sections: vollstaendigSections,
    // PROJ-46: Italienische Spiegel-Felder. RichText-IT-Inhalte werden
    // genau wie ihre DE-Pendants sanitized. Empty-string → null, damit der
    // PDF-Renderer für leere IT-Felder auf DE zurückfällt.
    name_it: (formData.get("name_it") as string) || null,
    datenblatt_titel_it: (formData.get("datenblatt_titel_it") as string) || null,
    info_kurz_it: (formData.get("info_kurz_it") as string) || null,
    treiber_it: (formData.get("treiber_it") as string) || null,
    datenblatt_text_it:
      sanitizeRichTextHtml(formData.get("datenblatt_text_it") as string | null) || null,
    achtung_text_it:
      sanitizeRichTextHtml(formData.get("achtung_text_it") as string | null) || null,
    bild_detail_1_text_it: (formData.get("bild_detail_1_text_it") as string) || null,
    bild_detail_2_text_it: (formData.get("bild_detail_2_text_it") as string) || null,
    bild_detail_3_text_it: (formData.get("bild_detail_3_text_it") as string) || null,
  });
}

async function setProduktIcons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  produktId: string,
  iconIds: string[],
  iconWerte: Record<string, string>,
) {
  await supabase.from("produkt_icons").delete().eq("produkt_id", produktId);
  if (iconIds.length) {
    await supabase.from("produkt_icons").insert(
      iconIds.map((icon_id, i) => ({
        produkt_id: produktId,
        icon_id,
        sortierung: i,
        wert: iconWerte[icon_id] ?? null,
      })),
    );
  }
}

function readIconWerte(formData: FormData, iconIds: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of iconIds) {
    const raw = formData.get(`icon_wert__${id}`);
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    out[id] = trimmed.slice(0, 120);
  }
  return out;
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
  const iconWerte = readIconWerte(formData, iconIds);
  await setProduktIcons(supabase, data.id, iconIds, iconWerte);

  // PROJ-46: Auto-Trigger auch beim Erstellen. Wir simulieren einen leeren
  // Vorher-Snapshot — `maybeAutoTranslate` erkennt dann jedes nicht-leere
  // DE-Feld als „geändert" und übersetzt es, sofern der User das passende
  // IT-Feld nicht selbst ausgefüllt hat (der „manueller-Wert-gewinnt"-Schutz
  // greift, weil dann newIt !== oldIt = "" gilt).
  const emptyVorher: Record<string, unknown> = {};
  for (const f of TRANSLATABLE_FIELDS) {
    emptyVorher[f.de] = "";
    emptyVorher[f.it] = "";
  }
  await maybeAutoTranslate(supabase, data.id, parsed.data, emptyVorher);

  revalidatePath("/produkte");
  revalidateTag("dashboard", "max");
  revalidateTag("bereich-counts", "max");
  revalidateTag("kategorie-counts", "max");
  redirect(`/produkte/${data.id}?toast=success&message=Produkt+angelegt`);
}

export async function updateProdukt(id: string, _p: ProduktFormState, formData: FormData): Promise<ProduktFormState> {
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: "Bitte Eingaben prüfen.", fieldErrors: flat(parsed.error) };

  const supabase = await createClient();
  const tech = parseTechFields(formData);

  // PROJ-46: Vorher-Werte der DE- UND IT-Spalten lesen, damit wir später
  // erkennen, welche Felder durch dieses Update geändert wurden. Wir brauchen
  // beide Seiten:
  //   - DE-Vorher: um „DE wurde geändert" festzustellen (Auto-Trigger-Bedingung).
  //   - IT-Vorher: um „User hat IT manuell editiert" zu erkennen — die Form-State-
  //     Architektur sendet das IT-hidden-Input bei jedem Save mit (auch wenn der
  //     User das IT-Feld nicht angefasst hat). Ohne Vergleich gegen den vorigen
  //     IT-DB-Wert würde der Override-Schutz bei jedem schon-übersetzten Produkt
  //     greifen und die Auto-Übersetzung permanent abwürgen (PROJ-46 QA Bug-1).
  const deKeys = TRANSLATABLE_FIELDS.map((f) => f.de);
  const itKeys = TRANSLATABLE_FIELDS.map((f) => f.it);
  const { data: vorher } = await supabase
    .from("produkte")
    .select([...deKeys, ...itKeys].join(", "))
    .eq("id", id)
    .single<Record<string, unknown>>();

  const { error } = await supabase.from("produkte").update({ ...parsed.data, ...tech }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Artikelnummer existiert bereits.", fieldErrors: { artikelnummer: "Bereits vergeben" } };
    return { error: error.message };
  }

  const iconIds = formData.getAll("icon_ids").map(String).filter(Boolean);
  const iconWerte = readIconWerte(formData, iconIds);
  await setProduktIcons(supabase, id, iconIds, iconWerte);

  await logAudit(supabase, { tableName: "produkte", recordId: id, action: "update", recordLabel: parsed.data.artikelnummer });

  // PROJ-46: Auto-Trigger für italienische Übersetzung. Findet die geänderten
  // DE-Felder, prüft ob der User in derselben Speicherung das passende IT-Feld
  // manuell editiert hat (dann nicht überschreiben), ruft den Übersetzer.
  // Best-effort: Fehler stoppen das Save nicht, sondern landen nur im Log.
  await maybeAutoTranslate(supabase, id, parsed.data, vorher);

  revalidatePath("/produkte");
  revalidatePath(`/produkte/${id}`);
  revalidateTag("dashboard", "max");
  // Bereich/Kategorie kann sich beim Update ändern — Counts invalidieren.
  revalidateTag("bereich-counts", "max");
  revalidateTag("kategorie-counts", "max");
  return { error: null };
}

async function maybeAutoTranslate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  produktId: string,
  parsedData: Record<string, unknown>,
  vorher: Record<string, unknown> | null,
) {
  try {
    if (!vorher) return; // konnte Vorher-Snapshot nicht lesen — überspringen

    const { data: settings } = await supabase
      .from("ai_einstellungen")
      .select("auto_translate_it")
      .eq("id", 1)
      .single();
    if (!settings || settings.auto_translate_it !== true) return;

    const changedDeKeys = decideAutoTranslateKeys({ vorher, parsedData });
    if (changedDeKeys.length === 0) return;

    // Synchron warten — der Save selbst wartet auf den Übersetzer. Auf Vercel
    // Functions ist Fire-and-forget nach Response unzuverlässig, deshalb der
    // bewusst blockierende Aufruf. Toast-UX-Hinweis ist vorhanden.
    await uebersetzeProdukt(supabase, produktId, {
      nurLeere: false,
      felder: changedDeKeys,
    });
  } catch (e) {
    // Auto-Trigger-Fehler stoppen das Speichern nicht — DE-Werte sind sicher
    // schon in der DB. Wir loggen das nur.
    console.error("[PROJ-46] Auto-Übersetzung fehlgeschlagen:", e);
  }
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

  const idSchema = z.string().uuid();
  const idsCheck = z.array(idSchema).safeParse(ids);
  if (!idsCheck.success) return { error: "Ungueltige Produkt-IDs.", count: 0 };

  if (action === "change_kategorie" && value && !idSchema.safeParse(value).success) {
    return { error: "Ungueltige Kategorie-ID.", count: 0 };
  }

  const supabase = await createClient();
  const userEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
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

  await logAuditMany(
    supabase,
    ids.map((pid) => ({
      userEmail,
      tableName: "produkte",
      recordId: pid,
      action: action === "delete" ? "delete" : "update",
      changes:
        action !== "delete" ? { bulk_action: { old: null, new: action } } : undefined,
    })),
  );

  revalidatePath("/produkte");
  revalidateTag("dashboard", "max");
  revalidateTag("bereich-counts", "max");
  revalidateTag("kategorie-counts", "max");
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
  revalidateTag("bereich-counts", "max");
  revalidateTag("kategorie-counts", "max");
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

  // Copy produkt_icons (n:m) for the new product — inkl. Wert pro Icon
  const { data: srcIcons } = await supabase
    .from("produkt_icons")
    .select("icon_id, sortierung, wert")
    .eq("produkt_id", id);

  if (srcIcons && srcIcons.length > 0) {
    await supabase.from("produkt_icons").insert(
      srcIcons.map((row) => ({
        produkt_id: data.id,
        icon_id: row.icon_id,
        sortierung: row.sortierung,
        wert: row.wert,
      })),
    );
  }

  await logAudit(supabase, { tableName: "produkte", recordId: data.id, action: "create", recordLabel: copy.artikelnummer });

  revalidatePath("/produkte");
  revalidateTag("dashboard", "max");
  revalidateTag("bereich-counts", "max");
  revalidateTag("kategorie-counts", "max");
  return { id: data.id, error: null };
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
  // TODO(PROJ-17): Wizard-Flow auf Spur-Auswahl umstellen — deactivateOld ist obsolet.
  deactivateOld: boolean;
}): Promise<ImportPreiseResult> {
  if (data.rows.length > 5000) {
    return { imported: 0, notFound: [], error: "Maximal 5000 Zeilen pro Import." };
  }

  for (const row of data.rows) {
    if ((row.listenpreis != null && row.listenpreis < 0) ||
        (row.ek_lichtengros != null && row.ek_lichtengros < 0) ||
        (row.ek_eisenkeil != null && row.ek_eisenkeil < 0)) {
      return { imported: 0, notFound: [], error: "Negative Preise sind nicht erlaubt." };
    }
  }

  const supabase = await createClient();

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
  const today = new Date().toISOString().slice(0, 10);

  for (const row of data.rows) {
    const key = row.artikelnummer.trim().toLowerCase();
    const produktId = artNrToId[key];

    if (!produktId) {
      notFound.push(row.artikelnummer);
      continue;
    }

    const gueltig_ab = row.gueltig_ab ?? today;
    const inserts: Array<{ produkt_id: string; spur: "listenpreis" | "lichtengros" | "eisenkeil"; gueltig_ab: string; preis: number; quelle: string }> = [];

    if (row.listenpreis != null) {
      inserts.push({ produkt_id: produktId, spur: "listenpreis", gueltig_ab, preis: row.listenpreis, quelle: "import:preis-wizard" });
    }
    if (row.ek_lichtengros != null) {
      inserts.push({ produkt_id: produktId, spur: "lichtengros", gueltig_ab, preis: row.ek_lichtengros, quelle: "import:preis-wizard" });
    }
    if (row.ek_eisenkeil != null) {
      inserts.push({ produkt_id: produktId, spur: "eisenkeil", gueltig_ab, preis: row.ek_eisenkeil, quelle: "import:preis-wizard" });
    }

    if (inserts.length === 0) continue;

    const { error: insertErr } = await supabase.from("preise").insert(inserts);
    if (!insertErr) imported++;
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
      .from("aktuelle_preise_flat")
      .select("produkt_id, listenpreis, ek_lichtengros, ek_eisenkeil")
      .in("produkt_id", matchedIds);

    if (preise) {
      for (const p of preise) {
        priceMap[p.produkt_id] = {
          listenpreis: p.listenpreis,
          ek_lichtengros: p.ek_lichtengros,
          ek_eisenkeil: p.ek_eisenkeil,
        };
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

const bulkNamenSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string().max(300).optional(),
    datenblatt_titel: z.string().max(300).optional(),
  }).refine((u) => u.name !== undefined || u.datenblatt_titel !== undefined, {
    message: "Mindestens ein Feld muss übergeben werden",
  }),
).min(1).max(500);

export async function applyBulkProduktNamen(
  updates: { id: string; name?: string; datenblatt_titel?: string }[],
): Promise<{ error: string | null; count: number }> {
  const parsed = bulkNamenSchema.safeParse(updates);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig.", count: 0 };
  }

  const supabase = await createClient();
  let count = 0;

  for (const u of parsed.data) {
    const patch: Record<string, string> = {};
    if (u.name !== undefined) patch.name = u.name;
    if (u.datenblatt_titel !== undefined) patch.datenblatt_titel = u.datenblatt_titel;
    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase.from("produkte").update(patch).eq("id", u.id);
    if (error) {
      return { error: `Update für ${u.id}: ${error.message}`, count };
    }
    count += 1;
    await logAudit(supabase, {
      tableName: "produkte",
      recordId: u.id,
      action: "update",
      changes: { ki_namen: { old: null, new: patch } },
    });
  }

  revalidatePath("/produkte");
  revalidateTag("dashboard", "max");
  return { error: null, count };
}
