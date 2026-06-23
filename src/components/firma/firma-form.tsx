"use client";

// PROJ-1: Client-Formular für Firmen-/Steuerprofil.
// react-hook-form + zod (gemeinsames Schema), shadcn/ui-Primitiven, Speichern via PUT /api/firma.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  firmenprofilSchema,
  FIRMENPROFIL_DEFAULTS,
  type FirmenprofilFormValues,
} from "@/lib/validation/firma";
import type { Firmenprofil } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** Mappt ein geladenes DB-Profil auf die String-basierten Formularwerte. */
function profilZuFormValues(p: Firmenprofil | null): FirmenprofilFormValues {
  if (!p) return FIRMENPROFIL_DEFAULTS;
  return {
    firmenname: p.firmenname ?? "",
    inhaber: p.inhaber ?? "",
    steuernummer: p.steuernummer ?? "",
    ust_idnr: p.ust_idnr ?? "",
    strasse: p.strasse ?? "",
    plz: p.plz ?? "",
    ort: p.ort ?? "",
    finanzamt: p.finanzamt ?? "",
    rechtsform: p.rechtsform ?? "einzelunternehmer",
    ust_status: p.ust_status ?? "regelbesteuerung",
    wirtschaftsjahr_beginn: p.wirtschaftsjahr_beginn ?? 1,
    ust_va_rhythmus: p.ust_va_rhythmus ?? "monatlich",
    rhythmus_gueltig_ab: p.rhythmus_gueltig_ab ?? "",
    // PROJ-27 (AC4): Wert wird gelesen; UI-Schalter folgt im Frontend-Schritt.
    dauerfristverlaengerung: p.dauerfristverlaengerung ?? false,
  };
}

export function FirmaForm({
  initialProfil,
}: {
  initialProfil: Firmenprofil | null;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isNew = initialProfil === null;

  const form = useForm<FirmenprofilFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(firmenprofilSchema) as any,
    defaultValues: profilZuFormValues(initialProfil),
    mode: "onBlur",
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: FirmenprofilFormValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/firma", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = (await res.json().catch(() => null)) as
        | { profil?: Firmenprofil; error?: string }
        | null;

      if (!res.ok) {
        const msg =
          json?.error ?? "Speichern fehlgeschlagen. Bitte erneut versuchen.";
        setServerError(msg);
        toast.error(msg);
        return;
      }

      if (json?.profil) {
        form.reset(profilZuFormValues(json.profil));
      }
      toast.success("Firmenprofil gespeichert.");
    } catch {
      const msg = "Netzwerkfehler. Bitte erneut versuchen.";
      setServerError(msg);
      toast.error(msg);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        {isNew && (
          <Alert>
            <AlertDescription>
              Es ist noch kein Firmenprofil hinterlegt. Bitte fülle die
              Stammdaten aus und speichere — sie dienen allen weiteren Modulen
              als zentrale Datenquelle.
            </AlertDescription>
          </Alert>
        )}

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Firmenstammdaten */}
        <Card>
          <CardHeader>
            <CardTitle>Firmenstammdaten</CardTitle>
            <CardDescription>
              Erscheinen in Auswertungen und Exporten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firmenname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firmenname *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="organization"
                        placeholder="Mustermann IT-Beratung"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="inhaber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inhaber *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="name"
                        placeholder="Max Mustermann"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="steuernummer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steuernummer</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="12345/67890" />
                    </FormControl>
                    <FormDescription>
                      Format des zuständigen Finanzamts (Ziffern, optional mit /
                      . -).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ust_idnr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>USt-IdNr.</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DE123456789" />
                    </FormControl>
                    <FormDescription>DE + 9 Ziffern.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="strasse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Straße und Hausnummer</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="street-address"
                      placeholder="Musterstraße 1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="plz"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PLZ</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="postal-code"
                        placeholder="12345"
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ort"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Ort</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="address-level2"
                        placeholder="Musterstadt"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="finanzamt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zuständiges Finanzamt</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Finanzamt Musterstadt"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Steuerprofil */}
        <Card>
          <CardHeader>
            <CardTitle>Steuerprofil</CardTitle>
            <CardDescription>
              Steuert Klassifizierung und Steuerberechnungen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="rechtsform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rechtsform *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Rechtsform wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="einzelunternehmer">
                          Einzelunternehmer
                        </SelectItem>
                        <SelectItem value="freiberufler">
                          Freiberufler
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ust_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>USt-Status *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="USt-Status wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="regelbesteuerung">
                          Regelbesteuerung
                        </SelectItem>
                        <SelectItem value="kleinunternehmer">
                          Kleinunternehmer (§19 UStG)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="wirtschaftsjahr_beginn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wirtschaftsjahr-Beginn *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Monat wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONATE.map((monat, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {monat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      In der Regel Januar (Kalenderjahr).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ust_va_rhythmus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>USt-Voranmeldung-Rhythmus *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Rhythmus wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monatlich">Monatlich</SelectItem>
                        <SelectItem value="quartalsweise">
                          Quartalsweise
                        </SelectItem>
                        <SelectItem value="jaehrlich">Jährlich</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="rhythmus_gueltig_ab"
              render={({ field }) => (
                <FormItem className="sm:max-w-xs">
                  <FormLabel>Rhythmus gültig ab</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional — relevant bei Rhythmuswechsel mitten im Jahr.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dauerfristverlaengerung"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Dauerfristverlängerung</FormLabel>
                    <FormDescription>
                      Verlängert die USt-VA-Abgabefrist um einen Monat.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Dauerfristverlängerung"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Speichern…" : "Profil speichern"}
          </Button>
          {form.formState.isDirty && !submitting && (
            <span className="text-sm text-muted-foreground">
              Ungespeicherte Änderungen
            </span>
          )}
        </div>
      </form>
    </Form>
  );
}
