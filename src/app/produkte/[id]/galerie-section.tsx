"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadProduktBild, addGalerieBild, deleteGalerieBild } from "../actions";

type Bild = { id: string; storage_path: string; alt_text: string | null; url: string | null };

export function GalerieSection({ produktId, bilder }: { produktId: string; bilder: Bild[] }) {
  const [list, setList] = useState(bilder);
  const [pending, startTransition] = useTransition();

  function handleUpload(file: File | null) {
    if (!file) return;
    if (list.length >= 12) { toast.error("Max. 12 Galeriebilder."); return; }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId);
    startTransition(async () => {
      const r = await uploadProduktBild(fd);
      if (r.error || !r.path) { toast.error(r.error ?? "Upload fehlgeschlagen"); return; }
      const a = await addGalerieBild(produktId, r.path, file.name);
      if (a.error) toast.error(a.error);
      else { setList((prev) => [...prev, { id: crypto.randomUUID(), storage_path: r.path!, alt_text: file.name, url: URL.createObjectURL(file) }]); toast.success("Hinzugefügt"); }
    });
  }

  function remove(bildId: string) {
    startTransition(async () => {
      const r = await deleteGalerieBild(bildId, produktId);
      if (r.error) toast.error(r.error);
      else { setList((prev) => prev.filter((b) => b.id !== bildId)); toast.success("Gelöscht"); }
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Galerie ({list.length}/12)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending || list.length >= 12}
          onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
        />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {list.map((b) => (
            <div key={b.id} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.url ?? ""} alt={b.alt_text ?? ""} className="aspect-square w-full object-cover rounded border" />
              <Button
                size="sm" variant="destructive"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
                onClick={() => remove(b.id)} disabled={pending}
              >×</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
