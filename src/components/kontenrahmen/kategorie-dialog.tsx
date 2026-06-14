"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Kategorie, KategorieTyp } from "@/lib/types";
import {
  kategorieInputSchema,
  type KategorieInput,
} from "@/lib/validation/kontenrahmen";
import { Button } from "@/components/ui/button";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const TYP_LABELS: Record<KategorieTyp, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
  privat: "Privat",
  neutral: "Neutral / Durchlaufend",
};

const UST_OPTIONEN = [
  { value: "null", label: "Kein USt-Satz (Privat/Neutral)" },
  { value: "0", label: "0 % (steuerfrei / nicht steuerbar)" },
  { value: "7", label: "7 % (ermäßigt)" },
  { value: "19", label: "19 % (Regelsatz)" },
];

type FormValues = {
  bezeichnung: string;
  typ: KategorieTyp;
  ust_satz: string; // "null" | "0" | "7" | "19" (Select arbeitet mit Strings)
  euer_zeile: string;
  elster_kennzahl: string;
  aktiv: boolean;
  gueltig_ab: string;
};

function toFormValues(k: Kategorie | null): FormValues {
  return {
    bezeichnung: k?.bezeichnung ?? "",
    typ: k?.typ ?? "ausgabe",
    ust_satz: k?.ust_satz === null || k?.ust_satz === undefined
      ? k?.typ === "privat" || k?.typ === "neutral"
        ? "null"
        : "19"
      : String(k.ust_satz),
    euer_zeile: k?.euer_zeile ?? "",
    elster_kennzahl: k?.elster_kennzahl ?? "",
    aktiv: k?.aktiv ?? true,
    gueltig_ab: k?.gueltig_ab ?? "",
  };
}

function toPayload(values: FormValues): KategorieInput {
  const ohneUst = values.typ === "privat" || values.typ === "neutral";
  const ustSatz =
    ohneUst || values.ust_satz === "null"
      ? null
      : (Number(values.ust_satz) as 0 | 7 | 19);
  return {
    bezeichnung: values.bezeichnung,
    typ: values.typ,
    ust_satz: ustSatz,
    euer_zeile: values.euer_zeile || null,
    elster_kennzahl: values.elster_kennzahl || null,
    aktiv: values.aktiv,
    gueltig_ab: values.gueltig_ab || null,
  };
}

export function KategorieDialog({
  open,
  onOpenChange,
  kategorie,
  vorlage = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategorie: Kategorie | null;
  /** Vorbelegung für eine NEUE Kategorie (Duplizieren). Wird nur genutzt,
   *  wenn `kategorie` null ist; das Speichern legt dann neu an (POST). */
  vorlage?: Kategorie | null;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const istBearbeiten = kategorie !== null;

  const form = useForm<FormValues>({
    defaultValues: toFormValues(kategorie ?? vorlage),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(kategorie ?? vorlage));
    }
  }, [open, kategorie, vorlage, form]);

  const typ = form.watch("typ");
  const ustGesperrt = typ === "privat" || typ === "neutral";

  // USt-Satz automatisch auf "kein Satz" zwingen, wenn Typ privat/neutral
  useEffect(() => {
    if (ustGesperrt && form.getValues("ust_satz") !== "null") {
      form.setValue("ust_satz", "null");
    }
    if (!ustGesperrt && form.getValues("ust_satz") === "null") {
      form.setValue("ust_satz", "19");
    }
  }, [ustGesperrt, form]);

  async function onSubmit(values: FormValues) {
    const payload = toPayload(values);

    // Client-seitige Konsistenzprüfung (Server validiert nochmals).
    const check = kategorieInputSchema.safeParse(payload);
    if (!check.success) {
      const erste = check.error.issues[0];
      form.setError("ust_satz", {
        message: erste?.message ?? "Validierung fehlgeschlagen",
      });
      return;
    }

    setSubmitting(true);
    try {
      const url = istBearbeiten
        ? `/api/kontenrahmen/${kategorie.id}`
        : "/api/kontenrahmen";
      const res = await fetch(url, {
        method: istBearbeiten ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success(
        istBearbeiten ? "Kategorie aktualisiert" : "Kategorie angelegt",
      );
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Netzwerkfehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {istBearbeiten ? "Kategorie bearbeiten" : "Neue Kategorie"}
          </DialogTitle>
          <DialogDescription>
            EÜR-Kontenrahmen-Kategorie mit Typ, USt-Satz und EÜR-Zuordnung.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bezeichnung"
              rules={{ required: "Bezeichnung ist erforderlich" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bezeichnung</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Umsatzerlöse 19% USt"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="typ"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(
                        Object.keys(TYP_LABELS) as KategorieTyp[]
                      ).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYP_LABELS[t]}
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
              name="ust_satz"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>USt-Satz</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={ustGesperrt}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="USt-Satz wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UST_OPTIONEN.map((o) => (
                        <SelectItem
                          key={o.value}
                          value={o.value}
                          disabled={
                            ustGesperrt
                              ? o.value !== "null"
                              : o.value === "null"
                          }
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Bei Typ „Privat"/„Neutral" ist kein USt-Satz erlaubt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="euer_zeile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EÜR-Zeile</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Anlage EÜR Z. 14" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="elster_kennzahl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ELSTER-Kennzahl</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. 81" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="gueltig_ab"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gültig ab (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Für USt-Satz-Wechsel z. B. zum Jahreswechsel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aktiv"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Aktiv</FormLabel>
                    <FormDescription>
                      Inaktive Kategorien sind nicht mehr neu zuweisbar.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
