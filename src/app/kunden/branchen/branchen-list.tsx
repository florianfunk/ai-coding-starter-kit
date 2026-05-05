"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { createBranche, deleteBranche, updateBranche } from "../actions";

type Item = { id: string; name: string; count: number };

export function BranchenList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createBranche({ name: newName.trim() });
      if (!result.ok) {
        setError(result.error ?? result.fieldErrors?.name ?? "Anlegen fehlgeschlagen");
        return;
      }
      setNewName("");
      toast.success("Branche angelegt");
      router.refresh();
    });
  }

  function handleEdit(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      const result = await updateBranche(id, { name: editName.trim() });
      if (!result.ok) {
        toast.error(result.error ?? result.fieldErrors?.name ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Branche aktualisiert");
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteBranche(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error ?? "Löschen fehlgeschlagen");
        return;
      }
      toast.success("Branche gelöscht");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[240px]">
          <Input
            placeholder="Neue Branche (z. B. Gastronomie)"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            maxLength={80}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Button onClick={handleCreate} disabled={pending || !newName.trim()}>
          <Plus className="h-4 w-4" /> Anlegen
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Noch keine Branchen angelegt.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32 text-right">Anzahl Kunden</TableHead>
              <TableHead className="w-32 text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  {editingId === b.id ? (
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEdit(b.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={80}
                    />
                  ) : (
                    b.name
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {b.count}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === b.id ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(b.id)}
                        disabled={pending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        disabled={pending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(b.id);
                          setEditName(b.name);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(b)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Branche löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.count
                ? `"${deleteTarget.name}" wird von ${deleteTarget.count} Kunde${deleteTarget.count === 1 ? "" : "n"} genutzt — bitte zuerst dort entfernen.`
                : `"${deleteTarget?.name}" wird unwiderruflich gelöscht.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending || (deleteTarget?.count ?? 0) > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
