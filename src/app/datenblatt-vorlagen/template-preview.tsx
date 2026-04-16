import type { Slot } from "@/lib/datenblatt";

const SLOT_COLORS: Record<string, string> = {
  image: "#193073",
  energielabel: "#D90416",
  cutting: "#FFC10D",
};

export function TemplatePreview({
  pageWidth, pageHeight, slots, targetWidthPx = 300,
}: {
  pageWidth: number;
  pageHeight: number;
  slots: Slot[];
  targetWidthPx?: number;
}) {
  const scale = targetWidthPx / pageWidth;
  const h = pageHeight * scale;

  return (
    <div
      className="relative bg-white border rounded shadow-sm overflow-hidden"
      style={{ width: targetWidthPx, height: h }}
    >
      {slots.map((s) => (
        <div
          key={s.id}
          className="absolute border"
          style={{
            left: s.x_cm * scale,
            top: s.y_cm * scale,
            width: s.width_cm * scale,
            height: s.height_cm * scale,
            borderColor: SLOT_COLORS[s.kind] ?? "#888",
            background: `${SLOT_COLORS[s.kind] ?? "#888"}22`,
          }}
          title={`${s.label} (${s.width_cm}×${s.height_cm} cm)`}
        >
          <span
            className="absolute top-0 left-0 text-[8px] leading-none px-1 py-0.5 font-semibold"
            style={{ color: SLOT_COLORS[s.kind] ?? "#333" }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
