import type { NextConfig } from "next";

// Security-Header (Hardening). Konservative, app-passende Content-Security-
// Policy plus die üblichen Schutz-Header. Ziel: Clickjacking, MIME-Sniffing
// und unkontrollierte Outbound-Verbindungen verhindern, ohne Login, Supabase,
// KI-Streaming (same-origin /api) oder Paperless (rein serverseitig) zu brechen.

const isDev = process.env.NODE_ENV !== "production";

/** Origins, zu denen der Browser verbinden darf (Supabase Auth/Realtime). */
function connectSrc(): string {
  const quellen = new Set<string>(["'self'"]);
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase) {
    try {
      const u = new URL(supabase);
      quellen.add(u.origin);
      quellen.add(`wss://${u.host}`); // Realtime-WebSocket
    } catch {
      /* ungültige URL ignorieren */
    }
  }
  if (isDev) quellen.add("ws:"); // Next.js HMR im Dev
  return Array.from(quellen).join(" ");
}

function contentSecurityPolicy(): string {
  // Next.js benötigt 'unsafe-inline' (Hydration/Styles); im Dev zusätzlich
  // 'unsafe-eval' (HMR/React Refresh). Skripte bleiben dennoch auf 'self'
  // beschränkt. frame-ancestors/object-src/base-uri sind strikt.
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc()}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
