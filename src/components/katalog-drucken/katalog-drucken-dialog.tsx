"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchrittParameter } from "./schritt-parameter";
import { SchrittInhalt } from "./schritt-inhalt";
import { useWizardDefaults } from "./use-wizard-defaults";
import { useTreeSelection } from "./use-tree-selection";
import { startKatalogWizardJob } from "./actions";
import type { TreeData, KundeContext } from "./types";

type Props = {
  tree: TreeData;
  wechselkurs: number;
  triggerLabel?: string;
  kunde?: KundeContext;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function KatalogDruckenDialog({
  tree,
  wechselkurs,
  triggerLabel = "Katalog drucken",
  kunde,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
}: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;

  const [tab, setTab] = useState<"parameter" | "inhalt">("parameter");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const { parameter, setParameter } = useWizardDefaults();
  const selection = useTreeSelection(tree);

  // Beim Öffnen mit Kunde: Defaults aus Kunden-Daten setzen + Whitelist anwenden
  useEffect(() => {
    if (!open || !kunde) return;
    setParameter(kunde.defaults);
    if (kunde.whitelistProduktIds === null) {
      selection.selectAll();
    } else {
      selection.setSelection(kunde.whitelistProduktIds);
    }
    // bewusst nur beim Öffnen einmalig — Nutzer-Änderungen sollen erhalten bleiben
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kunde?.id]);

  const noneSelected = selection.counts.selected === 0;

  function handleSubmit() {
    if (noneSelected) {
      toast.error("Bitte mindestens ein Produkt auswählen.");
      setTab("inhalt");
      return;
    }
    startTransition(async () => {
      const result = await startKatalogWizardJob({
        ...parameter,
        produktIds: selection.toJobValue(),
        kundeId: kunde?.id ?? null,
      });
      if (result.error || !result.jobId) {
        toast.error(result.error ?? "Job konnte nicht gestartet werden");
        return;
      }
      toast.success("Katalog wird generiert…");
      setOpen(false);
      router.push(kunde ? `/kunden/${kunde.id}/druckhistorie` : `/export/katalog`);
      router.refresh();
      // Render-Task fire-and-forget
      fetch(`/api/katalog-jobs/${result.jobId}/run`, { method: "POST" }).catch(() => {
        toast.error("Render-Task konnte nicht gestartet werden");
      });
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTab("parameter");
      setSearch("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Printer className="h-3.5 w-3.5" /> {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Katalog drucken
            {kunde && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · für {kunde.firma} ({kunde.kunden_nr})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {kunde
              ? "Parameter und Auswahl sind aus dem Kunden-Profil vorbefüllt — Anpassungen wirken nur auf diesen Druck."
              : "Parameter wählen, Inhalt eingrenzen, PDF erstellen."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parameter">1. Parameter</TabsTrigger>
            <TabsTrigger value="inhalt">2. Inhalt auswählen</TabsTrigger>
          </TabsList>

          <TabsContent value="parameter" className="pt-4">
            <SchrittParameter
              parameter={parameter}
              onChange={setParameter}
              wechselkurs={wechselkurs}
            />
          </TabsContent>

          <TabsContent value="inhalt" className="pt-4">
            <SchrittInhalt
              tree={tree}
              selection={selection}
              search={search}
              onSearchChange={setSearch}
            />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {selection.counts.selected} / {selection.counts.total} Produkte
            </span>{" "}
            in {selection.counts.bereiche} Bereichen und {selection.counts.kategorien} Kategorien
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {tab === "inhalt" && (
            <Button type="button" variant="outline" onClick={() => setTab("parameter")}>
              Zurück
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button" variant="ghost">Abbrechen</Button>
          </DialogClose>
          {tab === "parameter" ? (
            <Button type="button" onClick={() => setTab("inhalt")}>
              Weiter
            </Button>
          ) : (
            <Button type="button" disabled={pending || noneSelected} onClick={handleSubmit}>
              {pending ? "Starte…" : "PDF erstellen"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
