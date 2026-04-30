"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  Loader2,
  ImageIcon,
  Library,
} from "lucide-react";
import { bildProxyUrl } from "@/lib/bild-url";
import {
  listMediathek,
  type MediathekItem,
  type UsageFilter,
} from "@/app/mediathek/actions";

interface Props {
  /** Trigger-Button-Variante: "icon" für Slot-Action-Bar, "default" für Standalone */
  triggerSize?: "icon" | "default";
  /** Aspect-Filter-Hint für UI (zeigt eher passende Bilder zuerst — nicht bindend) */
  preferAspect?: "wide" | "tall" | "square" | null;
  /** Callback mit dem gewählten Pfad */
  onSelect: (path: string) => void;
  /** Optional: Trigger-Button-Label (für Default-Variante) */
  label?: string;
  className?: string;
}

export function MediathekPicker({
  triggerSize = "default",
  preferAspect: _preferAspect = null,
  onSelect,
  label = "Aus Mediathek wählen",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediathekItem[]>([]);
  const [search, setSearch] = useState("");
  const [usage, setUsage] = useState<UsageFilter>("all");
  const [pending, startTransition] = useTransition();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          const next = await listMediathek({ search, usage });
          setItems(next);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Listing fehlgeschlagen");
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [open, search, usage]);

  function handleConfirm() {
    if (!selectedPath) return;
    onSelect(selectedPath);
    setOpen(false);
    setSelectedPath(null);
  }

  return (
    <>
      {triggerSize === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Aus Mediathek wählen"
          title="Aus Mediathek wählen"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground ${className ?? ""}`}
        >
          <Library className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={`gap-1.5 ${className ?? ""}`}
        >
          <Library className="h-3.5 w-3.5" />
          {label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-4 w-4" /> Bild aus Mediathek wählen
            </DialogTitle>
            <DialogDescription>
              Wähle ein bereits hochgeladenes Bild — kein erneutes Upload nötig.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Datei oder Pfad suchen…"
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Suche zurücksetzen"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={usage} onValueChange={(v) => setUsage(v as UsageFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="used">Verwendet</SelectItem>
                <SelectItem value="unused">Unbenutzt</SelectItem>
              </SelectContent>
            </Select>
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-10 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                Keine Bilder gefunden.
              </p>
            </div>
          ) : (
            <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
              {items.map((item) => {
                const url = bildProxyUrl("produktbilder", item.path);
                const isSelected = selectedPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setSelectedPath(item.path)}
                    className={`group relative overflow-hidden rounded-md border-2 bg-card transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-primary/40"
                    }`}
                    title={item.name}
                  >
                    <div className="aspect-square w-full bg-muted/30">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="truncate p-1 text-[10px] text-muted-foreground">
                      {item.name}
                    </div>
                    {item.usageCount > 0 && (
                      <span className="absolute top-1 right-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-sm">
                        {item.usageCount}×
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-[11px] text-muted-foreground">
              {selectedPath ? "1 Bild ausgewählt" : "Wähle ein Bild durch Klick"}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={!selectedPath}>
                Übernehmen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
