"use client";

// PROJ-21 — Wiederverwendbares Notiz-Panel für einen Lieferanten.
// CRUD mit optimistischen Updates. Genutzt im Lieferanten-Drilldown
// (PROJ-18) und auf der Übersichtsseite /lieferanten-notizen.
//
// Datenquelle:
//   - `initialNotizen` gesetzt → kein Fetch (Übersicht lädt serverseitig).
//   - sonst lazy GET /api/finanzen/lieferanten/notizen?norm=… beim Mount
//     (Drilldown: erst beim Aufklappen gemountet).

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LieferantNotiz } from "@/lib/finanzen/lieferant-notizen";

const MAX_LEN = 2000;

function deDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function LieferantNotizenPanel({
  empfaengerNorm,
  empfaengerName,
  initialNotizen,
  onCountChange,
}: {
  empfaengerNorm: string;
  /** Roh-Anzeigename — dient als `empfaenger` beim Anlegen (wird normalisiert). */
  empfaengerName: string;
  initialNotizen?: LieferantNotiz[];
  onCountChange?: (anzahl: number) => void;
}) {
  const [notizen, setNotizen] = useState<LieferantNotiz[]>(
    initialNotizen ?? [],
  );
  const [laedt, setLaedt] = useState(!initialNotizen);
  const [neuerText, setNeuerText] = useState("");
  const [speichertNeu, setSpeichertNeu] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loeschId, setLoeschId] = useState<string | null>(null);

  // Aktuelle Anzahl nach außen melden (Badge-Aktualisierung), ohne Render-Loop.
  const meldeRef = useRef(onCountChange);
  meldeRef.current = onCountChange;
  useEffect(() => {
    meldeRef.current?.(notizen.length);
  }, [notizen.length]);

  useEffect(() => {
    if (initialNotizen) return;
    let abbruch = false;
    setLaedt(true);
    fetch(
      `/api/finanzen/lieferanten/notizen?norm=${encodeURIComponent(empfaengerNorm)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Fehler"))))
      .then((j: { notizen?: LieferantNotiz[] }) => {
        if (!abbruch) setNotizen(j.notizen ?? []);
      })
      .catch(() => {
        if (!abbruch) toast.error("Notizen konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!abbruch) setLaedt(false);
      });
    return () => {
      abbruch = true;
    };
  }, [empfaengerNorm, initialNotizen]);

  async function hinzufuegen() {
    const text = neuerText.trim();
    if (!text) {
      toast.error("Die Notiz darf nicht leer sein.");
      return;
    }
    setSpeichertNeu(true);
    try {
      const r = await fetch("/api/finanzen/lieferanten/notizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empfaenger: empfaengerName, inhalt: text }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as { notiz: LieferantNotiz };
      setNotizen((ns) => [j.notiz, ...ns]);
      setNeuerText("");
      toast.success("Notiz hinzugefügt");
    } catch (e) {
      toast.error(
        "Hinzufügen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setSpeichertNeu(false);
    }
  }

  function startEdit(n: LieferantNotiz) {
    setEditId(n.id);
    setEditText(n.inhalt);
  }
  function abbrechenEdit() {
    setEditId(null);
    setEditText("");
  }

  async function speichernEdit(id: string) {
    const text = editText.trim();
    if (!text) {
      toast.error("Die Notiz darf nicht leer sein.");
      return;
    }
    setBusyId(id);
    try {
      const r = await fetch(`/api/finanzen/lieferanten/notizen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inhalt: text }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as { notiz: LieferantNotiz };
      setNotizen((ns) => ns.map((x) => (x.id === id ? j.notiz : x)));
      abbrechenEdit();
      toast.success("Notiz gespeichert");
    } catch (e) {
      toast.error(
        "Speichern fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function loeschen(id: string) {
    setBusyId(id);
    // optimistisch entfernen
    const vorher = notizen;
    setNotizen((ns) => ns.filter((x) => x.id !== id));
    setLoeschId(null);
    try {
      const r = await fetch(`/api/finanzen/lieferanten/notizen/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Notiz gelöscht");
    } catch (e) {
      setNotizen(vorher); // Rollback
      toast.error(
        "Löschen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Neue Notiz */}
      <div className="space-y-2 rounded-md border bg-background p-3">
        <label
          htmlFor={`notiz-neu-${empfaengerNorm}`}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Neue Notiz
        </label>
        <Textarea
          id={`notiz-neu-${empfaengerNorm}`}
          value={neuerText}
          onChange={(e) => setNeuerText(e.target.value.slice(0, MAX_LEN))}
          placeholder="z. B. Adobe Creative Cloud Lizenz, jährlich, geschäftlich"
          rows={2}
          className="text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {neuerText.length}/{MAX_LEN}
          </span>
          <Button
            size="sm"
            onClick={hinzufuegen}
            disabled={speichertNeu || neuerText.trim().length === 0}
          >
            {speichertNeu ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Hinzufügen
          </Button>
        </div>
      </div>

      {/* Liste */}
      {laedt ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">Lade Notizen…</p>
      ) : notizen.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          Noch keine Notizen für diesen Lieferanten.
        </p>
      ) : (
        <ul className="space-y-2">
          {notizen.map((n) => {
            const istEdit = editId === n.id;
            const bearbeitet = n.aktualisiert_am !== n.erstellt_am;
            return (
              <li
                key={n.id}
                className="rounded-md border bg-card p-3 text-sm shadow-[var(--shadow-1)]"
              >
                {istEdit ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) =>
                        setEditText(e.target.value.slice(0, MAX_LEN))
                      }
                      rows={3}
                      className="text-sm"
                      aria-label="Notiz bearbeiten"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={abbrechenEdit}
                        disabled={busyId === n.id}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Abbrechen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => speichernEdit(n.id)}
                        disabled={busyId === n.id || editText.trim().length === 0}
                      >
                        {busyId === n.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Speichern
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words">
                        {n.inhalt}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {deDateTime(n.erstellt_am)}
                        {bearbeitet ? " · bearbeitet" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(n)}
                        title="Notiz bearbeiten"
                        aria-label="Notiz bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setLoeschId(n.id)}
                        title="Notiz löschen"
                        aria-label="Notiz löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={loeschId !== null}
        onOpenChange={(o) => {
          if (!o) setLoeschId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Notiz wird dauerhaft entfernt. Das kann nicht rückgängig
              gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => loeschId && loeschen(loeschId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
