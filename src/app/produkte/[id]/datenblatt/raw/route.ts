import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { DatenblattDocument, type IconPdf } from "@/lib/pdf/datenblatt-document";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const layout = (url.searchParams.get("layout") === "eisenkeil" ? "eisenkeil" : "lichtengros") as
    | "lichtengros"
    | "eisenkeil";
  const download = url.searchParams.get("download") === "1";

  const supabase = await createClient();
  const { data: produkt } = await supabase.from("produkte").select("*").eq("id", id).single();
  if (!produkt) return new NextResponse("Not found", { status: 404 });

  const [{ data: iconRows }, { data: einstellungen }, { data: filialen }] = await Promise.all([
    supabase
      .from("produkt_icons")
      .select("wert, icons(label, symbol_path)")
      .eq("produkt_id", id)
      .order("sortierung"),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
    supabase.from("filialen").select("name, adresse").eq("marke", layout).order("sortierung").limit(1),
  ]);

  // Hauptbild + Datenblatt-Bilder parallel signieren
  const [
    hauptbildUrl,
    detail1Url,
    detail2Url,
    zeichnung1Url,
    zeichnung2Url,
    energielabelUrl,
  ] = await Promise.all([
    getSignedUrl("produktbilder", produkt.hauptbild_path),
    getSignedUrl("produktbilder", produkt.bild_detail_1_path),
    getSignedUrl("produktbilder", produkt.bild_detail_2_path),
    getSignedUrl("produktbilder", produkt.bild_zeichnung_1_path),
    getSignedUrl("produktbilder", produkt.bild_zeichnung_2_path),
    getSignedUrl("produktbilder", produkt.bild_energielabel_path),
  ]);

  // Icons mit Werten und signierten Symbol-URLs
  const icons: IconPdf[] = await Promise.all(
    ((iconRows ?? []) as any[]).map(async (r) => ({
      label: r.icons?.label ?? "",
      url: await getSignedUrl("produktbilder", r.icons?.symbol_path ?? null),
      wert: r.wert ?? null,
    })),
  );

  // Header-Logo: das Datenblatt zeigt das Logo auf weißem Grund, daher
  // "hell" (oft Negativ-/Dunkel-Variante des Logos) bevorzugen, fallback auf "dunkel".
  const logoPath = layout === "lichtengros"
    ? (einstellungen?.logo_lichtengros_dunkel ?? einstellungen?.logo_lichtengros_hell ?? null)
    : (einstellungen?.logo_eisenkeil_dunkel ?? einstellungen?.logo_eisenkeil_hell ?? null);
  const logoUrl = await getSignedUrl("assets", logoPath);
  const fil = filialen?.[0];
  const filialeFooter = fil ? fil.name : layout === "lichtengros" ? "LICHT.ENGROS S.R.L." : "EISENKEIL";

  // DETAILS-Slots: Detail1, Detail2, Zeichnung1 (Makro/Textur). Die bemaßte
  // technische Zeichnung (Zeichnung2) bekommt ihren eigenen Platz darunter.
  const detailUrls = [detail1Url, detail2Url, zeichnung1Url];

  const buffer = await renderToBuffer(
    DatenblattDocument({
      produkt,
      hauptbildUrl,
      detailUrls,
      zeichnungUrl: zeichnung2Url,
      energielabelUrl,
      icons,
      layout,
      logoUrl,
      filialeFooter,
    }),
  );

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Datenblatt-${produkt.artikelnummer}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
