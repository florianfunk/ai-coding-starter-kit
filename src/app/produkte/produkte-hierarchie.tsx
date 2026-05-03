"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Box, Layers, Package } from "lucide-react";
import type { CompletenessResult } from "@/lib/completeness";
import { bildProxyUrl } from "@/lib/bild-url";

type ProduktItem = {
  id: string;
  artikelnummer: string;
  name: string | null;
  bereich_id: string;
  kategorie_id: string;
  hauptbild_path: string | null;
  artikel_bearbeitet: boolean;
};

type Bereich = { id: string; name: string };
type Kategorie = { id: string; name: string; bereich_id: string };

type Props = {
  produkte: ProduktItem[];
  bereiche: Bereich[];
  kategorien: Kategorie[];
  completenessMap: Record<string, CompletenessResult>;
  hasFilter: boolean;
};

export function ProdukteHierarchie({ produkte, bereiche, kategorien, completenessMap, hasFilter }: Props) {
  const [openBereiche, setOpenBereiche] = useState<string[]>(hasFilter ? bereiche.map((b) => b.id) : []);
  const [openKategorien, setOpenKategorien] = useState<string[]>(hasFilter ? kategorien.map((k) => k.id) : []);

  // Gruppieren: Bereich → Kategorie → Produkte
  const grouped = useMemo(() => {
    const byBereich = new Map<string, Map<string, ProduktItem[]>>();
    for (const p of produkte) {
      let bereichMap = byBereich.get(p.bereich_id);
      if (!bereichMap) {
        bereichMap = new Map();
        byBereich.set(p.bereich_id, bereichMap);
      }
      const list = bereichMap.get(p.kategorie_id) ?? [];
      list.push(p);
      bereichMap.set(p.kategorie_id, list);
    }
    return byBereich;
  }, [produkte]);

  const sichtbareBereiche = bereiche.filter((b) => grouped.has(b.id));

  if (sichtbareBereiche.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Box className="mx-auto mb-3 h-12 w-12 opacity-40" />
        <p className="text-lg font-semibold text-foreground">Keine Produkte</p>
        <p className="text-sm">
          {hasFilter ? "Keine Treffer im aktuellen Filter." : "Legen Sie Ihr erstes Produkt an, um loszulegen."}
        </p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" value={openBereiche} onValueChange={setOpenBereiche} className="divide-y divide-border/60">
      {sichtbareBereiche.map((b) => {
        const bereichMap = grouped.get(b.id)!;
        const totalProdukte = Array.from(bereichMap.values()).reduce((sum, l) => sum + l.length, 0);
        const totalKategorien = bereichMap.size;
        const sichtbareKategorien = kategorien.filter((k) => k.bereich_id === b.id && bereichMap.has(k.id));

        return (
          <AccordionItem key={b.id} value={b.id} className="border-0">
            <AccordionTrigger className="px-5 py-3 hover:no-underline hover:bg-muted/40">
              <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-[14.5px] font-semibold tracking-[-0.01em] truncate">{b.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {totalKategorien} {totalKategorien === 1 ? "Kat." : "Kat."}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="pill pill-accent">{totalProdukte}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <Accordion
                type="multiple"
                value={openKategorien}
                onValueChange={setOpenKategorien}
                className="border-t border-border/40"
              >
                {sichtbareKategorien.map((k) => {
                  const kProdukte = bereichMap.get(k.id) ?? [];
                  return (
                    <AccordionItem key={k.id} value={k.id} className="border-b border-border/40 last:border-b-0">
                      <AccordionTrigger className="bg-muted/20 px-8 py-2 text-[13px] hover:no-underline hover:bg-muted/40">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{k.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                            {kProdukte.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <ul className="divide-y divide-border/40 bg-background">
                          {kProdukte.map((p) => {
                            const compl = completenessMap[p.id];
                            const bildUrl = p.hauptbild_path ? bildProxyUrl("produktbilder", p.hauptbild_path) : null;
                            return (
                              <li key={p.id} className="group">
                                <Link
                                  href={`/produkte/${p.id}`}
                                  className="flex items-center gap-3 pl-12 pr-5 py-2 transition-colors hover:bg-muted/40"
                                >
                                  {bildUrl ? (
                                    <Image
                                      src={bildUrl}
                                      alt=""
                                      width={32}
                                      height={32}
                                      unoptimized
                                      className="h-8 w-8 rounded-[6px] border border-border/60 object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-border/60 bg-muted">
                                      <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                                    </div>
                                  )}
                                  <span className="font-mono text-[12px] text-muted-foreground tabular-nums shrink-0 w-24 truncate">
                                    {p.artikelnummer}
                                  </span>
                                  <span className="flex-1 truncate text-[13px] transition-colors group-hover:text-primary">
                                    {p.name ?? "—"}
                                  </span>
                                  {compl && (
                                    <span
                                      className={`shrink-0 font-mono text-[11px] tabular-nums ${
                                        compl.color === "green"
                                          ? "text-[hsl(var(--green))]"
                                          : compl.color === "yellow"
                                          ? "text-amber-500"
                                          : "text-destructive"
                                      }`}
                                    >
                                      {compl.percent}%
                                    </span>
                                  )}
                                  {p.artikel_bearbeitet ? (
                                    <span className="pill pill-ok shrink-0">bearbeitet</span>
                                  ) : (
                                    <span className="pill pill-bad shrink-0">unbearbeitet</span>
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
