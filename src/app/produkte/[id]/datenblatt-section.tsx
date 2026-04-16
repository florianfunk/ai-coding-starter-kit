"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import type { DatenblattTemplate, Slot, SlotKind } from "@/lib/datenblatt";
import { setDatenblattTemplate, setSlotBild, uploadSlotBild } from "../datenblatt-actions";

const SLOT_COLORS: Record<SlotKind, { border: string; bg: string }> = {
  image:        { border: "#193073", bg: "rgba(25,48,115,0.08)" },
  energielabel: { border: "#D90416", bg: "rgba(217,4,22,0.08)" },
  cutting:      { border: "#FFC10D", bg: "rgba(255,193,13,0.14)" },
};

type Props = {
  produktId: string;
  templates: DatenblattTemplate[];
  activeTemplateId: string | null;
  slotImages: Record<string, { path: string; url: string }>; // keyed by slot_id (for active template)
};

export function DatenblattSection({ produktId, templates, activeTemplateId, slotImages }: Props) {
  const [currentId, setCurrentId] = useState<string | null>(activeTemplateId);
  const [images, setImages] = useState(slotImages);
  const [pending, startTransition] = useTransition();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const current = templates.find((t) => t.id === currentId) ?? null;

  function selectTemplate(id: string) {
    const prev = currentId;
    setCurrentId(id);
    setImages({}); // reset until new images loaded
    startTransition(async () => {
      const r = await setDatenblattTemplate(produktId, id);
      if (r.error) { toast.error(r.error); setCurrentId(prev); return; }
      toast.success("Vorlage ausgewählt");
      // Force reload to pull slot images for the new template
      window.location.reload();
    });
  }

  function uploadFor(slot: Slot, file: File) {
    if (!current) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId);
    startTransition(async () => {
      const up = await uploadSlotBild(fd);
      if (up.error || !up.path) { toast.error(up.error ?? "Upload fehlgeschlagen"); return; }
      const sv = await setSlotBild(produktId, current.id, slot.id, up.path);
      if (sv.error) { toast.error(sv.error); return; }
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => ({ ...prev, [slot.id]: { path: up.path!, url: previewUrl } }));
      toast.success("Bild zugeordnet");
    });
  }

  function removeFor(slot: Slot) {
    if (!current) return;
    startTransition(async () => {
      const r = await setSlotBild(produktId, current.id, slot.id, null);
      if (r.error) { toast.error(r.error); return; }
      setImages((prev) => {
        const next = { ...prev };
        delete next[slot.id];
        return next;
      });
      toast.success("Entfernt");
    });
  }

  const targetWidthPx = 640;
  const scale = current ? targetWidthPx / current.page_width_cm : 20;
  const canvasH = current ? current.page_height_cm * scale : 0;

  return (
    <Card className="border-l-4 border-l-violet-500">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Datenblatt-Vorlage</CardTitle>
        <a href="/datenblatt-vorlagen" className="text-xs text-muted-foreground hover:text-primary hover:underline">
          Vorlagen verwalten →
        </a>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template chooser */}
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => {
            const isActive = t.id === currentId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t.id)}
                disabled={pending}
                className={`px-3 py-2 rounded-lg border-2 text-sm transition ${
                  isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/40"
                }`}
              >
                <div className="font-medium">{t.name}</div>
                <div className={`text-[10px] ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {t.slots.length} Slots {t.is_system && "· System"}
                </div>
              </button>
            );
          })}
        </div>

        {!current && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Wähle oben eine Vorlage, um Bilder zuzuordnen.
          </p>
        )}

        {current && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Vorschau · {current.page_width_cm} × {current.page_height_cm} cm
              </p>
              <div
                className="relative bg-white border shadow-inner mx-auto"
                style={{ width: targetWidthPx, height: canvasH }}
              >
                {current.slots.map((slot) => {
                  const c = SLOT_COLORS[slot.kind];
                  const img = images[slot.id];
                  return (
                    <div
                      key={slot.id}
                      className="absolute flex flex-col items-stretch justify-stretch overflow-hidden"
                      style={{
                        left: slot.x_cm * scale,
                        top: slot.y_cm * scale,
                        width: slot.width_cm * scale,
                        height: slot.height_cm * scale,
                        borderColor: c.border,
                        borderWidth: 2,
                        borderStyle: img ? "solid" : "dashed",
                        background: img ? "#fff" : c.bg,
                      }}
                    >
                      {img ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={slot.label} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFor(slot)}
                            className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center hover:bg-destructive"
                            title="Bild entfernen"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputs.current[slot.id]?.click()}
                          className="w-full h-full flex flex-col items-center justify-center gap-1 text-[10px] font-medium"
                          style={{ color: c.border }}
                        >
                          <Upload className="h-4 w-4" />
                          <span className="text-center px-1">{slot.label}</span>
                          <span className="font-mono text-[9px] opacity-70">{slot.width_cm}×{slot.height_cm} cm</span>
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputs.current[slot.id] = el; }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFor(slot, f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Slots ({current.slots.length})</h4>
              {current.slots.map((slot) => {
                const c = SLOT_COLORS[slot.kind];
                const img = images[slot.id];
                return (
                  <div key={slot.id} className="flex items-center gap-2 p-2 rounded border">
                    <div className="w-10 h-10 rounded overflow-hidden border shrink-0 bg-muted flex items-center justify-center" style={{ borderColor: c.border }}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{slot.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{slot.width_cm}×{slot.height_cm} cm</p>
                    </div>
                    {img
                      ? <Button size="sm" variant="ghost" onClick={() => removeFor(slot)} className="h-7 w-7 p-0"><X className="h-3.5 w-3.5" /></Button>
                      : <Button size="sm" variant="outline" onClick={() => fileInputs.current[slot.id]?.click()} className="h-7 px-2 text-xs">Upload</Button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
