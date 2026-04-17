"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function useToastOnRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const type = searchParams.get("toast");
    const message = searchParams.get("message");

    if (!type || !message) return;

    if (type === "success") {
      toast.success(message);
    } else if (type === "error") {
      toast.error(message);
    }

    // Remove toast params from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("message");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [searchParams]);
}
