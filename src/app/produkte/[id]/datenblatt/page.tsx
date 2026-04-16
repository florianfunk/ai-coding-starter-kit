import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DatenblattPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const layout = sp.layout ?? "lichtengros";
  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Datenblatt-Vorschau</h1>
          <div className="flex gap-2">
            <Button asChild variant={layout === "lichtengros" ? "default" : "outline"} size="sm">
              <Link href={`?layout=lichtengros`}>Lichtengros</Link>
            </Button>
            <Button asChild variant={layout === "eisenkeil" ? "default" : "outline"} size="sm">
              <Link href={`?layout=eisenkeil`}>Eisenkeil</Link>
            </Button>
            <Button asChild>
              <a href={`/produkte/${id}/datenblatt/raw?layout=${layout}&download=1`}>Download PDF</a>
            </Button>
          </div>
        </div>
        <iframe
          src={`/produkte/${id}/datenblatt/raw?layout=${layout}`}
          className="w-full h-[80vh] border rounded"
        />
      </div>
    </AppShell>
  );
}
