/**
 * Layout-Registry fuer Datenblatt-PDFs.
 *
 * Jede aktivierte Vorlage in `datenblatt_templates` hat einen `latex_template_key`,
 * der hier registriert sein muss. Die Render-Route loest den Key zur Builder-Funktion
 * + Worker-Endpoint auf.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand as ClassicBrand } from "./datenblatt-payload";
import {
  buildModernDatenblattPayload,
  renderModernDatenblattPdf,
  type ModernBrand,
} from "./datenblatt-modern-payload";
import type { DatenblattLang } from "./i18n";

type LayoutEntry = {
  build: (
    supabase: SupabaseClient,
    produktId: string,
    brand: ClassicBrand,
    lang?: DatenblattLang,
  ) => Promise<Buffer>;
};

async function buildAndRenderModern(
  supabase: SupabaseClient,
  produktId: string,
  brand: ClassicBrand,
  lang: DatenblattLang = "de",
): Promise<Buffer> {
  const payload = await buildModernDatenblattPayload(
    supabase,
    produktId,
    brand as ModernBrand,
    lang,
  );
  return renderModernDatenblattPdf(payload);
}

export const LAYOUT_REGISTRY: Record<string, LayoutEntry> = {
  "lichtengross-datenblatt-modern": {
    build: buildAndRenderModern,
  },
};

export function getLayoutEntry(key: string): LayoutEntry | null {
  return LAYOUT_REGISTRY[key] ?? null;
}
