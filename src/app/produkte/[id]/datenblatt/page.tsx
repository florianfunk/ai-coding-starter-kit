import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DatenblattPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string; style?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const layout = sp.layout === "eisenkeil" ? "eisenkeil" : "lichtengros";
  const style = sp.style === "klassisch" ? "klassisch" : "modern";
  const qs = `?layout=${layout}&style=${style}`;
  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Datenblatt-Vorschau</h1>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground mr-1">Marke</span>
            <Button asChild variant={layout === "lichtengros" ? "default" : "outline"} size="sm">
              <Link href={`?layout=lichtengros&style=${style}`}>Lichtengros</Link>
            </Button>
            <Button asChild variant={layout === "eisenkeil" ? "default" : "outline"} size="sm">
              <Link href={`?layout=eisenkeil&style=${style}`}>Eisenkeil</Link>
            </Button>
            <span className="text-xs text-muted-foreground ml-3 mr-1">Stil</span>
            <Button asChild variant={style === "modern" ? "default" : "outline"} size="sm">
              <Link href={`?layout=${layout}&style=modern`}>Modern</Link>
            </Button>
            <Button asChild variant={style === "klassisch" ? "default" : "outline"} size="sm">
              <Link href={`?layout=${layout}&style=klassisch`}>Klassisch</Link>
            </Button>
            <Button asChild className="ml-2">
              <a href={`/produkte/${id}/datenblatt/raw${qs}&download=1`}>Download PDF</a>
            </Button>
          </div>
        </div>
        <iframe
          src={`/produkte/${id}/datenblatt/raw${qs}&_=${Date.now()}`}
          className="w-full h-[80vh] border rounded"
        />
      </div>
    </AppShell>
  );
}
