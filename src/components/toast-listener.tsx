"use client";

import { Suspense } from "react";
import { useToastOnRedirect } from "@/hooks/use-toast-on-redirect";

function ToastListenerInner() {
  useToastOnRedirect();
  return null;
}

export function ToastListener() {
  return (
    <Suspense fallback={null}>
      <ToastListenerInner />
    </Suspense>
  );
}
