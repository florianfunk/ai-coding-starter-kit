"use client";

// PROJ-6: Manuelle Beleg<->Buchung-Verknüpfung via Command-Suche + Dialog.
// Beide Seiten suchen, verknüpfen → status='manuell', gesperrt=true.

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  formatBetrag,
  formatDatum,
  type BelegKurz,
  type BuchungKurz,
} from "@/components/abgleich/abgleich-typen";

export function ManuelleZuordnungDialog({
  alleBelege,
  alleBuchungen,
  vorauswahlBuchung,
  vorauswahlBeleg,
  trigger,
  onErfolg,
}: {
  alleBelege: BelegKurz[];
  alleBuchungen: BuchungKurz[];
  vorauswahlBuchung?: BuchungKurz | null;
  vorauswahlBeleg?: BelegKurz | null;
  trigger?: React.ReactNode;
  onErfolg: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [buchung, setBuchung] = useState<BuchungKurz | null>(
    vorauswahlBuchung ?? null,
  );
  const [beleg, setBeleg] = useState<BelegKurz | null>(
    vorauswahlBeleg ?? null,
  );
  const [busy, setBusy] = useState(false);

  function reset() {
    setBuchung(vorauswahlBuchung ?? null);
    setBeleg(vorauswahlBeleg ?? null);
  }

  async function verknuepfen() {
    if (!buchung || !beleg) return;
    setBusy(true);
    try {
      const res = await fetch("/api/abgleich/zuordnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beleg_id: beleg.id, buchung_id: buchung.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Zuordnung fehlgeschlagen");
        setBusy(false);
        return;
      }
      toast.success("Beleg und Buchung wurden verknüpft.");
      setOpen(false);
      setBusy(false);
      reset();
      onErfolg();
    } catch {
      toast.error("Netzwerkfehler bei der Zuordnung");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Manuell zuordnen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manuelle Zuordnung</DialogTitle>
          <DialogDescription>
            Wähle eine Buchung und einen Beleg. Die Verknüpfung wird als
            manuell gesperrt gespeichert und vom automatischen Abgleich nicht
            mehr verändert.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium">Buchung</p>
            {buchung ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {formatBetrag(buchung.betrag, buchung.waehrung)}
                </p>
                <p className="text-muted-foreground">
                  {formatDatum(buchung.buchung_datum)} ·{" "}
                  {buchung.empfaenger ?? "ohne Empfänger"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  onClick={() => setBuchung(null)}
                >
                  Ändern
                </Button>
              </div>
            ) : (
              <Command className="rounded-md border">
                <CommandInput placeholder="Buchung suchen…" />
                <CommandList className="max-h-48">
                  <CommandEmpty>Keine Buchung gefunden.</CommandEmpty>
                  <CommandGroup>
                    {alleBuchungen.map((b) => (
                      <CommandItem
                        key={b.id}
                        value={`${b.empfaenger ?? ""} ${b.verwendungszweck ?? ""} ${b.betrag} ${b.buchung_datum}`}
                        onSelect={() => setBuchung(b)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {formatBetrag(b.betrag, b.waehrung)} ·{" "}
                            {formatDatum(b.buchung_datum)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {b.empfaenger ?? b.verwendungszweck ?? "–"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Beleg</p>
            {beleg ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {beleg.titel ?? `Beleg #${beleg.paperless_id}`}
                </p>
                <p className="text-muted-foreground">
                  {formatDatum(beleg.beleg_datum)} ·{" "}
                  {formatBetrag(beleg.betrag)} ·{" "}
                  {beleg.korrespondent ?? "ohne Korrespondent"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  onClick={() => setBeleg(null)}
                >
                  Ändern
                </Button>
              </div>
            ) : (
              <Command className="rounded-md border">
                <CommandInput placeholder="Beleg suchen…" />
                <CommandList className="max-h-48">
                  <CommandEmpty>Kein Beleg gefunden.</CommandEmpty>
                  <CommandGroup>
                    {alleBelege.map((b) => (
                      <CommandItem
                        key={b.id}
                        value={`${b.titel ?? ""} ${b.korrespondent ?? ""} ${b.betrag ?? ""} ${b.beleg_datum ?? ""} ${b.paperless_id}`}
                        onSelect={() => setBeleg(b)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {b.titel ?? `Beleg #${b.paperless_id}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDatum(b.beleg_datum)} ·{" "}
                            {formatBetrag(b.betrag)} ·{" "}
                            {b.korrespondent ?? "–"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={verknuepfen}
            disabled={!buchung || !beleg || busy}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verknüpfen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
