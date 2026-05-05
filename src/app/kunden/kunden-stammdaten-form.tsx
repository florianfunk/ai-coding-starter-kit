"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  createKunde,
  updateKunde,
  type KundeActionResult,
} from "./actions";

type Branche = { id: string; name: string };

type Stammdaten = {
  id?: string;
  kunden_nr: string;
  firma: string;
  ansprechpartner: string;
  email: string;
  telefon: string;
  website: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  standard_filiale: "lichtengros" | "eisenkeil" | "";
  notizen: string;
  status: "aktiv" | "archiviert";
  branche_ids: string[];
};

type Props = {
  initial: Stammdaten;
  alleBranchen: Branche[];
  mode: "create" | "edit";
};

export function KundenStammdatenForm({ initial, alleBranchen, mode }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Stammdaten>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function field<K extends keyof Stammdaten>(key: K, value: Stammdaten[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  }

  function toggleBranche(id: string) {
    setData((prev) => ({
      ...prev,
      branche_ids: prev.branche_ids.includes(id)
        ? prev.branche_ids.filter((b) => b !== id)
        : [...prev.branche_ids, id],
    }));
  }

  function buildPayload() {
    return {
      kunden_nr: data.kunden_nr.trim(),
      firma: data.firma.trim(),
      ansprechpartner: data.ansprechpartner || null,
      email: data.email,
      telefon: data.telefon || null,
      website: data.website || null,
      strasse: data.strasse || null,
      plz: data.plz || null,
      ort: data.ort || null,
      land: data.land || null,
      standard_filiale: data.standard_filiale === "" ? null : data.standard_filiale,
      notizen: data.notizen || null,
      status: data.status,
      branche_ids: data.branche_ids,
    };
  }

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const payload = buildPayload();
      let result: KundeActionResult;
      if (mode === "create") {
        result = await createKunde(payload);
      } else {
        result = await updateKunde(initial.id!, payload);
      }

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error ?? "Speichern fehlgeschlagen");
        return;
      }

      toast.success(mode === "create" ? "Kunde angelegt" : "Stammdaten gespeichert");
      if (mode === "create" && result.kundeId) {
        router.push(`/kunden/${result.kundeId}/stammdaten`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identifikation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="kunden_nr">
              Kunden-Nr. <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kunden_nr"
              value={data.kunden_nr}
              onChange={(e) => field("kunden_nr", e.target.value)}
              placeholder="K-0001"
              className={errors.kunden_nr ? "border-destructive" : ""}
            />
            {errors.kunden_nr && (
              <p className="mt-1 text-xs text-destructive">{errors.kunden_nr}</p>
            )}
          </div>
          <div>
            <Label htmlFor="firma">
              Firma <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firma"
              value={data.firma}
              onChange={(e) => field("firma", e.target.value)}
              className={errors.firma ? "border-destructive" : ""}
            />
            {errors.firma && (
              <p className="mt-1 text-xs text-destructive">{errors.firma}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontakt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="ansprechpartner">Ansprechpartner</Label>
            <Input
              id="ansprechpartner"
              value={data.ansprechpartner}
              onChange={(e) => field("ansprechpartner", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => field("email", e.target.value)}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="telefon">Telefon</Label>
            <Input
              id="telefon"
              value={data.telefon}
              onChange={(e) => field("telefon", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={data.website}
              onChange={(e) => field("website", e.target.value)}
              placeholder="https://"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anschrift</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="strasse">Straße</Label>
            <Input
              id="strasse"
              value={data.strasse}
              onChange={(e) => field("strasse", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="plz">PLZ</Label>
            <Input
              id="plz"
              value={data.plz}
              onChange={(e) => field("plz", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ort">Ort</Label>
            <Input
              id="ort"
              value={data.ort}
              onChange={(e) => field("ort", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="land">Land</Label>
            <Input
              id="land"
              value={data.land}
              onChange={(e) => field("land", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klassifizierung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Branchen</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Tags zur Kategorisierung — pflegen unter{" "}
              <Link href="/kunden/branchen" className="underline">
                /kunden/branchen
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-1">
              {alleBranchen.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Noch keine Branchen angelegt.
                </span>
              ) : (
                alleBranchen.map((b) => {
                  const active = data.branche_ids.includes(b.id);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => toggleBranche(b.id)}
                      className="focus:outline-none"
                    >
                      <Badge
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer text-xs hover:opacity-80"
                      >
                        {b.name}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <Label>Standard-Filiale</Label>
            <RadioGroup
              value={data.standard_filiale}
              onValueChange={(v) =>
                field("standard_filiale", v as Stammdaten["standard_filiale"])
              }
              className="mt-2 flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="lichtengros" />
                Lichtengros
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="eisenkeil" />
                Eisenkeil
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="" />
                keine
              </label>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notizen</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.notizen}
            onChange={(e) => field("notizen", e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Präferenzen, Sonderkonditionen, letzte Treffen …"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {data.notizen.length} / 2000 Zeichen
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex gap-2 border-t bg-background px-6 py-3">
        <Button onClick={handleSave} disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "Speichere…" : mode === "create" ? "Kunden anlegen" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(mode === "create" ? "/kunden" : `/kunden/${initial.id}/stammdaten`)}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
