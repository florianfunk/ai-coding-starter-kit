import { AppShell } from "@/components/app-shell";
import { TemplateEditor } from "../template-editor";

export default function NewTemplatePage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Neue Vorlage anlegen</h1>
        <TemplateEditor mode="create" />
      </div>
    </AppShell>
  );
}
