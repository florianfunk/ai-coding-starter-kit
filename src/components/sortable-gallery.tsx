"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  id: string;
  url: string;
  alt_text: string | null;
  storage_path: string;
};

interface SortableGalleryProps {
  produktId: string;
  images: GalleryImage[];
  hauptbildPath?: string | null;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onSetHauptbild: (storagePath: string) => Promise<void>;
  onDelete: (imageId: string) => void;
  disabled?: boolean;
}

function SortableImageItem({
  image,
  isHauptbild,
  onSetHauptbild,
  onDelete,
  disabled,
  overlay,
}: {
  image: GalleryImage;
  isHauptbild: boolean;
  onSetHauptbild: (storagePath: string) => void;
  onDelete: (imageId: string) => void;
  disabled?: boolean;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={cn(
        "relative group rounded-lg border bg-card overflow-hidden",
        isDragging && "opacity-30 z-0",
        overlay && "shadow-2xl ring-2 ring-primary rotate-2",
      )}
    >
      {/* Drag Handle */}
      <button
        className={cn(
          "absolute top-1.5 left-1.5 z-10 rounded bg-black/60 p-1 text-white",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "touch-none cursor-grab active:cursor-grabbing",
          overlay && "opacity-100",
        )}
        {...(overlay ? {} : { ...attributes, ...listeners })}
        aria-label="Bild verschieben"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Hauptbild badge */}
      {isHauptbild && (
        <div className="absolute top-1.5 right-1.5 z-10 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          Hauptbild
        </div>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt_text ?? "Galeriebild"}
        className="aspect-square w-full object-cover"
        draggable={false}
      />

      {/* Hover overlay with actions */}
      <div
        className={cn(
          "absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors",
          "flex items-end justify-center gap-2 p-2",
          overlay && "bg-black/40",
        )}
      >
        <div className={cn(
          "flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0",
          overlay && "opacity-100 translate-y-0",
        )}>
          {!isHauptbild && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 gap-1 text-xs"
              onClick={() => onSetHauptbild(image.storage_path)}
              disabled={disabled}
              title="Als Hauptbild setzen"
              aria-label="Als Hauptbild setzen"
            >
              <Star className="h-3.5 w-3.5" />
              Hauptbild
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1 text-xs"
            onClick={() => onDelete(image.id)}
            disabled={disabled}
            title="Bild entfernen"
            aria-label="Bild entfernen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SortableGallery({
  images,
  hauptbildPath,
  onReorder,
  onSetHauptbild,
  onDelete,
  disabled,
}: SortableGalleryProps) {
  const [items, setItems] = useState(images);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync when parent images change (e.g. after upload/delete)
  // We track by joining IDs to detect structural changes
  const parentKey = images.map((i) => i.id).join(",");
  const [lastParentKey, setLastParentKey] = useState(parentKey);
  if (parentKey !== lastParentKey) {
    setItems(images);
    setLastParentKey(parentKey);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
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
    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    await onReorder(newItems.map((i) => i.id));
  }

  const activeImage = activeId ? items.find((i) => i.id === activeId) : null;

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Noch keine Galeriebilder vorhanden.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((image) => (
            <SortableImageItem
              key={image.id}
              image={image}
              isHauptbild={hauptbildPath === image.storage_path}
              onSetHauptbild={onSetHauptbild}
              onDelete={onDelete}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay adjustScale={false}>
        {activeImage ? (
          <SortableImageItem
            image={activeImage}
            isHauptbild={hauptbildPath === activeImage.storage_path}
            onSetHauptbild={onSetHauptbild}
            onDelete={onDelete}
            disabled
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
