"use client";

// PROJ-16 — Familienmitglieder-Karte: Liste + Dialog (Add/Edit) + Delete.
//
// Felder: name (required), rolle (Select: ehepartner/kind/eltern/sonstige),
// auch_geschaeftspartner (Checkbox), notiz (Textarea).
//
// Hinweis: Familien-Namen sind PII und werden NIE im Web nachgeschlagen
// (DSGVO). Das ist bereits in der Pipeline implementiert; hier nur Daten.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import {
  familieSchema,
  FAMILIE_ROLLEN,
  type FamilieInput,
  type FamilieRolle,
} from "@/lib/validation/profil";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export interface FamilieEintrag {
  id: string;
  name: string;
  name_normalisiert: string;
  rolle: FamilieRolle;
  auch_geschaeftspartner: boolean;
  notiz: string | null;
  updated_at: string;
}

const ROLLEN_LABEL: Record<FamilieRolle, string> = {
  ehepartner: "Ehepartner",
  kind: "Kind",
  eltern: "Eltern",
  sonstige: "Sonstige",
};

type FormValues = {
  name: string;
  rolle: FamilieRolle;
  auch_geschaeftspartner: boolean;
  notiz: string;
};

export function FamilieKarte({
  initial,
}: {
  initial: FamilieEintrag[];
}) {
  const [eintraege, setEintraege] = useState<FamilieEintrag[]>(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<FamilieEintrag | null>(null);
  const [loeschen, setLoeschen] = useState<FamilieEintrag | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/profil");
      const json = await res.json();
      if (res.ok && Array.isArray(json.familie)) {
        setEintraege(json.familie as FamilieEintrag[]);
      }
    } catch {
      // Stillschweigend.
    }
  }

  async function confirmLoeschen() {
    if (!loeschen) return;
    const e = loeschen;
    setLoeschen(null);
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/profil/familie/${e.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      toast.success("Familienmitglied gelöscht.");
      await reload();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setBusyId(null);
    }
  }

  const istLeer = eintraege.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Familienmitglieder</CardTitle>
          <CardDescription>
            Überweisungen an/von eingetragenen Personen werden als
            Privatentnahme/-einlage erkannt und nie im Web nachgeschlagen.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setBearbeiten(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Person
        </Button>
      </CardHeader>
      <CardContent>
        {istLeer ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Familienmitglieder eingetragen.
          </div>
        ) : (
          <ul className="divide-y">
            {eintraege.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.name}</span>
                    <Badge variant="secondary">{ROLLEN_LABEL[e.rolle]}</Badge>
                    {e.auch_geschaeftspartner && (
                      <Badge variant="outline">auch Geschäftspartner</Badge>
                    )}
                  </div>
                  {e.notiz && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {e.notiz}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Bearbeiten"
                    disabled={busyId === e.id}
                    onClick={() => {
                      setBearbeiten(e);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Löschen"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === e.id}
                    onClick={() => setLoeschen(e)}
                  >
                    {busyId === e.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <FamilieDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eintrag={bearbeiten}
        onSaved={() => reload()}
      />

      <AlertDialog
        open={loeschen !== null}
        onOpenChange={(o) => {
          if (!o) setLoeschen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Familienmitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{loeschen?.name}" wird endgültig entfernt. Bereits
              klassifizierte Buchungen bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLoeschen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function FamilieDialog({
  open,
  onOpenChange,
  eintrag,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eintrag: FamilieEintrag | null;
  onSaved: () => void;
}) {
  const istBearbeiten = eintrag !== null;
  const [submitting, setSubmitting] = useState(false);

  // Validation manuell via safeParse — kein zodResolver noetig.
  const form = useForm<FormValues>({
    defaultValues: toForm(eintrag),
    values: open ? toForm(eintrag) : undefined,
  });

  function toForm(e: FamilieEintrag | null): FormValues {
    return {
      name: e?.name ?? "",
      rolle: e?.rolle ?? "ehepartner",
      auch_geschaeftspartner: e?.auch_geschaeftspartner ?? false,
      notiz: e?.notiz ?? "",
    };
  }

  async function onSubmit(values: FormValues) {
    const payload: FamilieInput = {
      name: values.name,
      rolle: values.rolle,
      auch_geschaeftspartner: values.auch_geschaeftspartner,
      notiz: values.notiz || null,
    };
    const check = familieSchema.safeParse(payload);
    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? "Validierungsfehler.");
      return;
    }

    setSubmitting(true);
    try {
      const url = istBearbeiten
        ? `/api/profil/familie/${eintrag.id}`
        : "/api/profil/familie";
      const res = await fetch(url, {
        method: istBearbeiten ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      toast.success(
        istBearbeiten ? "Eintrag aktualisiert." : "Eintrag angelegt.",
      );
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {istBearbeiten
              ? "Familienmitglied bearbeiten"
              : "Neues Familienmitglied"}
          </DialogTitle>
          <DialogDescription>
            Hier eingetragene Personen werden als private Kontakte behandelt.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Anna Mustermann"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rolle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FAMILIE_ROLLEN.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLLEN_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="auch_geschaeftspartner"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Auch geschäftlicher Kontakt</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Diese Person ist auch geschäftlicher Kontakt — keine
                      automatische Privat-Klassifizierung.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notiz"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notiz (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Speichern…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
