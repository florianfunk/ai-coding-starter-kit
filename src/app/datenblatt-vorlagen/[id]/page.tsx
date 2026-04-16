import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "../template-editor";
import type { DatenblattTemplate } from "@/lib/datenblatt";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("datenblatt_templates").select("*").eq("id", id).single();
  if (!data) notFound();

  const template: DatenblattTemplate = {
    ...data,
    page_width_cm: Number(data.page_width_cm),
    page_height_cm: Number(data.page_height_cm),
    slots: data.slots ?? [],
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {template.is_system ? "Vorlage ansehen" : "Vorlage bearbeiten"}
        </h1>
        <TemplateEditor mode="edit" template={template} />
      </div>
    </AppShell>
  );
}
