"use client";

// PROJ-5: Detail-Sheet einer Buchung — Begründung, Konfidenz, Quelle
// und Audit-Trail (auf Anfrage geladen). Nachvollziehbarkeit, keine Blackbox.

import { useEffect, useState } from "react";
import type { Buchung, Kategorie, Klassifikation } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEintrag {
  id: string;
  aktion: string;
  quelle: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const KLASS_LABEL: Record<Klassifikation, string> = {
  privat: "Privat",
  geschaeftlich: "Geschäftlich",
  unklar: "Unklar",
  neutral: "Neutral",
};

const QUELLE_LABEL: Record<string, string> = {
  regel: "Lernregel",
  ki: "KI",
  manuell: "Manuell",
};

function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBetrag(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function BuchungDetailSheet({
  buchung,
  kategorien,
  open,
  onOpenChange,
}: {
  buchung: Buchung | null;
  kategorien: Kategorie[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Audit-Ladezustand wird AUSSCHLIESSLICH asynchron gesetzt (nie synchron im
  // Effekt), inkl. der zugehörigen Buchungs-ID, damit die Anzeige nicht den
  // Trail einer vorher geöffneten Buchung zeigt.
  const [auditState, setAuditState] = useState<{
    buchungId: string | null;
    daten: AuditEintrag[] | null;
    fehler: boolean;
  }>({ buchungId: null, daten: null, fehler: false });

  useEffect(() => {
    if (!open || !buchung) return;
    const id = buchung.id;
    let abbruch = false;
    fetch(`/api/audit?entitaet=buchung&entitaet_id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Fehler"))))
      .then((j: { data?: AuditEintrag[] }) => {
        if (!abbruch) {
          setAuditState({
            buchungId: id,
            daten: j.data ?? [],
            fehler: false,
          });
        }
      })
      .catch(() => {
        if (!abbruch) {
          setAuditState({ buchungId: id, daten: null, fehler: true });
        }
      });
    return () => {
      abbruch = true;
    };
  }, [open, buchung]);

  const fuerAktuelle =
    buchung != null && auditState.buchungId === buchung.id;
  const audit = fuerAktuelle ? auditState.daten : null;
  const ladeFehler = fuerAktuelle ? auditState.fehler : false;

  const kategorieName = (id: string | null) =>
    id ? (kategorien.find((k) => k.id === id)?.bezeichnung ?? "—") : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {buchung && (
          <>
            <SheetHeader>
              <SheetTitle>Buchungsdetails</SheetTitle>
              <SheetDescription>
                Nachvollziehbarkeit der Klassifizierungs-Entscheidung.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 px-4 pb-6 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground">Datum</div>
                  <div>{buchung.buchung_datum}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Betrag</div>
                  <div
                    className={
                      buchung.betrag < 0 ? "text-destructive" : undefined
                    }
                  >
                    {formatBetrag(buchung.betrag)} {buchung.waehrung}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Verwendungszweck</div>
                <div className="break-words">
                  {buchung.verwendungszweck ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Empfänger</div>
                <div className="break-words">{buchung.empfaenger ?? "—"}</div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground">Klassifikation</div>
                  <div>
                    {buchung.klassifikation
                      ? KLASS_LABEL[buchung.klassifikation]
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Steuerrelevant</div>
                  <div>
                    {buchung.steuerrelevant === null
                      ? "—"
                      : buchung.steuerrelevant
                        ? "Ja"
                        : "Nein"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Kategorie</div>
                  <div>{kategorieName(buchung.kategorie_id)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">USt-Satz</div>
                  <div>
                    {buchung.ust_satz === null
                      ? "—"
                      : `${buchung.ust_satz} %`}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Quelle</div>
                  <div>
                    {buchung.quelle
                      ? (QUELLE_LABEL[buchung.quelle] ?? buchung.quelle)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Konfidenz</div>
                  <div>
                    {buchung.konfidenz === null
                      ? "—"
                      : `${Math.round(buchung.konfidenz * 100)} %`}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground">Begründung</div>
                <p className="mt-1 rounded-md bg-muted p-3">
                  {buchung.begruendung ?? "Noch nicht klassifiziert."}
                </p>
              </div>

              {buchung.pruef_grund && (
                <div>
                  <div className="text-muted-foreground">Prüfgrund</div>
                  <Badge variant="destructive">{buchung.pruef_grund}</Badge>
                </div>
              )}

              <Separator />

              <div>
                <div className="mb-2 font-medium">Audit-Trail</div>
                {ladeFehler ? (
                  <p className="text-muted-foreground">
                    Audit-Einträge konnten nicht geladen werden.
                  </p>
                ) : audit === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : audit.length === 0 ? (
                  <p className="text-muted-foreground">
                    Keine Audit-Einträge vorhanden.
                  </p>
                ) : (
                  <ScrollArea className="h-56 rounded-md border">
                    <ul className="divide-y">
                      {audit.map((a) => (
                        <li key={a.id} className="space-y-1 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{a.aktion}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDatum(a.created_at)}
                            </span>
                          </div>
                          {a.quelle && (
                            <div className="text-xs text-muted-foreground">
                              Quelle: {a.quelle}
                            </div>
                          )}
                          {a.details && (
                            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                              {JSON.stringify(a.details, null, 2)}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
