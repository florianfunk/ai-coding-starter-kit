import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DatenblattPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string; lang?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const layout = sp.layout === "eisenkeil" ? "eisenkeil" : "lichtengros";
  const lang = sp.lang === "it" ? "it" : "de";
  // Stil ist immer "modern" — die klassische Variante wurde entfernt.
  const qs = `?layout=${layout}&style=modern&lang=${lang}`;
  const downloadName = lang === "it" ? "Datenblatt-IT" : "Datenblatt";
  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Datenblatt-Vorschau</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Marke</span>
            <Button asChild variant={layout === "lichtengros" ? "default" : "outline"} size="sm">
              <Link href={`?layout=lichtengros&lang=${lang}`}>Lichtengros</Link>
            </Button>
            <Button asChild variant={layout === "eisenkeil" ? "default" : "outline"} size="sm">
              <Link href={`?layout=eisenkeil&lang=${lang}`}>Eisenkeil</Link>
            </Button>
            <span className="text-xs text-muted-foreground ml-3 mr-1">Sprache</span>
            <Button asChild variant={lang === "de" ? "default" : "outline"} size="sm">
              <Link href={`?layout=${layout}&lang=de`}>Deutsch</Link>
            </Button>
            <Button asChild variant={lang === "it" ? "default" : "outline"} size="sm">
              <Link href={`?layout=${layout}&lang=it`}>Italienisch</Link>
            </Button>
            <Button asChild className="ml-2">
              <a href={`/produkte/${id}/datenblatt/raw${qs}&download=1`} download={`${downloadName}.pdf`}>
                Download PDF
              </a>
            </Button>
          </div>
        </div>
        {/* Server Component — Date.now() läuft serverseitig pro Request,
            kein React-Render-Purity-Problem. Cache-Buster verhindert, dass
            das iframe ein altes PDF anzeigt nach Datenblatt-Edits. */}
        <iframe
          src={
            // eslint-disable-next-line react-hooks/purity -- Server Component
            `/produkte/${id}/datenblatt/raw${qs}&_=${Date.now()}`
          }
          className="w-full h-[80vh] border rounded"
        />
      </div>
    </AppShell>
  );
}
