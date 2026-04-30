"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { htmlToPlainText, isHtmlContent } from "@/lib/rich-text/sanitize";
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
import {
  GripVertical,
  Pencil,
  LayoutGrid as LayoutGridIcon,
  List,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { DeleteBereichButton } from "./delete-button";
import { reorderBereiche } from "./actions";
import { toast } from "sonner";

export interface BereichItem {
  id: string;
  name: string;
  beschreibung: string | null;
  farbe: string | null;
  startseite: number | null;
  bild_url: string | null;
  katCount: number;
  prodCount: number;
}

function Thumb({ item, size = "sm" }: { item: BereichItem; size?: "sm" | "lg" }) {
  const w = size === "sm" ? 64 : 120;
  const h = size === "sm" ? 44 : 80;
  const gradient = item.farbe
    ? item.farbe
    : `linear-gradient(135deg, hsl(${hashHue(item.id)},70%,68%), hsl(${(hashHue(item.id) + 40) % 360},70%,52%))`;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[10px] border border-border/60"
      style={{ width: w, height: h, background: gradient }}
    >
      {item.bild_url ? (
        <Image src={item.bild_url} alt="" width={w} height={h} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-white/90">
          <span className="text-[11px] font-bold">
            {item.name
              .split(/[\s-]/)
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

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function BereichRow({
  item,
  index,
  isDragOverlay,
  dragDisabled,
}: {
  item: BereichItem;
  index: number;
  isDragOverlay?: boolean;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: isDragOverlay || dragDisabled,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const plain = item.beschreibung
    ? isHtmlContent(item.beschreibung)
      ? htmlToPlainText(item.beschreibung)
      : item.beschreibung
    : "";

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`list-row group ${isDragging ? "opacity-30" : ""} ${
        isDragOverlay ? "shadow-xl ring-2 ring-primary/30 rounded-xl bg-background" : ""
      }`}
    >
      <button
        type="button"
        disabled={dragDisabled}
        className="shrink-0 cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground/40"
        aria-label={dragDisabled ? "Drag & Drop nur bei manueller Sortierung verfügbar" : "Reihenfolge ändern"}
        title={dragDisabled ? "Drag & Drop nur bei manueller Sortierung verfügbar" : "Reihenfolge ändern"}
        {...(isDragOverlay || dragDisabled ? {} : { ...attributes, ...listeners })}
      >
        <GripVertical className="h-[18px] w-[18px]" />
      </button>

      <Link href={`/bereiche/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="w-[26px] shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/70 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </div>
        <Thumb item={item} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{item.name}</span>
          </div>
          {plain && (
            <div className="line-clamp-1 text-[11.5px] text-muted-foreground">{plain}</div>
          )}
        </div>
      </Link>

      <div className="hidden items-center gap-5 md:flex">
        <div className="min-w-[54px] text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">{item.katCount}</div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Kat.</div>
        </div>
        <div className="min-w-[54px] text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">{item.prodCount}</div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Prod.</div>
        </div>
        <div className="min-w-[54px] text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">
            {item.startseite ?? <span className="text-muted-foreground/40">—</span>}
          </div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Seite</div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Link
          href={`/bereiche/${item.id}/bearbeiten`}
          aria-label="Bearbeiten"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <DeleteBereichButton id={item.id} name={item.name} />
      </div>
    </div>
  );
}

function BereichCard({ item }: { item: BereichItem }) {
  const hue = hashHue(item.id);
  const bg = item.farbe
    ? item.farbe
    : `linear-gradient(135deg, hsl(${hue},70%,68%), hsl(${(hue + 40) % 360},70%,52%))`;
  return (
    <Link
      href={`/bereiche/${item.id}`}
      className="glass-card card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative h-[116px]" style={{ background: bg }}>
        {item.bild_url ? (
          <Image
            src={item.bild_url}
            alt=""
            width={400}
            height={232}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        )}
        <div className="absolute bottom-3 left-3.5 right-3.5">
          <div className="text-[20px] font-bold leading-[1.1] tracking-[-0.015em] text-white drop-shadow">
            {item.name}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
        <div className="flex justify-between gap-2">
          <div>
            <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">{item.katCount}</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Kategorien</div>
          </div>
          <div>
            <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">{item.prodCount}</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Produkte</div>
          </div>
          {item.startseite != null && (
            <div>
              <div className="text-[17px] font-semibold tabular-nums tracking-[-0.012em]">
                {item.startseite}
              </div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Katalog-S.</div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

type SortKey = "manual" | "name" | "katCount" | "prodCount" | "startseite";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function BereicheHeader({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const headerCellClass =
    "flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 transition-colors hover:text-foreground";
  return (
    <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
      <div className="w-[18px] shrink-0" aria-hidden />
      <button
        type="button"
        onClick={() => onSort("manual")}
        className={`${headerCellClass} w-[26px] shrink-0 justify-start`}
        title="Manuelle Reihenfolge (Drag & Drop)"
      >
        #
      </button>
      <div className="w-[64px] shrink-0" aria-hidden />
      <button
        type="button"
        onClick={() => onSort("name")}
        className={`${headerCellClass} min-w-0 flex-1 justify-start`}
      >
        <span>Bereich</span>
        <SortIcon active={sortKey === "name"} dir={sortDir} />
      </button>
      <div className="hidden items-center gap-5 md:flex">
        <button
          type="button"
          onClick={() => onSort("katCount")}
          className={`${headerCellClass} min-w-[54px] justify-center`}
        >
          <span>Kat.</span>
          <SortIcon active={sortKey === "katCount"} dir={sortDir} />
        </button>
        <button
          type="button"
          onClick={() => onSort("prodCount")}
          className={`${headerCellClass} min-w-[54px] justify-center`}
        >
          <span>Prod.</span>
          <SortIcon active={sortKey === "prodCount"} dir={sortDir} />
        </button>
        <button
          type="button"
          onClick={() => onSort("startseite")}
          className={`${headerCellClass} min-w-[54px] justify-center`}
        >
          <span>Seite</span>
          <SortIcon active={sortKey === "startseite"} dir={sortDir} />
        </button>
      </div>
      <div className="w-[64px] shrink-0" aria-hidden />
    </div>
  );
}

export function SortableBereicheList({ initialItems }: { initialItems: BereichItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    if (sortKey === "manual") return base;

    const sorted = [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "de", { sensitivity: "base" });
      } else if (sortKey === "katCount") {
        cmp = a.katCount - b.katCount;
      } else if (sortKey === "prodCount") {
        cmp = a.prodCount - b.prodCount;
      } else if (sortKey === "startseite") {
        const av = a.startseite ?? Number.POSITIVE_INFINITY;
        const bv = b.startseite ?? Number.POSITIVE_INFINITY;
        cmp = av - bv;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === "manual") {
      setSortKey("manual");
      setSortDir("asc");
      return;
    }
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

    const { error } = await reorderBereiche(newItems.map((i) => i.id));
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
            placeholder="Bereiche durchsuchen…"
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
              <BereicheHeader
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              {filtered.map((item, i) => (
                <BereichRow
                  key={item.id}
                  item={item}
                  index={i}
                  dragDisabled={sortKey !== "manual"}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem ? <BereichRow item={activeItem} index={items.indexOf(activeItem)} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {filtered.map((item) => (
            <BereichCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="mt-1 text-center text-[11.5px] text-muted-foreground">
        {filtered.length} Bereiche ·{" "}
        {sortKey === "manual"
          ? "Drag & Drop zum Sortieren · Änderungen werden automatisch gespeichert"
          : "Spaltensortierung aktiv — manuelle Sortierung über '#' wiederherstellen"}
      </div>
    </div>
  );
}
