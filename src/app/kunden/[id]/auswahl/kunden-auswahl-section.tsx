"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProduktTree } from "@/components/katalog-drucken/produkt-tree";
import { useTreeSelection } from "@/components/katalog-drucken/use-tree-selection";
import type { TreeData } from "@/components/katalog-drucken/types";
import { saveAuswahl } from "../../actions";

type Props = {
  kundeId: string;
  tree: TreeData;
  initialAlleProdukte: boolean;
  initialWhitelist: string[];
};

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function KundenAuswahlSection({
  kundeId,
  tree,
  initialAlleProdukte,
  initialWhitelist,
}: Props) {
  const router = useRouter();
  const [alleProdukte, setAlleProdukte] = useState(initialAlleProdukte);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const selection = useTreeSelection(tree);
  const { setSelection: applySelection, selectAll, selected } = selection;

  const initialWhitelistSet = useMemo(
    () => new Set(initialWhitelist),
    [initialWhitelist],
  );

  // Initiale Auswahl einmalig anwenden (DB-Whitelist oder bei alle_produkte=true: alle Tree-IDs)
  useEffect(() => {
    if (initialAlleProdukte) {
      selectAll();
    } else {
      applySelection(initialWhitelist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dirty wird live aus dem Vergleich abgeleitet — kein Effect, kein Drift.
  // Bei alle_produkte = Toggle-Zustand vergleichen, sonst Set-Inhalt.
  const dirty =
    alleProdukte !== initialAlleProdukte ||
    (!alleProdukte && !setsEqual(selected, initialWhitelistSet));

  function handleAlleToggle(value: boolean) {
    setAlleProdukte(value);
    if (value) selectAll();
  }

  function handleSave() {
    startTransition(async () => {
      const ids = selection.toJobValue() ?? [];
      const result = await saveAuswahl(kundeId, {
        alle_produkte: alleProdukte,
        produkt_ids: alleProdukte ? [] : ids,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Auswahl gespeichert");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Switch
              id="alle-produkte"
              checked={alleProdukte}
              onCheckedChange={handleAlleToggle}
            />
            <div>
              <Label htmlFor="alle-produkte" className="cursor-pointer">
                Alle Produkte aufnehmen (auch zukünftige)
              </Label>
              <p className="text-xs text-muted-foreground">
                Wenn aktiv: jede Neuanlage landet automatisch im Kunden-Sortiment.
                Tree wird ignoriert.
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!dirty || pending}>
            <Save className="h-4 w-4" />
            {pending ? "Speichere…" : "Auswahl speichern"}
          </Button>
        </CardContent>
      </Card>

      {!alleProdukte && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suche Artikelnr. oder Name…"
                  className="pl-8"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selection.selectAll}
              >
                Alle auswählen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selection.selectNone}
              >
                Alle abwählen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selection.invert}
              >
                Auswahl umkehren
              </Button>
            </div>
            <ProduktTree tree={tree} selection={selection} search={search} />
            <div className="border-t pt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {selection.counts.selected} / {selection.counts.total} Produkte
              </span>{" "}
              in {selection.counts.bereiche} Bereichen und{" "}
              {selection.counts.kategorien} Kategorien ausgewählt
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
