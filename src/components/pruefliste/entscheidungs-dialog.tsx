"use client";

// PROJ-7: Schnellentscheidungs-Panel (Dialog) für einen oder mehrere
// Prüffälle. Kategorie + USt + privat/geschäftlich, optionaler
// Belegzuordnungs-Hinweis, optionaler Betrag-Split (nur Einzelfall) sowie
// "Als Lernregel speichern" mit aus dem Fall vorbefüllter Bedingung.

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Buchung,
  Kategorie,
  KategorieTyp,
  Klassifikation,
} from "@/lib/types";
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
import { schlageRegelVor } from "@/lib/classifier/regel-vorschlag";
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";
import { formatBetrag } from "./labels";

const KLASS_OPTIONEN: Array<{ value: Klassifikation; label: string }> = [
  { value: "geschaeftlich", label: "Geschäftlich" },
  { value: "privat", label: "Privat" },
  { value: "neutral", label: "Neutral / Durchlaufend" },
  { value: "unklar", label: "Unklar (offen lassen)" },
];

// Welche EÜR-Kategorie-Typen zu einer privat/geschäftlich-Einstufung passen.
// Bei "unklar" wird nicht gefiltert (null = alle Typen erlaubt).
const KLASS_KATEGORIE_TYPEN: Record<Klassifikation, KategorieTyp[] | null> = {
  geschaeftlich: ["einnahme", "ausgabe"],
  privat: ["privat"],
  neutral: ["neutral"],
  unklar: null,
};

const UST_OPTIONEN = [
  { value: "null", label: "Kein USt-Satz" },
  { value: "0", label: "0 %" },
  { value: "7", label: "7 %" },
  { value: "19", label: "19 %" },
];

interface FormValues {
  kategorie_id: string; // "" = keine
  ust_satz: string; // "null" | "0" | "7" | "19"
  klassifikation: Klassifikation;
  beleg_hinweis: string;
  split_aktiv: boolean;
  split_anteil_a: string; // 0..1
  split_klass_a: Klassifikation;
  split_klass_b: Klassifikation;
  regel_aktiv: boolean;
  regel_bezeichnung: string;
  regel_empfaenger: string;
  regel_zweck: string;
}

export interface EntscheidungErgebnis {
  bearbeitet: number;
  regel: { id: string; bezeichnung: string } | null;
  gleichartige_offen: number;
}

export function EntscheidungsDialog({
  open,
  onOpenChange,
  faelle,
  kategorien,
  onEntschieden,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faelle: Buchung[];
  kategorien: Kategorie[];
  onEntschieden: (e: EntscheidungErgebnis) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const einzel = faelle.length === 1;
  const fall = einzel ? faelle[0] : null;

  // Automatischer Regel-Vorschlag aus den ausgewählten Buchungen: ein stabiles
  // Empfänger-Muster (variable IDs/Präfixe entfernt), damit künftige Buchungen
  // desselben Empfängers automatisch gleich verbucht werden.
  const vorschlag = useMemo(() => schlageRegelVor(faelle), [faelle]);

  const defaults = useMemo<FormValues>(
    () => ({
      kategorie_id: fall?.kategorie_id ?? "",
      ust_satz:
        fall?.ust_satz === null || fall?.ust_satz === undefined
          ? "null"
          : String(fall.ust_satz),
      klassifikation:
        fall?.klassifikation && fall.klassifikation !== "unklar"
          ? fall.klassifikation
          : "geschaeftlich",
      beleg_hinweis: "",
      split_aktiv: false,
      split_anteil_a: "0.5",
      split_klass_a: "geschaeftlich",
      split_klass_b: "privat",
      regel_aktiv: false,
      regel_bezeichnung: vorschlag.bezeichnung,
      regel_empfaenger: vorschlag.empfaenger_muster,
      regel_zweck: vorschlag.zweck_muster,
    }),
    [fall, vorschlag],
  );

  const form = useForm<FormValues>({ defaultValues: defaults });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const splitAktiv = form.watch("split_aktiv");
  const regelAktiv = form.watch("regel_aktiv");
  const klassifikation = form.watch("klassifikation");

  // EÜR-Kategorien passend zur gewählten privat/geschäftlich-Einstufung:
  // bei "Privat" nur private Kategorien, bei "Geschäftlich" Einnahmen/Ausgaben.
  const sichtbareKategorien = useMemo(() => {
    const erlaubt = KLASS_KATEGORIE_TYPEN[klassifikation];
    if (!erlaubt) return kategorien;
    return kategorien.filter((k) => erlaubt.includes(k.typ));
  }, [kategorien, klassifikation]);

  // Wechselt die Einstufung, passt die bisher gewählte Kategorie aber nicht mehr
  // zum neuen Typ, wird sie zurückgesetzt, damit keine widersprüchliche
  // Zuordnung stehen bleibt.
  function handleKlassifikationChange(value: Klassifikation) {
    form.setValue("klassifikation", value);
    const erlaubt = KLASS_KATEGORIE_TYPEN[value];
    const aktuelle = form.getValues("kategorie_id");
    if (erlaubt && aktuelle) {
      const kat = kategorien.find((k) => k.id === aktuelle);
      if (!kat || !erlaubt.includes(kat.typ)) {
        form.setValue("kategorie_id", "");
      }
    }
  }

  async function onSubmit(values: FormValues) {
    const ustSatz =
      values.ust_satz === "null"
        ? null
        : (Number(values.ust_satz) as 0 | 7 | 19);

    const body: Record<string, unknown> = {
      buchung_ids: faelle.map((f) => f.id),
      kategorie_id: values.kategorie_id || null,
      ust_satz: ustSatz,
      klassifikation: values.klassifikation,
    };
    if (values.beleg_hinweis.trim()) {
      body.beleg_hinweis = values.beleg_hinweis.trim();
    }

    if (einzel && values.split_aktiv) {
      const anteil = Number(values.split_anteil_a);
      if (!(anteil > 0 && anteil < 1)) {
        form.setError("split_anteil_a", {
          message: "Anteil zwischen 0 und 1 angeben (z. B. 0.6).",
        });
        return;
      }
      body.split = {
        anteil_a: anteil,
        klassifikation_a: values.split_klass_a,
        kategorie_id_a: values.kategorie_id || null,
        klassifikation_b: values.split_klass_b,
        kategorie_id_b: values.kategorie_id || null,
      };
    }

    if (values.regel_aktiv) {
      if (!values.regel_empfaenger.trim() && !values.regel_zweck.trim()) {
        form.setError("regel_empfaenger", {
          message: "Für eine Regel mindestens Empfänger- oder Zweck-Muster.",
        });
        return;
      }
      body.regel_anlegen = {
        bezeichnung: values.regel_bezeichnung.trim() || "Neue Regel",
        empfaenger_muster: values.regel_empfaenger.trim() || undefined,
        zweck_muster: values.regel_zweck.trim() || undefined,
        prioritaet: 100,
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pruefliste/entscheiden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Entscheidung fehlgeschlagen.");
        return;
      }
      const anzahl = json.bearbeitet ?? 0;
      toast.success(
        anzahl === 1
          ? "Fall entschieden."
          : `${anzahl} Fälle entschieden.`,
      );
      if (json.regel) {
        toast.success(`Lernregel „${json.regel.bezeichnung}" angelegt.`);
      }
      if (Array.isArray(json.fehler) && json.fehler.length > 0) {
        toast.warning(`${json.fehler.length} Hinweis(e) bei der Verarbeitung.`);
      }
      onOpenChange(false);
      onEntschieden({
        bearbeitet: anzahl,
        regel: json.regel ?? null,
        gleichartige_offen: json.gleichartige_offen ?? 0,
      });
    } catch {
      toast.error("Netzwerkfehler bei der Entscheidung.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {einzel ? "Fall entscheiden" : `${faelle.length} Fälle entscheiden`}
          </DialogTitle>
          <DialogDescription>
            {einzel && fall
              ? `${fall.empfaenger ?? "Ohne Empfänger"} · ${formatBetrag(
                  fall.betrag,
                )} ${fall.waehrung}`
              : "Bulk-Entscheidung: identische Zuordnung für alle ausgewählten Fälle."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="klassifikation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Privat / geschäftlich</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      handleKlassifikationChange(v as Klassifikation)
                    }
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

            <FormField
              control={form.control}
              name="kategorie_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EÜR-Kategorie</FormLabel>
                  <KategorieCombobox
                    kategorien={sichtbareKategorien}
                    value={field.value || "none"}
                    onChange={(v) => field.onChange(v === "none" ? "" : v)}
                    vorabOptionen={[{ value: "none", label: "Keine Kategorie" }]}
                    inDialog
                  />
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
              name="beleg_hinweis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Belegzuordnungs-Hinweis (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Rechnung Nr. 2026-042"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Frei – wird im Audit-Trail festgehalten.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {einzel && (
              <div className="space-y-3 rounded-md border p-3">
                <FormField
                  control={form.control}
                  name="split_aktiv"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Betrag aufteilen</FormLabel>
                        <FormDescription>
                          z. B. 60 % geschäftlich / 40 % privat – erzeugt zwei
                          Teilbuchungen.
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
                {splitAktiv && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="split_anteil_a"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anteil A</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="0.99"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="split_klass_a"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teil A</FormLabel>
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
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="split_klass_b"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teil B</FormLabel>
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
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {/* PROJ-26 (Feature 4 / AC6): prominenter 1-Klick-Pfad. Aktiviert
                den Lernregel-Switch und befüllt das Empfänger-Muster. */}
            {!regelAktiv && (
              <button
                type="button"
                onClick={() => form.setValue("regel_aktiv", true)}
                className="flex w-full items-center gap-3 rounded-md border border-brand-violet/40 bg-tint-violet px-3 py-3 text-left transition-colors hover:bg-brand-violet/15"
              >
                <Sparkles className="h-5 w-5 shrink-0 text-brand-violet" />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-brand-violet">
                    Immer so für diesen Empfänger
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Legt eine Lernregel an — gleichartige Buchungen laufen künftig
                    automatisch und tauchen nicht mehr in der Prüfliste auf.
                  </div>
                </div>
              </button>
            )}

            <div
              className={cn(
                "space-y-3 rounded-md border p-3",
                regelAktiv && "border-brand-violet/50 bg-tint-violet/40",
              )}
            >
              <FormField
                control={form.control}
                name="regel_aktiv"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-brand-violet" />
                        Als Lernregel speichern
                      </FormLabel>
                      <FormDescription>
                        Gleichartige Buchungen laufen künftig automatisch —
                        Vorschlag unten aus den Buchungen, anpassbar.
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
              {regelAktiv && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="regel_bezeichnung"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regel-Bezeichnung</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="regel_empfaenger"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empfänger enthält</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="z. B. Telekom"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="regel_zweck"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zweck enthält</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="z. B. Mobilfunk"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Alert>
                    <AlertTitle>Hinweis</AlertTitle>
                    <AlertDescription>
                      Die Regel übernimmt Kategorie, USt-Satz und
                      privat/geschäftlich aus dieser Entscheidung.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

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
                {submitting ? "Speichern…" : "Entscheiden"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
