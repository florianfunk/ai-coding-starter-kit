"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { KatalogDocument, type KatalogParams } from "@/lib/pdf/katalog-document";

export type StartKatalogResult = { jobId?: string; error: string | null };

export async function startKatalogJob(params: KatalogParams): Promise<StartKatalogResult> {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("katalog_jobs")
    .insert({ status: "queued", parameter: params as any })
    .select("id")
    .single();
  if (error || !job) return { error: error?.message ?? "Job-Anlage fehlgeschlagen" };

  // Fire-and-forget: run in background
  void runKatalogJob(job.id, params);
  revalidatePath("/export/katalog");
  return { jobId: job.id, error: null };
}

async function runKatalogJob(jobId: string, params: KatalogParams) {
  const admin = await createServiceRoleClient();
  try {
    await admin.from("katalog_jobs").update({ status: "running", progress: 5 }).eq("id", jobId);

    // Load all data
    const { data: bereiche } = await admin.from("bereiche").select("*").order("sortierung");
    const { data: kategorien } = await admin.from("kategorien").select("*").order("sortierung");
    const { data: produkte } = await admin.from("produkte").select("*").order("sortierung");
    const { data: preise } = await admin.from("aktuelle_preise").select("*");
    const { data: produktIcons } = await admin.from("produkt_icons").select("produkt_id, icons(label)").order("sortierung");
    const { data: einstellungen } = await admin.from("katalog_einstellungen").select("*").eq("id", 1).single();
    const { data: filialen } = await admin.from("filialen").select("*").eq("marke", params.layout).order("sortierung");

    await admin.from("katalog_jobs").update({ progress: 30 }).eq("id", jobId);

    // Build maps
    const kategorienByBereich = new Map<string, any[]>();
    for (const k of kategorien ?? []) {
      const arr = kategorienByBereich.get(k.bereich_id) ?? [];
      arr.push(k);
      kategorienByBereich.set(k.bereich_id, arr);
    }
    const produkteByKategorie = new Map<string, any[]>();
    for (const p of produkte ?? []) {
      const arr = produkteByKategorie.get(p.kategorie_id) ?? [];
      arr.push(p);
      produkteByKategorie.set(p.kategorie_id, arr);
    }
    const preisByProdukt = new Map<string, { listenpreis: number; ek: number | null } | null>();
    for (const pr of preise ?? []) {
      preisByProdukt.set(pr.produkt_id, { listenpreis: Number(pr.listenpreis), ek: pr.ek != null ? Number(pr.ek) : null });
    }
    const iconLabelsByProdukt = new Map<string, string[]>();
    for (const r of (produktIcons ?? []) as any[]) {
      const arr = iconLabelsByProdukt.get(r.produkt_id) ?? [];
      if (r.icons?.label) arr.push(r.icons.label);
      iconLabelsByProdukt.set(r.produkt_id, arr);
    }

    // Bilder URLs (signed)
    const hauptbildByProdukt = new Map<string, string | null>();
    for (const p of produkte ?? []) {
      hauptbildByProdukt.set(p.id, await signServiceUrl(admin, "produktbilder", p.hauptbild_path));
    }
    const bereichBildUrl = new Map<string, string | null>();
    for (const b of bereiche ?? []) {
      bereichBildUrl.set(b.id, await signServiceUrl(admin, "produktbilder", b.bild_path));
    }
    const logoField = params.layout === "lichtengros" ? "logo_lichtengros_dunkel" : "logo_eisenkeil_dunkel";
    const logoUrl = await signServiceUrl(admin, "assets", einstellungen?.[logoField] ?? null);
    const coverVorneUrl = await signServiceUrl(admin, "assets", einstellungen?.cover_vorne_path);
    const coverHintenUrl = await signServiceUrl(admin, "assets", einstellungen?.cover_hinten_path);

    await admin.from("katalog_jobs").update({ progress: 60 }).eq("id", jobId);

    const filialenText = (filialen ?? []).map((f) => `${f.name}\n${f.adresse ?? ""}\n${f.telefon ?? ""}`).join("\n\n");
    const copyrightText = (params.layout === "lichtengros" ? einstellungen?.copyright_lichtengros : einstellungen?.copyright_eisenkeil) ?? "";

    const buffer = await renderToBuffer(
      KatalogDocument({
        params,
        bereiche: bereiche ?? [],
        kategorienByBereich,
        produkteByKategorie,
        preisByProdukt,
        hauptbildByProdukt,
        iconLabelsByProdukt,
        bereichBildUrl,
        logoUrl,
        coverVorneUrl,
        coverHintenUrl,
        copyrightText,
        filialenText,
        generatedAt: new Date(),
      }),
    );

    await admin.from("katalog_jobs").update({ progress: 90 }).eq("id", jobId);

    const path = `${jobId}/Katalog-${params.layout}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const { error: upErr } = await admin.storage.from("kataloge").upload(path, buffer as any, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw upErr;

    await admin.from("katalog_jobs").update({ status: "done", progress: 100, pdf_path: path }).eq("id", jobId);
  } catch (e: any) {
    console.error("Katalog-Job fehlgeschlagen", e);
    await admin.from("katalog_jobs").update({ status: "error", error_text: e?.message ?? String(e) }).eq("id", jobId);
  }
}

async function signServiceUrl(client: any, bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function getKatalogJob(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("katalog_jobs").select("*").eq("id", jobId).single();
  let pdfUrl: string | null = null;
  if (data?.pdf_path) {
    pdfUrl = await getSignedUrl("kataloge", data.pdf_path);
  }
  return { job: data, pdfUrl };
}
