import type { NextConfig } from "next";

const securityHeaders = [
  // SAMEORIGIN statt DENY: blockiert weiterhin Cross-Origin-Iframes
  // (Clickjacking-Schutz), erlaubt aber unsere eigene Datenblatt-Vorschau
  // (iframe in /produkte/[id]/datenblatt zeigt /produkte/[id]/datenblatt/raw).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/api/bild/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jmnszkurqgitzooczagy.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
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
