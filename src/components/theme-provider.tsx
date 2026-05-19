"use client";

// Apple-Design: Light/Dark-Umschaltung via next-themes.
// Klasse auf <html> → unsere .dark-Tokens in globals.css greifen automatisch.

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
