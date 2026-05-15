"use client";

// PROJ-7: Regel-Editor (Dialog + react-hook-form). Bedingung
// (Empfänger/Zweck-Muster, Konto, Betragsbereich), Aktion (Kategorie, USt,
// privat/geschäftlich), Priorität und aktiv-Schalter. Die vom Server
// gemeldete Konfliktwarnung wird sichtbar angezeigt.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Kategorie, Klassifikation, Konto, Lernregel } from "@/lib/types";
import { regelInputSchema } from "@/lib/validation/regel";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const KLASS_OPTIONEN: Array<{ value: Klassifikation | "none"; label: string }> =
  [
    { value: "none", label: "— nicht setzen —" },
    { value: "geschaeftlich", label: "Geschäftlich" },
    { value: "privat", label: "Privat" },
    { value: "neutral", label: "Neutral" },
    { value: "unklar", label: "Unklar" },
  ];

const UST_OPTIONEN = [
  { value: "none", label: "— nicht setzen —" },
  { value: "0", label: "0 %" },
  { value: "7", label: "7 %" },
  { value: "19", label: "19 %" },
];

interface FormValues {
  bezeichnung: string;
  empfaenger_muster: string;
  zweck_muster: string;
  konto_id: string; // "none" | uuid
  betrag_min: string;
  betrag_max: string;
  kategorie_id: string; // "none" | uuid
  ust_satz: string; // "none" | "0" | "7" | "19"
  klassifikation: Klassifikation | "none";
  prioritaet: string;
  aktiv: boolean;
}

function toForm(r: Lernregel | null): FormValues {
  return {
    bezeichnung: r?.bezeichnung ?? "",
    empfaenger_muster: r?.bedingung?.empfaenger_muster ?? "",
    zweck_muster: r?.bedingung?.zweck_muster ?? "",
    konto_id: r?.bedingung?.konto_id ?? "none",
    betrag_min:
      typeof r?.bedingung?.betrag_min === "number"
        ? String(r.bedingung.betrag_min)
        : "",
    betrag_max:
      typeof r?.bedingung?.betrag_max === "number"
        ? String(r.bedingung.betrag_max)
        : "",
    kategorie_id: r?.aktion?.kategorie_id ?? "none",
    ust_satz:
      typeof r?.aktion?.ust_satz === "number"
        ? String(r.aktion.ust_satz)
        : "none",
    klassifikation: r?.aktion?.klassifikation ?? "none",
    prioritaet: r ? String(r.prioritaet) : "100",
    aktiv: r?.aktiv ?? true,
  };
}

export interface RegelKonfliktInfo {
  regel_id: string;
  bezeichnung?: string;
  felder: string[];
}

export function RegelDialog({
  open,
  onOpenChange,
  regel,
  konten,
  kategorien,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regel: Lernregel | null;
  konten: Konto[];
  kategorien: Kategorie[];
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [konflikte, setKonflikte] = useState<RegelKonfliktInfo[]>([]);
  const istBearbeiten = regel !== null;

  const form = useForm<FormValues>({ defaultValues: toForm(regel) });

  useEffect(() => {
    if (open) {
      form.reset(toForm(regel));
      setKonflikte([]);
    }
  }, [open, regel, form]);

  function bauePayload(values: FormValues) {
    const bedingung: Record<string, unknown> = {};
    if (values.empfaenger_muster.trim())
      bedingung.empfaenger_muster = values.empfaenger_muster.trim();
    if (values.zweck_muster.trim())
      bedingung.zweck_muster = values.zweck_muster.trim();
    if (values.konto_id !== "none") bedingung.konto_id = values.konto_id;
    if (values.betrag_min.trim() !== "")
      bedingung.betrag_min = Number(values.betrag_min);
    if (values.betrag_max.trim() !== "")
      bedingung.betrag_max = Number(values.betrag_max);

    const aktion: Record<string, unknown> = {};
    if (values.kategorie_id !== "none")
      aktion.kategorie_id = values.kategorie_id;
    if (values.ust_satz !== "none") aktion.ust_satz = Number(values.ust_satz);
    if (values.klassifikation !== "none")
      aktion.klassifikation = values.klassifikation;

    return {
      bezeichnung: values.bezeichnung.trim(),
      bedingung,
      aktion,
      prioritaet: Number(values.prioritaet),
      aktiv: values.aktiv,
    };
  }

  async function onSubmit(values: FormValues) {
    const payload = bauePayload(values);

    const check = regelInputSchema.safeParse(payload);
    if (!check.success) {
      const erste = check.error.issues[0];
      toast.error(erste?.message ?? "Validierung fehlgeschlagen.");
      return;
    }

    setSubmitting(true);
    try {
      const url = istBearbeiten ? `/api/regeln/${regel.id}` : "/api/regeln";
      const res = await fetch(url, {
        method: istBearbeiten ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      if (Array.isArray(json.konflikte) && json.konflikte.length > 0) {
        setKonflikte(json.konflikte as RegelKonfliktInfo[]);
        toast.warning(
          "Regel gespeichert – aber es bestehen Konflikte (siehe Hinweis).",
        );
      } else {
        toast.success(
          istBearbeiten ? "Regel aktualisiert." : "Regel angelegt.",
        );
        onOpenChange(false);
      }
      onSaved();
    } catch {
      toast.error("Netzwerkfehler beim Speichern.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {istBearbeiten ? "Regel bearbeiten" : "Neue Lernregel"}
          </DialogTitle>
          <DialogDescription>
            Bedingung trifft per Teilstring (case-insensitiv). Alle gesetzten
            Bedingungen müssen erfüllt sein.
          </DialogDescription>
        </DialogHeader>

        {konflikte.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Regelkonflikt</AlertTitle>
            <AlertDescription>
              Kollidiert mit gleicher Priorität:{" "}
              {konflikte
                .map((k) => k.bezeichnung ?? k.regel_id)
                .join(", ")}
              . Solche Fälle landen weiterhin in der Prüfliste.
            </AlertDescription>
          </Alert>
        )}

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
                      placeholder="z. B. Telekom → Telefon 19%"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">Bedingung</p>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="empfaenger_muster"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empfänger enthält</FormLabel>
                      <FormControl>
                        <Input placeholder="z. B. Telekom" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zweck_muster"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verwendungszweck enthält</FormLabel>
                      <FormControl>
                        <Input placeholder="z. B. Mobilfunk" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="konto_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konto</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            — beliebig —
                          </SelectItem>
                          {konten.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.bezeichnung}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="betrag_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Betrag min</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="—"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="betrag_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Betrag max</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="—"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormDescription>
                  Mindestens eine Bedingung angeben.
                </FormDescription>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">Aktion</p>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="kategorie_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EÜR-Kategorie</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            — nicht setzen —
                          </SelectItem>
                          {kategorien.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.bezeichnung}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="ust_satz"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>USt-Satz</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UST_OPTIONEN.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
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
                    name="klassifikation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Privat / geschäftlich</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {KLASS_OPTIONEN.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormDescription>
                  Mindestens eine Aktion angeben.
                </FormDescription>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="prioritaet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorität</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="1000" {...field} />
                    </FormControl>
                    <FormDescription>Höher gewinnt.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aktiv"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <FormLabel>Aktiv</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {konflikte.length > 0 ? "Schließen" : "Abbrechen"}
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
