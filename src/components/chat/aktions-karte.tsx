"use client";

// PROJ-17 — Aktions-Karte (Confirm-Flow fuer Schreib-Tools).
//
// Wird zwischen den Nachrichten gerendert, wenn eine Assistant-Nachricht
// einen `chat_aktion`-Eintrag mitbringt (mehrere moeglich). Status-abhaengig:
//
//  - pending_confirm: "Bestaetigen" + "Abbrechen"
//  - confirmed:       gruener Haken + Zeitpunkt
//  - cancelled:       graues "Abgebrochen"-Badge + Zeitpunkt
//  - error:           Alert + "Neuen Vorschlag generieren"
//                     (legt einen frischen chat_aktion-Eintrag an — der
//                      Idempotenz-Check im Backend sperrt error-Vorschlaege.)
//
// Optimistic Update: beim Klick auf Bestaetigen sofort Loader anzeigen,
// dann auf das Promise-Ergebnis warten.

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestamp } from "@/lib/chat/datum";
import {
  abrecheAktionApi,
  aktionNeuerVorschlagApi,
  bestaetigeAktionApi,
} from "@/lib/chat/api";
import type { ChatAktion } from "@/lib/chat/typen";

interface Props {
  aktion: ChatAktion;
  konversationId: string;
  onStatusChange: (next: ChatAktion) => void;
  /**
   * Callback, wenn der Nutzer "Neuen Vorschlag generieren" klickt. Der
   * Parent-State sollte daraufhin die Nachrichten neu laden (damit der
   * frische chat_aktion-Eintrag + die neue Assistant-Nachricht im UI
   * erscheinen). Optional — wenn nicht gesetzt, wird der Button ausgeblendet.
   */
  onNeuerVorschlag?: () => void | Promise<void>;
}

function aktionsIcon(name: string) {
  if (name.startsWith("loesche")) return <Trash2 className="h-4 w-4" />;
  if (name.startsWith("lege")) return <Plus className="h-4 w-4" />;
  if (name.startsWith("aendere") || name === "bucheBuchungenUm")
    return <Pencil className="h-4 w-4" />;
  return <Pencil className="h-4 w-4" />;
}

export function AktionsKarte({
  aktion,
  konversationId,
  onStatusChange,
  onNeuerVorschlag,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function bestaetigen() {
    setBusy(true);
    try {
      const ergebnis = await bestaetigeAktionApi(konversationId, aktion.id);
      if (!ergebnis.ok) {
        onStatusChange({
          ...aktion,
          status: "error",
          fehler_text: ergebnis.fehler,
        });
        toast.error(`Aktion fehlgeschlagen: ${ergebnis.fehler}`);
        return;
      }
      onStatusChange({
        ...aktion,
        status: "confirmed",
        ausgefuehrt_am: ergebnis.ausgefuehrt_am,
        fehler_text: null,
      });
      toast.success("Aktion ausgeführt.");
    } finally {
      setBusy(false);
    }
  }

  async function abbrechen() {
    setBusy(true);
    try {
      const ergebnis = await abrecheAktionApi(konversationId, aktion.id);
      if (!ergebnis.ok) {
        toast.error(`Abbrechen fehlgeschlagen: ${ergebnis.fehler}`);
        return;
      }
      onStatusChange({
        ...aktion,
        status: "cancelled",
        ausgefuehrt_am: new Date().toISOString(),
      });
      toast.message("Aktion abgebrochen.");
    } finally {
      setBusy(false);
    }
  }

  async function neuerVorschlag() {
    setBusy(true);
    try {
      const res = await aktionNeuerVorschlagApi(konversationId, aktion.id);
      if (!res.ok) {
        toast.error(`Neuer Vorschlag fehlgeschlagen: ${res.fehler}`);
        return;
      }
      toast.success("Neuer Vorschlag erstellt.");
      // Parent laedt Nachrichten neu — dadurch erscheinen die neue
      // Assistant-Nachricht + die neue Aktions-Karte automatisch.
      if (onNeuerVorschlag) await onNeuerVorschlag();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.02] shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {aktionsIcon(aktion.aktion)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktions-Vorschlag
            </div>
            <h4 className="mt-0.5 text-sm font-semibold leading-tight">
              {aktion.titel}
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {aktion.vorschau}
            </p>
          </div>
        </div>
        <StatusBadge status={aktion.status} />
      </CardHeader>

      {aktion.vorher_nachher && aktion.vorher_nachher.length > 0 ? (
        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Datum</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Vorher</TableHead>
                  <TableHead>Nachher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aktion.vorher_nachher.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {z.datum}
                    </TableCell>
                    <TableCell className="text-sm">{z.empfaenger}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                      {z.betrag}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {z.vorher}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {z.nachher}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      ) : null}

      <CardContent className="pt-0">
        <StatusZeile aktion={aktion} />

        {aktion.status === "pending_confirm" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={bestaetigen} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Bestätigen
            </Button>
            <Button variant="ghost" onClick={abbrechen} disabled={busy}>
              Abbrechen
            </Button>
          </div>
        ) : null}

        {aktion.status === "error" ? (
          <div className="mt-3">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ausführung fehlgeschlagen</AlertTitle>
              <AlertDescription>
                {aktion.fehler_text ?? "Unbekannter Fehler."}
              </AlertDescription>
            </Alert>
            {onNeuerVorschlag ? (
              <Button
                variant="outline"
                size="sm"
                onClick={neuerVorschlag}
                disabled={busy}
                className="mt-2"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Neuen Vorschlag generieren
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ChatAktion["status"] }) {
  if (status === "confirmed") {
    return (
      <Badge className="shrink-0 rounded-full bg-tint-cyan text-income-strong hover:bg-tint-cyan dark:text-income">
        Bestätigt
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge variant="outline" className="shrink-0">
        Abgebrochen
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="shrink-0">
        Fehler
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0">
      Wartet auf Bestätigung
    </Badge>
  );
}

function StatusZeile({ aktion }: { aktion: ChatAktion }) {
  if (aktion.status === "confirmed" && aktion.ausgefuehrt_am) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-income-strong dark:text-income">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Erledigt am {formatTimestamp(aktion.ausgefuehrt_am)}
      </p>
    );
  }
  if (aktion.status === "cancelled" && aktion.ausgefuehrt_am) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <XCircle className="h-3.5 w-3.5" />
        Abgebrochen am {formatTimestamp(aktion.ausgefuehrt_am)}
      </p>
    );
  }
  return null;
}
