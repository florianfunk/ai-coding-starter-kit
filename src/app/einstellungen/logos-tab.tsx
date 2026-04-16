"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadAsset } from "./actions";

const ASSETS: { field: string; label: string }[] = [
  { field: "cover_vorne_path", label: "Cover vorne" },
  { field: "cover_hinten_path", label: "Cover hinten" },
  { field: "logo_lichtengros_dunkel", label: "Lichtengros dunkel" },
  { field: "logo_lichtengros_hell", label: "Lichtengros hell" },
  { field: "logo_eisenkeil_dunkel", label: "Eisenkeil dunkel" },
  { field: "logo_eisenkeil_hell", label: "Eisenkeil hell" },
  { field: "logo_lichtstudio", label: "Lichtstudio" },
];

export function LogosTab({ assetUrls }: { assetUrls: Record<string, string | null>; settings: any }) {
  const [pending, startTransition] = useTransition();

  function upload(field: string, file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("field", field);
    fd.append("file", file);
    startTransition(async () => {
      const r = await uploadAsset(fd);
      if (r.error) toast.error(r.error);
      else toast.success("Hochgeladen");
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Logos & Cover</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {ASSETS.map((a) => (
            <div key={a.field} className="space-y-2">
              <Label>{a.label}</Label>
              <div className="aspect-video rounded border bg-muted/30 flex items-center justify-center overflow-hidden">
                {assetUrls[a.field] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrls[a.field]!} alt={a.label} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">— kein Bild —</span>
                )}
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                disabled={pending}
                onChange={(e) => upload(a.field, e.target.files?.[0] ?? null)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
