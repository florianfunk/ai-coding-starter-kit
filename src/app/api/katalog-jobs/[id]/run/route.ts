/**
 * Führt einen Katalog-Job synchron aus.
 * Wird vom Client mit fetch(...) nach dem Anlegen des Jobs aufgerufen (fire-and-forget),
 * damit der lange Render-Prozess (20-60s) außerhalb der Server-Action-Zeitgrenzen läuft.
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  KatalogDocument,
  type PdfImage,
  type ProduktPreise,
} from "@/lib/pdf/katalog-document";
import { normalizeParams } from "./params";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[katalog-run +${Date.now() - t0}ms] ${msg}`);
  const { id: jobId } = await params;
  log(`start jobId=${jobId}`);
  const admin = await createServiceRoleClient();
  log("service-role client created");

  const { data: job, error: jobError } = await admin
    .from("katalog_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Job nicht gefunden" }, { status: 404 });
  }
  // Atomic: Claim den Job per UPDATE WHERE status='queued'. Wenn 0 Zeilen
  // aktualisiert wurden, läuft der Job schon woanders → idempotent mit 200 return.
  const { data: claimed } = await admin
    .from("katalog_jobs")
    .update({ status: "running", progress: 5 })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id");
  if (!claimed || claimed.length === 0) {
    log(`already claimed (status=${job.status}) — skipping duplicate render`);
    return NextResponse.json({ ok: true, message: "already running or done" });
  }
  log("status → running (claimed)");

  // Datenblatt-Jobs (PROJ-47): werden im Frontend-Step von PROJ-47 implementiert.
  // Bis dahin Job sauber als Fehler abschließen, damit die Druckhistorie nicht
  // dauerhaft "running" zeigt.
  if (job.typ === "datenblatt") {
    await admin
      .from("katalog_jobs")
      .update({
        status: "error",
        progress: 0,
        error_text: "Datenblatt-Render noch nicht implementiert (PROJ-47 Frontend-Step folgt)",
      })
      .eq("id", jobId);
    log("typ=datenblatt — not yet implemented");
    return NextResponse.json({ ok: false, message: "datenblatt rendering pending" });
  }

  const p = normalizeParams(job.parameter, log);

  try {

    // Daten laden
    const { data: bereiche } = await admin.from("bereiche").select("*").order("sortierung");
    log(`bereiche: ${bereiche?.length ?? 0}`);
    const { data: kategorien } = await admin.from("kategorien").select("*").order("sortierung");
    log(`kategorien: ${kategorien?.length ?? 0}`);
    const { data: produkteRaw } = await admin.from("produkte").select("*").order("sortierung");
    log(`produkte: ${produkteRaw?.length ?? 0}`);
    const { data: preise } = await admin.from("aktuelle_preise_flat").select("*");
    log(`preise: ${preise?.length ?? 0}`);
    const { data: produktIcons } = await admin.from("produkt_icons").select("produkt_id, icons(label)").order("sortierung");
    const { data: kategorieIcons } = await admin.from("kategorie_icons").select("kategorie_id, icon_id, icons(label, symbol_path)");
    const { data: einstellungen } = await admin.from("katalog_einstellungen").select("*").eq("id", 1).single();
    const { data: filialen } = await admin.from("filialen").select("*").eq("marke", p.layout).order("sortierung");
    log(`filialen: ${filialen?.length ?? 0}`);

    await admin.from("katalog_jobs").update({ progress: 30 }).eq("id", jobId);

    // Inhalts-Filter (PROJ-37): Produkt-Whitelist anwenden, falls vorhanden.
    // NULL/undefined = alle Produkte (Default-Verhalten wie vor PROJ-37).
    const produkte =
      p.produktIds && p.produktIds.length > 0
        ? (produkteRaw ?? []).filter((pr) => p.produktIds!.includes(pr.id))
        : (produkteRaw ?? []);
    log(`produkte nach Filter: ${produkte.length} (von ${produkteRaw?.length ?? 0})`);
    if (produkte.length === 0) {
      throw new Error("Keine Produkte ausgewählt — der Katalog wäre leer.");
    }

    // Maps bauen — nur über die gefilterten Produkte. Kategorien/Bereiche ohne
    // ausgewählte Produkte werden anschließend ausgesiebt, damit Index und
    // Trennseiten keine Toten Einträge enthalten.
    const produkteByKategorie = new Map<string, any[]>();
    for (const pr of produkte) {
      const arr = produkteByKategorie.get(pr.kategorie_id) ?? [];
      arr.push(pr);
      produkteByKategorie.set(pr.kategorie_id, arr);
    }
    // Nur Kategorien, die nach Filter ≥1 Produkt haben.
    const filteredKategorien = (kategorien ?? []).filter((k) =>
      (produkteByKategorie.get(k.id)?.length ?? 0) > 0,
    );
    const kategorienByBereich = new Map<string, any[]>();
    for (const k of filteredKategorien) {
      const arr = kategorienByBereich.get(k.bereich_id) ?? [];
      arr.push(k);
      kategorienByBereich.set(k.bereich_id, arr);
    }
    // Nur Bereiche, die nach Filter ≥1 Kategorie mit Produkten haben.
    const filteredBereiche = (bereiche ?? []).filter((b) =>
      (kategorienByBereich.get(b.id)?.length ?? 0) > 0,
    );
    log(
      `nach Inhaltsauswahl: ${filteredBereiche.length} bereiche, ${filteredKategorien.length} kategorien, ${produkte.length} produkte`,
    );

    // Preis-Map (drei Spuren). View `aktuelle_preise_flat` liefert die Spur-Spalten:
    //   listenpreis, ek_lichtengros, ek_eisenkeil  (ek = Alias für ek_lichtengros)
    const preisByProdukt = new Map<string, ProduktPreise | null>();
    for (const pr of preise ?? []) {
      const lichtengros = pr.ek_lichtengros != null ? Number(pr.ek_lichtengros) : null;
      preisByProdukt.set(pr.produkt_id, {
        listenpreis: pr.listenpreis != null ? Number(pr.listenpreis) : null,
        lichtengros,
        eisenkeil:   pr.ek_eisenkeil != null ? Number(pr.ek_eisenkeil) : null,
        ek: lichtengros, // Backwards-Compat
      });
    }
    const iconLabelsByProdukt = new Map<string, string[]>();
    for (const r of (produktIcons ?? []) as any[]) {
      const arr = iconLabelsByProdukt.get(r.produkt_id) ?? [];
      if (r.icons?.label) arr.push(r.icons.label);
      iconLabelsByProdukt.set(r.produkt_id, arr);
    }
    const kategorieIconsByKategorie = new Map<string, { label: string; url: PdfImage }[]>();
    for (const r of (kategorieIcons ?? []) as any[]) {
      if (!r.icons) continue;
      const url = await downloadImage(admin, "assets", r.icons.symbol_path, { maxWidth: 150, quality: 80 });
      const arr = kategorieIconsByKategorie.get(r.kategorie_id) ?? [];
      arr.push({ label: r.icons.label, url });
      kategorieIconsByKategorie.set(r.kategorie_id, arr);
    }

    // Bilder direkt als Buffer laden — verhindert dass @react-pdf während des Renderns
    // auf Netzwerk wartet (das ist der Grund warum renderToBuffer sonst hängt).
    // Download mit Parallel-Limit (sonst OOM bei 419 gleichzeitigen Sharp-Calls)
    async function batch<T, R>(
      items: T[],
      limit: number,
      fn: (item: T, index: number) => Promise<R>,
      onProgress?: (done: number, total: number) => void,
    ): Promise<R[]> {
      const results: R[] = new Array(items.length);
      let cursor = 0;
      let done = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
          const i = cursor++;
          if (i >= items.length) return;
          results[i] = await fn(items[i], i);
          done++;
          if (done % 50 === 0 || done === items.length) onProgress?.(done, items.length);
        }
      });
      await Promise.all(workers);
      return results;
    }

    // Thumbnails: 200px reicht für Tabellen-Thumbnails (28×20px gerendert).
    // Nur für die bereits gefilterten Produkte — sonst laden wir Bilder, die nie gerendert werden.
    log(`downloading ${produkte.length} product images …`);
    const hauptbildResults = await batch(
      produkte,
      8,
      async (pr) => [pr.id, await downloadImage(admin, "produktbilder", pr.hauptbild_path, { maxWidth: 200, quality: 70 })] as const,
      (done, total) => log(`  product images: ${done}/${total}`),
    );
    const hauptbildByProdukt = new Map(hauptbildResults);
    log("product images downloaded");

    // Bereich-Intro-Bilder: Vollbild A4 — nur für gefilterte Bereiche
    const bereichBildResults = await batch(
      filteredBereiche,
      4,
      async (b) => [b.id, await downloadImage(admin, "produktbilder", b.bild_path, { maxWidth: 1600, quality: 80 })] as const,
    );
    const bereichBildUrl = new Map(bereichBildResults);
    log("bereich images downloaded");

    // Kategorie-Bilder: pro Kategorie bis zu 4 Bilder (Bild1..Bild4)
    // Flatten: 4 Download-Tasks pro Kategorie, danach wieder pro Kategorie gruppieren.
    // Nur für gefilterte Kategorien — sonst Wartezeit für unbenutzte Bilder.
    type BildSlot = 1 | 2 | 3 | 4;
    type BildTask = { kategorieId: string; slot: BildSlot; path: string | null };
    const bildTasks: BildTask[] = filteredKategorien.flatMap((k) => [
      { kategorieId: k.id, slot: 1 as BildSlot, path: k.bild1_path },
      { kategorieId: k.id, slot: 2 as BildSlot, path: k.bild2_path },
      { kategorieId: k.id, slot: 3 as BildSlot, path: k.bild3_path },
      { kategorieId: k.id, slot: 4 as BildSlot, path: k.bild4_path },
    ]);
    const bildDownloads = await batch(
      bildTasks,
      8,
      async (t) => [t, await downloadImage(admin, "produktbilder", t.path, { maxWidth: 500, quality: 75 })] as const,
      (done, total) => log(`  kategorie images: ${done}/${total}`),
    );
    const kategorieBilderByKategorie = new Map<string, Record<BildSlot, PdfImage>>();
    for (const [task, img] of bildDownloads) {
      const existing = kategorieBilderByKategorie.get(task.kategorieId) ?? {
        1: null, 2: null, 3: null, 4: null,
      } as Record<BildSlot, PdfImage>;
      existing[task.slot] = img;
      kategorieBilderByKategorie.set(task.kategorieId, existing);
    }
    log("kategorie images downloaded");
    const logoField = p.layout === "lichtengros" ? "logo_lichtengros_dunkel" : "logo_eisenkeil_dunkel";
    const logoUrl = await downloadImage(admin, "assets", einstellungen?.[logoField] ?? null, { maxWidth: 400 });
    const coverVorneUrl = await downloadImage(admin, "assets", einstellungen?.cover_vorne_path, { maxWidth: 1600, quality: 80 });
    const coverHintenUrl = await downloadImage(admin, "assets", einstellungen?.cover_hinten_path, { maxWidth: 1600, quality: 80 });

    await admin.from("katalog_jobs").update({ progress: 60 }).eq("id", jobId);

    const filialenText = (filialen ?? [])
      .map((f) => `${f.name}\n${f.adresse ?? ""}\n${f.telefon ?? ""}`)
      .join("\n\n");
    const copyrightText =
      (p.layout === "lichtengros" ? einstellungen?.copyright_lichtengros : einstellungen?.copyright_eisenkeil) ?? "";

    log("starting renderToBuffer …");
    const buffer = await renderToBuffer(
      KatalogDocument({
        params: p,
        bereiche: filteredBereiche,
        kategorienByBereich,
        produkteByKategorie,
        preisByProdukt,
        hauptbildByProdukt,
        iconLabelsByProdukt,
        kategorieIconsByKategorie,
        bereichBildUrl,
        kategorieBilderByKategorie,
        logoUrl,
        coverVorneUrl,
        coverHintenUrl,
        copyrightText,
        filialenText,
        generatedAt: new Date(),
      }),
    );

    log(`renderToBuffer done, size=${(buffer as any).length ?? "?"} bytes`);
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

/**
 * Lädt ein Bild von Supabase Storage, komprimiert es und gibt einen Buffer zurück.
 * Ohne Komprimierung wird der Katalog ~300 MB groß (Upload-Limit: 50 MB).
 *
 * @react-pdf akzeptiert `{ data: Buffer, format }` statt URL —
 * verhindert dass der Renderer während des Zeichnens auf Netzwerk wartet.
 */
async function downloadImage(
  client: any,
  bucket: string,
  path: string | null | undefined,
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<{ data: Buffer; format: "jpg" | "png" } | null> {
  if (!path) return null;
  try {
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error || !data) return null;
    const arrayBuffer = await (data as Blob).arrayBuffer();
    const input = Buffer.from(arrayBuffer);
    // Komprimieren: max 800px Breite, JPEG Q=75 — gut genug für A4-Druck
    const output = await sharp(input)
      .rotate() // auto-rotate based on EXIF
      .resize({ width: opts.maxWidth ?? 800, withoutEnlargement: true })
      .jpeg({ quality: opts.quality ?? 75, mozjpeg: true })
      .toBuffer();
    return { data: output, format: "jpg" };
  } catch {
    return null;
  }
}

