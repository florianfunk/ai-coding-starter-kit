"use client";

import { useState, useTransition, useActionState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Image as ImageIcon,
  Table as TableIcon,
  Upload,
  X,
  Crop,
  Maximize2,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AITeaserButton } from "@/components/ai-teaser-button";
import { htmlToPlainText, isHtmlContent } from "@/lib/rich-text/sanitize";
import { EnhanceBildButton } from "@/components/enhance-bild-button";
import { ImageZoomModal } from "@/components/image-zoom-modal";
import { CropSuggestionModal, type CropAspect } from "@/components/crop-suggestion-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPALTEN_OPTIONEN } from "@/lib/katalog-column-map";
import {
  uploadKategorieBild,
  replaceKategorieBildPath,
  cropKategorieBild,
  type KategorieFormState,
} from "./actions";
import { getSlotBildSignedUrl } from "../produkte/datenblatt-actions";

const initial: KategorieFormState = { error: null };

export type IconOption = { id: string; label: string; gruppe: string | null; url: string | null };

type BildSlot = 1 | 2 | 3 | 4;
type BildState = {
  path: string | null;
  previewUrl: string | null;
  /** Vorheriger Pfad — für „Original wiederherstellen" nach Crop. Null wenn kein Crop oder bereits zurückgewechselt. */
  originalPath?: string | null;
  /** Vorherige Preview-URL passend zu originalPath. */
  originalPreviewUrl?: string | null;
};

const SLOT_ASPECT: Record<BildSlot, CropAspect> = {
  1: "wide",
  2: "wide",
  3: "tall",
  4: "tall",
};

const SLOT_GROUP: Record<BildSlot, "wide" | "tall"> = SLOT_ASPECT;

type Props = {
  bereiche: { id: string; name: string }[];
  icons: IconOption[];
  /** ID der Kategorie beim Bearbeiten — bei "neu" undefined. Wird fürs
   *  sofortige Persistieren von KI-bearbeiteten Bildern gebraucht. */
  kategorieId?: string;
  defaultValues?: {
    bereich_id?: string;
    name?: string;
    beschreibung?: string | null;
    sortierung?: number;
    bild1_path?: string | null;
    bild2_path?: string | null;
    bild3_path?: string | null;
    bild4_path?: string | null;
    bild1_url?: string | null;
    bild2_url?: string | null;
    bild3_url?: string | null;
    bild4_url?: string | null;
    iconIds?: string[];
    spalten?: (string | null)[];
  };
  action: (prev: KategorieFormState, formData: FormData) => Promise<KategorieFormState>;
  submitLabel: string;
};

const SLOT_META: Record<BildSlot, { label: string; size: string; hint: string }> = {
  1: { label: "Bild 1", size: "15 × 3 cm", hint: "Breit, mittig links" },
  2: { label: "Bild 2", size: "15 × 3 cm", hint: "Breit, unten links" },
  3: { label: "Bild 3", size: "5 × 3 cm",  hint: "Hochkant, oben rechts" },
  4: { label: "Bild 4", size: "5 × 3 cm",  hint: "Rechts unten" },
};

export function KategorieForm({ bereiche, icons, kategorieId, defaultValues, action, submitLabel }: Props) {
  const [formState, formAction, pending] = useActionState(action, initial);
  const [bilder, setBilder] = useState<Record<BildSlot, BildState>>({
    1: { path: defaultValues?.bild1_path ?? null, previewUrl: defaultValues?.bild1_url ?? null },
    2: { path: defaultValues?.bild2_path ?? null, previewUrl: defaultValues?.bild2_url ?? null },
    3: { path: defaultValues?.bild3_path ?? null, previewUrl: defaultValues?.bild3_url ?? null },
    4: { path: defaultValues?.bild4_path ?? null, previewUrl: defaultValues?.bild4_url ?? null },
  });
  const [uploadingSlot, setUploadingSlot] = useState<BildSlot | null>(null);
  const [beschreibung, setBeschreibung] = useState<string>(defaultValues?.beschreibung ?? "");
  const [name, setName] = useState<string>(defaultValues?.name ?? "");
  const [selected, setSelected] = useState<string[]>(() => {
    const seen = new Set<string>();
    return (defaultValues?.iconIds ?? []).filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  });
  const [, startUpload] = useTransition();
  const [spalten, setSpalten] = useState<(string | null)[]>(() => {
    const init = defaultValues?.spalten ?? [];
    return Array.from({ length: 9 }, (_, i) => init[i] ?? null);
  });

  // Zoom-Modal
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  // Crop-Modal
  const [cropSlot, setCropSlot] = useState<BildSlot | null>(null);
  const [cropSuggestionPath, setCropSuggestionPath] = useState<string | null>(null);
  const [cropSuggestionUrl, setCropSuggestionUrl] = useState<string | null>(null);
  const [cropLoading, setCropLoading] = useState(false);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleSlotDragEnd(event: DragEndEvent) {
    const fromSlot = Number(event.active.id) as BildSlot;
    const toSlot = event.over ? (Number(event.over.id) as BildSlot) : null;
    if (!toSlot || fromSlot === toSlot) return;
    if (SLOT_GROUP[fromSlot] !== SLOT_GROUP[toSlot]) {
      toast.error(
        `Tausch nicht möglich — Bild ${fromSlot} ist ${SLOT_META[fromSlot].size}, Bild ${toSlot} ist ${SLOT_META[toSlot].size}.`,
      );
      return;
    }
    setBilder((prev) => ({
      ...prev,
      [fromSlot]: prev[toSlot],
      [toSlot]: prev[fromSlot],
    }));
    toast.success(`Bild ${fromSlot} ↔ Bild ${toSlot} getauscht`);
  }

  async function generateCropSuggestion(slot: BildSlot) {
    const bild = bilder[slot];
    if (!bild.path) return;
    setCropLoading(true);
    try {
      const r = await cropKategorieBild({ path: bild.path, aspect: SLOT_ASPECT[slot] });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCropSuggestionPath(r.path);
      const { url } = await getSlotBildSignedUrl(r.path);
      setCropSuggestionUrl(url);
    } finally {
      setCropLoading(false);
    }
  }

  async function acceptCrop() {
    if (cropSlot == null || !cropSuggestionPath || !cropSuggestionUrl) return;
    const slot = cropSlot;
    const newPath = cropSuggestionPath;
    const newUrl = cropSuggestionUrl;
    const prev = bilder[slot];

    if (kategorieId) {
      const r = await replaceKategorieBildPath(kategorieId, `bild${slot}_path`, newPath);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBilder((p) => ({
      ...p,
      [slot]: {
        path: newPath,
        previewUrl: newUrl,
        originalPath: prev.path,
        originalPreviewUrl: prev.previewUrl,
      },
    }));
    toast.success(`${SLOT_META[slot].label}: Zuschnitt übernommen`);
    closeCropModal();
  }

  function closeCropModal() {
    setCropSlot(null);
    setCropSuggestionPath(null);
    setCropSuggestionUrl(null);
    setCropLoading(false);
  }

  async function restoreOriginal(slot: BildSlot) {
    const bild = bilder[slot];
    if (!bild.originalPath) return;
    const restored = bild.originalPath;
    const restoredUrl = bild.originalPreviewUrl ?? null;

    if (kategorieId) {
      const r = await replaceKategorieBildPath(kategorieId, `bild${slot}_path`, restored);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }

    setBilder((p) => ({
      ...p,
      [slot]: { path: restored, previewUrl: restoredUrl, originalPath: null, originalPreviewUrl: null },
    }));
    toast.success(`${SLOT_META[slot].label}: Original wiederhergestellt`);
  }

  function setSpalte(i: number, value: string | null) {
    setSpalten((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function handleFile(slot: BildSlot, file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploadingSlot(slot);
    startUpload(async () => {
      const r = await uploadKategorieBild(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        setBilder((prev) => ({
          ...prev,
          [slot]: { path: r.path, previewUrl: URL.createObjectURL(file) },
        }));
        toast.success(`${SLOT_META[slot].label} hochgeladen`);
      }
      setUploadingSlot(null);
    });
  }

  function clearSlot(slot: BildSlot) {
    setBilder((prev) => ({ ...prev, [slot]: { path: null, previewUrl: null } }));
  }

  async function handleEnhanced(slot: BildSlot, newPath: string) {
    // Wenn wir im Bearbeiten-Modus sind, direkt in die DB schreiben — sonst
    // würde das Original-Bild (das bereits aus dem Storage gelöscht wurde)
    // weiter von der Kategorie-Zeile referenziert. Bei "neu" nur Form-State.
    if (kategorieId) {
      const r = await replaceKategorieBildPath(kategorieId, `bild${slot}_path`, newPath);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    }
    const { url } = await getSlotBildSignedUrl(newPath);
    setBilder((prev) => ({
      ...prev,
      [slot]: { path: newPath, previewUrl: url ?? prev[slot].previewUrl },
    }));
  }

  function toggleIcon(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Card className="max-w-5xl">
      <CardHeader><CardTitle>{submitLabel}</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="bild1_path" value={bilder[1].path ?? ""} />
          <input type="hidden" name="bild2_path" value={bilder[2].path ?? ""} />
          <input type="hidden" name="bild3_path" value={bilder[3].path ?? ""} />
          <input type="hidden" name="bild4_path" value={bilder[4].path ?? ""} />

          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
            <div className="space-y-2">
              <Label htmlFor="bereich_id">Bereich *</Label>
              <select
                id="bereich_id"
                name="bereich_id"
                defaultValue={defaultValues?.bereich_id ?? ""}
                required
                className="w-full rounded-lg border px-3 py-2 bg-background text-sm"
              >
                <option value="" disabled>– bitte wählen –</option>
                {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {formState.fieldErrors?.bereich_id && (
                <p className="text-sm text-destructive">{formState.fieldErrors.bereich_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortierung">Sortierung</Label>
              <Input id="sortierung" name="sortierung" type="number" defaultValue={String(defaultValues?.sortierung ?? 0)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg"
            />
            {formState.fieldErrors?.name && <p className="text-sm text-destructive">{formState.fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="beschreibung">Beschreibung</Label>
              <AITeaserButton
                entityType="kategorie"
                entityName={name}
                entityContext={
                  beschreibung
                    ? isHtmlContent(beschreibung)
                      ? htmlToPlainText(beschreibung)
                      : beschreibung
                    : null
                }
                onAccept={(text) => {
                  setBeschreibung(`<p>${escapeHtml(text)}</p>`);
                  toast.success("Teaser übernommen");
                }}
              />
            </div>
            <input type="hidden" name="beschreibung" value={beschreibung} />
            <RichTextEditor value={beschreibung} onChange={setBeschreibung} />
          </div>

          {/* Katalog-Spalten */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-muted-foreground" />
              <Label>Katalog-Spalten</Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Wählen Sie, welche Produktdaten in den Tabellenspalten des Katalogs angezeigt werden.
              Bis zu 9 Spalten möglich — leere Spalten werden übersprungen.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {spalten.map((value, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Spalte {i + 1}</Label>
                  <input type="hidden" name={`spalte_${i + 1}`} value={value ?? "__leer__"} />
                  <Select
                    value={value ?? "__leer__"}
                    onValueChange={(v) => setSpalte(i, v === "__leer__" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Leer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__leer__">— Leer —</SelectItem>
                      {SPALTEN_OPTIONEN.map((opt) => (
                        <SelectItem key={opt.label} value={opt.label}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Icon-Auswahl */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Icons</Label>
              <a href="/icons" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                Icons verwalten &rarr;
              </a>
            </div>
            <IconPicker
              icons={icons}
              selectedIds={selected}
              onToggle={toggleIcon}
              onReorder={setSelected}
              showRemoveButtons
            />
          </div>

          {/* Bilder-Block: 4 Upload-Slots + Layout-Vorschau */}
          <div className="space-y-4">
            <div>
              <Label>Bilder für Katalog-Seite</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pro Kategorie werden bis zu 4 Bilder auf der Katalog-Seite angeordnet — breite Felder links (Bild 1 + 2), schmale Felder rechts (Bild 3 + 4).
                Fehlende Bilder lassen den Platz im Katalog leer. Bilder mit gleichem Format können per Drag &amp; Drop getauscht werden.
              </p>
            </div>

            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSlotDragEnd}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {([1, 2, 3, 4] as BildSlot[]).map((slot) => (
                  <BildSlotCard
                    key={slot}
                    slot={slot}
                    bild={bilder[slot]}
                    meta={SLOT_META[slot]}
                    isUploading={uploadingSlot === slot}
                    onFile={(file) => handleFile(slot, file)}
                    onClear={() => clearSlot(slot)}
                    onZoom={() => bilder[slot].previewUrl && setZoomUrl(bilder[slot].previewUrl)}
                    onCrop={() => {
                      setCropSlot(slot);
                      // Direkt generieren beim Öffnen — User sieht sofort das Ergebnis
                      void generateCropSuggestion(slot);
                    }}
                    onRestoreOriginal={() => restoreOriginal(slot)}
                    enhanceProps={
                      bilder[slot].path
                        ? {
                            bucket: "produktbilder",
                            path: bilder[slot].path!,
                            deleteOriginal: !!kategorieId,
                            onReplaced: (newPath) => handleEnhanced(slot, newPath),
                          }
                        : null
                    }
                  />
                ))}
              </div>
            </DndContext>

            <CategoryLayoutPreview bilder={bilder} />
          </div>

          <ImageZoomModal
            open={zoomUrl !== null}
            onOpenChange={(o) => !o && setZoomUrl(null)}
            src={zoomUrl ?? ""}
          />

          <CropSuggestionModal
            open={cropSlot !== null}
            onOpenChange={(o) => !o && closeCropModal()}
            originalUrl={cropSlot ? bilder[cropSlot].previewUrl ?? "" : ""}
            suggestionUrl={cropSuggestionUrl}
            loading={cropLoading}
            aspect={cropSlot ? SLOT_ASPECT[cropSlot] : "wide"}
            slotLabel={cropSlot ? `${SLOT_META[cropSlot].label} (${SLOT_META[cropSlot].size})` : undefined}
            onGenerate={() => {
              if (cropSlot) void generateCropSuggestion(cropSlot);
            }}
            onAccept={acceptCrop}
          />

          {formState.error && <Alert variant="destructive"><AlertDescription>{formState.error}</AlertDescription></Alert>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || uploadingSlot !== null}>{pending ? "Speichere…" : "Speichern"}</Button>
            <Button asChild variant="outline" type="button"><a href="/kategorien">Abbrechen</a></Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Bildet das FileMaker-Layout der Katalog-Seite nach.
 * 4-Spalten × 2-Zeilen-Grid: Bild1 und Bild2 sind breite Felder (3 Spalten),
 * Bild3 überspannt rechts oben zwei Zeilen hochkant, Bild4 liegt rechts unten.
 */
interface BildSlotCardProps {
  slot: BildSlot;
  bild: BildState;
  meta: { label: string; size: string; hint: string };
  isUploading: boolean;
  onFile: (file: File | null) => void;
  onClear: () => void;
  onZoom: () => void;
  onCrop: () => void;
  onRestoreOriginal: () => void;
  enhanceProps: {
    bucket: "produktbilder";
    path: string;
    deleteOriginal: boolean;
    onReplaced: (newPath: string) => void;
  } | null;
}

function BildSlotCard({
  slot,
  bild,
  meta,
  isUploading,
  onFile,
  onClear,
  onZoom,
  onCrop,
  onRestoreOriginal,
  enhanceProps,
}: BildSlotCardProps) {
  const isWide = slot === 1 || slot === 2;
  const hasImage = !!bild.previewUrl;

  // Drag-Source: nur wenn ein Bild da ist
  const draggable = useDraggable({
    id: String(slot),
    disabled: !hasImage,
  });

  // Drop-Target: immer aktiv (auch leere Slots können Drop empfangen)
  const droppable = useDroppable({
    id: String(slot),
  });

  return (
    <div
      ref={droppable.setNodeRef}
      className={`rounded-lg border bg-muted/20 p-3 space-y-2 transition-colors ${
        droppable.isOver ? "border-primary bg-primary/5" : ""
      } ${draggable.isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {hasImage && (
            <button
              type="button"
              ref={draggable.setNodeRef}
              {...draggable.listeners}
              {...draggable.attributes}
              className="cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
              aria-label={`${meta.label} verschieben`}
              title="Tauschen mit gleichem Format (Drag & Drop)"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-sm font-medium">{meta.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{meta.size}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{meta.hint}</p>

      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40 ${
          isWide ? "aspect-[5/1]" : "aspect-[1/2]"
        }`}
      >
        {bild.previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bild.previewUrl}
              alt=""
              className="h-full w-full object-cover cursor-zoom-in"
              onClick={onZoom}
            />
            <div className="absolute top-1 right-1 flex items-center gap-1">
              {bild.path && (
                <button
                  type="button"
                  onClick={onCrop}
                  aria-label="Auf Slot-Format zuschneiden"
                  title="Auf Slot-Format zuschneiden"
                  className="rounded-full bg-background/90 hover:bg-background p-1 border shadow-sm"
                >
                  <Crop className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={onZoom}
                aria-label="Bild groß ansehen"
                title="Bild groß ansehen"
                className="rounded-full bg-background/90 hover:bg-background p-1 border shadow-sm"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
              {enhanceProps && (
                <EnhanceBildButton
                  bucket={enhanceProps.bucket}
                  path={enhanceProps.path}
                  deleteOriginal={enhanceProps.deleteOriginal}
                  onReplaced={enhanceProps.onReplaced}
                  size="icon"
                  className="border shadow-sm"
                />
              )}
              <button
                type="button"
                aria-label="Bild entfernen"
                onClick={onClear}
                className="rounded-full bg-background/90 hover:bg-background p-1 border shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>

      {bild.originalPath && (
        <button
          type="button"
          onClick={onRestoreOriginal}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
          title="Zugeschnittenes Bild verwerfen — Original wiederherstellen"
        >
          <RotateCcw className="h-3 w-3" />
          Original wiederherstellen
        </button>
      )}

      <label className="flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer">
        <Upload className="h-3.5 w-3.5" />
        <span>{isUploading ? "Lädt…" : bild.path ? "Ersetzen" : "Datei auswählen"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

function CategoryLayoutPreview({ bilder }: { bilder: Record<BildSlot, BildState> }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">Anordnung auf der Katalog-Seite</p>
      <div className="aspect-[4/2] w-full max-w-md grid grid-cols-4 grid-rows-2 gap-1 bg-background rounded border p-1">
        <PreviewSlot bild={bilder[1]} label="Bild 1" size="15×3 cm" className="col-span-3 row-span-1" />
        <PreviewSlot bild={bilder[3]} label="Bild 3" size="5×3 cm"  className="col-span-1 row-span-2" />
        <PreviewSlot bild={bilder[2]} label="Bild 2" size="15×3 cm" className="col-span-3 row-span-1" />
        <PreviewSlot bild={bilder[4]} label="Bild 4" size="5×3 cm"  className="col-start-4 row-start-2" />
      </div>
    </div>
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

function PreviewSlot({
  bild,
  label,
  size,
  className,
}: {
  bild: BildState;
  label: string;
  size: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm border border-dashed ${
        bild.previewUrl ? "border-primary/40" : "border-muted-foreground/30 bg-muted/40"
      } ${className ?? ""}`}
    >
      {bild.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bild.previewUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center text-[9px] text-muted-foreground/70 px-1 text-center">
          <span className="font-medium">{label}</span>
          <span className="opacity-70">{size}</span>
        </div>
      )}
    </div>
  );
}
