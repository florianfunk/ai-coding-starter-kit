"use client";

// PROJ-13 — Tab "Daten": 3 Wartungsaktionen, je mit AlertDialog-Bestätigung.
// Aktionen sind owner-scoped und irreversibel; Snapshots bleiben unberührt.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { WARTUNG_BESTAETIGUNG, type WartungAktion } from "@/lib/validation/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AktionDef {
  aktion: WartungAktion;
  titel: string;
  beschreibung: string;
  bestaetigung: string;
  buttonLabel: string;
}

const AKTIONEN: AktionDef[] = [
  {
    aktion: "buchungen_reset",
    titel: "Buchungen & Klassifizierung zurücksetzen",
    beschreibung:
      "Löscht alle importierten Buchungen samt KI-Klassifizierung und Beleg-Zuordnungen. Belege, Kontenrahmen und abgeschlossene Steuerperioden-Snapshots bleiben erhalten.",
    bestaetigung:
      "Alle Buchungen samt Klassifizierung und Beleg-Zuordnungen werden unwiderruflich gelöscht (nur deine Daten). Snapshots bleiben unberührt. Fortfahren?",
    buttonLabel: "Buchungen löschen",
  },
  {
    aktion: "belege_reset",
    titel: "Belege zurücksetzen",
    beschreibung:
      "Löscht alle aus Paperless importierten Belege samt Beleg-Zuordnungen. Buchungen, Kontenrahmen und Snapshots bleiben erhalten.",
    bestaetigung:
      "Alle Belege samt Beleg-Zuordnungen werden unwiderruflich gelöscht (nur deine Daten). Buchungen und Snapshots bleiben unberührt. Fortfahren?",
    buttonLabel: "Belege löschen",
  },
  {
    aktion: "kontenrahmen_reseed",
    titel: "Kontenrahmen leeren (neu seeden)",
    beschreibung:
      "Löscht alle EÜR-Kategorien. Danach unter „Einstellungen › Kontenrahmen“ den Standard-Kontenrahmen neu anlegen.",
    bestaetigung:
      "Alle EÜR-Kategorien werden unwiderruflich gelöscht (nur deine Daten). Danach musst du den Kontenrahmen neu seeden. Fortfahren?",
    buttonLabel: "Kontenrahmen leeren",
  },
];

export function DatenPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState<WartungAktion | null>(null);
  // Eingetippte Bestätigungsphrase je Aktion.
  const [phrasen, setPhrasen] = useState<Record<string, string>>({});

  async function ausfuehren(aktion: WartungAktion) {
    setBusy(aktion);
    try {
      const res = await fetch("/api/admin/wartung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aktion,
          bestaetigung: phrasen[aktion] ?? "",
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; betroffen?: number; message?: string; error?: string }
        | null;

      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Aktion fehlgeschlagen.");
        return;
      }
      toast.success(
        `${json.message ?? "Aktion abgeschlossen."} (${
          json.betroffen ?? 0
        } Datensätze betroffen)`,
      );
      router.refresh();
      // Phrase nach Erfolg zurücksetzen.
      setPhrasen((p) => ({ ...p, [aktion]: "" }));
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {AKTIONEN.map((a) => (
        <Card key={a.aktion}>
          <CardHeader>
            <CardTitle className="text-base">{a.titel}</CardTitle>
            <CardDescription>{a.beschreibung}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Irreversibel. Nur deine Daten (owner-scoped). Abgeschlossene
            Steuerperioden-Snapshots werden nicht angefasst.
          </CardContent>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy !== null}>
                  {busy === a.aktion ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {a.buttonLabel}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{a.titel}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {a.bestaetigung}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor={`bestaetigung-${a.aktion}`} className="text-sm">
                    Zur Bestätigung{" "}
                    <span className="font-mono font-semibold">
                      {WARTUNG_BESTAETIGUNG[a.aktion]}
                    </span>{" "}
                    eintippen:
                  </Label>
                  <Input
                    id={`bestaetigung-${a.aktion}`}
                    autoComplete="off"
                    value={phrasen[a.aktion] ?? ""}
                    onChange={(e) =>
                      setPhrasen((p) => ({ ...p, [a.aktion]: e.target.value }))
                    }
                    placeholder={WARTUNG_BESTAETIGUNG[a.aktion]}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={
                      (phrasen[a.aktion] ?? "").trim() !==
                      WARTUNG_BESTAETIGUNG[a.aktion]
                    }
                    onClick={() => void ausfuehren(a.aktion)}
                  >
                    Ja, ausführen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
