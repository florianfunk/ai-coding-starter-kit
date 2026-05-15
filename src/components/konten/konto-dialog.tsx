"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Konto, KontoTyp } from "@/lib/types";
import {
  kontoInputSchema,
  type KontoInput,
} from "@/lib/validation/konto";
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
import { Separator } from "@/components/ui/separator";

const TYP_LABELS: Record<KontoTyp, string> = {
  bank: "Bank (Geschäftskonto)",
  paypal: "PayPal",
  kreditkarte: "Kreditkarte",
};

type FormValues = {
  bezeichnung: string;
  typ: KontoTyp;
  map_datum: string;
  map_betrag: string;
  map_verwendungszweck: string;
  map_empfaenger: string;
  map_waehrung: string;
  map_invertieren: boolean;
};

function toFormValues(k: Konto | null): FormValues {
  return {
    bezeichnung: k?.bezeichnung ?? "",
    typ: k?.typ ?? "bank",
    map_datum: k?.mapping?.datum ?? "",
    map_betrag: k?.mapping?.betrag ?? "",
    map_verwendungszweck: k?.mapping?.verwendungszweck ?? "",
    map_empfaenger: k?.mapping?.empfaenger ?? "",
    map_waehrung: k?.mapping?.waehrung ?? "",
    map_invertieren: k?.mapping?.betrag_vorzeichen_invertieren ?? false,
  };
}

function toPayload(v: FormValues): KontoInput {
  const hatMapping =
    v.map_datum.trim() !== "" || v.map_betrag.trim() !== "";
  return {
    bezeichnung: v.bezeichnung,
    typ: v.typ,
    mapping: hatMapping
      ? {
          datum: v.map_datum,
          betrag: v.map_betrag,
          verwendungszweck: v.map_verwendungszweck || undefined,
          empfaenger: v.map_empfaenger || undefined,
          waehrung: v.map_waehrung || undefined,
          betrag_vorzeichen_invertieren: v.map_invertieren,
        }
      : null,
  };
}

export function KontoDialog({
  open,
  onOpenChange,
  konto,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  konto: Konto | null;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const istBearbeiten = konto !== null;

  const form = useForm<FormValues>({
    defaultValues: toFormValues(konto),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(konto));
  }, [open, konto, form]);

  async function onSubmit(values: FormValues) {
    const payload = toPayload(values);

    const check = kontoInputSchema.safeParse(payload);
    if (!check.success) {
      const erste = check.error.issues[0];
      toast.error(erste?.message ?? "Validierung fehlgeschlagen");
      return;
    }

    setSubmitting(true);
    try {
      const url = istBearbeiten ? `/api/konten/${konto.id}` : "/api/konten";
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
      toast.success(istBearbeiten ? "Konto aktualisiert" : "Konto angelegt");
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
            {istBearbeiten ? "Konto bearbeiten" : "Neues Konto"}
          </DialogTitle>
          <DialogDescription>
            Konto-Stammdaten und wiederverwendbare Spalten-Mapping-Vorlage für
            den Excel/CSV-Import.
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
                      placeholder="z. B. Geschäftskonto Sparkasse"
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
                  <FormLabel>Kontotyp</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(TYP_LABELS) as KontoTyp[]).map((t) => (
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

            <Separator />
            <div>
              <h3 className="text-sm font-medium">Spalten-Mapping</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Spaltennamen exakt wie in der Kopfzeile der Export-Datei. Datum
                und Betrag sind Pflicht; die übrigen Felder sind optional. Diese
                Vorlage wird bei jedem weiteren Import dieses Kontos
                wiederverwendet.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="map_datum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spalte „Buchungsdatum“</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Buchungstag" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="map_betrag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spalte „Betrag“</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Betrag" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="map_verwendungszweck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spalte „Verwendungszweck“</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z. B. Verwendungszweck"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="map_empfaenger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spalte „Empfänger“</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z. B. Empfänger/Auftraggeber"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="map_waehrung"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spalte „Währung“</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Währung" {...field} />
                    </FormControl>
                    <FormDescription>
                      Leer = EUR als Standard.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="map_invertieren"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Betragsvorzeichen invertieren</FormLabel>
                    <FormDescription>
                      Aktivieren, wenn der Export Ausgaben positiv führt (oft
                      bei Kreditkarten/PayPal).
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
