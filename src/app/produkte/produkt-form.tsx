"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, Sun, Wrench, Thermometer, FileText, Palette, ChevronsUpDown, Images, CheckCircle2, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { FieldInfo } from "@/components/field-info";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AITeaserButton } from "@/components/ai-teaser-button";
import { AiNamenButton, type AiNamenContext } from "@/components/ai-namen-button";
import { htmlToPlainText, isHtmlContent } from "@/lib/rich-text/sanitize";
import { type ProduktFormState } from "./actions";
import { ALL_PRODUKT_FIELDS, PRODUKT_FIELD_GROUPS } from "./fields";
import { ProduktBildSlot } from "./produkt-bild-slot";
import { ElektrischCalcButton } from "./elektrisch-calc-button";

type Marke = "lichtengros" | "eisenkeil";

export type DatenblattBildUrls = {
  bild_detail_1_path?: string | null;
  bild_detail_2_path?: string | null;
  bild_zeichnung_1_path?: string | null;
  bild_zeichnung_2_path?: string | null;
  bild_zeichnung_3_path?: string | null;
  bild_energielabel_path?: string | null;
};

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

const EMPTY_SET: ReadonlySet<string> = new Set();

const STORAGE_KEY = "produkt-form-sections";

const SECTION_IDS = ["datenblatt", "datenblatt-bilder", "elektrisch", "lichttechnisch", "mechanisch", "thermisch", "icons"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const DEFAULT_OPEN: SectionId[] = ["datenblatt"];

const SECTION_META: Record<SectionId, { label: string; icon: LucideIcon; colorVar: string }> = {
  datenblatt: { label: "Datenblatt", icon: FileText, colorVar: "--violet" },
  "datenblatt-bilder": { label: "Datenblatt-Bilder", icon: Images, colorVar: "--violet" },
  elektrisch: { label: "Elektrotechnisch", icon: Zap, colorVar: "--warning" },
  lichttechnisch: { label: "Lichttechnisch", icon: Sun, colorVar: "--warning" },
  mechanisch: { label: "Mechanisch", icon: Wrench, colorVar: "--green" },
  thermisch: { label: "Thermisch & Sonstiges", icon: Thermometer, colorVar: "--destructive" },
  icons: { label: "Icons", icon: Palette, colorVar: "--primary" },
};

const DATENBLATT_BILDER_KEYS = [
  "bild_detail_1_path",
  "bild_detail_2_path",
  "bild_zeichnung_1_path",
  "bild_zeichnung_2_path",
  "bild_zeichnung_3_path",
  "bild_energielabel_path",
] as const;

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

/** Count filled vs total fields per section, for the header progress bar.
 *  Wenn die Section in `manualComplete` steht, gilt sie als 100 % (done = total). */
function sectionProgress(
  sectionId: SectionId,
  defaultValues: Record<string, any>,
  iconCount: number,
  manualComplete: ReadonlySet<string>,
) {
  const check = (v: unknown) => v != null && v !== "" && v !== false;
  let total = 0;
  let done = 0;

  if (sectionId === "icons") {
    total = 10;
    done = Math.min(iconCount, 10);
  } else if (sectionId === "datenblatt") {
    const keys = ["datenblatt_titel", "info_kurz", "treiber", "datenblatt_text", "datenblatt_text_2", "datenblatt_text_3"];
    total = keys.length;
    done = keys.filter((k) => check(defaultValues[k])).length;
  } else if (sectionId === "datenblatt-bilder") {
    total = DATENBLATT_BILDER_KEYS.length;
    done = DATENBLATT_BILDER_KEYS.filter((k) => check(defaultValues[k])).length;
  } else {
    const groupTabs = sectionId === "thermisch" ? ["thermisch", "sonstiges"] : [sectionId];
    for (const tab of groupTabs) {
      const group = PRODUKT_FIELD_GROUPS.find((g) => g.tab === tab);
      if (group) {
        total += group.fields.length;
        for (const f of group.fields) if (check(defaultValues[f.col])) done += 1;
      }
    }
  }

  if (manualComplete.has(sectionId)) return { done: total, total };
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
  defaultIconWerte?: Record<string, string>;
  defaultHauptbildUrl?: string | null;
  defaultDatenblattBildUrls?: DatenblattBildUrls;
  produktId?: string;
  action: (prev: ProduktFormState, formData: FormData) => Promise<ProduktFormState>;
  submitLabel: string;
};

export function ProduktForm({
  bereiche, kategorien, icons,
  defaultValues = {}, defaultIconIds = [], defaultIconWerte = {},
  defaultHauptbildUrl = null, defaultDatenblattBildUrls = {},
  produktId,
  action, submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [bereichId, setBereichId] = useState<string>(defaultValues.bereich_id ?? "");
  const [kategorieId, setKategorieId] = useState<string>(defaultValues.kategorie_id ?? "");
  const [name, setName] = useState<string>(defaultValues.name ?? "");
  const [artikelnummer, setArtikelnummer] = useState<string>(defaultValues.artikelnummer ?? "");
  const [datenblattTitel, setDatenblattTitel] = useState<string>(defaultValues.datenblatt_titel ?? "");
  const [infoKurz, setInfoKurz] = useState<string>(defaultValues.info_kurz ?? "");
  const datenblattEditorRef = useRef<Editor | null>(null);
  const datenblattInitial = (defaultValues.datenblatt_text ?? "") as string;
  const datenblattContextRef = useRef<string>(datenblattInitial);

  const handleDatenblattReady = useCallback((editor: Editor) => {
    datenblattEditorRef.current = editor;
  }, []);

  function handleProduktTeaserAccept(text: string) {
    const html = `<p>${escapeProduktHtml(text)}</p>`;
    datenblattEditorRef.current?.commands.setContent(html, { emitUpdate: true });
    datenblattContextRef.current = text;
    markDirty("datenblatt");
    toast.success("Teaser übernommen");
  }
  const [iconIds, setIconIds] = useState<string[]>(() => {
    const seen = new Set<string>();
    return defaultIconIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  });
  const [iconWerte, setIconWerte] = useState<Record<string, string>>(() => ({ ...defaultIconWerte }));
  const marken = useMemo<Marke[]>(() => {
    const raw = defaultValues.marken;
    if (Array.isArray(raw) && raw.length) {
      const filtered = raw.filter((m): m is Marke => m === "lichtengros" || m === "eisenkeil");
      if (filtered.length) return filtered;
    }
    return ["lichtengros"];
  }, [defaultValues.marken]);
  const [uploading] = useTransition();
  const [openSections, setOpenSections] = useState<string[]>(loadOpenSections);
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());

  // Manuell als „alle Daten eingegeben" markierte Sections.
  // Wirken in der UI sofort als 100 %; werden beim Submit als
  // formData.getAll("vollstaendig_sections") in die DB geschrieben.
  const [manualComplete, setManualComplete] = useState<Set<SectionId>>(() => {
    const raw = defaultValues.vollstaendig_sections;
    if (!Array.isArray(raw)) return new Set();
    return new Set(
      raw.filter((id): id is SectionId =>
        SECTION_IDS.includes(id as SectionId),
      ),
    );
  });

  /** Roher Section-Progress ohne Markierungs-Effekt — für den Toggle. */
  const rawProgress = useCallback(
    (id: SectionId) => sectionProgress(id, defaultValues, iconIds.length, EMPTY_SET),
    [defaultValues, iconIds.length],
  );

  const toggleManualComplete = useCallback((id: SectionId) => {
    setManualComplete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Markierung ändert den DB-Wert → Section ist dirty
    setDirtySections((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

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

  const setIconWert = useCallback((id: string, value: string) => {
    setIconWerte((prev) => {
      if ((prev[id] ?? "") === value) return prev;
      const next = { ...prev };
      if (value.length === 0) delete next[id];
      else next[id] = value;
      return next;
    });
    markDirty("icons");
  }, [markDirty]);

  const filteredKategorien = useMemo(
    () => kategorien.filter((k) => !bereichId || k.bereich_id === bereichId),
    [kategorien, bereichId],
  );

  const getNamenContext = useCallback((): AiNamenContext => {
    const bereich = bereiche.find((b) => b.id === bereichId);
    const kategorie = kategorien.find((k) => k.id === kategorieId);
    const tech: Record<string, string> = {};
    for (const f of ALL_PRODUKT_FIELDS) {
      const v = defaultValues[f.col];
      if (v == null) continue;
      const s = String(v).trim();
      if (!s || s === "false") continue;
      const label = f.unit ? `${f.label} (${f.unit})` : f.label;
      tech[label] = s;
    }
    return {
      artikelnummer,
      bereichName: bereich?.name ?? null,
      kategorieName: kategorie?.name ?? null,
      infoKurz: infoKurz || null,
      technischeDaten: Object.keys(tech).length > 0 ? tech : null,
    };
  }, [artikelnummer, bereichId, kategorieId, infoKurz, bereiche, kategorien, defaultValues]);

  const handleAcceptBezeichnung = useCallback((value: string) => {
    setName(value);
    markDirty("base");
  }, [markDirty]);

  const handleAcceptTitel = useCallback((value: string) => {
    setDatenblattTitel(value);
    markDirty("datenblatt");
  }, [markDirty]);

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

  /** Sidebar-Link auf eine zugeklappte Section: erst Accordion öffnen,
   *  dann sauber zum Header scrollen (das CSS scroll-margin-top greift). */
  useEffect(() => {
    function ensureSectionOpen(hash: string) {
      const m = hash.match(/^#section-(.+)$/);
      if (!m) return;
      const id = m[1];
      if (!SECTION_IDS.includes(id as SectionId)) return; // base etc. nicht collapsible
      setOpenSections((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveOpenSections(next);
        return next;
      });
      // Nach dem Re-Render erneut scrollen — der initiale Browser-Scroll
      // landet sonst auf dem zugeklappten Header.
      requestAnimationFrame(() => {
        const el = document.getElementById(`section-${id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const link = target?.closest('a[href^="#section-"]') as HTMLAnchorElement | null;
      if (!link) return;
      ensureSectionOpen(link.getAttribute("href") ?? "");
    }

    function onHashChange() {
      ensureSectionOpen(window.location.hash);
    }

    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHashChange);
    // Initial: falls die Seite mit Hash geladen wurde
    if (window.location.hash) ensureSectionOpen(window.location.hash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  function toggleIcon(id: string) {
    setIconIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // Abwahl: zugehörigen Wert verwerfen
    setIconWerte((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    markDirty("icons");
  }

  const thermischGroup = PRODUKT_FIELD_GROUPS.find((g) => g.tab === "thermisch");
  const sonstigesGroup = PRODUKT_FIELD_GROUPS.find((g) => g.tab === "sonstiges");

  return (
    <form action={formAction} className="space-y-6">
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
              <Input
                id="artikelnummer"
                name="artikelnummer"
                required
                value={artikelnummer}
                onChange={(e) => setArtikelnummer(e.target.value)}
                className="font-mono text-base"
              />
              {state.fieldErrors?.artikelnummer && <p className="text-sm text-destructive">{state.fieldErrors.artikelnummer}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="name">Bezeichnung</Label>
                <AiNamenButton
                  getContext={getNamenContext}
                  onAcceptBezeichnung={handleAcceptBezeichnung}
                  onAcceptTitel={handleAcceptTitel}
                />
              </div>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortierung">Sortierung</Label>
              <Input id="sortierung" name="sortierung" type="number" defaultValue={String(defaultValues.sortierung ?? 0)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bereich_id">Bereich *</Label>
              <select
                id="bereich_id"
                name="bereich_id"
                required
                value={bereichId}
                onChange={(e) => {
                  const next = e.target.value;
                  setBereichId(next);
                  if (kategorieId && !kategorien.some((k) => k.id === kategorieId && k.bereich_id === next)) {
                    setKategorieId("");
                  }
                }}
                className="w-full rounded-lg border px-3 py-2 bg-background text-sm"
              >
                <option value="" disabled>-- wahlen --</option>
                {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kategorie_id">Kategorie *</Label>
              <select
                id="kategorie_id"
                name="kategorie_id"
                required
                value={kategorieId}
                onChange={(e) => setKategorieId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 bg-background text-sm"
              >
                <option value="" disabled>-- wahlen --</option>
                {filteredKategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Switch id="artikel_bearbeitet" name="artikel_bearbeitet" defaultChecked={defaultValues.artikel_bearbeitet ?? false} />
            <Label htmlFor="artikel_bearbeitet">Artikel bearbeitet</Label>
          </div>

          {/* Marken werden intern als "lichtengros" gesetzt; keine UI-Auswahl */}
          {marken.map((m) => <input key={m} type="hidden" name="marken" value={m} />)}

          <div className="mt-4">
            <ProduktBildSlot
              name="hauptbild_path"
              label="Hauptbild"
              column="hauptbild_path"
              produktId={produktId}
              defaultPath={defaultValues.hauptbild_path ?? null}
              defaultUrl={defaultHauptbildUrl}
              size="lg"
              onDirty={() => markDirty("base")}
            />
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
          <AccordionTrigger className="card-head hover:no-underline pr-[260px]">
            <SectionHeader
              colorVar={SECTION_META.datenblatt.colorVar}
              Icon={FileText}
              label="Datenblatt"
              required
              progress={sectionProgress("datenblatt", defaultValues, iconIds.length, manualComplete)}
              rawDone={rawProgress("datenblatt").done}
              manuallyComplete={manualComplete.has("datenblatt")}
            />
          </AccordionTrigger>
          <SectionCompleteToggle
            active={manualComplete.has("datenblatt")}
            onToggle={() => toggleManualComplete("datenblatt")}
            fieldsFilled={rawProgress("datenblatt").done}
            fieldsTotal={rawProgress("datenblatt").total}
          />
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("datenblatt")} floating />
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datenblatt_titel">Titel</Label>
                  <Input
                    id="datenblatt_titel"
                    name="datenblatt_titel"
                    value={datenblattTitel}
                    onChange={(e) => setDatenblattTitel(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="info_kurz">
                    Info-Zeile
                    <span className="ml-1 text-xs text-muted-foreground">(unter der Artikelnummer)</span>
                  </Label>
                  <Input
                    id="info_kurz"
                    name="info_kurz"
                    value={infoKurz}
                    onChange={(e) => setInfoKurz(e.target.value)}
                    placeholder="z. B. STEPLIGHT 3W 2700K 124lm CRI90 IP65 inkl. TRAFO N.DIM.-WEISS"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="treiber">Treiber</Label>
                <Textarea
                  id="treiber"
                  name="treiber"
                  defaultValue={defaultValues.treiber ?? ""}
                  placeholder="z. B. inkl. Treiber 24V DC, 30W, dimmbar"
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="datenblatt_text">Text Block 1</Label>
                    <AITeaserButton
                      entityType="produkt"
                      entityName={name || artikelnummer}
                      entityContext={
                        datenblattContextRef.current
                          ? isHtmlContent(datenblattContextRef.current)
                            ? htmlToPlainText(datenblattContextRef.current)
                            : datenblattContextRef.current
                          : (defaultValues.info_kurz as string | null) ?? null
                      }
                      onAccept={handleProduktTeaserAccept}
                    />
                  </div>
                  <RichTextEditor
                    name="datenblatt_text"
                    defaultValue={defaultValues.datenblatt_text ?? ""}
                    onEditorReady={handleDatenblattReady}
                    minHeight={220}
                  />
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

        {/* Datenblatt-Bilder (PROJ-36) */}
        <AccordionItem
          id="section-datenblatt-bilder"
          value="datenblatt-bilder"
          className="glass-card overflow-hidden border-0 relative"
          onInput={() => markDirty("datenblatt-bilder")}
          onChange={() => markDirty("datenblatt-bilder")}
        >
          <AccordionTrigger className="card-head hover:no-underline pr-[260px]">
            <SectionHeader
              colorVar={SECTION_META["datenblatt-bilder"].colorVar}
              Icon={Images}
              label="Datenblatt-Bilder"
              progress={sectionProgress("datenblatt-bilder", defaultValues, iconIds.length, manualComplete)}
              rawDone={rawProgress("datenblatt-bilder").done}
              manuallyComplete={manualComplete.has("datenblatt-bilder")}
            />
          </AccordionTrigger>
          <SectionCompleteToggle
            active={manualComplete.has("datenblatt-bilder")}
            onToggle={() => toggleManualComplete("datenblatt-bilder")}
            fieldsFilled={rawProgress("datenblatt-bilder").done}
            fieldsTotal={rawProgress("datenblatt-bilder").total}
          />
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("datenblatt-bilder")} floating />
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <ProduktBildSlot
                    name="bild_detail_1_path"
                    label="Detail-Bild 1"
                    column="bild_detail_1_path"
                    produktId={produktId}
                    defaultPath={defaultValues.bild_detail_1_path ?? null}
                    defaultUrl={defaultDatenblattBildUrls.bild_detail_1_path ?? null}
                    onDirty={() => markDirty("datenblatt-bilder")}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="bild_detail_1_text" className="text-xs">Detail-Text 1</Label>
                    <Textarea
                      id="bild_detail_1_text"
                      name="bild_detail_1_text"
                      defaultValue={defaultValues.bild_detail_1_text ?? ""}
                      rows={2}
                      maxLength={500}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <ProduktBildSlot
                    name="bild_detail_2_path"
                    label="Detail-Bild 2"
                    column="bild_detail_2_path"
                    produktId={produktId}
                    defaultPath={defaultValues.bild_detail_2_path ?? null}
                    defaultUrl={defaultDatenblattBildUrls.bild_detail_2_path ?? null}
                    onDirty={() => markDirty("datenblatt-bilder")}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="bild_detail_2_text" className="text-xs">Detail-Text 2</Label>
                    <Textarea
                      id="bild_detail_2_text"
                      name="bild_detail_2_text"
                      defaultValue={defaultValues.bild_detail_2_text ?? ""}
                      rows={2}
                      maxLength={500}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bild_detail_3_text" className="text-xs">
                  Detail-Text 3
                  <span className="ml-1 text-muted-foreground">(erscheint neben Zeichnung 1 im PDF)</span>
                </Label>
                <Textarea
                  id="bild_detail_3_text"
                  name="bild_detail_3_text"
                  defaultValue={defaultValues.bild_detail_3_text ?? ""}
                  rows={2}
                  maxLength={500}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ProduktBildSlot
                  name="bild_zeichnung_1_path"
                  label="Zeichnung 1"
                  column="bild_zeichnung_1_path"
                  produktId={produktId}
                  defaultPath={defaultValues.bild_zeichnung_1_path ?? null}
                  defaultUrl={defaultDatenblattBildUrls.bild_zeichnung_1_path ?? null}
                  onDirty={() => markDirty("datenblatt-bilder")}
                />
                <ProduktBildSlot
                  name="bild_zeichnung_2_path"
                  label="Zeichnung 2"
                  column="bild_zeichnung_2_path"
                  produktId={produktId}
                  defaultPath={defaultValues.bild_zeichnung_2_path ?? null}
                  defaultUrl={defaultDatenblattBildUrls.bild_zeichnung_2_path ?? null}
                  onDirty={() => markDirty("datenblatt-bilder")}
                />
                <ProduktBildSlot
                  name="bild_zeichnung_3_path"
                  label="Zeichnung 3"
                  column="bild_zeichnung_3_path"
                  produktId={produktId}
                  defaultPath={defaultValues.bild_zeichnung_3_path ?? null}
                  defaultUrl={defaultDatenblattBildUrls.bild_zeichnung_3_path ?? null}
                  onDirty={() => markDirty("datenblatt-bilder")}
                />
              </div>

              <div className="border-t pt-4">
                <ProduktBildSlot
                  name="bild_energielabel_path"
                  label="Energielabel-Bild"
                  column="bild_energielabel_path"
                  produktId={produktId}
                  defaultPath={defaultValues.bild_energielabel_path ?? null}
                  defaultUrl={defaultDatenblattBildUrls.bild_energielabel_path ?? null}
                  onDirty={() => markDirty("datenblatt-bilder")}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Elektrotechnisch, Lichttechnisch, Mechanisch */}
        {PRODUKT_FIELD_GROUPS.filter((g) => g.tab !== "thermisch" && g.tab !== "sonstiges").map((group) => {
          const meta = SECTION_META[group.tab as SectionId];
          if (!meta) return null;
          const progress = sectionProgress(group.tab as SectionId, defaultValues, iconIds.length, manualComplete);
          return (
            <AccordionItem
              key={group.tab}
              id={`section-${group.tab}`}
              value={group.tab}
              className="glass-card overflow-hidden border-0 relative"
              onInput={() => markDirty(group.tab)}
              onChange={() => markDirty(group.tab)}
            >
              <AccordionTrigger className="card-head hover:no-underline pr-[260px]">
                <SectionHeader
                  colorVar={meta.colorVar}
                  Icon={meta.icon}
                  label={meta.label}
                  progress={progress}
                  rawDone={rawProgress(group.tab as SectionId).done}
                  manuallyComplete={manualComplete.has(group.tab as SectionId)}
                />
              </AccordionTrigger>
              <SectionCompleteToggle
                active={manualComplete.has(group.tab as SectionId)}
                onToggle={() => toggleManualComplete(group.tab as SectionId)}
                fieldsFilled={rawProgress(group.tab as SectionId).done}
                fieldsTotal={rawProgress(group.tab as SectionId).total}
              />
              <SectionSaveButton pending={pending || uploading} dirty={isDirty(group.tab)} floating />
              <AccordionContent className="px-4 pb-4">
                {group.tab === "elektrisch" && (
                  <div className="mb-3 flex justify-end">
                    <ElektrischCalcButton />
                  </div>
                )}
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
          <AccordionTrigger className="card-head hover:no-underline pr-[260px]">
            <SectionHeader
              colorVar={SECTION_META.thermisch.colorVar}
              Icon={Thermometer}
              label="Thermisch & Sonstiges"
              progress={sectionProgress("thermisch", defaultValues, iconIds.length, manualComplete)}
              rawDone={rawProgress("thermisch").done}
              manuallyComplete={manualComplete.has("thermisch")}
            />
          </AccordionTrigger>
          <SectionCompleteToggle
            active={manualComplete.has("thermisch")}
            onToggle={() => toggleManualComplete("thermisch")}
            fieldsFilled={rawProgress("thermisch").done}
            fieldsTotal={rawProgress("thermisch").total}
          />
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
          <AccordionTrigger className="card-head hover:no-underline pr-[260px]">
            <SectionHeader
              colorVar={SECTION_META.icons.colorVar}
              Icon={Palette}
              label="Icons & Tags"
              progress={sectionProgress("icons", defaultValues, iconIds.length, manualComplete)}
              rawDone={rawProgress("icons").done}
              manuallyComplete={manualComplete.has("icons")}
              countBadge={iconIds.length}
            />
          </AccordionTrigger>
          <SectionCompleteToggle
            active={manualComplete.has("icons")}
            onToggle={() => toggleManualComplete("icons")}
            fieldsFilled={rawProgress("icons").done}
            fieldsTotal={rawProgress("icons").total}
          />
          <SectionSaveButton pending={pending || uploading} dirty={isDirty("icons")} floating />
          <AccordionContent className="px-4 pb-4">
            <IconPicker
              icons={icons}
              selectedIds={iconIds}
              onToggle={toggleIcon}
              onReorder={setIconIds}
              showRemoveButtons
              values={iconWerte}
              onValueChange={setIconWert}
            />
            {/* Hidden inputs für Icon-Werte (Key: icon_wert__<iconId>) */}
            {iconIds.map((id) =>
              iconWerte[id] ? (
                <input
                  key={`wert-${id}`}
                  type="hidden"
                  name={`icon_wert__${id}`}
                  value={iconWerte[id]}
                />
              ) : null,
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Manuell als „vollständig" markierte Sections — wird via getAll() gelesen */}
      {Array.from(manualComplete).map((id) => (
        <input key={id} type="hidden" name="vollstaendig_sections" value={id} />
      ))}
    </form>
  );
}

/** Compact Save-Button for the dark section header.
 *  Triggers the parent form's submit. In Accordion items we render it
 *  `floating` (absolute, pinned to the top of the header bar) so it sits
 *  on the dark trigger strip without nesting a <button> inside another
 *  <button>. Only renders when the form has unsaved changes. */
/**
 * Toggle-Button im Section-Header: markiert die Section als „alle Daten
 * eingegeben". Wirkt sich sofort auf den Section-Progress (100 %) und nach
 * dem Speichern auf die globale Completeness aus.
 *
 * Wird ausgeblendet, wenn die Section ohne Markierung schon zu 100 % gefüllt
 * ist — dann ist nichts zu markieren. Ist die Markierung aktiv, bleibt der
 * Button immer sichtbar, damit man sie auch wieder entfernen kann.
 */
function SectionCompleteToggle({
  active,
  onToggle,
  fieldsFilled,
  fieldsTotal,
}: {
  active: boolean;
  onToggle: () => void;
  /** Anzahl tatsächlich gefüllter Felder (ohne Markierung gerechnet). */
  fieldsFilled: number;
  /** Gesamtzahl der Felder dieser Section. */
  fieldsTotal: number;
}) {
  if (!active && fieldsFilled >= fieldsTotal && fieldsTotal > 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      title={active ? "Markierung 'Alle Daten eingegeben' entfernen" : "Als 'alle Daten eingegeben' markieren"}
      aria-pressed={active}
      className={`absolute right-[124px] top-2 z-10 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold tracking-[-0.003em] transition-all ${
        active
          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
          : "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{active ? "Vollständig" : "Als vollständig"}</span>
    </button>
  );
}

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
  rawDone,
  required,
  countBadge,
  manuallyComplete,
}: {
  colorVar?: string;
  Icon: LucideIcon;
  label: string;
  progress: { done: number; total: number };
  /** Tatsächlich gefüllte Felder (vor Manual-Complete-Override). */
  rawDone?: number;
  required?: boolean;
  countBadge?: number;
  manuallyComplete?: boolean;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const stateColor = pct >= 100 ? "#193073" : pct >= 50 ? "#FFC10D" : "#D90416";
  const realDone = rawDone ?? progress.done;
  const isEmpty = realDone === 0 && !manuallyComplete;
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="card-head-icon"><Icon /></div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="card-head-title">{label}</span>
          {required && <span className="pill">Pflicht</span>}
          {isEmpty && <span className="pill pill-warn">Leer</span>}
          {manuallyComplete && (
            <span className="pill pill-warn" title="Als vollständig markiert, obwohl Felder leer sind">
              markiert
            </span>
          )}
          {countBadge != null && countBadge > 0 && (
            <span className="pill">{countBadge}</span>
          )}
        </div>
        <div className="card-head-sub font-mono">
          {manuallyComplete && rawDone !== undefined && rawDone < progress.total
            ? `${rawDone} / ${progress.total} Felder · markiert`
            : `${progress.done} / ${progress.total} Felder · ${pct}%`}
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

function escapeProduktHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
