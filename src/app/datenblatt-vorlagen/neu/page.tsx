import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChevronRight } from "lucide-react";
import { TemplateEditor } from "../template-editor";

export const dynamic = "force-dynamic";

export default function NewTemplatePage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/datenblatt-vorlagen">Datenblatt-Vorlagen</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Neu</span>
          </div>
          <h1 className="display-lg">Neue Datenblatt-Vorlage</h1>
        </div>
        <TemplateEditor mode="create" />
      </div>
    </AppShell>
  );
}
