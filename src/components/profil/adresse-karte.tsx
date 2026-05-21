"use client";

// PROJ-16 — Adresse-Karte (Single-Row pro Owner).
//
// Inline-Formular (kein Dialog). Felder: Straße, PLZ, Ort, Land (Default DE).
// PUT auf /api/profil/adresse — Upsert auf `mein_profil_adresse` mit
// owner_id als PK.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { adresseSchema, type AdresseInput } from "@/lib/validation/profil";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
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

export interface AdresseEintrag {
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
  updated_at?: string;
}

type FormValues = {
  strasse: string;
  plz: string;
  ort: string;
  land: string;
};

const LAENDER = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
];

export function AdresseKarte({
  initial,
}: {
  initial: AdresseEintrag | null;
}) {
  const [submitting, setSubmitting] = useState(false);

  // Validation passiert manuell via safeParse in onSubmit — kein
  // zodResolver noetig (vermeidet Type-Mismatch zwischen react-hook-form
  // FieldValues und Zod-Schema bei optionalen Feldern).
  const form = useForm<FormValues>({
    defaultValues: {
      strasse: initial?.strasse ?? "",
      plz: initial?.plz ?? "",
      ort: initial?.ort ?? "",
      land: initial?.land ?? "DE",
    },
  });

  async function onSubmit(values: FormValues) {
    const payload: AdresseInput = {
      strasse: values.strasse || null,
      plz: values.plz || null,
      ort: values.ort || null,
      land: values.land || "DE",
    };

    const check = adresseSchema.safeParse(payload);
    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? "Validierungsfehler.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/profil/adresse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      toast.success("Adresse gespeichert.");
      const a = json.adresse as AdresseEintrag;
      form.reset({
        strasse: a.strasse ?? "",
        plz: a.plz ?? "",
        ort: a.ort ?? "",
        land: a.land ?? "DE",
      });
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wohnort & Adresse</CardTitle>
        <CardDescription>
          Lokale Anbieter (Strom, Wasser, Versicherungen mit Wohnungsbezug)
          werden anhand der Adresse als privat erkannt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="strasse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Straße & Hausnummer</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Musterstraße 12"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="plz"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>PLZ</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="12345"
                        {...field}
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
                  <FormItem className="col-span-2">
                    <FormLabel>Ort</FormLabel>
                    <FormControl>
                      <Input placeholder="Musterstadt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="land"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Land</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LAENDER.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.label} ({l.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
