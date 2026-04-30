"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";
import { ColorPalettePicker } from "@/components/color-palette-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AITeaserButton } from "@/components/ai-teaser-button";
import { htmlToPlainText, isHtmlContent } from "@/lib/rich-text/sanitize";
import { uploadBereichBild, type BereichFormState } from "./actions";

const initial: BereichFormState = { error: null };

type Props = {
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

export function BereichForm({ defaultValues, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [bildPath, setBildPath] = useState(defaultValues?.bild_path ?? null);
  const [bildPreview, setBildPreview] = useState(defaultValues?.bild_url ?? null);
  const [farbe, setFarbe] = useState(defaultValues?.farbe ?? "");
  const [name, setName] = useState(defaultValues?.name ?? "");
  const editorRef = useRef<Editor | null>(null);
  const beschreibungContextRef = useRef<string | null>(defaultValues?.beschreibung ?? null);
  const [uploading, startUpload] = useTransition();

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
      if (res.error) toast.error(res.error);
      else {
        setBildPath(res.path);
        setBildPreview(URL.createObjectURL(file));
        toast.success("Bild hochgeladen");
      }
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bild_path" value={bildPath ?? ""} />

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

          {/* Row: Bild + Beschreibung + Seitenangaben */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            <div className="space-y-2">
              <Label>Bild</Label>
              <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-border bg-muted/40">
                {bildPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bildPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
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

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <a href="/bereiche">Abbrechen</a>
        </Button>
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Speichere…" : submitLabel}
        </Button>
      </div>
    </form>
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
