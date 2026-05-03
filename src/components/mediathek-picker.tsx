"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  X,
  Loader2,
  ImageIcon,
  Library,
  Eye,
} from "lucide-react";
import { bildProxyUrl } from "@/lib/bild-url";
import {
  listMediathek,
  getMediathekFilterOptions,
  type MediathekItem,
  type UsageFilter,
  type MediathekFilterOptions,
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
  const [filterOptions, setFilterOptions] = useState<MediathekFilterOptions | null>(null);
  const [search, setSearch] = useState("");
  const [usage, setUsage] = useState<UsageFilter>("all");
  const [bereichId, setBereichId] = useState<string>("all");
  const [kategorieId, setKategorieId] = useState<string>("all");
  const [pending, startTransition] = useTransition();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediathekItem | null>(null);

  // Beim Öffnen: Filter-Optionen einmal laden
  useEffect(() => {
    if (!open || filterOptions) return;
    void getMediathekFilterOptions().then(setFilterOptions);
  }, [open, filterOptions]);

  // Wenn Bereich wechselt, Kategorie zurücksetzen (sonst kann sie inkonsistent sein).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Cross-Filter-Reset
    setKategorieId("all");
  }, [bereichId]);

  // Liste laden bei Filter-Änderung (debounced für Suche)
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          const next = await listMediathek({
            search,
            usage,
            bereichId,
            kategorieId,
          });
          setItems(next);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Listing fehlgeschlagen");
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [open, search, usage, bereichId, kategorieId]);

  // Kategorien-Liste optional einschränken auf den gewählten Bereich
  const filteredKategorien = useMemo(() => {
    if (!filterOptions) return [];
    if (bereichId === "all") return filterOptions.kategorien;
    return filterOptions.kategorien.filter((k) => k.bereichId === bereichId);
  }, [filterOptions, bereichId]);

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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-4 w-4" /> Bild aus Mediathek wählen
            </DialogTitle>
            <DialogDescription>
              Filter nach Bereich, Kategorie und Verwendung — wähle ein bereits
              hochgeladenes Bild ohne erneutes Upload.
            </DialogDescription>
          </DialogHeader>

          {/* Filter-Bar — zwei Reihen für Übersichtlichkeit */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suche in Pfad / Produkt / Kategorie…"
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

            <div className="flex flex-wrap items-center gap-2">
              <Select value={bereichId} onValueChange={setBereichId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Alle Bereiche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Bereiche</SelectItem>
                  {filterOptions?.bereiche.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kategorieId} onValueChange={setKategorieId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Alle Kategorien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {filteredKategorien.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(bereichId !== "all" || kategorieId !== "all" || usage !== "all" || search) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setUsage("all");
                    setBereichId("all");
                    setKategorieId("all");
                  }}
                  className="text-xs"
                >
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-10 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                Keine Bilder gefunden — Filter anpassen.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[55vh] pr-3">
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                style={{ gridAutoRows: "minmax(220px, auto)" }}
              >
              {items.map((item) => {
                const url = bildProxyUrl("produktbilder", item.path);
                const isSelected = selectedPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setSelectedPath(item.path)}
                    className={`group relative flex h-full flex-col overflow-hidden rounded-lg border-2 bg-card text-left transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-primary/40"
                    }`}
                    title={item.smartTitle || item.name}
                  >
                    {/* Bild-Bereich nimmt allen verfügbaren Platz in der
                        Tile (Grid-Row ist mind. 220 px hoch). */}
                    <div className="relative min-h-0 flex-1 bg-muted/40">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={item.smartTitle || item.name}
                          className="absolute inset-0 h-full w-full object-contain p-2"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      {item.usageCount > 0 && (
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                          {item.usageCount}×
                        </span>
                      )}
                      {url && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Vorschau in groß"
                          title="Vorschau in groß"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewItem(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreviewItem(item);
                            }
                          }}
                          className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="border-t bg-background p-2">
                      <div
                        className="line-clamp-2 text-[11.5px] font-medium leading-snug"
                        title={item.smartTitle || item.name}
                      >
                        {item.smartTitle || item.name}
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            </ScrollArea>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-[11px] text-muted-foreground">
              {selectedPath ? "1 Bild ausgewählt" : `${items.length} Bilder · Klick zum Auswählen`}
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

      {/* Lightbox-Vorschau in groß */}
      <Dialog
        open={previewItem !== null}
        onOpenChange={(o) => !o && setPreviewItem(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              {previewItem?.smartTitle || previewItem?.name}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {previewItem?.path}
            </DialogDescription>
          </DialogHeader>
          {previewItem && (
            <div className="relative flex max-h-[75vh] items-center justify-center bg-muted/30 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bildProxyUrl("produktbilder", previewItem.path) ?? ""}
                alt={previewItem.smartTitle || previewItem.name}
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPreviewItem(null)}
            >
              Schließen
            </Button>
            {previewItem && (
              <Button
                type="button"
                onClick={() => {
                  setSelectedPath(previewItem.path);
                  setPreviewItem(null);
                }}
              >
                Dieses Bild auswählen
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
