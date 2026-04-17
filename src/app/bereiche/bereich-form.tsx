"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";
import { ColorPalettePicker } from "@/components/color-palette-picker";
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
  const [uploading, startUpload] = useTransition();

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
                defaultValue={defaultValues?.name ?? ""}
                className="text-xl font-bold border-0 border-b-2 border-b-accent rounded-none px-0 focus-visible:ring-0 focus-visible:border-b-primary"
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
                className="text-xl font-semibold text-right border-0 border-b-2 border-b-accent rounded-none px-0 focus-visible:ring-0 focus-visible:border-b-primary"
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
              <div className="aspect-[4/3] w-full rounded-lg border-2 border-dashed bg-muted/50 overflow-hidden flex items-center justify-center">
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
                <Label htmlFor="beschreibung">Beschreibung</Label>
                <Textarea
                  id="beschreibung"
                  name="beschreibung"
                  rows={4}
                  defaultValue={defaultValues?.beschreibung ?? ""}
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

      <div className="flex gap-2 justify-end">
        <Button asChild variant="outline" type="button">
          <a href="/bereiche">Abbrechen</a>
        </Button>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? "Speichere…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
