"use client";

import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Pencil, ChevronRight, ImageIcon } from "lucide-react";
import { DeleteKategorieButton } from "./delete-button";
import { reorderKategorien } from "./actions";
import { toast } from "sonner";

interface KategorieItem {
  id: string;
  name: string;
  bereich_id: string;
  bereichName: string;
  thumbnail_url: string | null;
  prodCount: number;
  icons: string[];
}

function KategorieCard({
  item,
  index,
  isDragOverlay,
}: {
  item: KategorieItem;
  index: number;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: isDragOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`group card-hover border-2 overflow-hidden ${
        isDragging ? "opacity-30" : ""
      } ${isDragOverlay ? "shadow-2xl ring-2 ring-primary/30" : ""}`}
    >
      <CardContent className="flex items-center gap-5 py-4 relative">
        <button
          type="button"
          className="shrink-0 relative z-20 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Reihenfolge aendern"
          {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <Link
          href={`/kategorien/${item.id}`}
          className="absolute inset-0 z-0"
          aria-label={`${item.name} oeffnen`}
        />

        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0 relative z-10">
          {index + 1}
        </div>

        <div className="h-16 w-24 rounded-lg bg-muted overflow-hidden shrink-0 relative z-10 border">
          {item.thumbnail_url ? (
            <Image
              src={item.thumbnail_url}
              alt=""
              width={96}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="font-semibold text-lg group-hover:text-primary transition-colors">
              {item.name}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{item.bereichName}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.icons.slice(0, 6).map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="hidden md:block text-center shrink-0 relative z-10 pointer-events-none min-w-14">
          <p className="text-2xl font-bold leading-none text-primary">
            {item.prodCount}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            Produkte
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative z-20">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hover:bg-primary/10 hover:text-primary"
          >
            <Link href={`/kategorien/${item.id}/bearbeiten`}>
              <Pencil className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Link>
          </Button>
          <DeleteKategorieButton id={item.id} name={item.name} />
          <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SortableKategorienList({
  initialItems,
}: {
  initialItems: KategorieItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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

    const { error } = await reorderKategorien(newItems.map((i) => i.id));
    if (error) {
      toast.error("Fehler beim Speichern der Reihenfolge");
      setItems(items);
    } else {
      toast.success("Reihenfolge gespeichert");
    }
  }

  const activeItem = activeId
    ? items.find((i) => i.id === activeId)
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-3">
          {items.map((item, i) => (
            <KategorieCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <KategorieCard
            item={activeItem}
            index={items.indexOf(activeItem)}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
