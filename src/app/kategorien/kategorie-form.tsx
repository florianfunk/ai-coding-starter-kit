"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon, Table as TableIcon, Upload, X } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { EnhanceBildButton } from "@/components/enhance-bild-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPALTEN_OPTIONEN } from "@/lib/katalog-column-map";
import { uploadKategorieBild, replaceKategorieBildPath, type KategorieFormState } from "./actions";
import { getSlotBildSignedUrl } from "../produkte/datenblatt-actions";

const initial: KategorieFormState = { error: null };

export type IconOption = { id: string; label: string; gruppe: string | null; url: string | null };

type BildSlot = 1 | 2 | 3 | 4;
type BildState = { path: string | null; previewUrl: string | null };

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
  const [selected, setSelected] = useState<string[]>(() => {
    const seen = new Set<string>();
    return (defaultValues?.iconIds ?? []).filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  });
  const [, startUpload] = useTransition();
  const [spalten, setSpalten] = useState<(string | null)[]>(() => {
    const init = defaultValues?.spalten ?? [];
    return Array.from({ length: 9 }, (_, i) => init[i] ?? null);
  });

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
            <Input id="name" name="name" required defaultValue={defaultValues?.name ?? ""} className="text-lg" />
            {formState.fieldErrors?.name && <p className="text-sm text-destructive">{formState.fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
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
                Fehlende Bilder lassen den Platz im Katalog leer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {([1, 2, 3, 4] as BildSlot[]).map((slot) => {
                const meta = SLOT_META[slot];
                const bild = bilder[slot];
                const isUploading = uploadingSlot === slot;
                const isWide = slot === 1 || slot === 2;
                return (
                  <div key={slot} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{meta.label}</span>
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
                          <img src={bild.previewUrl} alt="" className="h-full w-full object-cover" />
                          <div className="absolute top-1 right-1 flex items-center gap-1">
                            {bild.path && (
                              <EnhanceBildButton
                                bucket="produktbilder"
                                path={bild.path}
                                deleteOriginal={!!kategorieId}
                                onReplaced={(newPath) => handleEnhanced(slot, newPath)}
                                size="icon"
                                className="border shadow-sm"
                              />
                            )}
                            <button
                              type="button"
                              aria-label="Bild entfernen"
                              onClick={() => clearSlot(slot)}
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
                    <label className="flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploading ? "Lädt…" : bild.path ? "Ersetzen" : "Datei auswählen"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => handleFile(slot, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <CategoryLayoutPreview bilder={bilder} />
          </div>

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
