"use client";

// PROJ-13 — Tab "Benutzer": E-Mail + letzte Anmeldung (read-only) +
// Passwort-ändern-Formular (client-seitige Längen-/Übereinstimmungsprüfung,
// Server macht die Re-Auth).

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import type { BenutzerInfo } from "@/app/(app)/einstellungen/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

function formatDatum(iso: string | null): string {
  if (!iso) return "unbekannt";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unbekannt";
  return d.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BenutzerPanel({ benutzer }: { benutzer: BenutzerInfo }) {
  const [aktuelles, setAktuelles] = useState("");
  const [neues, setNeues] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);

    if (aktuelles.length < 1) {
      setFehler("Bitte das aktuelle Passwort eingeben.");
      return;
    }
    if (neues.length < 8) {
      setFehler("Das neue Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (neues !== wiederholung) {
      setFehler("Die Passwort-Wiederholung stimmt nicht überein.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/passwort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aktuelles_passwort: aktuelles,
          neues_passwort: neues,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || !json?.ok) {
        const msg = json?.error ?? "Passwort konnte nicht geändert werden.";
        setFehler(msg);
        toast.error(msg);
        return;
      }
      toast.success("Passwort geändert.");
      setAktuelles("");
      setNeues("");
      setWiederholung("");
    } catch {
      const msg = "Netzwerkfehler. Bitte erneut versuchen.";
      setFehler(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
          <CardDescription>
            Deine Zugangsdaten (Single-Tenant).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>E-Mail</Label>
            <Input value={benutzer.email} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label>Letzte Anmeldung</Label>
            <Input
              value={formatDatum(benutzer.last_sign_in_at)}
              readOnly
              disabled
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>
            Zur Sicherheit wird das aktuelle Passwort serverseitig geprüft
            (Re-Auth), bevor das neue gesetzt wird.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fehler && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{fehler}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="pw-aktuell">Aktuelles Passwort</Label>
              <Input
                id="pw-aktuell"
                type="password"
                autoComplete="current-password"
                value={aktuelles}
                onChange={(e) => setAktuelles(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw-neu">Neues Passwort</Label>
              <Input
                id="pw-neu"
                type="password"
                autoComplete="new-password"
                value={neues}
                onChange={(e) => setNeues(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mindestens 8 Zeichen.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw-wdh">Neues Passwort wiederholen</Label>
              <Input
                id="pw-wdh"
                type="password"
                autoComplete="new-password"
                value={wiederholung}
                onChange={(e) => setWiederholung(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Passwort ändern
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
