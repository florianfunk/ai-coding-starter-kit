"use client";

// PROJ-14 — Hauptansicht: Filter oben (Zeitraum, Konto, "nur
// steuerrelevant"), darunter Tabs Geschäftlich / Privat / Cockpit.
// Tab-Wahl bestimmt den Bereichs-Filter. Die Filter-Werte werden an die
// Tab-Inhalte durchgereicht — jeder Tab lädt seine eigenen Daten.

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ZeitraumPicker,
  type Zeitraum,
} from "@/components/kategorien-analyse/zeitraum-picker";
import {
  KategorienTabelle,
  type KategorienFilter,
} from "@/components/kategorien-analyse/kategorien-tabelle";
import { FinanzenCockpit } from "@/components/kategorien-analyse/finanzen-cockpit";
import { GeldbewegungenAnsicht } from "@/components/kategorien-analyse/geldbewegungen-ansicht";
import { AboRadarTab } from "@/components/kategorien-analyse/abo-radar-tab";
import { LieferantenTab } from "@/components/kategorien-analyse/lieferanten-tab";
import type { Bereich } from "@/lib/validation/kategorien-analyse";

interface Konto {
  id: string;
  bezeichnung: string;
  typ: "bank" | "paypal" | "kreditkarte";
}

/** Default-Zeitraum: laufendes Kalenderjahr. */
function defaultZeitraum(): Zeitraum {
  const y = new Date().getFullYear();
  return { von: `${y}-01-01`, bis: `${y}-12-31` };
}

type Tab =
  | "geschaeft"
  | "privat"
  | "bewegungen"
  | "abos"
  | "lieferanten"
  | "cockpit";

export function KategorienAnalyseAnsicht({ konten }: { konten: Konto[] }) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>(defaultZeitraum);
  const [kontoId, setKontoId] = useState<string>("alle");
  const [nurSteuerrelevant, setNurSteuerrelevant] = useState(false);
  const [tab, setTab] = useState<Tab>("geschaeft");

  // Tab → Bereich: 'geschaeft' und 'privat' bestimmen den Bereichs-Filter
  // direkt. 'cockpit' und 'bewegungen' zeigen alle Bereiche und nutzen
  // 'nur steuerrelevant' nicht (es geht um Konto-Sicht, nicht EÜR).
  const bereich: Bereich =
    tab === "geschaeft" ? "geschaeft" : tab === "privat" ? "privat" : "alle";
  const istKontoSicht =
    tab === "cockpit" ||
    tab === "bewegungen" ||
    tab === "abos" ||
    tab === "lieferanten";

  const kategorienFilter: KategorienFilter = {
    von: zeitraum.von,
    bis: zeitraum.bis,
    kontoId: kontoId === "alle" ? null : kontoId,
    bereich,
    nurSteuerrelevant,
  };

  return (
    <div className="space-y-6">
      {/* Filter — alles in einer kompakten Zeile, bricht responsiv um */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
          <ZeitraumPicker value={zeitraum} onChange={setZeitraum} />
          <span aria-hidden className="hidden h-6 w-px bg-border sm:inline-block" />
          <Select value={kontoId} onValueChange={setKontoId}>
            <SelectTrigger
              id="konto"
              aria-label="Konto"
              className="h-8 w-[180px] text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Konten</SelectItem>
              {konten.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.bezeichnung}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            className={
              "flex items-center gap-2 " +
              (istKontoSicht ? "text-muted-foreground" : "")
            }
            title={
              istKontoSicht ? "Filter wirkt nur in den EÜR-Sichten" : undefined
            }
          >
            <Switch
              id="steuerrelevant"
              checked={nurSteuerrelevant}
              onCheckedChange={setNurSteuerrelevant}
              disabled={istKontoSicht}
            />
            <Label htmlFor="steuerrelevant" className="cursor-pointer text-sm">
              Nur steuerrelevant
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="geschaeft">Geschäftlich</TabsTrigger>
          <TabsTrigger value="privat">Privat</TabsTrigger>
          <TabsTrigger value="bewegungen">Geldbewegungen</TabsTrigger>
          <TabsTrigger value="abos">Abo-Radar</TabsTrigger>
          <TabsTrigger value="lieferanten">Lieferanten</TabsTrigger>
          <TabsTrigger value="cockpit">Gesamt-Cockpit</TabsTrigger>
        </TabsList>

        <TabsContent value="geschaeft" className="mt-6">
          <KategorienTabelle filter={kategorienFilter} />
        </TabsContent>
        <TabsContent value="privat" className="mt-6">
          <KategorienTabelle filter={kategorienFilter} />
        </TabsContent>
        <TabsContent value="bewegungen" className="mt-6">
          <GeldbewegungenAnsicht
            filter={{
              von: zeitraum.von,
              bis: zeitraum.bis,
              kontoId: kontoId === "alle" ? null : kontoId,
              bereich: "alle",
            }}
          />
        </TabsContent>
        <TabsContent value="abos" className="mt-6">
          <AboRadarTab
            filter={{
              von: zeitraum.von,
              bis: zeitraum.bis,
              kontoId: kontoId === "alle" ? null : kontoId,
              bereich: "alle",
            }}
          />
        </TabsContent>
        <TabsContent value="lieferanten" className="mt-6">
          <LieferantenTab
            filter={{
              von: zeitraum.von,
              bis: zeitraum.bis,
              kontoId: kontoId === "alle" ? null : kontoId,
              bereich: "alle",
              nurSteuerrelevant,
            }}
          />
        </TabsContent>
        <TabsContent value="cockpit" className="mt-6">
          <FinanzenCockpit
            filter={{
              von: zeitraum.von,
              bis: zeitraum.bis,
              kontoId: kontoId === "alle" ? null : kontoId,
              bereich: "alle",
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
