import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { DatenblattDocument } from "@/lib/pdf/datenblatt-document";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const layout = (url.searchParams.get("layout") === "eisenkeil" ? "eisenkeil" : "lichtengros") as
    | "lichtengros" | "eisenkeil";
  const download = url.searchParams.get("download") === "1";

  const supabase = await createClient();
  const { data: produkt } = await supabase.from("produkte").select("*").eq("id", id).single();
  if (!produkt) return new NextResponse("Not found", { status: 404 });

  const [{ data: galerie }, { data: iconLinks }, { data: einstellungen }, { data: filialen }] = await Promise.all([
    supabase.from("produkt_bilder").select("storage_path").eq("produkt_id", id).order("sortierung"),
    supabase.from("produkt_icons").select("icons(label)").eq("produkt_id", id).order("sortierung"),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
    supabase.from("filialen").select("name, adresse").eq("marke", layout).order("sortierung").limit(1),
  ]);

  const hauptbildUrl = await getSignedUrl("produktbilder", produkt.hauptbild_path);
  const galerieUrls = (await Promise.all(
    (galerie ?? []).map((g) => getSignedUrl("produktbilder", g.storage_path)),
  )).filter((u): u is string => !!u);
  const iconLabels = ((iconLinks ?? []) as any[]).map((r) => r.icons?.label).filter(Boolean) as string[];
  const logoField = layout === "lichtengros" ? "logo_lichtengros_dunkel" : "logo_eisenkeil_dunkel";
  const logoUrl = await getSignedUrl("assets", einstellungen?.[logoField] ?? null);
  const fil = filialen?.[0];
  const filialeFooter = fil ? `${fil.name}` : layout === "lichtengros" ? "LICHT.ENGROS S.R.L." : "EISENKEIL";

  const buffer = await renderToBuffer(
    DatenblattDocument({
      produkt,
      hauptbildUrl,
      galerieUrls,
      iconLabels,
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
