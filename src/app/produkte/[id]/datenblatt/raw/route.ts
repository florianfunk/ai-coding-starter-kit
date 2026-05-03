/**
 * Streamt das LaTeX-gerenderte Datenblatt-PDF fuer ein Produkt.
 *
 * Query:
 *   ?layout=lichtengros|eisenkeil   (Marke; default: lichtengros)
 *   ?style=klassisch                 (forciert das alte FileMaker-Replikat;
 *                                     ohne Parameter wird die DB-Vorlage genutzt)
 *   ?download=1                      (Content-Disposition: attachment)
 *
 * Rendering laeuft im dedizierten Worker auf pdf.lichtengross.funk.solutions.
 *
 * PROJ-38: Render-Route ist datengetrieben.
 *  1. Lade Vorlage des Produkts (FK datenblatt_template_id)
 *  2. Falls keine Vorlage gesetzt oder Vorlage hat keinen latex_template_key:
 *     Fallback auf Default-Vorlage (is_default=true)
 *  3. Layout-Key wird in der LAYOUT_REGISTRY zu Builder+Renderer aufgeloest
 *  4. Style "klassisch" umgeht das System und nutzt das FileMaker-Replikat direkt.
 */
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildDatenblattPayload,
  renderDatenblattPdf,
  type Brand,
} from "@/lib/latex/datenblatt-payload";
import { getLayoutEntry, type ResolvedTemplate } from "@/lib/latex/layout-registry";

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
    .select("artikelnummer, datenblatt_template_id")
    .eq("id", id)
    .single();
  if (!produkt) return new NextResponse("Not found", { status: 404 });

  try {
    let pdf: Buffer;

    if (forceClassic) {
      // Direktzugriff auf das FileMaker-Replikat (kein Vorlagen-Lookup).
      const payload = await buildDatenblattPayload(supabase, id, layout);
      pdf = await renderDatenblattPdf(payload);
    } else {
      const template = await resolveTemplate(supabase, produkt.datenblatt_template_id);
      if (!template) {
        return new NextResponse(
          "Keine aktivierte Datenblatt-Vorlage konfiguriert. Bitte mindestens eine Default-Vorlage anlegen.",
          { status: 500 },
        );
      }
      const entry = getLayoutEntry(template.latex_template_key);
      if (!entry) {
        return new NextResponse(
          `Unbekanntes LaTeX-Layout "${template.latex_template_key}" — bitte in LAYOUT_REGISTRY registrieren.`,
          { status: 500 },
        );
      }
      pdf = await entry.build(supabase, id, layout, template);
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

async function resolveTemplate(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  templateId: string | null,
): Promise<ResolvedTemplate | null> {
  // 1. Versuch: gewaehlte Vorlage des Produkts
  if (templateId) {
    const { data } = await supabase
      .from("datenblatt_templates")
      .select("id, latex_template_key, slots")
      .eq("id", templateId)
      .single();
    if (data?.latex_template_key) {
      return {
        id: data.id,
        latex_template_key: data.latex_template_key,
        slots: (data.slots as ResolvedTemplate["slots"]) ?? [],
      };
    }
  }

  // 2. Fallback: Default-Vorlage
  const { data: def } = await supabase
    .from("datenblatt_templates")
    .select("id, latex_template_key, slots")
    .eq("is_default", true)
    .not("latex_template_key", "is", null)
    .maybeSingle();
  if (def?.latex_template_key) {
    return {
      id: def.id,
      latex_template_key: def.latex_template_key,
      slots: (def.slots as ResolvedTemplate["slots"]) ?? [],
    };
  }

  return null;
}
