"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon, X } from "lucide-react";
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

  // Group icons by gruppe for easier browsing
  const grouped = useMemo(() => {
    const g: Record<string, IconOption[]> = {};
    for (const ic of icons) {
      const key = ic.gruppe ?? "Ohne Gruppe";
      if (!g[key]) g[key] = [];
      g[key].push(ic);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [icons]);

  const iconById = useMemo(() => new Map(icons.map((ic) => [ic.id, ic])), [icons]);

  return (
    <Card className="max-w-5xl">
      <CardHeader><CardTitle>{submitLabel}</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="vorschaubild_path" value={bildPath ?? ""} />
          {[...selected].map((id) => <input key={id} type="hidden" name="icon_ids" value={id} />)}

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

          {/* Icon-Auswahl mit Bildern pro Gruppe */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Icons</Label>
              <a href="/icons" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                Icons verwalten →
              </a>
            </div>

            {/* Ausgewählte Icons zuerst zeigen */}
            {selected.size > 0 && (
              <div className="rounded-lg border bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground mb-2">Ausgewählt ({selected.size}):</p>
                <div className="flex flex-wrap gap-2">
                  {[...selected].map((id) => {
                    const ic = iconById.get(id);
                    if (!ic) return null;
                    return (
                      <div key={id} className="relative group">
                        <div className="h-14 w-14 rounded-lg border-2 border-primary bg-background flex items-center justify-center overflow-hidden">
                          {ic.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain p-1" />
                          ) : (
                            <span className="text-[10px] font-bold">{ic.label}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleIcon(id)}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="text-[10px] text-center mt-1 truncate w-14">{ic.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Auswahl nach Gruppe */}
            <div className="rounded-lg border divide-y">
              {grouped.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Noch keine Icons angelegt. <a href="/icons/neu" className="underline">Jetzt welche anlegen →</a>
                </p>
              )}
              {grouped.map(([gruppe, items]) => (
                <div key={gruppe} className="p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{gruppe}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((ic) => {
                      const on = selected.has(ic.id);
                      return (
                        <button
                          key={ic.id}
                          type="button"
                          onClick={() => toggleIcon(ic.id)}
                          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${
                            on ? "border-primary bg-primary/10" : "border-transparent hover:border-primary/30 hover:bg-muted"
                          }`}
                          title={ic.label}
                        >
                          <div className="h-12 w-12 rounded border bg-background flex items-center justify-center overflow-hidden">
                            {ic.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain p-1" />
                            ) : (
                              <span className="text-[9px] font-bold px-1">{ic.label}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground w-12 truncate text-center">{ic.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
