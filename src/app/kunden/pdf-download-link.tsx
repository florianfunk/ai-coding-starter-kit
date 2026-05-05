"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function PdfDownloadLink({ jobId }: { jobId: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch(`/api/katalog-jobs/${jobId}`, { cache: "no-store" });
      const data = (await res.json()) as { pdfUrl?: string; error?: string };
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      } else {
        toast.error(data.error ?? "PDF nicht verfügbar");
      }
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs underline disabled:opacity-50"
    >
      <Download className="h-3 w-3" />
      {pending ? "…" : "PDF"}
    </button>
  );
}
