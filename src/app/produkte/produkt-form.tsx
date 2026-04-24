"use client";

import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, Sun, Wrench, Thermometer, Image as ImageIcon, FileText, Palette, ChevronsUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { FieldInfo } from "@/components/field-info";
import { RichTextEditor } from "@/components/rich-text-editor";
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

const SECTION_META: Record<SectionId, { label: string; icon: LucideIcon; colorVar: string }> = {
  datenblatt: { label: "Datenblatt", icon: FileText, colorVar: "--violet" },
  elektrisch: { label: "Elektrotechnisch", icon: Zap, colorVar: "--warning" },
  lichttechnisch: { label: "Lichttechnisch", icon: Sun, colorVar: "--warning" },
  mechanisch: { label: "Mechanisch", icon: Wrench, colorVar: "--green" },
  thermisch: { label: "Thermisch & Sonstiges", icon: Thermometer, colorVar: "--destructive" },
  icons: { label: "Icons", icon: Palette, colorVar: "--primary" },
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

/** Count filled vs total fields per section, for the header progress bar */
function sectionProgress(sectionId: SectionId, defaultValues: Record<string, any>, iconCount: number) {
  const check = (v: unknown) => v != null && v !== "" && v !== false;
  if (sectionId === "icons") return { done: Math.min(iconCount, 10), total: 10 };
  if (sectionId === "datenblatt") {
    const keys = ["datenblatt_titel", "datenblatt_text", "datenblatt_text_2", "datenblatt_text_3"];
    return { done: keys.filter((k) => check(defaultValues[k])).length, total: keys.length };
  }
  const groupTabs = sectionId === "thermisch" ? ["thermisch", "sonstiges"] : [sectionId];
  let done = 0;
  let total = 0;
  for (const tab of groupTabs) {
    const group = PRODUKT_FIELD_GROUPS.find((g) => g.tab === tab);
    if (group) {
      total += group.fields.length;
      for (const f of group.fields) if (check(defaultValues[f.col])) done += 1;
    }
  }
  return { done, total };
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
  const [iconIds, setIconIds] = useState<string[]>(() => {
    const seen = new Set<string>();
    return defaultIconIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  });
  const [uploading, startUpload] = useTransition();
  const [openSections, setOpenSections] = useState<string[]>(loadOpenSections);
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());

  const isDirty = useCallback(
    (id: string) => dirtySections.has(id),
    [dirtySections],
  );

  const markDirty = useCallback((id: string) => {
    setDirtySections((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

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
    if (state.error === null && state !== initial && !pending) {
      toast.success("Gespeichert");
      setDirtySections(new Set());
    }
  }, [state, pending]);

  function handleHauptbild(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("produkt_id", produktId ?? "neu");
    startUpload(async () => {
      const r = await uploadProduktBild(fd);
      if (r.error) toast.error(r.error);
      else {
        setHauptbildPath(r.path);
        setHauptbildPreview(URL.createObjectURL(file));
        markDirty("base");
      }
    });
  }

  function toggleIcon(id: string) {
    setIconIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    markDirty("icons");
  }

  const thermischGroup = PRODUKT_FIELD_GROUPS.find((g) => g.tab === "thermisch");
  const sonstigesGroup = PRODUKT_FIELD_GROUPS.find((g) => g.tab === "sonstiges");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="hauptbild_path" value={hauptbildPath ?? ""} />

      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}

      {/* Grunddaten -- always visible, not collapsible */}
      <section
        id="section-base"
        className="glass-card"
        onInput={() => markDirty("base")}
        onChange={() => markDirty("base")}
      >
        <div className="card-head">
          <div className="card-head-icon"><FileText /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="card-head-title">Grunddaten</span>
              <span className="pill">Pflicht</span>
            </div>
            <div className="card-head-sub">
              Artikelnummer, Name, Bereich, Kategorie, Hauptbild
            </div>
          </div>
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("base")} />
        </div>
        <div className="p-5">
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
              <div className="flex h-32 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-border bg-muted/40">
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
        </div>
      </section>

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
        <AccordionItem
          id="section-datenblatt"
          value="datenblatt"
          className="glass-card overflow-hidden border-0 relative"
          onInput={() => markDirty("datenblatt")}
          onChange={() => markDirty("datenblatt")}
        >
          <AccordionTrigger className="card-head hover:no-underline pr-[112px]">
            <SectionHeader
              colorVar={SECTION_META.datenblatt.colorVar}
              Icon={FileText}
              label="Datenblatt"
              required
              progress={sectionProgress("datenblatt", defaultValues, iconIds.length)}
            />
          </AccordionTrigger>
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("datenblatt")} floating />
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="datenblatt_titel">Titel</Label>
                <Input id="datenblatt_titel" name="datenblatt_titel" defaultValue={defaultValues.datenblatt_titel ?? ""} className="text-base" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_text">Text Block 1</Label>
                  <RichTextEditor name="datenblatt_text" defaultValue={defaultValues.datenblatt_text ?? ""} minHeight={220} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_text_2">Text Block 2</Label>
                  <RichTextEditor name="datenblatt_text_2" defaultValue={defaultValues.datenblatt_text_2 ?? ""} minHeight={220} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_text_3">Text Block 3</Label>
                  <RichTextEditor name="datenblatt_text_3" defaultValue={defaultValues.datenblatt_text_3 ?? ""} minHeight={220} />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Elektrotechnisch, Lichttechnisch, Mechanisch */}
        {PRODUKT_FIELD_GROUPS.filter((g) => g.tab !== "thermisch" && g.tab !== "sonstiges").map((group) => {
          const meta = SECTION_META[group.tab as SectionId];
          if (!meta) return null;
          const progress = sectionProgress(group.tab as SectionId, defaultValues, iconIds.length);
          return (
            <AccordionItem
              key={group.tab}
              id={`section-${group.tab}`}
              value={group.tab}
              className="glass-card overflow-hidden border-0 relative"
              onInput={() => markDirty(group.tab)}
              onChange={() => markDirty(group.tab)}
            >
              <AccordionTrigger className="card-head hover:no-underline pr-[112px]">
                <SectionHeader colorVar={meta.colorVar} Icon={meta.icon} label={meta.label} progress={progress} />
              </AccordionTrigger>
              <SectionSaveButton pending={pending || uploading} dirty={isDirty(group.tab)} floating />
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {group.fields.map((f) => (
                    <FieldInput key={f.col} field={f} defaultValue={defaultValues[f.col]} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Thermisch & Sonstiges (merged) */}
        <AccordionItem
          id="section-thermisch"
          value="thermisch"
          className="glass-card overflow-hidden border-0 relative"
          onInput={() => markDirty("thermisch")}
          onChange={() => markDirty("thermisch")}
        >
          <AccordionTrigger className="card-head hover:no-underline pr-[112px]">
            <SectionHeader
              colorVar={SECTION_META.thermisch.colorVar}
              Icon={Thermometer}
              label="Thermisch & Sonstiges"
              progress={sectionProgress("thermisch", defaultValues, iconIds.length)}
            />
          </AccordionTrigger>
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("thermisch")} floating />
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
        <AccordionItem
          id="section-icons"
          value="icons"
          className="glass-card overflow-hidden border-0 relative"
          onInput={() => markDirty("icons")}
          onChange={() => markDirty("icons")}
        >
          <AccordionTrigger className="card-head hover:no-underline pr-[112px]">
            <SectionHeader
              colorVar={SECTION_META.icons.colorVar}
              Icon={Palette}
              label="Icons & Tags"
              progress={sectionProgress("icons", defaultValues, iconIds.length)}
              countBadge={iconIds.length}
            />
          </AccordionTrigger>
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("icons")} floating />
          <AccordionContent className="px-4 pb-4">
            <IconPicker
              icons={icons}
              selectedIds={iconIds}
              onToggle={toggleIcon}
              onReorder={setIconIds}
              showRemoveButtons
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end">
        <Button asChild variant="ghost" type="button" className="text-muted-foreground">
          <a href="/produkte">Abbrechen</a>
        </Button>
      </div>
    </form>
  );
}

/** Compact Save-Button for the dark section header.
 *  Triggers the parent form's submit. In Accordion items we render it
 *  `floating` (absolute, pinned to the top of the header bar) so it sits
 *  on the dark trigger strip without nesting a <button> inside another
 *  <button>. Only renders when the form has unsaved changes. */
function SectionSaveButton({
  pending,
  dirty,
  floating,
}: {
  pending: boolean;
  dirty: boolean;
  floating?: boolean;
}) {
  if (!dirty && !pending) return null;
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      className={`${
        floating ? "absolute right-3 top-2 z-10" : "shrink-0"
      } inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold tracking-[-0.003em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_0.5px_0_rgba(255,255,255,0.22)] transition-all hover:-translate-y-px hover:shadow-[0_4px_10px_rgba(217,4,22,0.35)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none`}
      style={{ background: "#D90416" }}
    >
      {pending ? "Speichere…" : "Speichern"}
    </button>
  );
}

function SectionHeader({
  Icon,
  label,
  progress,
  required,
  countBadge,
}: {
  colorVar?: string;
  Icon: LucideIcon;
  label: string;
  progress: { done: number; total: number };
  required?: boolean;
  countBadge?: number;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const stateColor = pct >= 100 ? "#193073" : pct >= 50 ? "#FFC10D" : "#D90416";
  const isEmpty = progress.done === 0;
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="card-head-icon"><Icon /></div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="card-head-title">{label}</span>
          {required && <span className="pill">Pflicht</span>}
          {isEmpty && <span className="pill pill-warn">Leer</span>}
          {countBadge != null && countBadge > 0 && (
            <span className="pill">{countBadge}</span>
          )}
        </div>
        <div className="card-head-sub font-mono">
          {progress.done} / {progress.total} Felder · {pct}%
        </div>
      </div>
      <div className="hidden w-[100px] shrink-0 sm:block">
        <div className="prog" style={{ height: 4, background: "rgba(255,255,255,0.15)" }}>
          <div
            className="prog-fill"
            style={{ width: `${pct}%`, background: stateColor }}
          />
        </div>
      </div>
    </div>
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
