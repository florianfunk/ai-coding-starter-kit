import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildDatenblattPayload,
  renderDatenblattPdf,
  type Brand,
} from "@/lib/latex/datenblatt-payload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const layout: Brand = url.searchParams.get("layout") === "eisenkeil" ? "eisenkeil" : "lichtengros";
  const download = url.searchParams.get("download") === "1";

  const supabase = await createServiceRoleClient();
  const { data: produkt } = await supabase
    .from("produkte")
    .select("artikelnummer")
    .eq("id", id)
    .single();
  if (!produkt) return new NextResponse("Not found", { status: 404 });

  try {
    const payload = await buildDatenblattPayload(supabase, id, layout);
    const pdf = await renderDatenblattPdf(payload);
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Datenblatt-${produkt.artikelnummer}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[datenblatt] render failed", err);
    return new NextResponse(`Fehler beim Rendern: ${err?.message ?? String(err)}`, { status: 500 });
  }
}
