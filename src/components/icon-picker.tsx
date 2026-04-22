"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, GripVertical, Check } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type IconItem = {
  id: string;
  label: string;
  gruppe?: string | null;
  url?: string | null;
};

type Props = {
  icons: IconItem[];
  /** Ordered list of selected icon ids — order is preserved and persisted */
  selectedIds: string[];
  onToggle: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  /** Show remove buttons on selected icons (default: false) */
  showRemoveButtons?: boolean;
};

export function IconPicker({
  icons,
  selectedIds,
  onToggle,
  onReorder,
  showRemoveButtons = false,
}: Props) {
  const [search, setSearch] = useState("");

  const iconById = useMemo(() => new Map(icons.map((ic) => [ic.id, ic])), [icons]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredIcons = useMemo(() => {
    if (!normalizedSearch) return icons;
    return icons.filter(
      (ic) =>
        ic.label.toLowerCase().includes(normalizedSearch) ||
        (ic.gruppe ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [icons, normalizedSearch]);

  const grouped = useMemo(() => {
    const g: Record<string, IconItem[]> = {};
    for (const ic of filteredIcons) {
      const key = ic.gruppe ?? "Ohne Gruppe";
      if (!g[key]) g[key] = [];
      g[key].push(ic);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredIcons]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedIds.indexOf(String(active.id));
    const newIndex = selectedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(selectedIds, oldIndex, newIndex));
  }

  return (
    <div className="space-y-4">
      {/* Hidden inputs for form submission — order reflects drag-and-drop state */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="icon_ids" value={id} />
      ))}

      {/* Search field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Icons durchsuchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* Selected icons preview — draggable */}
      {selectedIds.length > 0 && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {selectedIds.length}
              </span>
              <p className="text-sm font-medium">Ausgewählt</p>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" /> Zum Sortieren ziehen
            </p>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={selectedIds} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-3">
                {selectedIds.map((id) => {
                  const ic = iconById.get(id);
                  if (!ic) return null;
                  return (
                    <SortableSelectedIcon
                      key={id}
                      icon={ic}
                      onRemove={showRemoveButtons ? () => onToggle(id) : undefined}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Grouped icon grid */}
      <div className="rounded-xl border bg-card">
        {icons.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Noch keine Icons angelegt.{" "}
            <a href="/icons/neu" className="text-primary hover:underline">
              Jetzt welche anlegen &rarr;
            </a>
          </p>
        )}

        {icons.length > 0 && grouped.length === 0 && normalizedSearch && (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Keine Icons gefunden für &bdquo;{search.trim()}&ldquo;
          </p>
        )}

        <div className="divide-y">
          {grouped.map(([gruppe, items]) => (
            <div key={gruppe} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {gruppe}
                </p>
                <span className="text-[10px] text-muted-foreground/60">
                  ({items.length})
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
                {items.map((ic) => {
                  const on = selectedSet.has(ic.id);
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => onToggle(ic.id)}
                      className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                        on
                          ? "bg-primary/10 ring-2 ring-primary shadow-sm"
                          : "ring-1 ring-border hover:ring-primary/40 hover:bg-muted/50"
                      }`}
                      title={ic.label}
                      aria-pressed={on}
                    >
                      {on && (
                        <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                      <div
                        className={`h-12 w-12 rounded-md bg-background flex items-center justify-center overflow-hidden ${
                          on ? "" : "border border-border/60 group-hover:border-border"
                        }`}
                      >
                        {ic.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ic.url}
                            alt={ic.label}
                            className="max-h-full max-w-full object-contain p-1"
                          />
                        ) : (
                          <span className="text-[9px] font-bold px-1 text-center leading-tight">
                            {ic.label}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] w-full truncate text-center leading-tight ${
                          on ? "text-primary font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {ic.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableSelectedIcon({
  icon,
  onRemove,
}: {
  icon: IconItem;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: icon.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex flex-col items-center gap-1.5 touch-none select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      {...attributes}
      {...listeners}
    >
      <div
        className={`relative h-14 w-14 rounded-lg bg-background flex items-center justify-center overflow-hidden transition-all ${
          isDragging
            ? "shadow-xl ring-2 ring-primary scale-105"
            : "ring-2 ring-primary/70 group-hover:ring-primary group-hover:shadow-md"
        }`}
      >
        {icon.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={icon.url}
            alt={icon.label}
            className="max-h-full max-w-full object-contain p-1 pointer-events-none"
          />
        ) : (
          <span className="text-[10px] font-bold pointer-events-none text-center px-1 leading-tight">
            {icon.label}
          </span>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
          aria-label={`${icon.label} entfernen`}
        >
          <X className="h-3 w-3" strokeWidth={3} />
        </button>
      )}
      <span className="text-[10px] text-center w-14 truncate pointer-events-none font-medium">
        {icon.label}
      </span>
    </div>
  );
}
