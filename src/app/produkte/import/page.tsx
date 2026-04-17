import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PreisImportWizard } from "./preis-import-wizard";

export default function PreisImportPage() {
  return (
    <AppShell>
      <PageHeader
        title="Preis-Import"
        subtitle="CSV-Datei mit Preisdaten importieren"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Produkte", href: "/produkte" },
          { label: "Preis-Import" },
        ]}
      />
      <PreisImportWizard />
    </AppShell>
  );
}
