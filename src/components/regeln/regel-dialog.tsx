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
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RegexFeld } from "@/components/regeln/regex-feld";
import { SplitBlock, type SplitBlockValues } from "@/components/regeln/split-block";

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
  empfaenger_regex: string;
  zweck_regex: string;
  konto_id: string; // "none" | uuid
  betrag_min: string;
  betrag_max: string;
  kategorie_id: string; // "none" | uuid
  ust_satz: string; // "none" | "0" | "7" | "19"
  klassifikation: Klassifikation | "none";
  prioritaet: string;
  aktiv: boolean;
}

const SPLIT_DEFAULT: SplitBlockValues = {
  anteilGeschaeftlichProzent: 70,
  kategorieGeschaeftlich: "none",
  kategoriePrivat: "none",
  ustSatzGeschaeftlich: "none",
};

function toForm(r: Lernregel | null): FormValues {
  return {
    bezeichnung: r?.bezeichnung ?? "",
    empfaenger_muster: r?.bedingung?.empfaenger_muster ?? "",
    zweck_muster: r?.bedingung?.zweck_muster ?? "",
    empfaenger_regex: r?.bedingung?.empfaenger_regex ?? "",
    zweck_regex: r?.bedingung?.zweck_regex ?? "",
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

/** Split-State (außerhalb der RHF-Werte, eigene Composite-Form). */
function toSplit(r: Lernregel | null): SplitBlockValues {
  const s = r?.aktion?.split;
  if (!s) return SPLIT_DEFAULT;
  return {
    anteilGeschaeftlichProzent: Math.round(s.anteil_geschaeftlich * 100),
    kategorieGeschaeftlich: s.kategorie_geschaeftlich ?? "none",
    kategoriePrivat: s.kategorie_privat ?? "none",
    ustSatzGeschaeftlich:
      typeof s.ust_satz_geschaeftlich === "number"
        ? String(s.ust_satz_geschaeftlich)
        : "none",
  };
}

export interface RegelKonfliktInfo {
  regel_id: string;
  bezeichnung?: string;
  felder: string[];
}

export interface RegelPrefill {
  /** Vorbelegung für die Bezeichnung der neuen Regel. */
  bezeichnung?: string;
  /** Vorbelegung für das Empfänger-Substring-Muster. */
  empfaenger_muster?: string;
}

export function RegelDialog({
  open,
  onOpenChange,
  regel,
  konten,
  kategorien,
  onSaved,
  beispielBetrag,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regel: Lernregel | null;
  konten: Konto[];
  kategorien: Kategorie[];
  onSaved: () => void;
  /** Optionaler Beispielbetrag (€) für die Split-Vorschau. */
  beispielBetrag?: number;
  /**
   * PROJ-15 P2 (#3): Vorbelegung für eine NEUE Regel (nur wirksam, wenn
   * `regel === null`). Erlaubt es z. B. der „Häufige Prüflisten-Empfänger"-
   * Seite, den Empfänger direkt vorzufüllen.
   */
  prefill?: RegelPrefill;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [konflikte, setKonflikte] = useState<RegelKonfliktInfo[]>([]);
  const [splitAktiv, setSplitAktiv] = useState(false);
  const [split, setSplit] = useState<SplitBlockValues>(SPLIT_DEFAULT);
  const istBearbeiten = regel !== null;

  const form = useForm<FormValues>({ defaultValues: toForm(regel) });

  useEffect(() => {
    if (open) {
      const basis = toForm(regel);
      // Prefill nur für NEUE Regeln (regel === null) anwenden.
      if (!regel && prefill) {
        if (prefill.bezeichnung) basis.bezeichnung = prefill.bezeichnung;
        if (prefill.empfaenger_muster)
          basis.empfaenger_muster = prefill.empfaenger_muster;
      }
      form.reset(basis);
      setSplit(toSplit(regel));
      setSplitAktiv(Boolean(regel?.aktion?.split));
      setKonflikte([]);
    }
  }, [open, regel, prefill, form]);

  function bauePayload(values: FormValues) {
    const bedingung: Record<string, unknown> = {};
    if (values.empfaenger_muster.trim())
      bedingung.empfaenger_muster = values.empfaenger_muster.trim();
    if (values.zweck_muster.trim())
      bedingung.zweck_muster = values.zweck_muster.trim();
    if (values.empfaenger_regex.trim())
      bedingung.empfaenger_regex = values.empfaenger_regex.trim();
    if (values.zweck_regex.trim())
      bedingung.zweck_regex = values.zweck_regex.trim();
    if (values.konto_id !== "none") bedingung.konto_id = values.konto_id;
    if (values.betrag_min.trim() !== "")
      bedingung.betrag_min = Number(values.betrag_min);
    if (values.betrag_max.trim() !== "")
      bedingung.betrag_max = Number(values.betrag_max);

    const aktion: Record<string, unknown> = {};
    if (splitAktiv) {
      // Split schließt einfache Kategorie/USt/Klassifikation aus (Schema).
      const anteilG = Math.min(
        100,
        Math.max(0, Math.round(split.anteilGeschaeftlichProzent)),
      );
      const splitAktion: Record<string, unknown> = {
        anteil_geschaeftlich: anteilG / 100,
        anteil_privat: (100 - anteilG) / 100,
      };
      if (split.kategorieGeschaeftlich !== "none")
        splitAktion.kategorie_geschaeftlich = split.kategorieGeschaeftlich;
      if (split.kategoriePrivat !== "none")
        splitAktion.kategorie_privat = split.kategoriePrivat;
      if (split.ustSatzGeschaeftlich !== "none")
        splitAktion.ust_satz_geschaeftlich = Number(
          split.ustSatzGeschaeftlich,
        );
      aktion.split = splitAktion;
    } else {
      if (values.kategorie_id !== "none")
        aktion.kategorie_id = values.kategorie_id;
      if (values.ust_satz !== "none") aktion.ust_satz = Number(values.ust_satz);
      if (values.klassifikation !== "none")
        aktion.klassifikation = values.klassifikation;
    }

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
                  name="empfaenger_regex"
                  render={({ field }) => (
                    <RegexFeld
                      id="empfaenger_regex"
                      label="Empfänger-Regex"
                      beschreibung="Optional. Deckt ganze Provider-Familien ab, z. B. ^STRIPE\*.* — case-insensitiv, gegen den normalisierten Empfänger."
                      value={field.value}
                      onChange={field.onChange}
                      probePlaceholder="z. B. ^STRIPE\*.*"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="zweck_regex"
                  render={({ field }) => (
                    <RegexFeld
                      id="zweck_regex"
                      label="Verwendungszweck-Regex"
                      beschreibung="Optional. Case-insensitiver Regex gegen den Verwendungszweck."
                      value={field.value}
                      onChange={field.onChange}
                      probePlaceholder="z. B. (abo|subscription)"
                    />
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
                {!splitAktiv && (
                  <>
                    <FormField
                      control={form.control}
                      name="kategorie_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EÜR-Kategorie</FormLabel>
                          <KategorieCombobox
                            kategorien={kategorien}
                            value={field.value}
                            onChange={field.onChange}
                            vorabOptionen={[
                              { value: "none", label: "— nicht setzen —" },
                            ]}
                            inDialog
                          />
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
                      Mindestens eine Aktion angeben — oder unten aufteilen.
                    </FormDescription>
                  </>
                )}

                <SplitBlock
                  aktiv={splitAktiv}
                  onAktivChange={setSplitAktiv}
                  values={split}
                  onChange={setSplit}
                  kategorien={kategorien}
                  beispielBetrag={beispielBetrag}
                />
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
