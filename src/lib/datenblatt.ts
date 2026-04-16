export type SlotKind = "image" | "energielabel" | "cutting";

export type Slot = {
  id: string;
  label: string;
  x_cm: number;
  y_cm: number;
  width_cm: number;
  height_cm: number;
  kind: SlotKind;
};

export type DatenblattTemplate = {
  id: string;
  name: string;
  beschreibung: string | null;
  is_system: boolean;
  page_width_cm: number;
  page_height_cm: number;
  slots: Slot[];
  sortierung: number;
};

export const DEFAULT_PAGE_WIDTH_CM = 21;
export const DEFAULT_PAGE_HEIGHT_CM = 29.7;

export function clampSlot(slot: Slot, pageW: number, pageH: number): Slot {
  const w = Math.max(1, Math.min(slot.width_cm, pageW));
  const h = Math.max(1, Math.min(slot.height_cm, pageH));
  const x = Math.max(0, Math.min(slot.x_cm, pageW - w));
  const y = Math.max(0, Math.min(slot.y_cm, pageH - h));
  return { ...slot, x_cm: Number(x.toFixed(2)), y_cm: Number(y.toFixed(2)), width_cm: Number(w.toFixed(2)), height_cm: Number(h.toFixed(2)) };
}

export function slotFromKind(kind: SlotKind): Partial<Slot> {
  if (kind === "energielabel") return { label: "Energielabel", width_cm: 1.5, height_cm: 3 };
  if (kind === "cutting") return { label: "Cutting-Diagramm", width_cm: 11, height_cm: 2.2 };
  return { label: "Bild", width_cm: 6, height_cm: 4.4 };
}
