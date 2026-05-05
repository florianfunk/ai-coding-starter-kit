"use client";

import { useState } from "react";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KatalogDruckenDialog } from "@/components/katalog-drucken/katalog-drucken-dialog";
import type { TreeData, KundeContext } from "@/components/katalog-drucken/types";

type Props = {
  kundeContext: KundeContext;
  tree: TreeData;
  wechselkurs: number;
};

export function KundenQuickButtons({ kundeContext, tree, wechselkurs }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setWizardOpen(true)}>
        <Printer className="h-3.5 w-3.5" />
        Katalog drucken
      </Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button size="sm" variant="outline" disabled>
                <FileText className="h-3.5 w-3.5" />
                Datenblatt drucken
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Folge-Schritt — kommt mit dem Datenblatt-Render-Update.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <KatalogDruckenDialog
        tree={tree}
        wechselkurs={wechselkurs}
        kunde={kundeContext}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        hideTrigger
      />
    </>
  );
}
