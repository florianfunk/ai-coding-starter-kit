"use client";

/**
 * PROJ-41: Manueller Crop-Editor mit Aspect-Lock + Live-Vorschau.
 *
 * Wird vom CropSuggestionModal in den Editor-Modus gerendert. Zeigt das
 * Original mit interaktivem Crop-Rechteck (react-image-crop) und daneben
 * eine Live-Vorschau des finalen Slot-Ausschnitts.
 *
 * Aspect ist hart gelockt — kein Toggle.
 */

import { useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { CropAspect } from "./crop-suggestion-modal";

export interface ManualCropResult {
  /** Crop-Koordinaten in Pixel relativ zum Original-Bild */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Original-Dimensionen — wird vom Server zur Validierung benötigt */
  origWidth: number;
  origHeight: number;
}

interface Props {
  /** URL des zu croppenden Originalbilds */
  originalUrl: string;
  /** Slot-Aspect — bestimmt Aspect-Ratio des Crop-Rechtecks */
  aspect: CropAspect;
  /** Initiales Crop-Rechteck als Prozent-Werte (0..1) — z.B. vom Smart-Crop-Vorschlag */
  initialCrop?: { x: number; y: number; width: number; height: number };
  /** Callback bei jeder Crop-Änderung — Parent kann die finalen Pixel-Werte ablegen */
  onChange: (result: ManualCropResult | null) => void;
}

const ASPECT_RATIO: Record<CropAspect, number> = {
  wide: 5 / 1,
  tall: 1 / 2,
  a4: 210 / 297,
};

const MIN_CROP_PX = 50;

function buildCenteredAspectCrop(
  containerWidth: number,
  containerHeight: number,
  aspectValue: number,
): PercentCrop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspectValue, containerWidth, containerHeight),
    containerWidth,
    containerHeight,
  );
}

export function ManualCropEditor({ originalUrl, aspect, initialCrop, onChange }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop | undefined>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>();
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const aspectValue = ASPECT_RATIO[aspect];

  // Initial-Crop setzen, sobald Bild geladen ist
  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    setImgDims({ w: naturalWidth, h: naturalHeight });

    if (initialCrop) {
      const percentCrop: PercentCrop = {
        unit: "%",
        x: initialCrop.x * 100,
        y: initialCrop.y * 100,
        width: initialCrop.width * 100,
        height: initialCrop.height * 100,
      };
      setCrop(percentCrop);
      // Completed-Crop in Pixel umrechnen
      setCompletedCrop({
        unit: "px",
        x: initialCrop.x * naturalWidth,
        y: initialCrop.y * naturalHeight,
        width: initialCrop.width * naturalWidth,
        height: initialCrop.height * naturalHeight,
      });
    } else {
      const c = buildCenteredAspectCrop(naturalWidth, naturalHeight, aspectValue);
      setCrop(c);
      setCompletedCrop({
        unit: "px",
        x: (c.x / 100) * naturalWidth,
        y: (c.y / 100) * naturalHeight,
        width: (c.width / 100) * naturalWidth,
        height: (c.height / 100) * naturalHeight,
      });
    }
  }

  // Bei jedem completedCrop oder Bilddim-Wechsel das Ergebnis nach oben melden
  useEffect(() => {
    if (!completedCrop || !imgDims) {
      onChange(null);
      return;
    }
    if (completedCrop.width < MIN_CROP_PX || completedCrop.height < MIN_CROP_PX) {
      onChange(null);
      return;
    }
    onChange({
      x: Math.round(completedCrop.x),
      y: Math.round(completedCrop.y),
      width: Math.round(completedCrop.width),
      height: Math.round(completedCrop.height),
      origWidth: imgDims.w,
      origHeight: imgDims.h,
    });
  }, [completedCrop, imgDims, onChange]);

  const previewWrapperClass =
    aspect === "wide"
      ? "aspect-[5/1] w-full"
      : aspect === "tall"
      ? "aspect-[1/2] mx-auto max-w-[140px]"
      : "aspect-[210/297] mx-auto max-w-[180px]";

  // Live-Preview via CSS: Original-Bild positioniert + skaliert hinter einem Crop-Fenster
  const previewStyle: React.CSSProperties = (() => {
    if (!completedCrop || !imgDims || completedCrop.width === 0 || completedCrop.height === 0) {
      return { backgroundImage: `url(${originalUrl})` };
    }
    // Skalierungsfaktor: Crop-Width × Faktor = Container-Width
    // Container-Aspect entspricht Crop-Aspect, also Faktor = Container-Width / Crop-Width
    // Wir setzen background-size relativ zur Crop-Width (in %)
    const scaleX = (imgDims.w / completedCrop.width) * 100;
    const scaleY = (imgDims.h / completedCrop.height) * 100;
    const posX = -(completedCrop.x / completedCrop.width) * 100;
    const posY = -(completedCrop.y / completedCrop.height) * 100;
    return {
      backgroundImage: `url(${originalUrl})`,
      backgroundSize: `${scaleX}% ${scaleY}%`,
      backgroundPosition: `${posX}% ${posY}%`,
      backgroundRepeat: "no-repeat",
    };
  })();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
      <div className="min-w-0">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Crop-Bereich
        </div>
        <div className="overflow-hidden rounded-[12px] border border-border/60 bg-muted/30">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectValue}
            keepSelection
            minWidth={MIN_CROP_PX}
            minHeight={MIN_CROP_PX}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={originalUrl}
              alt="Original"
              onLoad={handleImageLoad}
              className="block max-h-[60vh] w-auto"
            />
          </ReactCrop>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Ziehe das Rechteck oder die Anfasser. Aspect-Verhältnis ist gelockt.
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Live-Vorschau
        </div>
        <div
          className={`overflow-hidden rounded-[12px] border border-primary/30 bg-muted/30 ${previewWrapperClass}`}
          style={previewStyle}
          aria-label="Vorschau des finalen Slot-Ausschnitts"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          So sieht das Bild im Slot aus.
        </p>
      </div>
    </div>
  );
}
