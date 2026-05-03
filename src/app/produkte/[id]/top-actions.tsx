"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { deleteProdukt, duplicateProdukt } from "../actions";

interface ProduktTopActionsProps {
  id: string;
  artikelnummer?: string;
}

export function ProduktTopActions({ id, artikelnummer }: ProduktTopActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [delPending, startDelTransition] = useTransition();
  const [dupPending, startDupTransition] = useTransition();

  const pending = delPending || dupPending;
  const displayName = artikelnummer ?? id;

  return (
    <div className="flex gap-2">
      {/* Duplizieren */}
      <AlertDialog open={dupOpen} onOpenChange={setDupOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
            disabled={pending}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Duplizieren
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produkt duplizieren?</AlertDialogTitle>
            <AlertDialogDescription>
              &laquo;{displayName}&raquo; wird dupliziert. Preise werden nicht &uuml;bernommen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dupPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={dupPending}
              onClick={(e) => {
                e.preventDefault();
                startDupTransition(async () => {
                  const r = await duplicateProdukt(id);
                  if (r.error) {
                    toast.error(r.error);
                    setDupOpen(false);
                  } else {
                    toast.success("Produkt dupliziert");
                    setDupOpen(false);
                    if (r.id) router.push(`/produkte/${r.id}`);
                  }
                });
              }}
            >
              {dupPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Dupliziere&hellip;
                </>
              ) : (
                "Duplizieren"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* L&ouml;schen */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-colors" disabled={pending}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> L&ouml;schen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produkt l&ouml;schen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Preise und Galeriebilder werden mit gel&ouml;scht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={delPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                startDelTransition(async () => {
                  const r = await deleteProdukt(id);
                  if (r.error) toast.error(r.error);
                });
              }}
            >
              {delPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> L&ouml;sche&hellip;
                </>
              ) : (
                <>Endg&uuml;ltig l&ouml;schen</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
