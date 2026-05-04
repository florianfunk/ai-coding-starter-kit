/**
 * PROJ-38: Layout-Registry fuer Datenblatt-Vorlagen.
 *
 * Jede aktivierte Vorlage in `datenblatt_templates` hat einen `latex_template_key`,
 * der hier registriert sein muss. Die Render-Route loest den Key zur Builder-Funktion
 * + Worker-Endpoint auf.
 *
 * Neue LaTeX-Variante hinzufuegen:
 *   1. Template-Ordner unter services/latex-pdf-service/templates/<key>
 *   2. Builder-Funktion in eigenem Modul (Signatur: BuildModernPayload o.ae.)
 *   3. Eintrag in LAYOUT_REGISTRY
 *   4. Migration mit Vorlagen-Eintrag (latex_template_key = <key>, slots = ...)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand as ClassicBrand } from "./datenblatt-payload";
import {
  buildModernDatenblattPayload,
  renderModernDatenblattPdf,
  type ModernBrand,
} from "./datenblatt-modern-payload";
import type { DatenblattLang } from "./i18n";

/**
 * Resolved-Vorlage mit allem, was der Renderer braucht.
 * Wird von der Route an den Builder uebergeben.
 */
export type ResolvedTemplate = {
  id: string;
  latex_template_key: string;
  slots: Array<{
    id: string;
    kind: "image" | "energielabel" | "cutting";
    label: string;
    position?: string;
    optional?: boolean;
  }>;
};

/**
 * Eine Layout-Variante besteht aus einem Builder (TS-Code, der den Payload erzeugt
 * und den PDF-Render-Aufruf an den Worker macht).
 */
type LayoutEntry = {
  build: (
    supabase: SupabaseClient,
    produktId: string,
    brand: ClassicBrand,
    template: ResolvedTemplate,
    lang?: DatenblattLang,
  ) => Promise<Buffer>;
};

/**
 * Adapter: Modern-Builder + Render in einem Aufruf.
 * Akzeptiert die Resolved-Template-Definition und reicht sie weiter.
 */
async function buildAndRenderModern(
  supabase: SupabaseClient,
  produktId: string,
  brand: ClassicBrand,
  template: ResolvedTemplate,
  lang: DatenblattLang = "de",
): Promise<Buffer> {
  const payload = await buildModernDatenblattPayload(
    supabase,
    produktId,
    brand as ModernBrand,
    template,
    lang,
  );
  return renderModernDatenblattPdf(payload);
}

export const LAYOUT_REGISTRY: Record<string, LayoutEntry> = {
  "lichtengross-datenblatt-modern": {
    build: buildAndRenderModern,
  },
  // Weitere Layouts hier registrieren.
};

export function getLayoutEntry(key: string): LayoutEntry | null {
  return LAYOUT_REGISTRY[key] ?? null;
}
