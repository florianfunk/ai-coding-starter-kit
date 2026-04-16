"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, Trash2 } from "lucide-react";
import { deleteProdukt, duplicateProdukt } from "../actions";

export function ProduktTopActions({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="hover:bg-primary hover:text-primary-foreground transition-colors"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const r = await duplicateProdukt(id);
          if (r.error) toast.error(r.error);
          else { toast.success("Dupliziert"); if (r.id) router.push(`/produkte/${r.id}`); }
        })}
      >
        <Copy className="h-4 w-4 mr-1" /> Duplizieren
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-colors">
            <Trash2 className="h-4 w-4 mr-1" /> Löschen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produkt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Preise und Galeriebilder werden mit gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const r = await deleteProdukt(id);
                  if (r.error) toast.error(r.error);
                });
              }}
            >
              {pending ? "Lösche…" : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
