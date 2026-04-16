"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadBereichBild, type BereichFormState } from "./actions";

const initial: BereichFormState = { error: null };

type Props = {
  defaultValues?: {
    name?: string;
    beschreibung?: string | null;
    sortierung?: number;
    seitenzahl?: number | null;
    startseite?: number | null;
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
  const [uploading, startUpload] = useTransition();

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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{submitLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bild_path" value={bildPath ?? ""} />

          <Field label="Name" name="name" defaultValue={defaultValues?.name ?? ""} required error={state.fieldErrors?.name} />

          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea
              id="beschreibung"
              name="beschreibung"
              rows={3}
              defaultValue={defaultValues?.beschreibung ?? ""}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Sortierung" name="sortierung" type="number" defaultValue={String(defaultValues?.sortierung ?? 0)} />
            <Field label="Seitenzahl" name="seitenzahl" type="number" defaultValue={defaultValues?.seitenzahl?.toString() ?? ""} />
            <Field label="Startseite" name="startseite" type="number" defaultValue={defaultValues?.startseite?.toString() ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bild">Bild</Label>
            <Input
              id="bild"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {bildPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bildPreview} alt="Vorschau" className="h-24 rounded border" />
            )}
            {uploading && <p className="text-sm text-muted-foreground">Lade hoch…</p>}
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || uploading}>
              {pending ? "Speichere…" : "Speichern"}
            </Button>
            <Button asChild variant="outline" type="button">
              <a href="/bereiche">Abbrechen</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label, name, type = "text", defaultValue, required, error,
}: {
  label: string; name: string; type?: string; defaultValue?: string; required?: boolean; error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required && " *"}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
