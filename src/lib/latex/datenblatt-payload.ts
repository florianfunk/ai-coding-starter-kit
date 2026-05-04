/**
 * Payload-Builder für das Lichtengross-Datenblatt-LaTeX-Template.
 *
 * Lädt für ein Produkt: Stammdaten, Icons, Markenlogo, Hauptbild, Detail-
 * bilder und technische Zeichnung. Bilder werden direkt aus Supabase Storage
 * gezogen und als base64-Strings im `images_b64`-Dictionary mitgeliefert,
 * das der Worker pro Request ins Workdir entpackt. So braucht der Worker
 * keinen Supabase-Zugriff.
 *
 * Das Template referenziert die Bilder unter ihrem Dateinamen
 * (z.B. `\includegraphics{hauptbild}`), die Endung wird per
 * `\DeclareGraphicsExtensions` aufgelöst.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { ALL_PRODUKT_FIELDS } from "@/app/produkte/fields";
import { isHtmlContent, htmlToPlainText } from "@/lib/rich-text/sanitize";

/** Die Codebase + DB nutzen "lichtengros" (mit einem s) als Marken-Code.
 *  Der angezeigte Markenname ist "LICHT.ENGROS" (mit Punkt). */
export type Brand = "lichtengros" | "eisenkeil";

export type DatenblattPayload = {
  meta: {
    /** Footer-Firmenname mittig */
    filiale: string;
    /** Stand-Datum rechts im Footer (DD.MM.YYYY) */
    stand: string;
    /** Fallback-Schriftzug, falls kein Logo geladen werden kann */
    brand_label: string;
    /** Marke (für Template-Konditionalblöcke, falls später nötig) */
    brand: Brand;
  };
  produkt: {
    artikelnummer: string;
    untertitel: string;
  };
  tech_rows: { label: string; value: string }[];
  icons: { filename: string; label: string; wert: string; highlight: string }[];
  details: { filename: string | null }[];
  hauptbild: string;
  zeichnung: string;
  logo_filename: string;
  beschreibung_body: string;
  warnung: string | null;
  /** filename → base64 (ohne data:-Prefix). Worker entpackt ins Workdir. */
  images_b64: Record<string, string>;
};

type Ext = "jpg" | "png";

type SizePreset = "hauptbild" | "detail" | "zeichnung" | "icon" | "logo";

const SIZE_BY_PRESET: Record<SizePreset, { maxWidth: number; quality: number; format: "jpg" | "png" }> = {
  // Hauptbild: A4-Breite ~58 % * 4 px/mm → 480 px reichen für scharfen Druck
  hauptbild: { maxWidth: 1200, quality: 82, format: "jpg" },
  detail: { maxWidth: 800, quality: 80, format: "jpg" },
  zeichnung: { maxWidth: 1200, quality: 85, format: "png" },
  // Icons: 12 mm gerendert ≈ 50 px @150dpi — 200 px Quelle ist genug
  icon: { maxWidth: 200, quality: 80, format: "png" },
  // Logo: 8.5 mm hoch * 4 px/mm = 34 px, mit Headroom 400 px Breite
  logo: { maxWidth: 600, quality: 90, format: "png" },
};

async function downloadAndCompress(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string | null | undefined,
  preset: SizePreset,
): Promise<{ base64: string; ext: Ext } | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) return null;
  const input = Buffer.from(await data.arrayBuffer());
  const cfg = SIZE_BY_PRESET[preset];

  let pipeline = sharp(input).rotate().resize({
    width: cfg.maxWidth,
    withoutEnlargement: true,
  });
  let ext: Ext;
  if (cfg.format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
    ext = "png";
  } else {
    pipeline = pipeline.jpeg({ quality: cfg.quality, mozjpeg: true });
    ext = "jpg";
  }

  const out = await pipeline.toBuffer();
  return { base64: out.toString("base64"), ext };
}

/** Splittet den Beschreibungstext am ACHTUNG-Block ab — der Warnhinweis
 *  wird im Footer-Bereich fett gerendert. */
function splitBeschreibung(raw: string | null | undefined): {
  body: string;
  warnung: string | null;
} {
  if (!raw) return { body: "", warnung: null };
  const plain = isHtmlContent(raw) ? htmlToPlainText(raw) : raw;
  const normalised = plain.replace(/\r\n?/g, "\n");
  const lines = normalised.split("\n");
  const warnIdx = lines.findIndex((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^ACHTUNG\b/i.test(t)) return true;
    if (/INSTALLATION.*ELEKTROFACHKRAFT/i.test(t)) return true;
    if (/LAIENHAFTE VORGEHENSWEISE/i.test(t)) return true;
    return false;
  });
  if (warnIdx < 0) return { body: normalised.trim(), warnung: null };
  const body = lines.slice(0, warnIdx).join("\n").trim();
  const warnung = lines
    .slice(warnIdx)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  return { body, warnung };
}

/** Markenspezifische Konfiguration: Logo-Quelle, Footer-Default, Label.
 *
 * Datenblatt zeigt das Logo auf weißem Grund — wir nehmen daher die
 * "_hell"-Variante (intern: dunkles Logo für hellen Hintergrund) zuerst,
 * Fallback auf "_dunkel". Die Naming-Konvention der DB ist invertiert,
 * d.h. das Feld "_hell" enthält die druckfähige Schwarz-Version. */
function brandConfig(brand: Brand, einstellungen: any) {
  if (brand === "eisenkeil") {
    return {
      label: "EISENKEIL",
      defaultFiliale: "EISENKEIL",
      logoPath:
        einstellungen?.logo_eisenkeil_hell ??
        einstellungen?.logo_eisenkeil_dunkel ??
        null,
    };
  }
  return {
    label: "LICHT.ENGROS",
    defaultFiliale: "LICHT.ENGROS S.R.L.",
    logoPath:
      einstellungen?.logo_lichtengros_hell ??
      einstellungen?.logo_lichtengros_dunkel ??
      null,
  };
}



export async function buildDatenblattPayload(
  supabase: SupabaseClient,
  produktId: string,
  brand: Brand,
): Promise<DatenblattPayload> {
  const [{ data: produkt }, { data: iconRows }, { data: einstellungen }, { data: filialen }] =
    await Promise.all([
      supabase.from("produkte").select("*").eq("id", produktId).single(),
      supabase
        .from("produkt_icons")
        .select("wert, sortierung, icons(label, symbol_path)")
        .eq("produkt_id", produktId)
        .order("sortierung"),
      supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
      supabase.from("filialen").select("name").eq("marke", brand).order("sortierung").limit(1),
    ]);

  if (!produkt) {
    throw new Error(`Produkt ${produktId} nicht gefunden`);
  }

  const cfg = brandConfig(brand, einstellungen);
  const filialeFooter = filialen?.[0]?.name ?? cfg.defaultFiliale;

  const images: Record<string, string> = {};

  // ── Hauptbild ─────────────────────────────────────────────────────────
  const main = await downloadAndCompress(supabase, "produktbilder", produkt.hauptbild_path, "hauptbild");
  let hauptbildName = "";
  if (main) {
    hauptbildName = `hauptbild.${main.ext}`;
    images[hauptbildName] = main.base64;
  }

  // ── Detail-Slots: Detail1, Detail2, Zeichnung1 (Makro/Textur) ─────────
  const detailSlots: { key: keyof typeof produkt; name: string }[] = [
    { key: "bild_detail_1_path", name: "detail1" },
    { key: "bild_detail_2_path", name: "detail2" },
    { key: "bild_zeichnung_1_path", name: "detail3" },
  ];
  const details: { filename: string | null }[] = [];
  for (const s of detailSlots) {
    const img = await downloadAndCompress(
      supabase,
      "produktbilder",
      (produkt as any)[s.key],
      "detail",
    );
    if (img) {
      const fn = `${s.name}.${img.ext}`;
      images[fn] = img.base64;
      details.push({ filename: fn });
    } else {
      details.push({ filename: null });
    }
  }

  // ── Technische Zeichnung mit Maßen ────────────────────────────────────
  const zeichnungImg = await downloadAndCompress(
    supabase,
    "produktbilder",
    produkt.bild_zeichnung_2_path,
    "zeichnung",
  );
  let zeichnungName = "";
  if (zeichnungImg) {
    zeichnungName = `zeichnung.${zeichnungImg.ext}`;
    images[zeichnungName] = zeichnungImg.base64;
  }

  // ── Markenlogo ────────────────────────────────────────────────────────
  const logoImg = await downloadAndCompress(supabase, "assets", cfg.logoPath, "logo");
  let logoName = "";
  if (logoImg) {
    logoName = `logo.${logoImg.ext}`;
    images[logoName] = logoImg.base64;
  }

  // ── Icons (max. 8 — Layout-Limit aus FM-Vorlage) ──────────────────────
  const iconList = ((iconRows ?? []) as any[]).slice(0, 8);
  const icons: DatenblattPayload["icons"] = [];
  for (let i = 0; i < iconList.length; i++) {
    const r = iconList[i];
    const label: string = r.icons?.label ?? "";
    const sym = await downloadAndCompress(
      supabase,
      "produktbilder",
      r.icons?.symbol_path ?? null,
      "icon",
    );
    const filename = sym ? `icon${i + 1}.${sym.ext}` : "";
    if (sym && filename) images[filename] = sym.base64;
    icons.push({
      filename,
      label,
      wert: r.wert ?? "",
      highlight: /^\d{4}\s*K?$/i.test(label.trim()) ? "1" : "0",
    });
  }
  // 8 Slots auffüllen für bündiges Raster
  while (icons.length < 8) {
    icons.push({ filename: "", label: "", wert: "", highlight: "0" });
  }

  // ── Tech-Rows (leere Felder weglassen) ────────────────────────────────
  const techRows = ALL_PRODUKT_FIELDS.map((f) => {
    const v = (produkt as any)[f.col];
    if (v == null || v === "") return null;
    const valStr = f.type === "bool" ? (v ? "Ja" : "Nein") : String(v);
    const unit = f.unit ? ` ${f.unit}` : "";
    return { label: f.label, value: `${valStr}${unit}` };
  }).filter(Boolean) as { label: string; value: string }[];

  // achtung_text ist die neue, eigenständige Quelle für den Warnhinweis.
  // Falls leer, fällt der Generator auf die Heuristik zurück (Altdaten, bei
  // denen die Migration den Block nicht extrahieren konnte).
  const explicitAchtung = (() => {
    const raw = (produkt as any).achtung_text as string | null | undefined;
    if (!raw) return null;
    const plain = isHtmlContent(raw) ? htmlToPlainText(raw) : raw;
    const collapsed = plain.replace(/\s+/g, " ").trim();
    return collapsed.length ? collapsed : null;
  })();

  const split = explicitAchtung
    ? { body: (() => {
        const raw = produkt.datenblatt_text ?? "";
        if (!raw) return "";
        const plain = isHtmlContent(raw) ? htmlToPlainText(raw) : raw;
        return plain.replace(/\r\n?/g, "\n").trim();
      })(), warnung: explicitAchtung }
    : splitBeschreibung(produkt.datenblatt_text);
  const { body: beschreibungBody, warnung } = split;

  return {
    meta: {
      filiale: filialeFooter,
      stand: new Date().toLocaleDateString("de-DE"),
      brand_label: cfg.label,
      brand,
    },
    produkt: {
      artikelnummer: produkt.artikelnummer ?? "",
      untertitel: produkt.info_kurz || produkt.datenblatt_titel || "",
    },
    tech_rows: techRows,
    icons,
    details,
    hauptbild: hauptbildName,
    zeichnung: zeichnungName,
    logo_filename: logoName,
    beschreibung_body: beschreibungBody,
    warnung,
    images_b64: images,
  };
}

/** POST an den LaTeX-Worker, gibt das PDF als Buffer zurück. */
export async function renderDatenblattPdf(
  payload: DatenblattPayload,
): Promise<Buffer> {
  const url = process.env.LATEX_WORKER_URL;
  const token = process.env.LATEX_WORKER_TOKEN;
  if (!url || !token) {
    throw new Error("LATEX_WORKER_URL / LATEX_WORKER_TOKEN nicht gesetzt");
  }
  const res = await fetch(`${url.replace(/\/$/, "")}/render/lichtengross-datenblatt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Token": token,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LaTeX-Worker ${res.status}: ${txt.slice(0, 500)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
