import { Check, AlertTriangle, FileText, Edit3, Sparkles, Cpu, Zap, Tag, Bolt, Images, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { CompletenessResult } from "@/lib/completeness";
import { PRODUKT_FIELD_GROUPS } from "../fields";

function fieldsForTab(tab: string): string[] {
  return PRODUKT_FIELD_GROUPS.find((g) => g.tab === tab)?.fields.map((f) => f.col) ?? [];
}

type SectionStat = {
  id: string;
  label: string;
  icon: LucideIcon;
  done: number;
  total: number;
  /** True wenn die Section vom Pfleger als „alle Daten eingegeben" markiert wurde. */
  manualComplete?: boolean;
};

type Check = { ok: boolean; text: string; sub?: string };

type MetaRow = [label: string, value: string];

function sectionColorVar(pct: number) {
  if (pct >= 100) return "--green";
  if (pct >= 50) return "--warning";
  return "--destructive";
}

/** Compute section stats from the actual Produkt row + related counts.
 *  Sections, die in `produkt.vollstaendig_sections` stehen, werden als
 *  100 % gewertet (done = total), unabhängig von den tatsächlichen Werten. */
export function buildSectionStats(
  produkt: Record<string, unknown>,
  ctx: { hasActivePrice: boolean; iconCount: number; galerieCount: number; hasTemplate: boolean },
): SectionStat[] {
  const manualSections = new Set<string>(
    Array.isArray(produkt.vollstaendig_sections) ? (produkt.vollstaendig_sections as string[]) : [],
  );
  const isManual = (id: string) => manualSections.has(id);
  const val = (k: string) => {
    const v = produkt[k];
    return v != null && v !== "" && v !== false;
  };

  const base: Array<[string, boolean]> = [
    ["artikelnummer", val("artikelnummer")],
    ["name", val("name")],
    ["bereich_id", val("bereich_id")],
    ["kategorie_id", val("kategorie_id")],
    ["hauptbild_path", val("hauptbild_path")],
    ["active_price", ctx.hasActivePrice],
  ];
  const baseDone = base.filter(([, v]) => v).length;

  const datenblatt: Array<[string, boolean]> = [
    ["datenblatt_titel", val("datenblatt_titel")],
    ["datenblatt_text", val("datenblatt_text")],
    ["datenblatt_text_2", val("datenblatt_text_2")],
    ["datenblatt_text_3", val("datenblatt_text_3")],
    ["template", ctx.hasTemplate],
  ];
  const datenblattDone = datenblatt.filter(([, v]) => v).length;

  const datenblattBilder = [
    "bild_detail_1_path",
    "bild_detail_2_path",
    "bild_zeichnung_1_path",
    "bild_zeichnung_2_path",
    "bild_zeichnung_3_path",
    "bild_energielabel_path",
  ];
  const datenblattBilderDone = datenblattBilder.filter((k) => val(k)).length;

  // Feldlisten direkt aus fields.ts spiegeln, damit Form & Sidebar nie auseinanderlaufen.
  const elektrisch = fieldsForTab("elektrisch");
  const elektrischDone = elektrisch.filter((k) => val(k)).length;

  const lichttechnisch = fieldsForTab("lichttechnisch");
  const lichttechnischDone = lichttechnisch.filter((k) => val(k)).length;

  const mechanisch = fieldsForTab("mechanisch");
  const mechanischDone = mechanisch.filter((k) => val(k)).length;

  // Form merged „thermisch" + „sonstiges" in eine UI-Section (siehe produkt-form.tsx).
  const thermisch = [...fieldsForTab("thermisch"), ...fieldsForTab("sonstiges")];
  const thermischDone = thermisch.filter((k) => val(k)).length;

  return [
    { id: "base", label: "Grunddaten", icon: FileText, done: baseDone, total: base.length },
    {
      id: "datenblatt",
      label: "Datenblatt",
      icon: Edit3,
      done: isManual("datenblatt") ? datenblatt.length : datenblattDone,
      total: datenblatt.length,
      manualComplete: isManual("datenblatt"),
    },
    {
      id: "datenblatt-bilder",
      label: "Datenblatt-Bilder",
      icon: Images,
      done: isManual("datenblatt-bilder") ? datenblattBilder.length : datenblattBilderDone,
      total: datenblattBilder.length,
      manualComplete: isManual("datenblatt-bilder"),
    },
    {
      id: "elektrisch",
      label: "Elektrotechnik",
      icon: Bolt,
      done: isManual("elektrisch") ? elektrisch.length : elektrischDone,
      total: elektrisch.length,
      manualComplete: isManual("elektrisch"),
    },
    {
      id: "lichttechnisch",
      label: "Lichttechnik",
      icon: Sparkles,
      done: isManual("lichttechnisch") ? lichttechnisch.length : lichttechnischDone,
      total: lichttechnisch.length,
      manualComplete: isManual("lichttechnisch"),
    },
    {
      id: "mechanisch",
      label: "Mechanisch",
      icon: Cpu,
      done: isManual("mechanisch") ? mechanisch.length : mechanischDone,
      total: mechanisch.length,
      manualComplete: isManual("mechanisch"),
    },
    {
      id: "thermisch",
      label: "Thermisch & Sonstiges",
      icon: Zap,
      done: isManual("thermisch") ? thermisch.length : thermischDone,
      total: thermisch.length,
      manualComplete: isManual("thermisch"),
    },
    {
      id: "icons",
      label: "Icons & Tags",
      icon: Tag,
      done: isManual("icons") ? 10 : Math.min(ctx.iconCount, 10),
      total: 10,
      manualComplete: isManual("icons"),
    },
  ];
}

export function buildChecks(
  completeness: CompletenessResult,
  sections: SectionStat[],
  ctx: { galerieCount: number; hasTemplate: boolean },
): Check[] {
  const checks: Check[] = [];
  const missing = new Set(completeness.missing);

  checks.push({ ok: !missing.has("Artikelnummer"), text: "Artikelnummer eindeutig" });
  checks.push({ ok: !missing.has("Aktiver Preis"), text: "Preis aktuell" });

  const thermisch = sections.find((s) => s.id === "thermisch");
  if (thermisch && thermisch.done < thermisch.total) {
    checks.push({
      ok: thermisch.done > 0,
      text: "Thermik-Daten",
      sub: `${thermisch.done} / ${thermisch.total} Felder gepflegt`,
    });
  } else {
    checks.push({ ok: true, text: "Thermik-Daten erfasst" });
  }

  if (!ctx.hasTemplate) {
    checks.push({ ok: false, text: "Datenblatt-Vorlage fehlt", sub: "Keine Vorlage zugeordnet" });
  } else {
    checks.push({ ok: true, text: "Datenblatt-Vorlage gesetzt" });
  }

  if (ctx.galerieCount === 0) {
    checks.push({ ok: false, text: "Galerie leer", sub: "Mindestens 1 Bild empfohlen" });
  } else {
    checks.push({ ok: true, text: `Galerie · ${ctx.galerieCount} Bilder` });
  }

  return checks;
}

/** Right rail with TOC, checks, and metadata */
export async function ProduktRail({
  produktId,
  sections,
  checks,
  createdAt,
  updatedAt,
  produkt,
}: {
  produktId: string;
  sections: SectionStat[];
  checks: Check[];
  createdAt?: string | null;
  updatedAt?: string | null;
  produkt: Record<string, unknown>;
}) {
  // Get audit info for "last edited by"
  const supabase = await createClient();
  const { data: lastAudit } = await supabase
    .from("audit_log")
    .select("user_email, created_at")
    .eq("table_name", "produkte")
    .eq("record_id", produktId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const rows: MetaRow[] = [
    ["Erstellt", fmt(createdAt)],
    ["Zuletzt bearbeitet", lastAudit ? `${fmt(lastAudit.created_at)} · ${lastAudit.user_email ?? "System"}` : fmt(updatedAt)],
  ];
  if (produkt.zolltarifnummer) rows.push(["Zolltarifnummer", String(produkt.zolltarifnummer)]);
  if (produkt.gewicht_g) rows.push(["Gewicht", `${produkt.gewicht_g} g`]);
  if (produkt.verpackungseinheit) rows.push(["VPE", String(produkt.verpackungseinheit)]);

  return (
    <aside className="produkt-rail flex flex-col gap-3.5 self-start lg:sticky lg:top-[72px]">
      {/* TOC / Section nav */}
      <div className="glass-card p-4">
        <div className="eyebrow mb-2.5">Produktstruktur</div>
        <nav className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
            const colorVar = sectionColorVar(pct);
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#section-${s.id}`}
                className="flex items-center gap-2.5 rounded-[8px] px-1 py-1.5 transition-colors hover:bg-muted"
              >
                <div
                  className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px]"
                  style={{
                    background: `hsl(var(${colorVar}) / 0.18)`,
                    color: `hsl(var(${colorVar}))`,
                  }}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[12.5px] font-medium leading-tight">
                    <span className="truncate">{s.label}</span>
                    {s.manualComplete && (
                      <Check
                        className="h-3 w-3 shrink-0"
                        style={{ color: "hsl(var(--green))" }}
                        aria-label="Als vollständig markiert"
                      />
                    )}
                  </div>
                  <div className="font-mono text-[10.5px] tabular-nums text-muted-foreground/80">
                    {s.done}/{s.total}
                    {s.manualComplete && " · markiert"}
                  </div>
                </div>
                <div className="w-8">
                  <div className="prog" style={{ height: 3 }}>
                    <div
                      className="prog-fill"
                      style={{ width: `${pct}%`, background: `hsl(var(${colorVar}))` }}
                    />
                  </div>
                </div>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Validation / Checks */}
      <div className="glass-card p-4">
        <div className="eyebrow mb-2.5">Prüfungen</div>
        <div className="flex flex-col gap-0.5">
          {checks.map((it, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5">
              <div
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                style={{
                  background: it.ok
                    ? "hsl(var(--green) / 0.18)"
                    : "hsl(var(--warning) / 0.2)",
                  color: it.ok ? "hsl(var(--green))" : "hsl(var(--warning))",
                }}
              >
                {it.ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-foreground/90">{it.text}</div>
                {it.sub && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{it.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="glass-card p-4">
        <div className="eyebrow mb-2.5">Metadaten</div>
        <dl className="space-y-0">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex items-start justify-between gap-2.5 border-b border-dashed border-border/60 py-1.5 text-[12px] last:border-b-0"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-mono text-foreground/85 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
