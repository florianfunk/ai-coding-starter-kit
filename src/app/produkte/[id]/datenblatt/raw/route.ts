/**
 * Streamt das LaTeX-gerenderte Datenblatt-PDF fuer ein Produkt.
 *
 * Query:
 *   ?layout=lichtengros|eisenkeil   (Marke; default: lichtengros)
 *   ?style=klassisch                 (forciert das alte FileMaker-Replikat;
 *                                     ohne Parameter wird das Default-Layout genutzt)
 *   ?lang=de|it                      (PROJ-46 — Sprache; default: de)
 *   ?download=1                      (Content-Disposition: attachment)
 *
 * Rendering laeuft im dedizierten Worker auf pdf.lichtengross.funk.solutions.
 *
 * Es gibt aktuell genau ein modernes Layout (`lichtengross-datenblatt-modern`).
 * Die DB-Vorlage steuert nur noch den `latex_template_key`; pro Produkt wird
 * keine Vorlage mehr ausgewaehlt.
 */
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildDatenblattPayload,
  renderDatenblattPdf,
  type Brand,
} from "@/lib/latex/datenblatt-payload";
import { getLayoutEntry } from "@/lib/latex/layout-registry";
import type { DatenblattLang } from "@/lib/latex/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const layout: Brand = url.searchParams.get("layout") === "eisenkeil" ? "eisenkeil" : "lichtengros";
  const forceClassic = url.searchParams.get("style") === "klassisch";
  const lang: DatenblattLang = url.searchParams.get("lang") === "it" ? "it" : "de";
  const download = url.searchParams.get("download") === "1";

  // Defense-in-Depth: nicht nur auf Middleware vertrauen — auch hier prüfen.
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = await createServiceRoleClient();

  const { data: produkt } = await supabase
    .from("produkte")
    .select("artikelnummer")
    .eq("id", id)
    .single();
  if (!produkt) return new NextResponse("Not found", { status: 404 });

  try {
    let pdf: Buffer;

    if (forceClassic) {
      // Direktzugriff auf das FileMaker-Replikat (kein Layout-Lookup).
      const payload = await buildDatenblattPayload(supabase, id, layout, lang);
      pdf = await renderDatenblattPdf(payload);
    } else {
      const layoutKey = await resolveDefaultLayoutKey(supabase);
      if (!layoutKey) {
        return new NextResponse(
          "Kein aktiviertes Datenblatt-Layout konfiguriert. Bitte mindestens eine Default-Vorlage anlegen.",
          { status: 500 },
        );
      }
      const entry = getLayoutEntry(layoutKey);
      if (!entry) {
        return new NextResponse(
          `Unbekanntes LaTeX-Layout "${layoutKey}" — bitte in LAYOUT_REGISTRY registrieren.`,
          { status: 500 },
        );
      }
      pdf = await entry.build(supabase, id, layout, lang);
    }

    // PROJ-46: Sprach-Suffix im Dateinamen — DE bleibt rückwärtskompatibel.
    const langSuffix = lang === "it" ? "-IT" : "";
    const filename = `Datenblatt-${produkt.artikelnummer}${langSuffix}.pdf`;
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
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

async function resolveDefaultLayoutKey(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("datenblatt_templates")
    .select("latex_template_key")
    .eq("is_default", true)
    .not("latex_template_key", "is", null)
    .maybeSingle();
  return data?.latex_template_key ?? null;
}
