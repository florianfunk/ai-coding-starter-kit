"use client";

/**
 * Einheitliche Bild-Bearbeitungs-Komponente für Produktbilder
 * (Hauptbild + Datenblatt-Bilder). Bietet die gleiche Action-Bar wie
 * Kategorien/Bereiche: Upload, Mediathek, Zoom, Smart-/Manual-Crop, KI-Bild,
 * Download, KI-Enhance (Upscale/Hintergrund), Entfernen, „Original wiederherstellen".
 *
 * Im Bearbeiten-Modus (`produktId` + `column` gesetzt) werden Crop/KI-Bild/
 * Mediathek-Replace direkt in die DB-Spalte persistiert. Beim Anlegen ohne
 * Produkt-ID nur Form-State — der Pfad wird beim Submit über das Hidden-Input
 * mitgeschickt.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Upload,
  X,
  Crop,
  Maximize2,
  Download,
  RotateCcw,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { AIImageButton } from "@/components/ai-image-button";
import { EnhanceBildButton } from "@/components/enhance-bild-button";
import { ImageZoomModal } from "@/components/image-zoom-modal";
import { CropSuggestionModal } from "@/components/crop-suggestion-modal";
import { MediathekPicker } from "@/components/mediathek-picker";
import type { ManualCropResult } from "@/components/manual-crop-editor";
import { bildProxyUrl } from "@/lib/bild-url";
import {
  uploadSlotBild,
  replaceProduktBildPath,
  cropProduktBild,
  cropProduktBildManuell,
  generateProduktBildKi,
  getSlotBildSignedUrl,
} from "./datenblatt-actions";

type BildState = {
  path: string | null;
  previewUrl: string | null;
  originalPath?: string | null;
  originalPreviewUrl?: string | null;
};

type Props = {
  /** Form-Field-Name fürs Hidden-Input (z. B. "hauptbild_path") */
  name: string;
  /** Sichtbares Label */
  label: string;
  /** DB-Spalte für direktes Persistieren (nur Edit-Modus) */
  column?:
    | "hauptbild_path"
    | "bild_detail_1_path"
    | "bild_detail_2_path"
    | "bild_zeichnung_1_path"
    | "bild_zeichnung_2_path"
    | "bild_zeichnung_3_path"
    | "bild_energielabel_path";
  /** Produkt-ID — undefined beim Anlegen */
  produktId?: string;
  defaultPath: string | null;
  defaultUrl: string | null;
  /** Größe der Bild-Vorschau. "lg" für Hauptbild, "md" für Datenblatt-Bilder (default md) */
  size?: "md" | "lg";
  /** Wird beim Form-State-Update aufgerufen (z. B. um die Section als "dirty" zu markieren). */
  onDirty?: () => void;
};

export function ProduktBildSlot({
  name,
  label,
  column,
  produktId,
  defaultPath,
  defaultUrl,
  size = "md",
  onDirty,
}: Props) {
  const [bild, setBild] = useState<BildState>({
    path: defaultPath,
    previewUrl: defaultUrl,
  });
  const [uploading, startUpload] = useTransition();

  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSuggestionPath, setCropSuggestionPath] = useState<string | null>(null);
  const [cropSuggestionUrl, setCropSuggestionUrl] = useState<string | null>(null);
  const [cropLoading, setCropLoading] = useState(false);

  const [aiPreview, setAiPreview] = useState<{ path: string | null; url: string | null }>({
    path: null,
    url: null,
  });
  const [aiLoading, setAiLoading] = useState(false);

  const canPersist = !!produktId && !!column;
  // Bild-Vorschau quadratisch, mind. so breit wie die Action-Bar darunter
  // (7 Icons × 28px + 6 × 4px Gap ≈ 220px).
  const previewSize =
    size === "lg" ? "h-60 w-60" : "h-56 w-56";

  function markDirty() {
    onDirty?.();
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId ?? "neu");
    startUpload(async () => {
      const r = await uploadSlotBild(fd);
      if (r.error || !r.path) {
        toast.error(r.error ?? "Upload fehlgeschlagen");
        return;
      }
      setBild({ path: r.path, previewUrl: URL.createObjectURL(file) });
      markDirty();
    });
  }

  async function handleMediathekSelect(path: string) {
    const prev = bild;
    const { url } = await getSlotBildSignedUrl(path);

    if (canPersist) {
      const r = await replaceProduktBildPath(produktId!, column!, path);
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
    markDirty();
    toast.success(`${label}: Bild aus Mediathek übernommen`);
  }

  async function handleEnhanced(newPath: string) {
    if (canPersist) {
      const r = await replaceProduktBildPath(produktId!, column!, newPath);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }
    const { url } = await getSlotBildSignedUrl(newPath);
    setBild((prev) => ({ ...prev, path: newPath, previewUrl: url ?? prev.previewUrl }));
    markDirty();
  }

  function clearBild() {
    setBild({ path: null, previewUrl: null });
    markDirty();
  }

  // Smart-Crop -----------------------------------------------------------
  async function generateCropSuggestion() {
    if (!bild.path) return;
    setCropLoading(true);
    try {
      const r = await cropProduktBild({ path: bild.path });
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

    if (canPersist) {
      const r = await replaceProduktBildPath(produktId!, column!, newPath);
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
    markDirty();
    toast.success(`${label}: Zuschnitt übernommen`);
    closeCropModal();
  }

  async function acceptManualCrop(result: ManualCropResult) {
    if (!bild.path) return;
    const r = await cropProduktBildManuell({
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

    if (canPersist) {
      const dbResult = await replaceProduktBildPath(produktId!, column!, newPath);
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
    markDirty();
    toast.success(`${label}: Manueller Zuschnitt übernommen`);
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

    if (canPersist) {
      const r = await replaceProduktBildPath(produktId!, column!, restored);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBild({
      path: restored,
      previewUrl: restoredUrl,
      originalPath: null,
      originalPreviewUrl: null,
    });
    markDirty();
    toast.success(`${label}: Original wiederhergestellt`);
  }

  // KI-Bild --------------------------------------------------------------
  async function handleAiImageGenerate(userPrompt: string) {
    setAiLoading(true);
    try {
      const r = await generateProduktBildKi({
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

    if (canPersist) {
      const r = await replaceProduktBildPath(produktId!, column!, aiPreview.path);
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
    markDirty();
    toast.success(`${label}: KI-Bild übernommen`);
  }

  function handleAiImageClose() {
    setAiPreview({ path: null, url: null });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <input type="hidden" name={name} value={bild.path ?? ""} />

      <div className={`relative flex ${previewSize} shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40`}>
        {bild.previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bild.previewUrl}
            alt={label}
            className="h-full w-full object-contain cursor-zoom-in"
            onClick={() => setZoomUrl(bild.previewUrl)}
          />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
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
          preferAspect="square"
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
            title="Auf 1:1 zuschneiden"
            aria-label="Zuschneiden"
          >
            <Crop className="h-3.5 w-3.5" />
          </SlotIconButton>
        )}

        <AIImageButton
          triggerSize="icon"
          aspect="square"
          slotLabel={label}
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
            deleteOriginal={canPersist}
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
          className="flex w-full max-w-[260px] items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
          title="Zugeschnittenes/KI-Bild verwerfen — Original wiederherstellen"
        >
          <RotateCcw className="h-3 w-3" />
          Original wiederherstellen
        </button>
      )}

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
        aspect="square"
        slotLabel={label}
        onGenerate={() => {
          void generateCropSuggestion();
        }}
        onAccept={acceptCrop}
        onAcceptManual={acceptManualCrop}
      />
    </div>
  );
}

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
