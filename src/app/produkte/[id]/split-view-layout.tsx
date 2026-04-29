"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SplitViewLayoutProps {
  produktId: string;
  children: React.ReactNode;
}

/**
 * Wraps product detail content and adds a toggleable datenblatt preview panel.
 *
 * - Desktop (>=1280px): side-by-side — form 60%, preview 40% with sticky scroll
 * - Mobile/Tablet (<1280px): collapsible panel below the content
 */
export function SplitViewLayout({ produktId, children }: SplitViewLayoutProps) {
  const [showPreview, setShowPreview] = useState(false);
  const toggle = useCallback(() => setShowPreview((v) => !v), []);

  return (
    <>
      {/* Floating toggle button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          size="lg"
          variant={showPreview ? "default" : "outline"}
          onClick={toggle}
          className="shadow-lg rounded-full h-12 w-12 p-0"
          title={showPreview ? "Vorschau ausblenden" : "Vorschau einblenden"}
          aria-label={showPreview ? "Vorschau ausblenden" : "Vorschau einblenden"}
        >
          {showPreview ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Desktop layout */}
      <div
        className={
          showPreview
            ? "xl:flex xl:gap-6 xl:items-start"
            : ""
        }
      >
        {/* Main content */}
        <div
          className={
            showPreview
              ? "xl:w-[60%] xl:min-w-0 space-y-5"
              : "space-y-5"
          }
        >
          {/* Inject the toggle button into the header area */}
          {children}
        </div>

        {/* Desktop preview panel (>=1280px, sticky) */}
        {showPreview && (
          <div className="hidden xl:block xl:w-[40%] xl:min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
            <PreviewCard produktId={produktId} />
          </div>
        )}
      </div>

      {/* Mobile/Tablet collapsible preview (<1280px) */}
      <div className="xl:hidden mt-5">
        <Collapsible open={showPreview} onOpenChange={setShowPreview}>
          <Card className="border-l-4 border-l-primary">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Datenblatt-Vorschau
                  </CardTitle>
                  {showPreview ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <PreviewInner produktId={produktId} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </>
  );
}

/* ─── Shared Preview UI ─── */

function PreviewCard({ produktId }: { produktId: string }) {
  return (
    <Card className="border-l-4 border-l-primary flex flex-col h-[calc(100vh-2rem)]">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base">Datenblatt-Vorschau</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 pt-0 overflow-hidden">
        <PreviewInner produktId={produktId} />
      </CardContent>
    </Card>
  );
}

function PreviewInner({ produktId }: { produktId: string }) {
  const [layout, setLayout] = useState<"lichtengros" | "eisenkeil">(
    "lichtengros"
  );
  const [style, setStyle] = useState<"klassisch" | "modern">("modern");
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const iframeSrc = `/produkte/${produktId}/datenblatt/raw?layout=${layout}&style=${style}`;

  const switchLayout = useCallback(
    (l: "lichtengros" | "eisenkeil") => {
      if (l !== layout) {
        setLayout(l);
        setLoading(true);
        setIframeKey((k) => k + 1);
      }
    },
    [layout]
  );

  const switchStyle = useCallback(
    (st: "klassisch" | "modern") => {
      if (st !== style) {
        setStyle(st);
        setLoading(true);
        setIframeKey((k) => k + 1);
      }
    },
    [style]
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Controls */}
      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        <Button
          size="sm"
          variant={layout === "lichtengros" ? "default" : "outline"}
          onClick={() => switchLayout("lichtengros")}
          className="h-7 px-2.5 text-xs"
        >
          Lichtengros
        </Button>
        <Button
          size="sm"
          variant={layout === "eisenkeil" ? "default" : "outline"}
          onClick={() => switchLayout("eisenkeil")}
          className="h-7 px-2.5 text-xs"
        >
          Eisenkeil
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          size="sm"
          variant={style === "modern" ? "default" : "outline"}
          onClick={() => switchStyle("modern")}
          className="h-7 px-2.5 text-xs"
        >
          Modern
        </Button>
        <Button
          size="sm"
          variant={style === "klassisch" ? "default" : "outline"}
          onClick={() => switchStyle("klassisch")}
          className="h-7 px-2.5 text-xs"
        >
          Klassisch
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          title="Vorschau aktualisieren"
          aria-label="Vorschau aktualisieren"
          className="h-7 w-7 p-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          asChild
          title="In neuem Tab oeffnen"
          className="h-7 w-7 p-0"
        >
          <a
            href={`/produkte/${produktId}/datenblatt?layout=${layout}&style=${style}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      {/* Iframe */}
      <div className="relative flex-1 min-h-[500px] border rounded bg-muted/30">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Datenblatt wird geladen...</span>
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={iframeSrc}
          className="w-full h-full rounded"
          onLoad={() => setLoading(false)}
          title="Datenblatt-Vorschau"
        />
      </div>

      {/* Download */}
      <Button variant="outline" asChild className="w-full shrink-0">
        <a
          href={`/produkte/${produktId}/datenblatt/raw?layout=${layout}&style=${style}&download=1`}
        >
          <Download className="h-4 w-4 mr-2" />
          PDF herunterladen
        </a>
      </Button>
    </div>
  );
}
