/**
 * Führt einen Katalog-Job synchron aus.
 * Wird vom Client mit fetch(...) nach dem Anlegen des Jobs aufgerufen (fire-and-forget),
 * damit der lange Render-Prozess (20-60s) außerhalb der Server-Action-Zeitgrenzen läuft.
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { KatalogDocument, type KatalogParams } from "@/lib/pdf/katalog-document";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const admin = await createServiceRoleClient();

  const { data: job, error: jobError } = await admin
    .from("katalog_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Job nicht gefunden" }, { status: 404 });
  }
  if (job.status !== "queued") {
    return NextResponse.json({ error: `Job ist bereits im Status ${job.status}` }, { status: 409 });
  }

  const p = job.parameter as KatalogParams;

  try {
    await admin.from("katalog_jobs").update({ status: "running", progress: 5 }).eq("id", jobId);

    // Daten laden
    const { data: bereiche } = await admin.from("bereiche").select("*").order("sortierung");
    const { data: kategorien } = await admin.from("kategorien").select("*").order("sortierung");
    const { data: produkte } = await admin.from("produkte").select("*").order("sortierung");
    const { data: preise } = await admin.from("aktuelle_preise").select("*");
    const { data: produktIcons } = await admin.from("produkt_icons").select("produkt_id, icons(label)").order("sortierung");
    const { data: kategorieIcons } = await admin.from("kategorie_icons").select("kategorie_id, icon_id, icons(label, symbol_path)");
    const { data: einstellungen } = await admin.from("katalog_einstellungen").select("*").eq("id", 1).single();
    const { data: filialen } = await admin.from("filialen").select("*").eq("marke", p.layout).order("sortierung");

    await admin.from("katalog_jobs").update({ progress: 30 }).eq("id", jobId);

    // Maps bauen
    const kategorienByBereich = new Map<string, any[]>();
    for (const k of kategorien ?? []) {
      const arr = kategorienByBereich.get(k.bereich_id) ?? [];
      arr.push(k);
      kategorienByBereich.set(k.bereich_id, arr);
    }
    const produkteByKategorie = new Map<string, any[]>();
    for (const pr of produkte ?? []) {
      const arr = produkteByKategorie.get(pr.kategorie_id) ?? [];
      arr.push(pr);
      produkteByKategorie.set(pr.kategorie_id, arr);
    }
    const preisByProdukt = new Map<string, { listenpreis: number; ek: number | null } | null>();
    for (const pr of preise ?? []) {
      preisByProdukt.set(pr.produkt_id, {
        listenpreis: Number(pr.listenpreis),
        ek: pr.ek != null ? Number(pr.ek) : null,
      });
    }
    const iconLabelsByProdukt = new Map<string, string[]>();
    for (const r of (produktIcons ?? []) as any[]) {
      const arr = iconLabelsByProdukt.get(r.produkt_id) ?? [];
      if (r.icons?.label) arr.push(r.icons.label);
      iconLabelsByProdukt.set(r.produkt_id, arr);
    }
    const kategorieIconsByKategorie = new Map<string, { label: string; url: string | null }[]>();
    for (const r of (kategorieIcons ?? []) as any[]) {
      if (!r.icons) continue;
      const url = await signUrl(admin, "assets", r.icons.symbol_path);
      const arr = kategorieIconsByKategorie.get(r.kategorie_id) ?? [];
      arr.push({ label: r.icons.label, url });
      kategorieIconsByKategorie.set(r.kategorie_id, arr);
    }

    // Bild-URLs signieren
    const hauptbildByProdukt = new Map<string, string | null>();
    for (const pr of produkte ?? []) {
      hauptbildByProdukt.set(pr.id, await signUrl(admin, "produktbilder", pr.hauptbild_path));
    }
    const bereichBildUrl = new Map<string, string | null>();
    for (const b of bereiche ?? []) {
      bereichBildUrl.set(b.id, await signUrl(admin, "produktbilder", b.bild_path));
    }
    const kategorieBildUrl = new Map<string, string | null>();
    for (const k of kategorien ?? []) {
      kategorieBildUrl.set(k.id, await signUrl(admin, "produktbilder", k.vorschaubild_path));
    }
    const logoField = p.layout === "lichtengros" ? "logo_lichtengros_dunkel" : "logo_eisenkeil_dunkel";
    const logoUrl = await signUrl(admin, "assets", einstellungen?.[logoField] ?? null);
    const coverVorneUrl = await signUrl(admin, "assets", einstellungen?.cover_vorne_path);
    const coverHintenUrl = await signUrl(admin, "assets", einstellungen?.cover_hinten_path);

    await admin.from("katalog_jobs").update({ progress: 60 }).eq("id", jobId);

    const filialenText = (filialen ?? [])
      .map((f) => `${f.name}\n${f.adresse ?? ""}\n${f.telefon ?? ""}`)
      .join("\n\n");
    const copyrightText =
      (p.layout === "lichtengros" ? einstellungen?.copyright_lichtengros : einstellungen?.copyright_eisenkeil) ?? "";

    const buffer = await renderToBuffer(
      KatalogDocument({
        params: p,
        bereiche: bereiche ?? [],
        kategorienByBereich,
        produkteByKategorie,
        preisByProdukt,
        hauptbildByProdukt,
        iconLabelsByProdukt,
        kategorieIconsByKategorie,
        bereichBildUrl,
        kategorieBildUrl,
        logoUrl,
        coverVorneUrl,
        coverHintenUrl,
        copyrightText,
        filialenText,
        generatedAt: new Date(),
      }),
    );

    await admin.from("katalog_jobs").update({ progress: 90 }).eq("id", jobId);

    const path = `${jobId}/Katalog-${p.layout}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const { error: upErr } = await admin.storage.from("kataloge").upload(path, buffer as any, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw upErr;

    await admin
      .from("katalog_jobs")
      .update({ status: "done", progress: 100, pdf_path: path })
      .eq("id", jobId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Katalog-Job fehlgeschlagen", e);
    await admin
      .from("katalog_jobs")
      .update({ status: "error", error_text: e?.message ?? String(e) })
      .eq("id", jobId);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

async function signUrl(client: any, bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
