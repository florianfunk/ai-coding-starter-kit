import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { FilialenTab } from "./filialen-tab";
import { KatalogTab } from "./katalog-tab";
import { LogosTab } from "./logos-tab";
import { AiTab } from "./ai-tab";

export const dynamic = "force-dynamic";

const ASSET_FIELDS = [
  "cover_vorne_path", "cover_hinten_path",
  "logo_lichtengros_dunkel", "logo_lichtengros_hell",
  "logo_eisenkeil_dunkel", "logo_eisenkeil_hell",
  "logo_lichtstudio",
] as const;

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const [{ data: filialen }, { data: e }, { data: ai }] = await Promise.all([
    supabase.from("filialen").select("*").order("marke").order("sortierung"),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
    supabase
      .from("ai_einstellungen")
      .select("replicate_token, openai_api_key, anthropic_api_key, ai_provider, ai_model, auto_translate_it")
      .eq("id", 1)
      .single(),
  ]);

  const assetUrls: Record<string, string | null> = {};
  for (const f of ASSET_FIELDS) {
    assetUrls[f] = await getSignedUrl("assets", e?.[f] ?? null);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Konfiguration"
        title="Einstellungen"
        subtitle="Filialen, Katalog-Parameter und Marken-Assets"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Einstellungen" },
        ]}
      />
      <Tabs defaultValue="filialen">
        <TabsList>
          <TabsTrigger value="filialen" className="gap-2">
            <Building2 className="h-3.5 w-3.5" /> Filialen
          </TabsTrigger>
          <TabsTrigger value="katalog" className="gap-2">
            <FileText className="h-3.5 w-3.5" /> Katalog
          </TabsTrigger>
          <TabsTrigger value="logos" className="gap-2">
            <ImageIcon className="h-3.5 w-3.5" /> Logos
          </TabsTrigger>
          <TabsTrigger value="ki" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" /> KI
          </TabsTrigger>
        </TabsList>
        <TabsContent value="filialen"><FilialenTab filialen={filialen ?? []} /></TabsContent>
        <TabsContent value="katalog"><KatalogTab settings={e} /></TabsContent>
        <TabsContent value="logos"><LogosTab assetUrls={assetUrls} settings={e} /></TabsContent>
        <TabsContent value="ki"><AiTab settings={ai} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
