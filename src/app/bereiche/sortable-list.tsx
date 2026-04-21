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
import { GripVertical, Pencil, ChevronRight, ImageIcon } from "lucide-react";
import { DeleteBereichButton } from "./delete-button";
import { reorderBereiche } from "./actions";
import { toast } from "sonner";

interface BereichItem {
  id: string;
  name: string;
  beschreibung: string | null;
  farbe: string | null;
  startseite: number | null;
  bild_url: string | null;
  katCount: number;
  prodCount: number;
}

function BereichCard({
  item,
  index,
  isDragOverlay,
}: {
  item: BereichItem;
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
          href={`/bereiche/${item.id}`}
          className="absolute inset-0 z-0"
          aria-label={`${item.name} oeffnen`}
        />

        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 relative z-10 border-2"
          style={
            item.farbe
              ? { backgroundColor: item.farbe, borderColor: item.farbe }
              : undefined
          }
        >
          <span className={item.farbe ? "text-foreground/80" : "text-primary"}>
            {index + 1}
          </span>
        </div>

        <div className="h-16 w-24 rounded-lg bg-muted overflow-hidden shrink-0 relative z-10 border">
          {item.bild_url ? (
            <Image
              src={item.bild_url}
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
          <div className="font-semibold text-lg group-hover:text-primary transition-colors">
            {item.name}
          </div>
          {item.beschreibung && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
              {item.beschreibung}
            </p>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0 relative z-10 pointer-events-none">
          <div className="text-center min-w-14">
            <p className="text-2xl font-bold leading-none text-primary">
              {item.katCount}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Kategorien
            </p>
          </div>
          <div className="text-center min-w-14">
            <p className="text-2xl font-bold leading-none">{item.prodCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Produkte
            </p>
          </div>
          <div className="text-center min-w-14">
            <p className="text-sm font-semibold leading-none">
              S. {item.startseite ?? "\u2014"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Start
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative z-20">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hover:bg-primary/10 hover:text-primary"
          >
            <Link href={`/bereiche/${item.id}/bearbeiten`}>
              <Pencil className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Link>
          </Button>
          <DeleteBereichButton id={item.id} name={item.name} />
          <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SortableBereicheList({
  initialItems,
}: {
  initialItems: BereichItem[];
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

    const { error } = await reorderBereiche(newItems.map((i) => i.id));
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
            <BereichCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <BereichCard
            item={activeItem}
            index={items.indexOf(activeItem)}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
