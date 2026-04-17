import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { BereichForm } from "../bereich-form";
import { createBereich } from "../actions";

export const dynamic = "force-dynamic";

export default function NewBereichPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Neu anlegen"
        title="Neuer Bereich"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Bereiche", href: "/bereiche" },
          { label: "Neu" },
        ]}
      />
      <BereichForm action={createBereich} submitLabel="Anlegen" />
    </AppShell>
  );
}
