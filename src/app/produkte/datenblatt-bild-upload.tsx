"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnhanceBildButton } from "@/components/enhance-bild-button";
import { uploadSlotBild, getSlotBildSignedUrl } from "./datenblatt-actions";

type Props = {
  name: string;
  label: string;
  produktId: string | undefined;
  defaultPath: string | null;
  defaultUrl: string | null;
};

/**
 * PROJ-36: Generische Upload-Komponente für Datenblatt-Bilder
 * (Detail-Bilder, Zeichnungen, Energielabel).
 *
 * Rendert Thumbnail, File-Input, Entfernen-Button und ein Hidden-Input
 * mit dem aktuellen Storage-Pfad, der beim Submit des Produkt-Formulars
 * mitgeschickt wird. Wiederverwendung der bestehenden `uploadSlotBild`
 * Server Action (Pfad: produkte/{id}/datenblatt/...).
 */
export function DatenblattBildUpload({ name, label, produktId, defaultPath, defaultUrl }: Props) {
  const [path, setPath] = useState<string | null>(defaultPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultUrl);
  const [uploading, startUpload] = useTransition();

  function onFileChange(file: File | null) {
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
      setPath(r.path);
      setPreviewUrl(URL.createObjectURL(file));
    });
  }

  function onRemove() {
    setPath(null);
    setPreviewUrl(null);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <input type="hidden" name={name} value={path ?? ""} />
      <div className="flex items-start gap-3">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-border bg-muted/40">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Input
            id={name}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            {uploading && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Upload className="h-3 w-3 animate-pulse" /> Lade hoch...
              </span>
            )}
            {path && !uploading && (
              <>
                <EnhanceBildButton
                  bucket="produktbilder"
                  path={path}
                  onReplaced={async (newPath) => {
                    const r = await getSlotBildSignedUrl(newPath);
                    setPath(newPath);
                    setPreviewUrl(r.url ?? null);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" /> Entfernen
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
