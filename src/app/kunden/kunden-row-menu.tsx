"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreVertical, Edit, Copy, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteKunde, duplicateKunde, setKundeStatus } from "./actions";

type Props = {
  kundeId: string;
  status: "aktiv" | "archiviert";
  firma: string;
};

export function KundenRowMenu({ kundeId, status, firma }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateKunde(kundeId);
      if (!result.ok || !result.kundeId) {
        toast.error(result.error ?? "Duplizieren fehlgeschlagen");
        return;
      }
      toast.success("Kunde dupliziert — bitte Firma ergänzen");
      router.push(`/kunden/${result.kundeId}/stammdaten`);
    });
  }

  function handleArchive() {
    const next = status === "aktiv" ? "archiviert" : "aktiv";
    startTransition(async () => {
      const result = await setKundeStatus(kundeId, next);
      if (!result.ok) {
        toast.error(result.error ?? "Status konnte nicht geändert werden");
        return;
      }
      toast.success(next === "archiviert" ? "Kunde archiviert" : "Kunde reaktiviert");
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteKunde(kundeId);
      if (!result.ok) {
        toast.error(result.error ?? "Löschen fehlgeschlagen");
        return;
      }
      toast.success("Kunde gelöscht");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Aktionen</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/kunden/${kundeId}/stammdaten`}>
              <Edit className="mr-2 h-4 w-4" />
              Bearbeiten
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplizieren
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchive}>
            {status === "aktiv" ? (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archivieren
              </>
            ) : (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Reaktivieren
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{firma}</strong> wird unwiderruflich gelöscht. Druckaufträge bleiben in
              der globalen Druckhistorie erhalten (ohne Kunden-Zuordnung).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
