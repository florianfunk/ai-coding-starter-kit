"use client";

import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, Sun, Wrench, Thermometer, Image as ImageIcon, FileText, Palette, ChevronsUpDown } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { FieldInfo } from "@/components/field-info";
import { uploadProduktBild, type ProduktFormState } from "./actions";
import { PRODUKT_FIELD_GROUPS } from "./fields";

const FIELD_TOOLTIPS: Record<string, string> = {
  schutzart_ip: "Die IP-Schutzart gibt den Schutzgrad gegen Beruhrung, Fremdkorper und Wasser an (z.B. IP20 = kein Wasserschutz, IP67 = wasserdicht).",
  ugr: "Unified Glare Rating — Mass fur die psychologische Blendung. Werte unter 19 gelten als blendfrei.",
  farbkonsistenz_sdcm: "Standard Deviation of Color Matching — misst die Farbkonsistenz. SDCM 3 = kaum sichtbare Farbunterschiede.",
  farbwiedergabeindex_cri: "Color Rendering Index — wie naturlich Farben unter dieser Lichtquelle erscheinen. CRI 90+ ist sehr gut.",
  lebensdauer_h: "Angabe in Stunden (h). Typisch: 50.000h = ca. 17 Jahre bei 8h/Tag.",
  energieeffizienzklasse: "EU-Energielabel von A (beste) bis G.",
  schutzklasse: "Elektrische Schutzklasse (I, II oder III). Bestimmt die Erdungsanforderung.",
  nennspannung_v: "Betriebsspannung in Volt (z.B. 24V DC fur LED-Strips, 230V AC fur Deckenleuchten).",
};

const initial: ProduktFormState = { error: null };

const STORAGE_KEY = "produkt-form-sections";

const SECTION_IDS = ["datenblatt", "elektrisch", "lichttechnisch", "mechanisch", "thermisch", "icons"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const DEFAULT_OPEN: SectionId[] = ["datenblatt"];

const SECTION_META: Record<SectionId, { label: string; icon: React.ElementType; color: string }> = {
  datenblatt: { label: "Datenblatt", icon: FileText, color: "border-l-violet-500" },
  elektrisch: { label: "Elektrotechnisch", icon: Zap, color: "border-l-amber-500" },
  lichttechnisch: { label: "Lichttechnisch", icon: Sun, color: "border-l-yellow-400" },
  mechanisch: { label: "Mechanisch", icon: Wrench, color: "border-l-emerald-500" },
  thermisch: { label: "Thermisch & Sonstiges", icon: Thermometer, color: "border-l-red-400" },
  icons: { label: "Icons", icon: Palette, color: "border-l-primary" },
};

function loadOpenSections(): string[] {
  if (typeof window === "undefined") return DEFAULT_OPEN;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_OPEN;
}

function saveOpenSections(sections: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch { /* ignore */ }
}

/** Check if a section has any filled fields in defaultValues */
function isSectionFilled(sectionId: SectionId, defaultValues: Record<string, any>, iconCount: number): boolean {
  if (sectionId === "icons") return iconCount > 0;
  if (sectionId === "datenblatt") {
    return !!(defaultValues.datenblatt_titel || defaultValues.datenblatt_text || defaultValues.datenblatt_text_2 || defaultValues.datenblatt_text_3);
  }
  // For field-group sections, check if any field has a value
  const groupTabs = sectionId === "thermisch" ? ["thermisch", "sonstiges"] : [sectionId];
  for (const tab of groupTabs) {
    const group = PRODUKT_FIELD_GROUPS.find((g) => g.tab === tab);
    if (group) {
      for (const f of group.fields) {
        const val = defaultValues[f.col];
        if (val != null && val !== "" && val !== false) return true;
      }
    }
  }
  return false;
}

type Bereich = { id: string; name: string };
type Kategorie = { id: string; name: string; bereich_id: string };
type Icon = { id: string; label: string; gruppe?: string | null; url?: string | null };

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
  const [openSections, setOpenSections] = useState<string[]>(loadOpenSections);

  const filteredKategorien = useMemo(
    () => kategorien.filter((k) => !bereichId || k.bereich_id === bereichId),
    [kategorien, bereichId],
  );

  const allOpen = openSections.length === SECTION_IDS.length;

  const handleSectionsChange = useCallback((value: string[]) => {
    setOpenSections(value);
    saveOpenSections(value);
  }, []);

  const toggleAll = useCallback(() => {
    const next = allOpen ? [] : [...SECTION_IDS];
    setOpenSections(next);
    saveOpenSections(next);
  }, [allOpen]);

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

  const thermischGroup = PRODUKT_FIELD_GROUPS.find((g) => g.tab === "thermisch");
  const sonstigesGroup = PRODUKT_FIELD_GROUPS.find((g) => g.tab === "sonstiges");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="hauptbild_path" value={hauptbildPath ?? ""} />

      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}

      {/* Grunddaten -- always visible, not collapsible */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4 tracking-tight">Grunddaten</h3>
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
                <option value="" disabled>-- wahlen --</option>
                {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kategorie_id">Kategorie *</Label>
              <select id="kategorie_id" name="kategorie_id" required defaultValue={defaultValues.kategorie_id ?? ""} className="w-full rounded-lg border px-3 py-2 bg-background text-sm">
                <option value="" disabled>-- wahlen --</option>
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
                {uploading && <p className="text-sm text-muted-foreground">Lade hoch...</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toggle all button */}
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={toggleAll} className="text-muted-foreground text-xs gap-1.5">
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allOpen ? "Alle schliessen" : "Alle offnen"}
        </Button>
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" value={openSections} onValueChange={handleSectionsChange} className="space-y-3">
        {/* Datenblatt */}
        <AccordionItem value="datenblatt" className="border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="flex items-center gap-2">
              <SectionIndicator filled={isSectionFilled("datenblatt", defaultValues, iconSet.size)} />
              <FileText className="h-4 w-4 text-violet-500" />
              <span className="font-semibold">Datenblatt</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
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
          </AccordionContent>
        </AccordionItem>

        {/* Elektrotechnisch */}
        {PRODUKT_FIELD_GROUPS.filter((g) => g.tab !== "thermisch" && g.tab !== "sonstiges").map((group) => {
          const meta = SECTION_META[group.tab as SectionId];
          if (!meta) return null;
          const SIcon = meta.icon;
          return (
            <AccordionItem key={group.tab} value={group.tab} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  <SectionIndicator filled={isSectionFilled(group.tab as SectionId, defaultValues, iconSet.size)} />
                  <SIcon className={`h-4 w-4 ${meta.color.replace("border-l-", "text-")}`} />
                  <span className="font-semibold">{meta.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">({group.fields.length} Felder)</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.fields.map((f) => (
                    <FieldInput key={f.col} field={f} defaultValue={defaultValues[f.col]} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Thermisch & Sonstiges (merged) */}
        <AccordionItem value="thermisch" className="border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="flex items-center gap-2">
              <SectionIndicator filled={isSectionFilled("thermisch", defaultValues, iconSet.size)} />
              <Thermometer className="h-4 w-4 text-red-400" />
              <span className="font-semibold">Thermisch & Sonstiges</span>
              <span className="text-xs text-muted-foreground ml-1">({(thermischGroup?.fields.length ?? 0) + (sonstigesGroup?.fields.length ?? 0)} Felder)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {thermischGroup?.fields.map((f) => (
                <FieldInput key={f.col} field={f} defaultValue={defaultValues[f.col]} />
              ))}
              {sonstigesGroup?.fields.map((f) => (
                <FieldInput key={f.col} field={f} defaultValue={defaultValues[f.col]} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Icons */}
        <AccordionItem value="icons" className="border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="flex items-center gap-2">
              <SectionIndicator filled={iconSet.size > 0} />
              <Palette className="h-4 w-4 text-primary" />
              <span className="font-semibold">Icons</span>
              {iconSet.size > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{iconSet.size}</span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <IconPicker icons={icons} selectedIds={iconSet} onToggle={toggleIcon} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="sticky bottom-0 z-40 -mx-6 px-6 py-3 border-t-2 border-primary/20 bg-background/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block">Produktdaten</p>
        <div className="flex gap-3 ml-auto">
          <Button asChild variant="outline" type="button"><a href="/produkte">Abbrechen</a></Button>
          <Button type="submit" size="lg" disabled={pending || uploading}>
            {pending ? "Speichere..." : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SectionIndicator({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${filled ? "bg-emerald-500" : "bg-gray-300"}`}
      aria-label={filled ? "Ausgefullt" : "Leer"}
    />
  );
}

function FieldInput({ field, defaultValue }: { field: { col: string; label: string; type: string; unit?: string }; defaultValue: any }) {
  const tooltip = FIELD_TOOLTIPS[field.col];
  if (field.type === "bool") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.col} className="inline-flex items-center gap-1.5">
          {field.label}
          {tooltip && <FieldInfo text={tooltip} />}
        </Label>
        <select id={field.col} name={field.col} defaultValue={defaultValue == null ? "" : String(defaultValue)} className="w-full rounded-lg border px-3 py-2 bg-background text-sm">
          <option value="">--</option>
          <option value="true">Ja</option>
          <option value="false">Nein</option>
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={field.col} className="text-xs inline-flex items-center gap-1.5">
        {field.label}
        {field.unit && <span className="text-muted-foreground">({field.unit})</span>}
        {tooltip && <FieldInfo text={tooltip} />}
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
