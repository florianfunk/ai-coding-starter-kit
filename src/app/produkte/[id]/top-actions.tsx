"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteProdukt, duplicateProdukt } from "../actions";

export function ProduktTopActions({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const r = await duplicateProdukt(id);
          if (r.error) toast.error(r.error);
          else { toast.success("Dupliziert"); if (r.id) router.push(`/produkte/${r.id}`); }
        })}
      >Duplizieren</Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Löschen</Button>
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
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const r = await deleteProdukt(id);
                  if (r.error) toast.error(r.error);
                });
              }}
            >Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
