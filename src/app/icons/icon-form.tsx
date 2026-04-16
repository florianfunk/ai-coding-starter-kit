"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";
import { uploadIconBild, type IconFormState } from "./actions";

const initial: IconFormState = { error: null };

type Props = {
  gruppen: string[];
  defaultValues?: {
    label?: string;
    gruppe?: string | null;
    sortierung?: number;
    symbol_path?: string | null;
    symbol_url?: string | null;
  };
  action: (prev: IconFormState, formData: FormData) => Promise<IconFormState>;
  submitLabel: string;
  redirectOnSuccess?: string;
};

export function IconForm({ gruppen, defaultValues, action, submitLabel, redirectOnSuccess }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initial);
  const [symbolPath, setSymbolPath] = useState(defaultValues?.symbol_path ?? null);
  const [symbolPreview, setSymbolPreview] = useState<string | null>(defaultValues?.symbol_url ?? null);
  const [gruppe, setGruppe] = useState(defaultValues?.gruppe ?? "");
  const [useCustomGruppe, setUseCustomGruppe] = useState(false);
  const [uploading, startUpload] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state !== initial && !pending) {
      toast.success("Gespeichert");
      if (redirectOnSuccess) router.push(redirectOnSuccess);
    }
  }, [state, pending, redirectOnSuccess, router]);

  function handleFile(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const r = await uploadIconBild(fd);
      if (r.error) toast.error(r.error);
      else {
        setSymbolPath(r.path);
        if (file.type !== "application/pdf") {
          setSymbolPreview(URL.createObjectURL(file));
        } else {
          setSymbolPreview(null);
        }
        toast.success("Bild hochgeladen");
      }
    });
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="symbol_path" value={symbolPath ?? ""} />

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Name *</Label>
              <Input id="label" name="label" required defaultValue={defaultValues?.label ?? ""} placeholder="z.B. 2700K" />
              {state.fieldErrors?.label && <p className="text-sm text-destructive">{state.fieldErrors.label}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gruppe">Gruppe</Label>
              {useCustomGruppe ? (
                <div className="flex gap-2">
                  <Input
                    id="gruppe-input"
                    value={gruppe}
                    onChange={(e) => setGruppe(e.target.value)}
                    placeholder="neue Gruppe"
                    autoFocus
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setUseCustomGruppe(false)}>
                    Abbr.
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    id="gruppe"
                    value={gruppe}
                    onChange={(e) => setGruppe(e.target.value)}
                    className="flex-1 rounded-lg border px-3 py-2 bg-background text-sm"
                  >
                    <option value="">— keine —</option>
                    {gruppen.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setUseCustomGruppe(true)}>
                    Neue
                  </Button>
                </div>
              )}
              <input type="hidden" name="gruppe" value={gruppe} />
            </div>

            <div className="space-y-2 w-24">
              <Label htmlFor="sortierung">Sort.</Label>
              <Input id="sortierung" name="sortierung" type="number" defaultValue={String(defaultValues?.sortierung ?? 0)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-2">
              <Label>Icon-Bild</Label>
              <div className="aspect-square w-full rounded-lg border-2 border-dashed bg-muted/30 overflow-hidden flex items-center justify-center">
                {symbolPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={symbolPreview} alt="" className="max-h-full max-w-full object-contain p-4" />
                ) : symbolPath ? (
                  <div className="text-center text-xs text-muted-foreground">
                    <p>Datei hochgeladen</p>
                    <p className="font-mono mt-1 break-all px-2">{symbolPath.split("/").pop()}</p>
                  </div>
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="file">Datei (PNG/SVG/PDF — 240×240 px)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                  disabled={uploading}
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {uploading && <p className="text-xs text-muted-foreground">Lade hoch…</p>}
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-xs text-blue-900">
                  <strong>Hinweis:</strong> Icons sollten ein einheitliches Format haben
                  (240×240 px, quadratisch, transparenter Hintergrund bei PNG/SVG).
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end mt-4">
        <Button asChild variant="outline" type="button"><a href="/icons">Abbrechen</a></Button>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? "Speichere…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
