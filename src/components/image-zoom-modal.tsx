"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
  title?: string;
}

export function ImageZoomModal({ open, onOpenChange, src, alt = "", title }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] p-2 sm:p-4">
        <DialogTitle className="sr-only">{title ?? "Bildvorschau"}</DialogTitle>
        <div className="flex max-h-[85vh] items-center justify-center overflow-auto rounded-md bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] w-auto object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
