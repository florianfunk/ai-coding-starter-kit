"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SortableGallery, type GalleryImage } from "@/components/sortable-gallery";
import {
  uploadProduktBild,
  addGalerieBild,
  deleteGalerieBild,
  reorderGalerieBilder,
  setHauptbild,
} from "../actions";

type Bild = { id: string; storage_path: string; alt_text: string | null; url: string | null };

export function GalerieSection({
  produktId,
  bilder,
  hauptbildPath,
}: {
  produktId: string;
  bilder: Bild[];
  hauptbildPath?: string | null;
}) {
  const [list, setList] = useState<GalleryImage[]>(
    bilder.map((b) => ({
      id: b.id,
      url: b.url ?? "",
      alt_text: b.alt_text,
      storage_path: b.storage_path,
    })),
  );
  const [pending, startTransition] = useTransition();

  function handleUpload(file: File | null) {
    if (!file) return;
    if (list.length >= 12) {
      toast.error("Max. 12 Galeriebilder.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId);
    startTransition(async () => {
      const r = await uploadProduktBild(fd);
      if (r.error || !r.path) {
        toast.error(r.error ?? "Upload fehlgeschlagen");
        return;
      }
      const a = await addGalerieBild(produktId, r.path, file.name);
      if (a.error) {
        toast.error(a.error);
      } else {
        setList((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            storage_path: r.path!,
            alt_text: file.name,
            url: URL.createObjectURL(file),
          },
        ]);
        toast.success("Hinzugefuegt");
      }
    });
  }

  async function handleReorder(orderedIds: string[]) {
    const r = await reorderGalerieBilder(produktId, orderedIds);
    if (r.error) toast.error(r.error);
  }

  async function handleSetHauptbild(storagePath: string) {
    const r = await setHauptbild(produktId, storagePath);
    if (r.error) toast.error(r.error);
    else toast.success("Hauptbild gesetzt");
  }

  function handleDelete(bildId: string) {
    startTransition(async () => {
      const r = await deleteGalerieBild(bildId, produktId);
      if (r.error) {
        toast.error(r.error);
      } else {
        setList((prev) => prev.filter((b) => b.id !== bildId));
        toast.success("Geloescht");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Galerie ({list.length}/12)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending || list.length >= 12}
          onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
        />
        <SortableGallery
          produktId={produktId}
          images={list}
          hauptbildPath={hauptbildPath}
          onReorder={handleReorder}
          onSetHauptbild={handleSetHauptbild}
          onDelete={handleDelete}
          disabled={pending}
        />
      </CardContent>
    </Card>
  );
}
