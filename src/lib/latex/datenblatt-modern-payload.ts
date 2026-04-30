/**
 * Payload-Builder für das moderne Lichtengross/Eisenkeil-Datenblatt.
 *
 * Datenmodell entspricht dem Claude-Design-Briefing
 * (daten/handoff/CLAUDE.md): Quickfacts (6 Kacheln), gruppierte Specs
 * (Elektrik / Photometrie / Bestueckung & Geometrie / Betrieb &
 * Konformitaet), Lead-Text + Strukturparagraphen, Energieklasse fuer die
 * Footer-Skala.
 *
 * Bilder werden serverseitig komprimiert und als base64-Dictionary
 * (`images_b64`) an den LaTeX-Worker uebergeben.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { isHtmlContent, htmlToPlainText } from "@/lib/rich-text/sanitize";

export type ModernBrand = "lichtengros" | "eisenkeil";

export type ModernDatenblattPayload = {
  meta: {
    brand: ModernBrand;
    brand_initial: string;
    brand_name: string;
    brand_suffix: string;
    brand_sub: string;
    filiale: string;
    stand: string;
    revision: string;
    version: string;
    energy_class: string;
  };
  produkt: {
    artikelnummer: string;
    eyebrow: string;
    title: string;
    title_accent: string;
    subtitle: string;
    pill: string;
    lead: string;
  };
  quickfacts: { label: string; value: string; unit: string }[];
  spec_groups: { title: string; rows: { label: string; value: string }[] }[];
  paragraphs: string[];
  warnung: string | null;
  logo_filename: string;
  figA_filename: string | null;
  figB_filename: string | null;
  figC_filename: string | null;
  images_b64: Record<string, string>;
};

type Ext = "jpg" | "png";

async function downloadAndCompress(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string | null | undefined,
  preset: "hero" | "detail" | "logo",
): Promise<{ base64: string; ext: Ext } | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) return null;
  const input = Buffer.from(await data.arrayBuffer());

  const cfg =
    preset === "hero"
      ? { maxWidth: 1200, quality: 82, png: false }
      : preset === "detail"
      ? { maxWidth: 800, quality: 80, png: false }
      : { maxWidth: 600, quality: 90, png: true };

  let pipeline = sharp(input).rotate().resize({
    width: cfg.maxWidth,
    withoutEnlargement: true,
  });
  let ext: Ext;
  if (cfg.png) {
    pipeline = pipeline.png({ compressionLevel: 9 });
    ext = "png";
  } else {
    pipeline = pipeline.jpeg({ quality: cfg.quality, mozjpeg: true });
    ext = "jpg";
  }
  const out = await pipeline.toBuffer();
  return { base64: out.toString("base64"), ext };
}

function brandConfig(brand: ModernBrand, _einstellungen: any) {
  if (brand === "eisenkeil") {
    return {
      brand_initial: "E",
      brand_name: "Eisenkeil",
      brand_suffix: "",
      brand_sub: "Lighting Distribution",
      defaultFiliale: "EISENKEIL",
      // Logo liegt statisch im Worker unter /srv/assets/lichtengross/.
      // Das Template referenziert es ueber den Dateinamen ohne Pfad —
      // \graphicspath in der Klasse loest /srv/assets/lichtengross/ auf.
      logoFilename: "eisenkeil_logo.png",
    };
  }
  return {
    brand_initial: "L",
    brand_name: "Lichtengross",
    brand_suffix: "S.R.L.",
    brand_sub: "Professional Lighting Components",
    defaultFiliale: "LICHT.ENGROS S.R.L.",
    logoFilename: "lichtengross_logo.png",
  };
}

/** Plain-Text aus DB-Beschreibung, Splittet ACHTUNG-Block ab. */
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
  // Fuhrendes "ACHTUNG:" / "ACHTUNG " entfernen — das Label kommt vom Template.
  const warnung = lines
    .slice(warnIdx)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/^ACHTUNG\s*[:\.]?\s*/i, "");
  return { body, warnung };
}

/** Beschreibungstext in 1–4 Absaetze splitten (Briefing Lead + 4 Paras). */
function splitParagraphs(body: string): string[] {
  if (!body) return [];
  // Erster Absatz wird Lead. Wenn der Body sehr lang ist, kuerzen wir ihn
  // auf max 2 Absaetze damit das Datenblatt auf eine Seite passt.
  const byBlank = body.split(/\n\s*\n+/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  if (byBlank.length >= 2) return byBlank.slice(0, 2);
  // Single block: kuerzer trimmen
  const truncated = body.trim().length > 600 ? body.trim().slice(0, 580).replace(/\s\S*$/, " …") : body.trim();
  return [truncated];
}

/** Format helper for DB values with units (skip empty). */
function fmtValue(v: any, unit?: string): string {
  if (v == null || v === "") return "";
  const s = String(v).replace(/\.(\d)/, ",$1"); // 4.8 → 4,8
  return unit ? `${s} ${unit}` : s;
}

/** Quickfact-Liste (genau 6) aus DB-Werten. Leere Felder zeigen "—". */
function buildQuickfacts(produkt: any): ModernDatenblattPayload["quickfacts"] {
  return [
    { label: "Leistung", value: fmtValue(produkt.leistung_w) || "—", unit: produkt.leistung_w ? "W/m" : "" },
    { label: "Lichtstrom", value: fmtValue(produkt.lichtstrom_lm) || "—", unit: produkt.lichtstrom_lm ? "lm/m" : "" },
    { label: "CCT", value: fmtValue(produkt.farbtemperatur_k) || "—", unit: produkt.farbtemperatur_k ? "K" : "" },
    { label: "CRI", value: produkt.farbwiedergabeindex_cri ? `Ra ${produkt.farbwiedergabeindex_cri}` : "—", unit: "" },
    { label: "Spannung", value: fmtValue(produkt.nennspannung_v) || "—", unit: produkt.nennspannung_v ? `V ${produkt.spannungsart || ""}`.trim() : "" },
    { label: "IP", value: produkt.ip_schutzart || produkt.schutzart_ip || "—", unit: "" },
  ];
}

/** Spec-Gruppen exakt nach Briefing 6.5.2. */
function buildSpecGroups(produkt: any): ModernDatenblattPayload["spec_groups"] {
  // Konsolidierte Specs — Leistung/CCT/CRI/Spannung/IP sind schon in Quickfacts,
  // hier nur das, was im Detail relevant ist. Pro Gruppe max. 4 Zeilen.
  const groups = [
    {
      title: "Elektrik & Sicherheit",
      rows: [
        ["Mit Betriebsgerät", produkt.mit_betriebsgeraet === true ? "Ja" : produkt.mit_betriebsgeraet === false ? "Nein" : ""],
        ["Schutzklasse / IP", [produkt.schutzklasse, produkt.ip_schutzart || produkt.schutzart_ip].filter(Boolean).join(" · ")],
        ["Effizienz", fmtValue(produkt.gesamteffizienz_lm_w, "lm/W")],
        ["Energieeffizienzklasse", produkt.energieeffizienzklasse || ""],
      ],
    },
    {
      title: "Photometrie",
      rows: [
        ["SDCM", produkt.farbkonsistenz_sdcm ? `SDCM ${String(produkt.farbkonsistenz_sdcm).replace(/^SDCM\s*/i, "")}` : ""],
        ["Abstrahlwinkel", produkt.abstrahlwinkel_grad ? `${produkt.abstrahlwinkel_grad}°` : ""],
      ],
    },
    {
      title: "Bestückung & Geometrie",
      rows: [
        ["LED-Chip", produkt.led_chip ? `SMD ${produkt.led_chip}` : ""],
        ["LED/m · Pitch", [produkt.anzahl_led_pro_meter ? `${produkt.anzahl_led_pro_meter}/m` : null, produkt.abstand_led_zu_led_mm ? `${produkt.abstand_led_zu_led_mm} mm` : null].filter(Boolean).join(" · ")],
        ["Maße L × B × H", [produkt.laenge_mm, produkt.breite_mm, produkt.hoehe_mm].every((v) => v != null && v !== "") ? `${produkt.laenge_mm} × ${produkt.breite_mm} × ${produkt.hoehe_mm} mm` : (produkt.masse_text || "")],
        ["Abschnitt / Max. Länge", [produkt.laenge_einzelabschnitt_mm ? `${produkt.laenge_einzelabschnitt_mm} mm` : null, produkt.maximale_laenge_m ? `${produkt.maximale_laenge_m} m` : null].filter(Boolean).join(" · ")],
        ["Min. Biegeradius / Rolle", [produkt.kleinster_biegeradius_mm ? `${produkt.kleinster_biegeradius_mm} mm` : null, produkt.rollenlaenge_m ? `${produkt.rollenlaenge_m} m` : null].filter(Boolean).join(" · ")],
      ],
    },
    {
      title: "Betrieb & Konformität",
      rows: [
        ["Umgebung Ta / Tc", [
          produkt.umgebungstemperatur_min_c != null && produkt.umgebungstemperatur_max_c != null
            ? `${produkt.umgebungstemperatur_min_c}…${produkt.umgebungstemperatur_max_c} °C`
            : null,
          produkt.tc_max_c ? `${produkt.tc_max_c} °C` : null,
        ].filter(Boolean).join(" · ")],
        ["Lebensdauer L70", fmtValue(produkt.lebensdauer_h, "h")],
        ["Zertifikate", produkt.zertifikate || ""],
      ],
    },
  ];
  // Leere Zeilen rauswerfen pro Gruppe
  return groups
    .map((g) => ({
      title: g.title,
      rows: g.rows.filter(([, v]) => v && v !== "" && v !== "—").map(([label, value]) => ({ label: String(label), value: String(value) })),
    }))
    .filter((g) => g.rows.length > 0);
}

/**
 * PROJ-38: Resolved-Vorlage mit Slot-Definitionen.
 * Wird vom Layout-Registry-Adapter durchgereicht.
 */
export type ResolvedTemplateForPayload = {
  id: string;
  slots: Array<{
    id: string;
    kind: "image" | "energielabel" | "cutting";
    position?: string;
  }>;
};

export async function buildModernDatenblattPayload(
  supabase: SupabaseClient,
  produktId: string,
  brand: ModernBrand,
  template?: ResolvedTemplateForPayload,
): Promise<ModernDatenblattPayload> {
  const [{ data: produkt }, { data: einstellungen }, { data: filialen }, { data: slotBilder }] = await Promise.all([
    supabase
      .from("produkte")
      .select("*, bereiche(name), kategorien(name)")
      .eq("id", produktId)
      .single(),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
    supabase.from("filialen").select("name").eq("marke", brand).order("sortierung").limit(1),
    template
      ? supabase
          .from("produkt_datenblatt_slots")
          .select("slot_id, storage_path")
          .eq("produkt_id", produktId)
          .eq("template_id", template.id)
      : Promise.resolve({ data: [] as { slot_id: string; storage_path: string | null }[] }),
  ]);

  if (!produkt) throw new Error(`Produkt ${produktId} nicht gefunden`);

  const cfg = brandConfig(brand, einstellungen);
  const filialeFooter = filialen?.[0]?.name ?? cfg.defaultFiliale;

  const images: Record<string, string> = {};

  // PROJ-38: Slot-Bilder pro position aufloesen.
  // Vorrang: produkt_datenblatt_slots-Eintrag fuer die aktive Vorlage; Fallback: Stammdaten-Pfad.
  const slotPathByPosition = new Map<string, string>();
  if (template && Array.isArray(slotBilder)) {
    const pathBySlotId = new Map<string, string>();
    for (const sb of slotBilder) {
      if (sb.storage_path) pathBySlotId.set(sb.slot_id, sb.storage_path);
    }
    for (const slot of template.slots) {
      if (slot.position && pathBySlotId.has(slot.id)) {
        slotPathByPosition.set(slot.position, pathBySlotId.get(slot.id)!);
      }
    }
  }

  const heroPath    = slotPathByPosition.get("hero")     ?? produkt.hauptbild_path;
  const detail1Path = slotPathByPosition.get("detail-1") ?? produkt.bild_detail_1_path;
  const detail2Path = slotPathByPosition.get("detail-2") ?? produkt.bild_detail_2_path;

  // Hauptbild → figA
  const figA = await downloadAndCompress(supabase, "produktbilder", heroPath, "hero");
  let figA_filename: string | null = null;
  if (figA) {
    figA_filename = `figA.${figA.ext}`;
    images[figA_filename] = figA.base64;
  }

  // figB = detail-1, figC = detail-2
  const figB = await downloadAndCompress(supabase, "produktbilder", detail1Path, "detail");
  let figB_filename: string | null = null;
  if (figB) {
    figB_filename = `figB.${figB.ext}`;
    images[figB_filename] = figB.base64;
  }

  const figC = await downloadAndCompress(supabase, "produktbilder", detail2Path, "detail");
  let figC_filename: string | null = null;
  if (figC) {
    figC_filename = `figC.${figC.ext}`;
    images[figC_filename] = figC.base64;
  }

  // Logo: statisches Brand-Asset aus dem Worker (kein Supabase-Download).
  const logo_filename = cfg.logoFilename;

  const { body, warnung } = splitBeschreibung(produkt.datenblatt_text);
  const allParagraphs = splitParagraphs(body);
  // Lead = produkt.info_kurz (Marketing-Headline) ODER der erste Absatz wenn info_kurz fehlt.
  // Body = die uebrigen Absaetze.
  const lead = (produkt.info_kurz?.trim()) || allParagraphs[0] || "";
  const paragraphs = produkt.info_kurz?.trim() ? allParagraphs : allParagraphs.slice(1);

  // Title-Bauplan (HTML-Vorlage): kurz, technisch, nicht der ganze
  // Marketing-Untertitel. Wir bauen aus DB-Feldern:
  //   Zeile 1: "<Produktklasse> <Watt> W/m · <Volt> V"
  //   Akzent:  "<CCT> K [<Lichtfarbe>]"
  function shortProductClass(p: any): string {
    const ak = String(p.artikelnummer ?? "");
    if (/^bl/i.test(ak)) return "LED-Flexband";
    if (/^pro/i.test(ak)) return "LED-Profil";
    if (/^drv|netz/i.test(ak)) return "Netzteil";
    return "LED-Komponente";
  }
  const cls = shortProductClass(produkt);
  const titleParts: string[] = [cls];
  if (produkt.leistung_w) titleParts.push(`${String(produkt.leistung_w).replace(".", ",")} W/m`);
  if (produkt.nennspannung_v) titleParts.push(`${produkt.nennspannung_v} V`);
  const title = titleParts.length > 1 ? `${titleParts[0]} ${titleParts.slice(1).join(" · ")}` : cls;
  const titleAccent = produkt.farbtemperatur_k
    ? `${produkt.farbtemperatur_k} K${produkt.lichtfarbe_label ? " " + produkt.lichtfarbe_label : ""}`
    : "";

  const payload: ModernDatenblattPayload = {
    meta: {
      brand,
      brand_initial: cfg.brand_initial,
      brand_name: cfg.brand_name,
      brand_suffix: cfg.brand_suffix,
      brand_sub: cfg.brand_sub,
      filiale: filialeFooter,
      stand: new Date().toLocaleDateString("de-DE"),
      revision: `Rev. ${new Date().toISOString().slice(0, 10)}`,
      version: "v1.0",
      energy_class: produkt.energieeffizienzklasse?.[0]?.toUpperCase() || "F",
    },
    produkt: {
      artikelnummer: produkt.artikelnummer ?? "",
      eyebrow: [produkt.bereiche?.name, produkt.kategorien?.name].filter(Boolean).join(" · "),
      title: title ?? "",
      title_accent: titleAccent,
      // Subtitle nur, wenn unterschieden von Lead und Title (sonst doppelt)
      subtitle: (() => {
        const candidate = produkt.info_kurz || "";
        if (!candidate || candidate.trim().length < 5) return "";
        if (lead && candidate.trim() === lead.trim()) return "";
        return candidate.length > 140 ? candidate.slice(0, 138) + "…" : candidate;
      })(),
      pill: produkt.rollenlaenge_m
        ? `${produkt.rollenlaenge_m} m Rolle`
        : produkt.verpackungseinheit || "",
      lead,
    },
    quickfacts: buildQuickfacts(produkt),
    spec_groups: buildSpecGroups(produkt),
    paragraphs,
    warnung,
    logo_filename,
    figA_filename,
    figB_filename,
    figC_filename,
    images_b64: images,
  };

  return payload;
}

export async function renderModernDatenblattPdf(
  payload: ModernDatenblattPayload,
): Promise<Buffer> {
  const url = process.env.LATEX_WORKER_URL;
  const token = process.env.LATEX_WORKER_TOKEN;
  if (!url || !token) {
    throw new Error("LATEX_WORKER_URL / LATEX_WORKER_TOKEN nicht gesetzt");
  }
  const res = await fetch(`${url.replace(/\/$/, "")}/render/lichtengross-datenblatt-modern`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Token": token },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LaTeX-Worker ${res.status}: ${txt.slice(0, 600)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
