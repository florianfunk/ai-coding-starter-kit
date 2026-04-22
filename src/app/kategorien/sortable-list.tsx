"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Pencil,
  ChevronRight,
  ImageIcon,
  Search,
  List,
  LayoutGrid as LayoutGridIcon,
} from "lucide-react";
import { DeleteKategorieButton } from "./delete-button";
import { reorderKategorien } from "./actions";
import { toast } from "sonner";

interface KategorieItem {
  id: string;
  name: string;
  bereich_id: string;
  bereichName: string;
  bereichFarbe: string | null;
  thumbnail_url: string | null;
  prodCount: number;
  icons: string[];
}

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function Thumb({ item }: { item: KategorieItem }) {
  const bg = item.bereichFarbe
    ? item.bereichFarbe
    : `linear-gradient(135deg, hsl(${hashHue(item.bereich_id)},70%,68%), hsl(${(hashHue(item.bereich_id) + 40) % 360},70%,52%))`;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[10px] border border-border/60"
      style={{ width: 64, height: 44, background: bg }}
    >
      {item.thumbnail_url ? (
        <Image
          src={item.thumbnail_url}
          alt=""
          width={64}
          height={44}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-white/90">
          <span className="text-[11px] font-bold">
            {item.name
              .split(/[\s&-]/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

function KategorieRow({
  item,
  index,
  isDragOverlay,
}: {
  item: KategorieItem;
  index: number;
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: isDragOverlay,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`list-row group ${isDragging ? "opacity-30" : ""} ${
        isDragOverlay ? "rounded-xl bg-background shadow-xl ring-2 ring-primary/30" : ""
      }`}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Reihenfolge ändern"
        {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      >
        <GripVertical className="h-[18px] w-[18px]" />
      </button>

      <Link href={`/kategorien/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/70 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </div>
        <Thumb item={item} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            {item.bereichFarbe && (
              <span
                className="inline-block h-[10px] w-[10px] rounded-sm border border-border/50"
                style={{ backgroundColor: item.bereichFarbe }}
                aria-hidden
              />
            )}
            <span className="font-medium">{item.bereichName}</span>
          </div>
          {item.icons.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.icons.slice(0, 6).map((label) => (
                <Badge key={label} variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-medium">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="hidden items-center gap-5 md:flex">
        <div className="min-w-[54px] text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">{item.prodCount}</div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Prod.</div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Link
          href={`/kategorien/${item.id}/bearbeiten`}
          aria-label="Bearbeiten"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <DeleteKategorieButton id={item.id} name={item.name} />
      </div>
      <ChevronRight className="h-[14px] w-[14px] text-muted-foreground/40" />
    </div>
  );
}

function KategorieCard({ item }: { item: KategorieItem }) {
  const hue = hashHue(item.bereich_id);
  const bg = item.bereichFarbe
    ? item.bereichFarbe
    : `linear-gradient(135deg, hsl(${hue},70%,68%), hsl(${(hue + 40) % 360},70%,52%))`;
  return (
    <Link
      href={`/kategorien/${item.id}`}
      className="glass-card card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative h-[96px]" style={{ background: bg }}>
        {item.thumbnail_url ? (
          <Image
            src={item.thumbnail_url}
            alt=""
            width={400}
            height={192}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        )}
        <div className="absolute left-3.5 right-3.5 top-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/90">
          {item.bereichName}
        </div>
        <div className="absolute bottom-3 left-3.5 right-3.5">
          <div className="text-[18px] font-bold leading-[1.15] tracking-[-0.015em] text-white drop-shadow">
            {item.name}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {item.icons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.icons.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-medium text-foreground/80"
              >
                {t}
              </span>
            ))}
            {item.icons.length > 4 && (
              <span className="text-[10.5px] font-medium text-muted-foreground/70">
                +{item.icons.length - 4}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-1">
          <div>
            <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">{item.prodCount}</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Produkte</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SortableKategorienList({ initialItems }: { initialItems: KategorieItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.bereichName.toLowerCase().includes(q));
  }, [items, query]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    const { error } = await reorderKategorien(newItems.map((i) => i.id));
    if (error) {
      toast.error("Fehler beim Speichern der Reihenfolge");
      setItems(items);
    } else {
      toast.success("Reihenfolge gespeichert");
    }
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="toolbar">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <Search className="h-[15px] w-[15px] text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kategorien durchsuchen…"
            className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none"
          />
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex-1" />
        <div className="segmented">
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="Liste">
            <List className="h-[13px] w-[13px]" />
          </button>
          <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} aria-label="Kacheln">
            <LayoutGridIcon className="h-[13px] w-[13px]" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-[60px] text-center">
          <div className="mx-auto mb-3.5 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Search className="h-[22px] w-[22px]" />
          </div>
          <div className="mb-1 text-[16px] font-semibold">Nichts gefunden</div>
          <div className="text-[13px] text-muted-foreground">Versuche einen anderen Suchbegriff.</div>
        </div>
      ) : view === "list" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="glass-card overflow-hidden">
              {filtered.map((item, i) => (
                <KategorieRow key={item.id} item={item} index={i} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem ? <KategorieRow item={activeItem} index={items.indexOf(activeItem)} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {filtered.map((item) => (
            <KategorieCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
