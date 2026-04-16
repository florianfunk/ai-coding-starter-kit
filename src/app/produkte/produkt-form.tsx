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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Sun, Wrench, Thermometer, MoreHorizontal, Image as ImageIcon, FileText, Hash } from "lucide-react";
import { uploadProduktBild, type ProduktFormState } from "./actions";
import { PRODUKT_FIELD_GROUPS } from "./fields";

const initial: ProduktFormState = { error: null };

const TAB_ICONS: Record<string, any> = {
  elektrisch: Zap,
  lichttechnisch: Sun,
  mechanisch: Wrench,
  thermisch: Thermometer,
  sonstiges: MoreHorizontal,
};

const TAB_COLORS: Record<string, string> = {
  basis: "border-l-blue-500",
  datenblatt: "border-l-violet-500",
  elektrisch: "border-l-amber-500",
  lichttechnisch: "border-l-yellow-400",
  mechanisch: "border-l-emerald-500",
  thermisch: "border-l-red-400",
  sonstiges: "border-l-gray-400",
  icons: "border-l-primary",
};

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
    if (state.error === null && state !== initial && !pending) toast.success("Gespeichert");
  }, [state, pending]);

  function handleHauptbild(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId ?? "neu");
    startUpload(async () => {
      const r = await uploadProduktBild(fd);
      if (r.error) toast.error(r.error);
      else { setHauptbildPath(r.path); setHauptbildPreview(URL.createObjectURL(file)); }
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
        <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0 border-b rounded-none w-full justify-start">
          <TabsTrigger value="basis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-b-none">
            <Hash className="h-3.5 w-3.5 mr-1" /> Basis
          </TabsTrigger>
          <TabsTrigger value="datenblatt" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-b-none">
            <FileText className="h-3.5 w-3.5 mr-1" /> Datenblatt
          </TabsTrigger>
          {PRODUKT_FIELD_GROUPS.map((g) => {
            const Icon = TAB_ICONS[g.tab] ?? MoreHorizontal;
            return (
              <TabsTrigger key={g.tab} value={g.tab} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-b-none">
                <Icon className="h-3.5 w-3.5 mr-1" /> {g.title.replace(" Daten", "")}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="icons" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-b-none">
            <ImageIcon className="h-3.5 w-3.5 mr-1" /> Icons ({iconSet.size})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basis">
          <SectionCard color={TAB_COLORS.basis} title="Basisdaten">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="artikelnummer">Artikelnummer *</Label>
                <Input id="artikelnummer" name="artikelnummer" required defaultValue={defaultValues.artikelnummer ?? ""} className="font-mono text-base" />
                {state.fieldErrors?.artikelnummer && <p className="text-sm text-destructive">{state.fieldErrors.artikelnummer}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Bezeichnung</Label>
                <Input id="name" name="name" defaultValue={defaultValues.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortierung">Sortierung</Label>
                <Input id="sortierung" name="sortierung" type="number" defaultValue={String(defaultValues.sortierung ?? 0)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bereich_id">Bereich *</Label>
                <select id="bereich_id" name="bereich_id" required value={bereichId} onChange={(e) => setBereichId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-background text-sm">
                  <option value="" disabled>– wählen –</option>
                  {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kategorie_id">Kategorie *</Label>
                <select id="kategorie_id" name="kategorie_id" required defaultValue={defaultValues.kategorie_id ?? ""} className="w-full rounded-lg border px-3 py-2 bg-background text-sm">
                  <option value="" disabled>– wählen –</option>
                  {filteredKategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Switch id="artikel_bearbeitet" name="artikel_bearbeitet" defaultChecked={defaultValues.artikel_bearbeitet ?? false} />
              <Label htmlFor="artikel_bearbeitet">Artikel bearbeitet</Label>
            </div>

            <div className="mt-4 space-y-2">
              <Label>Hauptbild</Label>
              <div className="flex items-start gap-4">
                <div className="h-32 w-40 rounded-lg border-2 border-dashed bg-muted/50 overflow-hidden flex items-center justify-center shrink-0">
                  {hauptbildPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hauptbildPreview} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
                    onChange={(e) => handleHauptbild(e.target.files?.[0] ?? null)} />
                  {uploading && <p className="text-sm text-muted-foreground">Lade hoch…</p>}
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="datenblatt">
          <SectionCard color={TAB_COLORS.datenblatt} title="Datenblatt-Inhalt">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="datenblatt_titel">Titel</Label>
                <Input id="datenblatt_titel" name="datenblatt_titel" defaultValue={defaultValues.datenblatt_titel ?? ""} className="text-base" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_text">Text Block 1</Label>
                  <Textarea id="datenblatt_text" name="datenblatt_text" rows={10} defaultValue={defaultValues.datenblatt_text ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_text_2">Text Block 2</Label>
                  <Textarea id="datenblatt_text_2" name="datenblatt_text_2" rows={10} defaultValue={defaultValues.datenblatt_text_2 ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_text_3">Text Block 3</Label>
                  <Textarea id="datenblatt_text_3" name="datenblatt_text_3" rows={10} defaultValue={defaultValues.datenblatt_text_3 ?? ""} />
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {PRODUKT_FIELD_GROUPS.map((group) => (
          <TabsContent key={group.tab} value={group.tab}>
            <SectionCard color={TAB_COLORS[group.tab] ?? "border-l-gray-300"} title={group.title}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.fields.map((f) => (
                  <FieldInput key={f.col} field={f} defaultValue={defaultValues[f.col]} />
                ))}
              </div>
            </SectionCard>
          </TabsContent>
        ))}

        <TabsContent value="icons">
          <SectionCard color={TAB_COLORS.icons} title="Icon-Leiste (Datenblatt)">
            <div className="flex flex-wrap gap-2">
              {icons.map((ic) => {
                const on = iconSet.has(ic.id);
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => toggleIcon(ic.id)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                      on
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >{ic.label}</button>
                );
              })}
              {icons.length === 0 && <p className="text-muted-foreground text-sm">Keine Icons in der DB.</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...iconSet].map((id) => {
                const ic = icons.find((i) => i.id === id);
                return ic ? <Badge key={id}>{ic.label}</Badge> : null;
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{iconSet.size} Icons ausgewählt</p>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 z-40 -mx-6 px-6 py-4 border-t bg-background/95 backdrop-blur flex gap-3 justify-end shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <Button asChild variant="outline" type="button"><a href="/produkte">Abbrechen</a></Button>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? "Speichere…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SectionCard({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4 tracking-tight">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldInput({ field, defaultValue }: { field: { col: string; label: string; type: string; unit?: string }; defaultValue: any }) {
  if (field.type === "bool") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.col}>{field.label}</Label>
        <select id={field.col} name={field.col} defaultValue={defaultValue == null ? "" : String(defaultValue)} className="w-full rounded-lg border px-3 py-2 bg-background text-sm">
          <option value="">—</option>
          <option value="true">Ja</option>
          <option value="false">Nein</option>
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={field.col} className="text-xs">
        {field.label}
        {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
      </Label>
      <Input
        id={field.col}
        name={field.col}
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "any" : undefined}
        defaultValue={defaultValue ?? ""}
        className="text-sm"
      />
    </div>
  );
}
