"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Zap, Scissors, Plus, Trash2, Copy, Lock } from "lucide-react";
import {
  type DatenblattTemplate, type Slot, type SlotKind,
  DEFAULT_PAGE_WIDTH_CM, DEFAULT_PAGE_HEIGHT_CM,
  clampSlot, slotFromKind,
} from "@/lib/datenblatt";
import { createTemplate, updateTemplate } from "./actions";

const SLOT_COLORS: Record<SlotKind, { border: string; bg: string; text: string }> = {
  image:        { border: "#193073", bg: "rgba(25,48,115,0.12)",  text: "#193073" },
  energielabel: { border: "#D90416", bg: "rgba(217,4,22,0.10)",   text: "#9c0310" },
  cutting:      { border: "#FFC10D", bg: "rgba(255,193,13,0.22)", text: "#8a6700" },
};

const PX_PER_CM_CANVAS = 28; // base; canvas is scaled to container

type Props =
  | { mode: "create"; template?: undefined }
  | { mode: "edit"; template: DatenblattTemplate };

type Interaction =
  | { type: "move"; slotId: string; startX: number; startY: number; origX: number; origY: number }
  | { type: "resize"; slotId: string; handle: "br"; startX: number; startY: number; origW: number; origH: number }
  | null;

export function TemplateEditor(props: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [saving, startSaving] = useTransition();

  const locked = props.mode === "edit" && props.template.is_system;

  const [name, setName] = useState(props.template?.name ?? "Neue Vorlage");
  const [beschreibung, setBeschreibung] = useState(props.template?.beschreibung ?? "");
  const [pageW, setPageW] = useState(props.template?.page_width_cm ?? DEFAULT_PAGE_WIDTH_CM);
  const [pageH, setPageH] = useState(props.template?.page_height_cm ?? DEFAULT_PAGE_HEIGHT_CM);
  const [slots, setSlots] = useState<Slot[]>(props.template?.slots ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  // Adaptive scale so canvas fits container width
  useEffect(() => {
    const measure = () => {
      const c = canvasRef.current?.parentElement;
      if (!c) return;
      setCanvasWidth(Math.min(c.clientWidth - 20, 900));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const scale = canvasWidth / pageW;
  const canvasHeight = pageH * scale;

  function toCanvas(cm: number) { return cm * scale; }
  function toCm(px: number) { return px / scale; }

  // --- Pointer logic ---
  useEffect(() => {
    if (!interaction) return;

    function onMove(e: PointerEvent) {
      if (!interaction) return;
      const dx = e.clientX - interaction.startX;
      const dy = e.clientY - interaction.startY;
      const dxCm = toCm(dx);
      const dyCm = toCm(dy);

      setSlots((prev) => prev.map((s) => {
        if (s.id !== interaction.slotId) return s;
        if (interaction.type === "move") {
          return clampSlot({ ...s, x_cm: interaction.origX + dxCm, y_cm: interaction.origY + dyCm }, pageW, pageH);
        }
        if (interaction.type === "resize") {
          return clampSlot({
            ...s,
            width_cm: Math.max(1, interaction.origW + dxCm),
            height_cm: Math.max(0.5, interaction.origH + dyCm),
          }, pageW, pageH);
        }
        return s;
      }));
    }

    function onUp() {
      setInteraction(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [interaction, pageW, pageH, scale]);

  function startMove(slotId: string, e: React.PointerEvent) {
    if (locked) return;
    e.preventDefault();
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    setSelectedId(slotId);
    setInteraction({
      type: "move", slotId,
      startX: e.clientX, startY: e.clientY,
      origX: slot.x_cm, origY: slot.y_cm,
    });
  }

  function startResize(slotId: string, e: React.PointerEvent) {
    if (locked) return;
    e.stopPropagation();
    e.preventDefault();
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    setSelectedId(slotId);
    setInteraction({
      type: "resize", slotId, handle: "br",
      startX: e.clientX, startY: e.clientY,
      origW: slot.width_cm, origH: slot.height_cm,
    });
  }

  function addSlot(kind: SlotKind) {
    if (locked) return;
    const base = slotFromKind(kind);
    const id = `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newSlot: Slot = clampSlot({
      id,
      label: base.label ?? "Bild",
      x_cm: 1, y_cm: 1,
      width_cm: base.width_cm ?? 6,
      height_cm: base.height_cm ?? 4,
      kind,
    }, pageW, pageH);
    setSlots((s) => [...s, newSlot]);
    setSelectedId(id);
  }

  function removeSlot(id: string) {
    if (locked) return;
    setSlots((s) => s.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateSlot(id: string) {
    if (locked) return;
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    const copy: Slot = { ...slot, id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x_cm: slot.x_cm + 0.5, y_cm: slot.y_cm + 0.5 };
    setSlots((s) => [...s, copy]);
    setSelectedId(copy.id);
  }

  function updateSlot(id: string, patch: Partial<Slot>) {
    if (locked) return;
    setSlots((s) => s.map((x) => (x.id === id ? clampSlot({ ...x, ...patch }, pageW, pageH) : x)));
  }

  const selected = selectedId ? slots.find((s) => s.id === selectedId) : null;

  function save() {
    if (locked) return;
    if (!name.trim()) { toast.error("Name ist Pflicht"); return; }
    startSaving(async () => {
      const payload = {
        name: name.trim(),
        beschreibung: beschreibung.trim() || null,
        page_width_cm: pageW,
        page_height_cm: pageH,
        slots,
        sortierung: props.template?.sortierung ?? 99,
      };
      if (props.mode === "create") {
        const r = await createTemplate(payload);
        if (r.error || !r.id) toast.error(r.error ?? "Fehler");
        else { toast.success("Angelegt"); router.push(`/datenblatt-vorlagen/${r.id}`); }
      } else {
        const r = await updateTemplate(props.template.id, payload);
        if (r.error) toast.error(r.error);
        else toast.success("Gespeichert");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* LEFT: Canvas */}
      <div className="space-y-3">
        {locked && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2 text-sm text-amber-900">
            <Lock className="h-4 w-4" />
            <span><strong>System-Vorlage</strong> — kann nicht bearbeitet werden. Dupliziere sie, um eine eigene Variante zu erstellen.</span>
          </div>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Canvas — {pageW} × {pageH} cm (A4)</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={locked} onClick={() => addSlot("image")}>
                <ImageIcon className="h-3.5 w-3.5 mr-1" /> Bild-Slot
              </Button>
              <Button size="sm" variant="outline" disabled={locked} onClick={() => addSlot("cutting")}>
                <Scissors className="h-3.5 w-3.5 mr-1" /> Cutting
              </Button>
              <Button size="sm" variant="outline" disabled={locked} onClick={() => addSlot("energielabel")}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Energielabel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={canvasRef}
              className="relative bg-white border shadow-inner overflow-hidden mx-auto select-none"
              style={{
                width: canvasWidth, height: canvasHeight,
                backgroundImage: "linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)",
                backgroundSize: `${scale}px ${scale}px`,
              }}
              onPointerDown={() => setSelectedId(null)}
            >
              {slots.map((s) => {
                const c = SLOT_COLORS[s.kind];
                const isSelected = selectedId === s.id;
                return (
                  <div
                    key={s.id}
                    onPointerDown={(e) => { e.stopPropagation(); startMove(s.id, e); }}
                    className={`absolute flex items-start transition-shadow ${isSelected ? "ring-2 ring-primary shadow-lg" : ""} ${locked ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: toCanvas(s.x_cm), top: toCanvas(s.y_cm),
                      width: toCanvas(s.width_cm), height: toCanvas(s.height_cm),
                      background: c.bg, borderColor: c.border, borderWidth: 2, borderStyle: "solid",
                    }}
                  >
                    <span className="px-1 py-0.5 text-[10px] font-semibold leading-none" style={{ color: c.text }}>
                      {s.label}
                    </span>
                    <span className="absolute bottom-0.5 right-1 text-[9px] leading-none font-mono" style={{ color: c.text }}>
                      {s.width_cm.toFixed(1)}×{s.height_cm.toFixed(1)}
                    </span>
                    {!locked && (
                      <div
                        onPointerDown={(e) => startResize(s.id, e)}
                        className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-sm cursor-nwse-resize shadow border-2 border-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Properties */}
      <div className="space-y-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Vorlage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={locked} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="beschreibung">Beschreibung</Label>
              <Textarea id="beschreibung" rows={2} value={beschreibung ?? ""} onChange={(e) => setBeschreibung(e.target.value)} disabled={locked} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Breite (cm)</Label>
                <Input type="number" step="0.5" value={pageW} onChange={(e) => setPageW(Number(e.target.value))} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Höhe (cm)</Label>
                <Input type="number" step="0.5" value={pageH} onChange={(e) => setPageH(Number(e.target.value))} disabled={locked} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Slots ({slots.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {slots.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Keine Slots. Füge welche über die Buttons oben hinzu.</p>
            )}
            <ul className="divide-y">
              {slots.map((s) => {
                const c = SLOT_COLORS[s.kind];
                const isSel = selectedId === s.id;
                return (
                  <li
                    key={s.id}
                    className={`p-2 cursor-pointer text-xs ${isSel ? "bg-primary/10" : "hover:bg-muted/50"}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c.border }} />
                      <span className="flex-1 truncate font-medium">{s.label}</span>
                      <Badge variant="outline" className="text-[9px]">{s.kind}</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground font-mono">
                      {s.x_cm.toFixed(1)},{s.y_cm.toFixed(1)} · {s.width_cm.toFixed(1)}×{s.height_cm.toFixed(1)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Slot bearbeiten</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={locked} onClick={() => duplicateSlot(selected.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" disabled={locked} onClick={() => removeSlot(selected.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={selected.label} onChange={(e) => updateSlot(selected.id, { label: e.target.value })} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typ</Label>
                <select
                  value={selected.kind}
                  onChange={(e) => updateSlot(selected.id, { kind: e.target.value as SlotKind })}
                  disabled={locked}
                  className="w-full rounded-lg border px-3 py-2 bg-background text-sm"
                >
                  <option value="image">Bild</option>
                  <option value="cutting">Cutting-Diagramm</option>
                  <option value="energielabel">Energielabel</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">X (cm)</Label>
                  <Input type="number" step="0.1" value={selected.x_cm} onChange={(e) => updateSlot(selected.id, { x_cm: Number(e.target.value) })} disabled={locked} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Y (cm)</Label>
                  <Input type="number" step="0.1" value={selected.y_cm} onChange={(e) => updateSlot(selected.id, { y_cm: Number(e.target.value) })} disabled={locked} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Breite (cm)</Label>
                  <Input type="number" step="0.1" value={selected.width_cm} onChange={(e) => updateSlot(selected.id, { width_cm: Number(e.target.value) })} disabled={locked} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Höhe (cm)</Label>
                  <Input type="number" step="0.1" value={selected.height_cm} onChange={(e) => updateSlot(selected.id, { height_cm: Number(e.target.value) })} disabled={locked} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tipp: Slot mit Maus ziehen, kleines Quadrat unten-rechts zum Resizen.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 sticky bottom-2">
          <Button asChild variant="outline" className="flex-1"><a href="/datenblatt-vorlagen">Zurück</a></Button>
          {!locked && (
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Speichere…" : (props.mode === "create" ? "Anlegen" : "Speichern")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
