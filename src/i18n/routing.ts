import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Supported locales — German is the primary language for RiskGuard.
  locales: ["de", "en"],
  defaultLocale: "de",
  // Path-based routing: every URL is prefixed (/de/..., /en/...).
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
