"use client";

// PROJ-16 — Arbeitgeber-Karte: Liste + Dialog (Add/Edit) + Delete.
//
// Felder: name (required), aktiv_von, aktiv_bis (optional), notiz (optional).
// Nach erfolgreichem Speichern eines NEUEN Eintrags zeigt das Backend ggf.
// einen `lernregel_vorschlag` zurueck — wir fragen den Nutzer per Toast,
// ob die Lernregel automatisch angelegt werden soll (POST /api/regeln).

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { format, parse } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { arbeitgeberSchema, type ArbeitgeberInput } from "@/lib/validation/profil";
import { Button } from "@/components/ui/button";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";

export interface ArbeitgeberEintrag {
  id: string;
  name: string;
  name_normalisiert: string;
  aktiv_von: string | null;
  aktiv_bis: string | null;
  notiz: string | null;
  updated_at: string;
}

interface LernregelVorschlag {
  empfaenger_muster: string;
  vorgeschlagene_kategorie_id: string;
  vorgeschlagene_kategorie_bezeichnung: string;
  klassifikation: "privat";
  prioritaet: number;
}

type FormValues = {
  name: string;
  aktiv_von: string;
  aktiv_bis: string;
  notiz: string;
};

function toIso(d: Date | undefined): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}
function fromIso(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  return parse(s, "yyyy-MM-dd", new Date());
}

export function ArbeitgeberKarte({
  initial,
}: {
  initial: ArbeitgeberEintrag[];
}) {
  const [eintraege, setEintraege] = useState<ArbeitgeberEintrag[]>(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<ArbeitgeberEintrag | null>(null);
  const [loeschen, setLoeschen] = useState<ArbeitgeberEintrag | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<LernregelVorschlag | null>(null);
  const [vorschlagBusy, setVorschlagBusy] = useState(false);

  async function reload() {
    try {
      const res = await fetch("/api/profil");
      const json = await res.json();
      if (res.ok && Array.isArray(json.arbeitgeber)) {
        setEintraege(json.arbeitgeber as ArbeitgeberEintrag[]);
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
      const res = await fetch(`/api/profil/arbeitgeber/${e.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      toast.success("Arbeitgeber gelöscht.");
      await reload();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setBusyId(null);
    }
  }

  async function annehmenLernregel() {
    if (!vorschlag) return;
    setVorschlagBusy(true);
    try {
      const payload = {
        bezeichnung: `Arbeitgeber: ${vorschlag.empfaenger_muster} → ${vorschlag.vorgeschlagene_kategorie_bezeichnung}`,
        bedingung: { empfaenger_muster: vorschlag.empfaenger_muster },
        aktion: {
          kategorie_id: vorschlag.vorgeschlagene_kategorie_id,
          klassifikation: vorschlag.klassifikation,
        },
        prioritaet: vorschlag.prioritaet,
        aktiv: true,
      };
      const res = await fetch("/api/regeln", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Lernregel konnte nicht angelegt werden.");
        return;
      }
      toast.success("Lernregel angelegt.");
      setVorschlag(null);
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setVorschlagBusy(false);
    }
  }

  const istLeer = eintraege.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Arbeitgeber</CardTitle>
          <CardDescription>
            Buchungen von eingetragenen Arbeitgebern werden als Privat-Gehalt
            erkannt (klassifikation „privat").
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setBearbeiten(null);
            setDialogOpen(true);
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Arbeitgeber
        </Button>
      </CardHeader>
      <CardContent>
        {istLeer ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Arbeitgeber eingetragen.
          </div>
        ) : (
          <ul className="divide-y">
            {eintraege.map((e) => {
              const zeitraum = formatiereZeitraum(e.aktiv_von, e.aktiv_bis);
              return (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{e.name}</div>
                    {zeitraum && (
                      <div className="text-xs text-muted-foreground">
                        {zeitraum}
                      </div>
                    )}
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
              );
            })}
          </ul>
        )}
      </CardContent>

      <ArbeitgeberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eintrag={bearbeiten}
        onSaved={(geandert, neuerVorschlag) => {
          reload();
          if (neuerVorschlag) setVorschlag(neuerVorschlag);
        }}
      />

      <AlertDialog
        open={loeschen !== null}
        onOpenChange={(o) => {
          if (!o) setLoeschen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arbeitgeber löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{loeschen?.name}" wird endgültig entfernt. Bereits klassifizierte
              Buchungen bleiben unverändert.
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

      <AlertDialog
        open={vorschlag !== null}
        onOpenChange={(o) => {
          if (!o && !vorschlagBusy) setVorschlag(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lernregel automatisch anlegen?</AlertDialogTitle>
            <AlertDialogDescription>
              Soll ich Buchungen von „
              {vorschlag?.empfaenger_muster ?? ""}" künftig automatisch der
              Kategorie „{vorschlag?.vorgeschlagene_kategorie_bezeichnung ?? ""}
              " als Privat-Gehalt zuordnen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={vorschlagBusy}>
              Nein, danke
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={annehmenLernregel}
              disabled={vorschlagBusy}
            >
              {vorschlagBusy ? "…" : "Ja, Regel anlegen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function formatiereZeitraum(
  von: string | null,
  bis: string | null,
): string | null {
  if (!von && !bis) return null;
  const v = von ? format(parse(von, "yyyy-MM-dd", new Date()), "dd.MM.yyyy") : "?";
  const b = bis ? format(parse(bis, "yyyy-MM-dd", new Date()), "dd.MM.yyyy") : "heute";
  return `${v} – ${b}`;
}

function ArbeitgeberDialog({
  open,
  onOpenChange,
  eintrag,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eintrag: ArbeitgeberEintrag | null;
  onSaved: (
    eintrag: ArbeitgeberEintrag,
    lernregel_vorschlag: LernregelVorschlag | null,
  ) => void;
}) {
  const istBearbeiten = eintrag !== null;
  const [submitting, setSubmitting] = useState(false);

  // Validation passiert manuell via safeParse in onSubmit — kein
  // zodResolver noetig (vermeidet Type-Mismatch zwischen react-hook-form
  // FieldValues und Zod-Schema bei optionalen Feldern).
  const form = useForm<FormValues>({
    defaultValues: toForm(eintrag),
    values: open ? toForm(eintrag) : undefined,
  });

  function toForm(e: ArbeitgeberEintrag | null): FormValues {
    return {
      name: e?.name ?? "",
      aktiv_von: e?.aktiv_von ?? "",
      aktiv_bis: e?.aktiv_bis ?? "",
      notiz: e?.notiz ?? "",
    };
  }

  async function onSubmit(values: FormValues) {
    const payload: ArbeitgeberInput = {
      name: values.name,
      aktiv_von: values.aktiv_von || null,
      aktiv_bis: values.aktiv_bis || null,
      notiz: values.notiz || null,
    };
    const check = arbeitgeberSchema.safeParse(payload);
    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? "Validierungsfehler.");
      return;
    }

    setSubmitting(true);
    try {
      const url = istBearbeiten
        ? `/api/profil/arbeitgeber/${eintrag.id}`
        : "/api/profil/arbeitgeber";
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
        istBearbeiten ? "Arbeitgeber aktualisiert." : "Arbeitgeber angelegt.",
      );
      onOpenChange(false);
      onSaved(
        json.eintrag as ArbeitgeberEintrag,
        (json.lernregel_vorschlag as LernregelVorschlag | null) ?? null,
      );
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
            {istBearbeiten ? "Arbeitgeber bearbeiten" : "Neuer Arbeitgeber"}
          </DialogTitle>
          <DialogDescription>
            Buchungen von hier eingetragenen Firmen mit Verwendungszweck
            „Lohn", „Gehalt" oder „Bezüge" werden als Privat-Gehalt erkannt.
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
                      placeholder="z. B. Accenture GmbH"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="aktiv_von"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aktiv von</FormLabel>
                    <DatumFeld
                      ariaLabel="Aktiv von"
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aktiv_bis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aktiv bis</FormLabel>
                    <DatumFeld
                      ariaLabel="Aktiv bis"
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notiz"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notiz (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Anstellung parallel zur Selbständigkeit"
                      {...field}
                    />
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

function DatumFeld({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const d = fromIso(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label={ariaLabel}
          variant="outline"
          className={cn(
            "w-full justify-start gap-2 text-left font-normal tabular-nums",
            !d && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {d ? format(d, "dd.MM.yyyy") : "—"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={d}
          onSelect={(nd) => onChange(toIso(nd))}
          locale={de}
          weekStartsOn={1}
        />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onChange("")}
          >
            Datum entfernen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
