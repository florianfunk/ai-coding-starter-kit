"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  X,
  Filter,
  Download as DownloadIcon,
  Trash2,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { bildProxyUrl } from "@/lib/bild-url";
import {
  listMediathek,
  getMediathekUsages,
  deleteMediathekBild,
  type MediathekItem,
  type UsageFilter,
} from "./actions";
import type { BildVerwendung } from "@/lib/bild-verwendung";

interface Props {
  initialItems: MediathekItem[];
}

export function MediathekGrid({ initialItems }: Props) {
  const [items, setItems] = useState<MediathekItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [usage, setUsage] = useState<UsageFilter>("all");
  const [prefix, setPrefix] = useState<string>("all");
  const [extension, setExtension] = useState<string>("all");
  const [pending, startTransition] = useTransition();

  // Detail-Sheet
  const [activeItem, setActiveItem] = useState<MediathekItem | null>(null);
  const [activeUsages, setActiveUsages] = useState<BildVerwendung[] | null>(null);
  const [usagesLoading, setUsagesLoading] = useState(false);

  // Delete-Confirm
  const [confirmDelete, setConfirmDelete] = useState<MediathekItem | null>(null);
  const [deleteUsages, setDeleteUsages] = useState<BildVerwendung[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Reload when filter changes (debounced for search)
  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          const next = await listMediathek({ search, usage, prefix, extension });
          setItems(next);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Listing fehlgeschlagen");
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [search, usage, prefix, extension]);

  // Distinct prefixes/extensions aus den initial geladenen Items
  const distinctPrefixes = useMemo(() => {
    const s = new Set(initialItems.map((i) => i.prefix));
    return Array.from(s).sort();
  }, [initialItems]);

  const distinctExtensions = useMemo(() => {
    const s = new Set(initialItems.map((i) => i.extension).filter(Boolean));
    return Array.from(s).sort();
  }, [initialItems]);

  async function openDetail(item: MediathekItem) {
    setActiveItem(item);
    setActiveUsages(null);
    setUsagesLoading(true);
    try {
      const usages = await getMediathekUsages(item.path);
      setActiveUsages(usages);
    } finally {
      setUsagesLoading(false);
    }
  }

  function closeDetail() {
    setActiveItem(null);
    setActiveUsages(null);
  }

  async function requestDelete(item: MediathekItem) {
    setDeleting(false);
    setConfirmDelete(item);
    setDeleteUsages([]);
    const usages = await getMediathekUsages(item.path);
    setDeleteUsages(usages);
  }

  async function performDelete(force: boolean) {
    if (!confirmDelete) return;
    setDeleting(true);
    const r = await deleteMediathekBild({ path: confirmDelete.path, force });
    setDeleting(false);
    if (!r.ok) {
      toast.error(r.error ?? "Löschen fehlgeschlagen");
      return;
    }
    toast.success("Bild gelöscht");
    setItems((prev) => prev.filter((i) => i.path !== confirmDelete.path));
    setConfirmDelete(null);
    if (activeItem?.path === confirmDelete.path) closeDetail();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
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

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={usage} onValueChange={(v) => setUsage(v as UsageFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="used">Verwendet</SelectItem>
              <SelectItem value="unused">Unbenutzt</SelectItem>
            </SelectContent>
          </Select>

          <Select value={prefix} onValueChange={setPrefix}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Ordner</SelectItem>
              {distinctPrefixes.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={extension} onValueChange={setExtension}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Formate</SelectItem>
              {distinctExtensions.map((ex) => (
                <SelectItem key={ex} value={ex}>
                  .{ex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-[60px] text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <div className="mt-3 text-[15px] font-medium">Keine Bilder gefunden</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Filter zurücksetzen oder neue Bilder hochladen.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <MediathekTile
              key={item.path}
              item={item}
              onOpen={() => openDetail(item)}
              onDelete={() => requestDelete(item)}
            />
          ))}
        </div>
      )}

      {/* Detail-Sheet */}
      <Sheet open={activeItem !== null} onOpenChange={(o) => !o && closeDetail()}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {activeItem && (
            <>
              <SheetHeader>
                <SheetTitle className="truncate text-base">{activeItem.name}</SheetTitle>
                <SheetDescription className="break-all text-[11px] font-mono">
                  {activeItem.path}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bildProxyUrl("produktbilder", activeItem.path) ?? ""}
                    alt={activeItem.name}
                    className="max-h-[40vh] w-full object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <Meta label="Größe" value={formatBytes(activeItem.size ?? 0)} />
                  <Meta label="Format" value={`.${activeItem.extension}`} />
                  <Meta label="Ordner" value={activeItem.prefix} />
                  <Meta label="Hochgeladen" value={formatDate(activeItem.createdAt)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a
                      href={bildProxyUrl("produktbilder", activeItem.path) ?? "#"}
                      download={activeItem.name}
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                      Herunterladen
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => requestDelete(activeItem)}
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Löschen
                  </Button>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold">Verwendet von</h3>
                    {activeUsages && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                        {activeUsages.length}
                      </span>
                    )}
                  </div>
                  {usagesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Lade Verwendungen…
                    </div>
                  ) : activeUsages && activeUsages.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">
                      Bild wird aktuell nicht verwendet — kann gefahrlos gelöscht werden.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(activeUsages ?? []).map((u, i) => (
                        <li key={`${u.entityType}-${u.entityId}-${u.slot}-${i}`}>
                          <Link
                            href={u.editUrl}
                            className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-[12px] hover:border-primary/40 hover:bg-muted/40"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {u.entityType} · {u.slot}
                              </div>
                              <div className="truncate font-medium">{u.label}</div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete-Confirm */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name}
              {deleteUsages.length > 0 && (
                <>
                  <br />
                  <span className="font-semibold text-destructive">
                    Achtung: Wird von {deleteUsages.length} Eintrag/-trägen verwendet.
                  </span>
                  <br />
                  Bei „Trotzdem löschen" werden die betroffenen Einträge ein Bild verlieren.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteUsages.length > 0 && (
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              {deleteUsages.slice(0, 5).map((u, i) => (
                <li key={i} className="truncate">
                  • {u.entityType}: {u.label} ({u.slot})
                </li>
              ))}
              {deleteUsages.length > 5 && (
                <li>… und {deleteUsages.length - 5} weitere</li>
              )}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void performDelete(deleteUsages.length > 0);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting
                ? "Lösche…"
                : deleteUsages.length > 0
                  ? "Trotzdem löschen"
                  : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MediathekTile({
  item,
  onOpen,
  onDelete,
}: {
  item: MediathekItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const url = bildProxyUrl("produktbilder", item.path);
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full"
        aria-label={`Details für ${item.name}`}
      >
        <div className="aspect-square w-full overflow-hidden bg-muted/30">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full place-items-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </button>

      <div className="space-y-1 p-2">
        <div className="truncate text-[11px] font-medium" title={item.name}>
          {item.name}
        </div>
        <div className="flex items-center justify-between">
          {item.usageCount > 0 ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-primary">
              {item.usageCount}× genutzt
            </span>
          ) : (
            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-warning">
              Unbenutzt
            </span>
          )}
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {formatBytes(item.size ?? 0)}
          </span>
        </div>
      </div>

      {/* Hover-Action: schnellzugriff Löschen */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`${item.name} löschen`}
        title="Löschen"
        className="absolute top-1.5 right-1.5 hidden h-7 w-7 items-center justify-center rounded-md border bg-background/95 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-[12px]">{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
