/**
 * Streamt das LaTeX-gerenderte Datenblatt-PDF fuer ein Produkt.
 *
 * Query:
 *   ?layout=lichtengros|eisenkeil   (Marke; default: lichtengros)
 *   ?style=klassisch|modern          (Layoutstil; default: modern)
 *   ?download=1                      (Content-Disposition: attachment)
 *
 * Rendering laeuft im dedizierten Worker auf pdf.lichtengross.funk.solutions.
 * - klassisch: lichtengross-datenblatt (FileMaker-Replikat)
 * - modern:    lichtengross-datenblatt-modern (Claude-Design-Briefing)
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildDatenblattPayload,
  renderDatenblattPdf,
  type Brand,
} from "@/lib/latex/datenblatt-payload";
import {
  buildModernDatenblattPayload,
  renderModernDatenblattPdf,
  type ModernBrand,
} from "@/lib/latex/datenblatt-modern-payload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const layout: Brand = url.searchParams.get("layout") === "eisenkeil" ? "eisenkeil" : "lichtengros";
  // Default = modern; "klassisch" forciert das alte FileMaker-Replikat.
  const style: "klassisch" | "modern" = url.searchParams.get("style") === "klassisch" ? "klassisch" : "modern";
  const download = url.searchParams.get("download") === "1";

  const supabase = await createServiceRoleClient();

  const { data: produkt } = await supabase
    .from("produkte")
    .select("artikelnummer")
    .eq("id", id)
    .single();
  if (!produkt) return new NextResponse("Not found", { status: 404 });

  try {
    let pdf: Buffer;
    if (style === "modern") {
      const payload = await buildModernDatenblattPayload(supabase, id, layout as ModernBrand);
      pdf = await renderModernDatenblattPdf(payload);
    } else {
      const payload = await buildDatenblattPayload(supabase, id, layout);
      pdf = await renderDatenblattPdf(payload);
    }

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
    return new NextResponse(
      `Fehler beim Rendern: ${err?.message ?? String(err)}`,
      { status: 500 },
    );
  }
}
