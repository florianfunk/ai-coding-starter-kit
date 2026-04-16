import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TemplateEditor } from "../template-editor";

export const dynamic = "force-dynamic";

export default function NewTemplatePage() {
  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-primary hover:bg-primary/5">
        <Link href="/datenblatt-vorlagen"><ChevronLeft className="h-4 w-4 mr-1" /> Alle Vorlagen</Link>
      </Button>
      <PageHeader eyebrow="Neu anlegen" title="Neue Datenblatt-Vorlage" />
      <TemplateEditor mode="create" />
    </AppShell>
  );
}
