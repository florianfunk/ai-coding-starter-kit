import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilialenTab } from "./filialen-tab";
import { KatalogTab } from "./katalog-tab";
import { LogosTab } from "./logos-tab";

export const dynamic = "force-dynamic";

const ASSET_FIELDS = [
  "cover_vorne_path", "cover_hinten_path",
  "logo_lichtengros_dunkel", "logo_lichtengros_hell",
  "logo_eisenkeil_dunkel", "logo_eisenkeil_hell",
  "logo_lichtstudio",
] as const;

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const [{ data: filialen }, { data: e }] = await Promise.all([
    supabase.from("filialen").select("*").order("marke").order("sortierung"),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
  ]);

  const assetUrls: Record<string, string | null> = {};
  for (const f of ASSET_FIELDS) {
    assetUrls[f] = await getSignedUrl("assets", e?.[f] ?? null);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <Tabs defaultValue="filialen">
          <TabsList>
            <TabsTrigger value="filialen">Filialen</TabsTrigger>
            <TabsTrigger value="katalog">Katalog</TabsTrigger>
            <TabsTrigger value="logos">Logos</TabsTrigger>
          </TabsList>
          <TabsContent value="filialen"><FilialenTab filialen={filialen ?? []} /></TabsContent>
          <TabsContent value="katalog"><KatalogTab settings={e} /></TabsContent>
          <TabsContent value="logos"><LogosTab assetUrls={assetUrls} settings={e} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
