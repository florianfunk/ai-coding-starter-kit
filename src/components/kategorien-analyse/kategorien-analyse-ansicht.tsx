"use client";

// PROJ-14 — Hauptansicht: Filter oben (Zeitraum, Konto, "nur
// steuerrelevant"), darunter Tabs Geschäftlich / Privat / Cockpit.
// Tab-Wahl bestimmt den Bereichs-Filter. Die Filter-Werte werden an die
// Tab-Inhalte durchgereicht — jeder Tab lädt seine eigenen Daten.

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { useJahr } from "@/components/jahr/jahr-provider";
import { clampZeitraum, jahrZuZeitraum } from "@/lib/jahr/aktives-jahr";

interface Konto {
  id: string;
  bezeichnung: string;
  typ: "bank" | "paypal" | "kreditkarte";
}

/** Aktuelle Uhrzeit (HH:MM) für die "Stand"-Anzeige. */
function uhrzeitJetzt(): string {
  return new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab =
  | "geschaeft"
  | "privat"
  | "bewegungen"
  | "abos"
  | "lieferanten"
  | "cockpit";

export function KategorienAnalyseAnsicht({ konten }: { konten: Konto[] }) {
  // PROJ-22: Default-Zeitraum = aktives Jahr (oder „Alle Jahre" = offen).
  const { aktivesJahr } = useJahr();
  const [zeitraum, setZeitraum] = useState<Zeitraum>(() =>
    jahrZuZeitraum(aktivesJahr),
  );
  const [kontoId, setKontoId] = useState<string>("alle");
  const [nurSteuerrelevant, setNurSteuerrelevant] = useState(false);
  const [tab, setTab] = useState<Tab>("geschaeft");

  // PROJ-20-Fix gegen veralteten Datenstand: ein zentraler refreshKey wird an
  // alle Tabs durchgereicht. Jede Erhöhung erzwingt dort ein Neuladen. Wird
  // ausgelöst durch (a) den manuellen Button, (b) Fenster-Fokus/Sichtbarkeit
  // — fängt Importe in anderen Tabs/Fenstern ab —, (c) erneute Wahl desselben
  // Zeitraums (Filter-Deps ändern sich dann nicht).
  const [refreshKey, setRefreshKey] = useState(0);
  // Leer initialisieren und erst clientseitig setzen — sonst Server-/Client-
  // Uhrzeit-Mismatch bei der Hydration.
  const [standZeit, setStandZeit] = useState<string>("");
  const letzterFokusRefresh = useRef<number>(0);

  useEffect(() => {
    // Bewusster Einmal-Render nach Mount: Die Uhrzeit ist client-only, der
    // Server kennt sie nicht — synchrones Setzen würde sonst einen Hydration-
    // Mismatch erzeugen. Genau der Fall, für den set-state-in-effect gedacht ist.
    setStandZeit(uhrzeitJetzt());
  }, []);

  const aktualisieren = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setStandZeit(uhrzeitJetzt());
  }, []);

  // PROJ-22: Wechselt das globale Jahr, wird der lokale Zeitraum auf dessen
  // Fenster zurückgesetzt (harte Klammer). „Alle Jahre" → offenes Fenster.
  useEffect(() => {
    // Synchronisation auf den globalen Jahres-Kontext — bewusst per Effect.
    setZeitraum(jahrZuZeitraum(aktivesJahr));
  }, [aktivesJahr]);

  // Auto-Refresh, sobald das Fenster/der Tab wieder den Fokus bekommt —
  // gedrosselt auf höchstens alle 10 s, damit schnelles Hin- und Herklicken
  // keine Fetch-Flut auslöst.
  useEffect(() => {
    function beiFokus() {
      if (typeof document !== "undefined" && document.hidden) return;
      const jetzt = Date.now();
      if (jetzt - letzterFokusRefresh.current < 10_000) return;
      letzterFokusRefresh.current = jetzt;
      aktualisieren();
    }
    window.addEventListener("focus", beiFokus);
    document.addEventListener("visibilitychange", beiFokus);
    return () => {
      window.removeEventListener("focus", beiFokus);
      document.removeEventListener("visibilitychange", beiFokus);
    };
  }, [aktualisieren]);

  // Zeitraum-Wahl: bei echter Änderung greift der Filter-Deps-Refetch der Tabs.
  // Wird derselbe Zeitraum erneut gewählt, ändern sich die Deps nicht — dann
  // explizit refreshen, damit die Auswahl trotzdem aktuelle Daten zieht.
  const handleZeitraum = useCallback(
    (z: Zeitraum) => {
      // PROJ-22: Detail-Auswahl bleibt innerhalb des aktiven Jahres.
      const geklammert = clampZeitraum(z, aktivesJahr);
      setZeitraum(geklammert);
      if (zeitraum.von === geklammert.von && zeitraum.bis === geklammert.bis)
        aktualisieren();
    },
    [zeitraum.von, zeitraum.bis, aktualisieren, aktivesJahr],
  );

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
          <ZeitraumPicker value={zeitraum} onChange={handleZeitraum} />
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

          {/* Aktualisieren + Datenstand — ganz rechts. Schützt davor, dass
              nach einem Import veraltete Zahlen stehen bleiben. */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              Stand {standZeit}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={aktualisieren}
              className="h-8 gap-1.5"
              title="Daten neu laden"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Aktualisieren
            </Button>
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
          <KategorienTabelle filter={kategorienFilter} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="privat" className="mt-6">
          <KategorienTabelle filter={kategorienFilter} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="bewegungen" className="mt-6">
          <GeldbewegungenAnsicht
            filter={{
              von: zeitraum.von,
              bis: zeitraum.bis,
              kontoId: kontoId === "alle" ? null : kontoId,
              bereich: "alle",
            }}
            refreshKey={refreshKey}
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
            refreshKey={refreshKey}
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
            refreshKey={refreshKey}
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
            refreshKey={refreshKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
