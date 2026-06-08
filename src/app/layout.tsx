import type { ReactNode } from "react";
import "./globals.css";

// Root layout is a pass-through. The real <html>/<body> live in
// app/[locale]/layout.tsx — the [locale] segment is the effective root for all
// routes (next-intl App Router pattern with path-based locale routing).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
