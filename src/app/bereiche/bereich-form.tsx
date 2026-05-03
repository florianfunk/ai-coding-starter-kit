"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Image as ImageIcon,
  Upload,
  X,
  Crop,
  Maximize2,
  Download,
  RotateCcw,
} from "lucide-react";
import { ColorPalettePicker } from "@/components/color-palette-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AITeaserButton } from "@/components/ai-teaser-button";
import { AIImageButton } from "@/components/ai-image-button";
import { EnhanceBildButton } from "@/components/enhance-bild-button";
import { ImageZoomModal } from "@/components/image-zoom-modal";
import { CropSuggestionModal } from "@/components/crop-suggestion-modal";
import { MediathekPicker } from "@/components/mediathek-picker";
import type { ManualCropResult } from "@/components/manual-crop-editor";
import { bildProxyUrl } from "@/lib/bild-url";
import { htmlToPlainText, isHtmlContent } from "@/lib/rich-text/sanitize";
import {
  uploadBereichBild,
  replaceBereichBildPath,
  cropBereichBild,
  cropBereichBildManuell,
  generateBereichBildKi,
  type BereichFormState,
} from "./actions";
import { getSlotBildSignedUrl } from "../produkte/datenblatt-actions";

const initial: BereichFormState = { error: null };

type BildState = {
  path: string | null;
  previewUrl: string | null;
  /** Vorheriger Pfad — für „Original wiederherstellen" nach Crop. */
  originalPath?: string | null;
  originalPreviewUrl?: string | null;
};

type Props = {
  /** ID des Bereichs beim Bearbeiten — bei "neu" undefined. Wird fürs sofortige
   *  Persistieren von KI-Bildern/Crops benötigt. */
  bereichId?: string;
  defaultValues?: {
    name?: string;
    beschreibung?: string | null;
    sortierung?: number;
    seitenzahl?: number | null;
    startseite?: number | null;
    endseite?: number | null;
    farbe?: string | null;
    bild_path?: string | null;
    bild_url?: string | null;
  };
  action: (prev: BereichFormState, formData: FormData) => Promise<BereichFormState>;
  submitLabel: string;
};

export function BereichForm({ bereichId, defaultValues, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [bild, setBild] = useState<BildState>({
    path: defaultValues?.bild_path ?? null,
    previewUrl: defaultValues?.bild_url ?? null,
  });
  const [farbe, setFarbe] = useState(defaultValues?.farbe ?? "");
  const [name, setName] = useState(defaultValues?.name ?? "");
  const editorRef = useRef<Editor | null>(null);
  const beschreibungContextRef = useRef<string | null>(defaultValues?.beschreibung ?? null);
  const [uploading, startUpload] = useTransition();

  // Modals
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSuggestionPath, setCropSuggestionPath] = useState<string | null>(null);
  const [cropSuggestionUrl, setCropSuggestionUrl] = useState<string | null>(null);
  const [cropLoading, setCropLoading] = useState(false);

  // KI-Bild
  const [aiPreview, setAiPreview] = useState<{ path: string | null; url: string | null }>({
    path: null,
    url: null,
  });
  const [aiLoading, setAiLoading] = useState(false);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  function handleTeaserAccept(text: string) {
    const html = `<p>${escapeHtml(text)}</p>`;
    editorRef.current?.commands.setContent(html, { emitUpdate: true });
    beschreibungContextRef.current = text;
    toast.success("Teaser übernommen");
  }

  const teaserContext = (() => {
    const v = beschreibungContextRef.current;
    if (!v) return null;
    return isHtmlContent(v) ? htmlToPlainText(v) : v;
  })();

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function handleFile(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const res = await uploadBereichBild(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (!res.path) return;
      setBild({ path: res.path, previewUrl: URL.createObjectURL(file) });
      toast.success("Bild hochgeladen");
    });
  }

  async function handleMediathekSelect(path: string) {
    const prev = bild;
    const { url } = await getSlotBildSignedUrl(path);

    if (bereichId) {
      const r = await replaceBereichBildPath(bereichId, path);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBild({
      path,
      previewUrl: url,
      originalPath: prev.path,
      originalPreviewUrl: prev.previewUrl,
    });
    toast.success("Bild aus Mediathek übernommen");
  }

  async function handleEnhanced(newPath: string) {
    if (bereichId) {
      const r = await replaceBereichBildPath(bereichId, newPath);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }
    const { url } = await getSlotBildSignedUrl(newPath);
    setBild((prev) => ({ ...prev, path: newPath, previewUrl: url ?? prev.previewUrl }));
  }

  function clearBild() {
    setBild({ path: null, previewUrl: null });
  }

  // Smart-Crop ------------------------------------------------------------
  async function generateCropSuggestion() {
    if (!bild.path) return;
    setCropLoading(true);
    try {
      const r = await cropBereichBild({ path: bild.path });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCropSuggestionPath(r.path);
      const { url } = await getSlotBildSignedUrl(r.path);
      setCropSuggestionUrl(url);
    } finally {
      setCropLoading(false);
    }
  }

  async function acceptCrop() {
    if (!cropSuggestionPath || !cropSuggestionUrl) return;
    const newPath = cropSuggestionPath;
    const newUrl = cropSuggestionUrl;
    const prev = bild;

    if (bereichId) {
      const r = await replaceBereichBildPath(bereichId, newPath);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBild({
      path: newPath,
      previewUrl: newUrl,
      originalPath: prev.path,
      originalPreviewUrl: prev.previewUrl,
    });
    toast.success("Zuschnitt übernommen");
    closeCropModal();
  }

  async function acceptManualCrop(result: ManualCropResult) {
    if (!bild.path) return;
    const r = await cropBereichBildManuell({
      path: bild.path,
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const newPath = r.path;
    const { url: newUrl } = await getSlotBildSignedUrl(newPath);
    if (!newUrl) {
      toast.error("Vorschau-URL konnte nicht erzeugt werden.");
      return;
    }

    if (bereichId) {
      const dbResult = await replaceBereichBildPath(bereichId, newPath);
      if (dbResult.error) {
        toast.error(dbResult.error);
        return;
      }
    }

    const prev = bild;
    setBild({
      path: newPath,
      previewUrl: newUrl,
      originalPath: prev.originalPath ?? prev.path,
      originalPreviewUrl: prev.originalPreviewUrl ?? prev.previewUrl,
    });
    toast.success("Manueller Zuschnitt übernommen");
    closeCropModal();
  }

  function closeCropModal() {
    setCropOpen(false);
    setCropSuggestionPath(null);
    setCropSuggestionUrl(null);
    setCropLoading(false);
  }

  async function restoreOriginal() {
    if (!bild.originalPath) return;
    const restored = bild.originalPath;
    const restoredUrl = bild.originalPreviewUrl ?? null;

    if (bereichId) {
      const r = await replaceBereichBildPath(bereichId, restored);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBild({ path: restored, previewUrl: restoredUrl, originalPath: null, originalPreviewUrl: null });
    toast.success("Original wiederhergestellt");
  }

  // KI-Bild ---------------------------------------------------------------
  async function handleAiImageGenerate(userPrompt: string) {
    setAiLoading(true);
    try {
      const r = await generateBereichBildKi({
        userPrompt,
        referencePath: bild.path ?? null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const { url } = await getSlotBildSignedUrl(r.path);
      setAiPreview({ path: r.path, url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler bei KI-Generierung");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAiImageAccept() {
    if (!aiPreview.path || !aiPreview.url) return;
    const prev = bild;

    if (bereichId) {
      const r = await replaceBereichBildPath(bereichId, aiPreview.path);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBild({
      path: aiPreview.path,
      previewUrl: aiPreview.url,
      originalPath: prev.path,
      originalPreviewUrl: prev.previewUrl,
    });
    setAiPreview({ path: null, url: null });
    toast.success("KI-Bild übernommen");
  }

  function handleAiImageClose() {
    setAiPreview({ path: null, url: null });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bild_path" value={bild.path ?? ""} />

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Row: Name + Sortierung */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortierung">Sortierung</Label>
              <Input
                id="sortierung"
                name="sortierung"
                type="number"
                defaultValue={String(defaultValues?.sortierung ?? 0)}
                className="text-right"
              />
            </div>
          </div>

          {/* Row: Farbe picker */}
          <div className="space-y-2">
            <Label>Farbe (für Katalog-Index)</Label>
            <input type="hidden" name="farbe" value={farbe} />
            <ColorPalettePicker value={farbe || null} onChange={(v) => setFarbe(v ?? "")} />
            {state.fieldErrors?.farbe && <p className="text-sm text-destructive">{state.fieldErrors.farbe}</p>}
          </div>

          {/* Row: Bild (DIN A4) + Beschreibung + Seitenangaben */}
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            <div className="space-y-2">
              <Label>Bild (DIN A4)</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Hochkant 210 × 297 mm. Wird so im Katalog gedruckt.
              </p>
              <div className="relative aspect-[210/297] w-full overflow-hidden rounded-[14px] border border-dashed border-border bg-muted/40">
                {bild.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={bild.previewUrl}
                    alt=""
                    className="h-full w-full object-cover cursor-zoom-in"
                    onClick={() => setZoomUrl(bild.previewUrl)}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Action-Bar */}
              <div className="flex flex-wrap items-center gap-1">
                <SlotIconButton
                  asLabel
                  title={uploading ? "Lädt…" : bild.path ? "Bild ersetzen" : "Datei auswählen"}
                  aria-label={uploading ? "Lädt…" : bild.path ? "Bild ersetzen" : "Datei auswählen"}
                  disabled={uploading}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </SlotIconButton>

                <MediathekPicker
                  triggerSize="icon"
                  preferAspect="tall"
                  onSelect={(path) => void handleMediathekSelect(path)}
                />

                {bild.previewUrl && (
                  <SlotIconButton
                    onClick={() => setZoomUrl(bild.previewUrl)}
                    title="Bild groß ansehen"
                    aria-label="Bild groß ansehen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </SlotIconButton>
                )}

                {bild.path && (
                  <SlotIconButton
                    onClick={() => {
                      setCropOpen(true);
                      void generateCropSuggestion();
                    }}
                    title="Auf DIN A4 zuschneiden"
                    aria-label="Zuschneiden"
                  >
                    <Crop className="h-3.5 w-3.5" />
                  </SlotIconButton>
                )}

                <AIImageButton
                  triggerSize="icon"
                  aspect="a4"
                  slotLabel="Bereich-Bild (DIN A4)"
                  onGenerate={handleAiImageGenerate}
                  previewUrl={aiPreview.url}
                  loading={aiLoading}
                  onAccept={() => {
                    void handleAiImageAccept();
                  }}
                  onClose={handleAiImageClose}
                  hasReferenceImage={!!bild.previewUrl}
                  referenceImageUrl={bild.previewUrl}
                />

                {bild.path && (
                  <SlotIconButton
                    asLink
                    href={bildProxyUrl("produktbilder", bild.path) ?? "#"}
                    download={bild.path.split("/").pop() ?? "bild"}
                    title="Bild herunterladen"
                    aria-label="Bild herunterladen"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </SlotIconButton>
                )}

                {bild.path && (
                  <EnhanceBildButton
                    bucket="produktbilder"
                    path={bild.path}
                    deleteOriginal={!!bereichId}
                    onReplaced={(newPath) => handleEnhanced(newPath)}
                    size="icon"
                    className="border shadow-sm"
                  />
                )}

                {bild.previewUrl && (
                  <SlotIconButton
                    onClick={clearBild}
                    title="Bild entfernen"
                    aria-label="Bild entfernen"
                    variant="destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </SlotIconButton>
                )}
              </div>

              {bild.originalPath && (
                <button
                  type="button"
                  onClick={restoreOriginal}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
                  title="Zugeschnittenes/KI-Bild verwerfen — Original wiederherstellen"
                >
                  <RotateCcw className="h-3 w-3" />
                  Original wiederherstellen
                </button>
              )}

              {uploading && <p className="text-xs text-muted-foreground">Lade hoch…</p>}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="beschreibung">Beschreibung</Label>
                  <AITeaserButton
                    entityType="bereich"
                    entityName={name}
                    entityContext={teaserContext}
                    onAccept={handleTeaserAccept}
                  />
                </div>
                <RichTextEditor
                  name="beschreibung"
                  defaultValue={defaultValues?.beschreibung ?? ""}
                  onEditorReady={handleEditorReady}
                  minHeight={120}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="seitenzahl">Seitenzahl</Label>
                  <Input id="seitenzahl" name="seitenzahl" type="number" defaultValue={defaultValues?.seitenzahl?.toString() ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startseite">Startseite</Label>
                  <Input id="startseite" name="startseite" type="number" defaultValue={defaultValues?.startseite?.toString() ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endseite">Endseite</Label>
                  <Input id="endseite" name="endseite" type="number" defaultValue={defaultValues?.endseite?.toString() ?? ""} />
                </div>
              </div>
            </div>
          </div>

          {state.error && (
            <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
          )}
        </CardContent>
      </Card>

      <ImageZoomModal
        open={zoomUrl !== null}
        onOpenChange={(o) => !o && setZoomUrl(null)}
        src={zoomUrl ?? ""}
      />

      <CropSuggestionModal
        open={cropOpen}
        onOpenChange={(o) => !o && closeCropModal()}
        originalUrl={bild.previewUrl ?? ""}
        suggestionUrl={cropSuggestionUrl}
        loading={cropLoading}
        aspect="a4"
        slotLabel="Bereich-Bild (DIN A4)"
        onGenerate={() => {
          void generateCropSuggestion();
        }}
        onAccept={acceptCrop}
        onAcceptManual={acceptManualCrop}
      />

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <a href={bereichId ? `/bereiche/${bereichId}` : "/bereiche"}>Abbrechen</a>
        </Button>
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Speichere…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Einheitlicher Icon-Button (analog zu `BildSlotCard` in der Kategorie-Form).
 */
type SlotIconButtonProps = {
  children: React.ReactNode;
  title: string;
  "aria-label": string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
} & (
  | { asLink: true; href: string; download?: string; asLabel?: never }
  | { asLabel: true; asLink?: never; href?: never; download?: never }
  | { asLink?: false; asLabel?: false; href?: never; download?: never }
);

function SlotIconButton(props: SlotIconButtonProps) {
  const { children, title, variant = "default", disabled } = props;
  const ariaLabel = props["aria-label"];
  const baseClass = `inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/90 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    variant === "destructive"
      ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;

  if ("asLink" in props && props.asLink) {
    return (
      <a
        href={props.href}
        download={props.download}
        title={title}
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={`${baseClass} cursor-pointer`}
      >
        {children}
      </a>
    );
  }

  if ("asLabel" in props && props.asLabel) {
    return (
      <label
        title={title}
        aria-label={ariaLabel}
        className={`${baseClass} cursor-pointer ${disabled ? "pointer-events-none opacity-40" : ""}`}
      >
        {children}
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={baseClass}
    >
      {children}
    </button>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
