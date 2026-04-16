import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BereichForm } from "../bereich-form";
import { createBereich } from "../actions";

export const dynamic = "force-dynamic";

export default function NewBereichPage() {
  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-primary hover:bg-primary/5">
        <Link href="/bereiche"><ChevronLeft className="h-4 w-4 mr-1" /> Alle Bereiche</Link>
      </Button>
      <PageHeader eyebrow="Neu anlegen" title="Neuer Bereich" />
      <BereichForm action={createBereich} submitLabel="Anlegen" />
    </AppShell>
  );
}
