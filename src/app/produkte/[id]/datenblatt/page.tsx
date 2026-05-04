import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Languages, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TRANSLATABLE_FIELDS } from "@/lib/i18n/translatable-fields";

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

  // PROJ-46 Bug-4: Wenn Sprache=IT gewählt und Produkt hat noch keine
  // (oder nur teilweise) IT-Übersetzungen → Banner mit klarem Hinweis.
  let translationStatus: {
    untranslated: { de: string; label: string }[];
    translated: number;
    total: number;
  } | null = null;
  if (lang === "it") {
    const supabase = await createClient();
    const itCols = TRANSLATABLE_FIELDS.flatMap((f) => [f.de, f.it]);
    const { data: produkt } = await supabase
      .from("produkte")
      .select(itCols.join(", "))
      .eq("id", id)
      .single<Record<string, unknown>>();
    if (produkt) {
      const untranslated = TRANSLATABLE_FIELDS.filter((f) => {
        const de = String(produkt[f.de] ?? "").trim();
        if (!de) return false; // DE-leer → kein Übersetzungs-Bedarf
        const it = String(produkt[f.it] ?? "").trim();
        return it.length === 0;
      }).map((f) => ({ de: f.de, label: f.label }));
      const total = TRANSLATABLE_FIELDS.filter(
        (f) => String(produkt[f.de] ?? "").trim().length > 0,
      ).length;
      translationStatus = {
        untranslated,
        translated: total - untranslated.length,
        total,
      };
    }
  }

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

        {translationStatus && translationStatus.untranslated.length > 0 && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5" />
              {translationStatus.translated === 0
                ? "Dieses Produkt ist noch nicht übersetzt"
                : `Teil-Übersetzung — ${translationStatus.translated} / ${translationStatus.total} Felder auf Italienisch`}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {translationStatus.translated === 0 ? (
                <>Im PDF erscheinen die deutschen Texte (mit italienischen Beschriftungen).</>
              ) : (
                <>
                  Folgende Felder werden im PDF aus Deutsch gerendert:{" "}
                  {translationStatus.untranslated.map((f) => f.label).join(", ")}
                  .
                </>
              )}{" "}
              Übersetzen kannst du im Produkt-Formular in der Sektion{" "}
              <Link
                href={`/produkte/${id}#section-italienisch`}
                className="font-medium underline underline-offset-2"
              >
                🇮🇹 Italienisch
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

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
