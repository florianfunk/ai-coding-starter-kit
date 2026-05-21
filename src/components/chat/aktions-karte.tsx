"use client";

// PROJ-17 — Aktions-Karte (Confirm-Flow fuer Schreib-Tools).
//
// Wird zwischen den Nachrichten gerendert, wenn eine Assistant-Nachricht
// ein `aktion`-Objekt mitbringt. Status-abhaengig:
//
//  - pending_confirm: "Bestaetigen" + "Abbrechen"
//  - confirmed:       gruener Haken + Zeitpunkt
//  - cancelled:       graues "Abgebrochen"-Badge + Zeitpunkt
//  - error:           Alert + "Erneut versuchen"
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
  mockAktionAbbrechen,
  mockAktionBestaetigen,
} from "@/lib/chat/mock-daten";
import type { ChatAktion } from "@/lib/chat/typen";

interface Props {
  aktion: ChatAktion;
  konversationId: string;
  onStatusChange: (next: ChatAktion) => void;
}

function aktionsIcon(name: string) {
  if (name.startsWith("loesche")) return <Trash2 className="h-4 w-4" />;
  if (name.startsWith("lege")) return <Plus className="h-4 w-4" />;
  if (name.startsWith("aendere") || name === "bucheBuchungenUm")
    return <Pencil className="h-4 w-4" />;
  return <Pencil className="h-4 w-4" />;
}

export function AktionsKarte({ aktion, konversationId, onStatusChange }: Props) {
  const [busy, setBusy] = useState(false);

  async function bestaetigen() {
    setBusy(true);
    // Optimistic: kurzfristig auf "confirmed" stellen waere falsch — wir
    // zeigen den Loader, bis das Backend antwortet.
    try {
      // TODO Backend: ersetze durch
      //   await fetch(`/api/chat/${konversationId}/aktion/${aktion.id}/bestaetigen`, { method: "POST" })
      // Die `konversationId` wird hier durchgereicht, damit der echte
      // Endpoint sie direkt nutzen kann.
      const ergebnis = await mockAktionBestaetigen(aktion.id);
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
    // konversationId ist im echten Backend-Flow noetig, hier ungenutzt:
    void konversationId;
  }

  async function abbrechen() {
    setBusy(true);
    try {
      // TODO Backend: ersetze durch
      //   await fetch(`/api/chat/${konversationId}/aktion/${aktion.id}/abbrechen`, { method: "POST" })
      await mockAktionAbbrechen(aktion.id);
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

  async function erneutVersuchen() {
    onStatusChange({
      ...aktion,
      status: "pending_confirm",
      fehler_text: null,
    });
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
            <Button
              variant="outline"
              size="sm"
              onClick={erneutVersuchen}
              className="mt-2"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ChatAktion["status"] }) {
  if (status === "confirmed") {
    return (
      <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
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
      <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
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
