import { AppShell } from "@/components/app-shell";
import { BereichForm } from "../bereich-form";
import { createBereich } from "../actions";

export default function NewBereichPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Neuer Bereich</h1>
        <BereichForm action={createBereich} submitLabel="Anlegen" />
      </div>
    </AppShell>
  );
}
