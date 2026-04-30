import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "../template-editor";
import { DeleteTemplateButton } from "../delete-button";
import type { DatenblattTemplate } from "@/lib/datenblatt";
import { ChevronRight } from "lucide-react";

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="crumbs">
              <Link href="/">Dashboard</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href="/datenblatt-vorlagen">Datenblatt-Vorlagen</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">{template.name}</span>
            </div>
            <h1 className="display-lg">{template.is_system ? "Vorlage ansehen" : "Vorlage bearbeiten"}</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">{template.name}</p>
          </div>
          {!template.is_system && (
            <DeleteTemplateButton
              id={template.id}
              name={template.name}
              variant="labeled"
              redirectOnSuccess
            />
          )}
        </div>
        <TemplateEditor mode="edit" template={template} />
      </div>
    </AppShell>
  );
}
