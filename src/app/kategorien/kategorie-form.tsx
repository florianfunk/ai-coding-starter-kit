"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon, Table as TableIcon } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPALTEN_OPTIONEN } from "@/lib/katalog-column-map";
import { uploadKategorieBild, type KategorieFormState } from "./actions";

const initial: KategorieFormState = { error: null };

export type IconOption = { id: string; label: string; gruppe: string | null; url: string | null };

type Props = {
  bereiche: { id: string; name: string }[];
  icons: IconOption[];
  defaultValues?: {
    bereich_id?: string;
    name?: string;
    beschreibung?: string | null;
    sortierung?: number;
    vorschaubild_path?: string | null;
    vorschaubild_url?: string | null;
    iconIds?: string[];
    spalten?: (string | null)[];
  };
  action: (prev: KategorieFormState, formData: FormData) => Promise<KategorieFormState>;
  submitLabel: string;
};

export function KategorieForm({ bereiche, icons, defaultValues, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [bildPath, setBildPath] = useState(defaultValues?.vorschaubild_path ?? null);
  const [bildPreview, setBildPreview] = useState(defaultValues?.vorschaubild_url ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValues?.iconIds ?? []));
  const [uploading, startUpload] = useTransition();
  const [spalten, setSpalten] = useState<(string | null)[]>(() => {
    const init = defaultValues?.spalten ?? [];
    return Array.from({ length: 9 }, (_, i) => init[i] ?? null);
  });

  function setSpalte(i: number, value: string | null) {
    setSpalten((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const r = await uploadKategorieBild(fd);
      if (r.error) toast.error(r.error);
      else {
        setBildPath(r.path);
        setBildPreview(URL.createObjectURL(file));
        toast.success("Bild hochgeladen");
      }
    });
  }

  function toggleIcon(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }


  return (
    <Card className="max-w-5xl">
      <CardHeader><CardTitle>{submitLabel}</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="vorschaubild_path" value={bildPath ?? ""} />

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
              {state.fieldErrors?.bereich_id && (
                <p className="text-sm text-destructive">{state.fieldErrors.bereich_id}</p>
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
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea id="beschreibung" name="beschreibung" rows={6} defaultValue={defaultValues?.beschreibung ?? ""} />
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
            <IconPicker icons={icons} selectedIds={selected} onToggle={toggleIcon} showRemoveButtons />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bild">Vorschaubild</Label>
            <div className="flex items-start gap-4">
              <div className="h-28 w-40 rounded-lg border-2 border-dashed bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                {bildPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bildPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <Input
                id="bild"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || uploading}>{pending ? "Speichere…" : "Speichern"}</Button>
            <Button asChild variant="outline" type="button"><a href="/kategorien">Abbrechen</a></Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
