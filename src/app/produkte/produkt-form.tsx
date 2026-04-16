"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { uploadProduktBild, type ProduktFormState } from "./actions";
import { PRODUKT_FIELD_GROUPS } from "./fields";

const initial: ProduktFormState = { error: null };

type Bereich = { id: string; name: string };
type Kategorie = { id: string; name: string; bereich_id: string };
type Icon = { id: string; label: string };

type Props = {
  bereiche: Bereich[];
  kategorien: Kategorie[];
  icons: Icon[];
  defaultValues?: Record<string, any>;
  defaultIconIds?: string[];
  defaultHauptbildUrl?: string | null;
  produktId?: string;
  action: (prev: ProduktFormState, formData: FormData) => Promise<ProduktFormState>;
  submitLabel: string;
};

export function ProduktForm({
  bereiche, kategorien, icons,
  defaultValues = {}, defaultIconIds = [],
  defaultHauptbildUrl = null, produktId,
  action, submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [bereichId, setBereichId] = useState<string>(defaultValues.bereich_id ?? "");
  const [hauptbildPath, setHauptbildPath] = useState<string | null>(defaultValues.hauptbild_path ?? null);
  const [hauptbildPreview, setHauptbildPreview] = useState<string | null>(defaultHauptbildUrl);
  const [iconSet, setIconSet] = useState<Set<string>>(new Set(defaultIconIds));
  const [uploading, startUpload] = useTransition();

  const filteredKategorien = useMemo(
    () => kategorien.filter((k) => !bereichId || k.bereich_id === bereichId),
    [kategorien, bereichId],
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function handleHauptbild(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId ?? "neu");
    startUpload(async () => {
      const r = await uploadProduktBild(fd);
      if (r.error) toast.error(r.error);
      else { setHauptbildPath(r.path); setHauptbildPreview(URL.createObjectURL(file)); toast.success("Bild hochgeladen"); }
    });
  }

  function toggleIcon(id: string) {
    setIconSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hauptbild_path" value={hauptbildPath ?? ""} />
      {[...iconSet].map((id) => <input key={id} type="hidden" name="icon_ids" value={id} />)}

      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}

      <Tabs defaultValue="basis">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="basis">Basis</TabsTrigger>
          <TabsTrigger value="datenblatt">Datenblatt</TabsTrigger>
          {PRODUKT_FIELD_GROUPS.map((g) => <TabsTrigger key={g.tab} value={g.tab}>{g.title}</TabsTrigger>)}
          <TabsTrigger value="icons">Icons ({iconSet.size})</TabsTrigger>
        </TabsList>

        <TabsContent value="basis">
          <Card>
            <CardHeader><CardTitle>Basis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="artikelnummer">Artikelnummer *</Label>
                  <Input id="artikelnummer" name="artikelnummer" required defaultValue={defaultValues.artikelnummer ?? ""} className="font-mono" />
                  {state.fieldErrors?.artikelnummer && <p className="text-sm text-destructive">{state.fieldErrors.artikelnummer}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortierung">Sortierung</Label>
                  <Input id="sortierung" name="sortierung" type="number" defaultValue={String(defaultValues.sortierung ?? 0)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={defaultValues.name ?? ""} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bereich_id">Bereich *</Label>
                  <select
                    id="bereich_id" name="bereich_id" required
                    value={bereichId} onChange={(e) => setBereichId(e.target.value)}
                    className="w-full rounded border px-2 py-2 bg-background"
                  >
                    <option value="" disabled>– wählen –</option>
                    {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kategorie_id">Kategorie *</Label>
                  <select
                    id="kategorie_id" name="kategorie_id" required
                    defaultValue={defaultValues.kategorie_id ?? ""}
                    className="w-full rounded border px-2 py-2 bg-background"
                  >
                    <option value="" disabled>– wählen –</option>
                    {filteredKategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="artikel_bearbeitet"
                  name="artikel_bearbeitet"
                  defaultChecked={defaultValues.artikel_bearbeitet ?? false}
                />
                <Label htmlFor="artikel_bearbeitet">Artikel bearbeitet</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hauptbild">Hauptbild</Label>
                <Input id="hauptbild" type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={uploading} onChange={(e) => handleHauptbild(e.target.files?.[0] ?? null)} />
                {hauptbildPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hauptbildPreview} alt="" className="h-32 rounded border" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datenblatt">
          <Card>
            <CardHeader><CardTitle>Datenblatt-Inhalt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="datenblatt_titel">Titel</Label>
                <Input id="datenblatt_titel" name="datenblatt_titel" defaultValue={defaultValues.datenblatt_titel ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="datenblatt_text">Beschreibung (Markdown)</Label>
                <Textarea id="datenblatt_text" name="datenblatt_text" rows={14} defaultValue={defaultValues.datenblatt_text ?? ""} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {PRODUKT_FIELD_GROUPS.map((group) => (
          <TabsContent key={group.tab} value={group.tab}>
            <Card>
              <CardHeader><CardTitle>{group.title}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {group.fields.map((f) => (
                    <FieldInput key={f.col} field={f} defaultValue={defaultValues[f.col]} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="icons">
          <Card>
            <CardHeader><CardTitle>Icon-Leiste (Datenblatt)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {icons.map((ic) => {
                  const on = iconSet.has(ic.id);
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => toggleIcon(ic.id)}
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "bg-primary text-primary-foreground border-primary" : "hover:border-foreground/50"}`}
                    >{ic.label}</button>
                  );
                })}
                {icons.length === 0 && <p className="text-muted-foreground text-sm">Keine Icons in der DB.</p>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{iconSet.size} ausgewählt</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {[...iconSet].map((id) => {
                  const ic = icons.find((i) => i.id === id);
                  return ic ? <Badge key={id} variant="secondary">{ic.label}</Badge> : null;
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 border-t bg-background flex gap-2 justify-end">
        <Button asChild variant="outline" type="button"><a href="/produkte">Abbrechen</a></Button>
        <Button type="submit" disabled={pending || uploading}>{pending ? "Speichere…" : submitLabel}</Button>
      </div>
    </form>
  );
}

function FieldInput({ field, defaultValue }: { field: { col: string; label: string; type: string; unit?: string }; defaultValue: any }) {
  if (field.type === "bool") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.col}>{field.label}</Label>
        <select
          id={field.col}
          name={field.col}
          defaultValue={defaultValue == null ? "" : String(defaultValue)}
          className="w-full rounded border px-2 py-2 bg-background"
        >
          <option value="">—</option>
          <option value="true">Ja</option>
          <option value="false">Nein</option>
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={field.col}>
        {field.label}
        {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
      </Label>
      <Input
        id={field.col}
        name={field.col}
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "any" : undefined}
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}
