import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Kleinster Wert hier = Minimum für jeden <Image>-Optimizer-Request.
    // Default [16, 32, …] führt bei uns zu 400 INVALID_IMAGE_OPTIMIZE_REQUEST
    // für 16px-Variante über den /api/bild-Proxy → SSR crash.
    // Kleinste sinnvolle Größe im UI sind 20px-Icon-Kacheln, 32px deckt das ab.
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
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
};

export default nextConfig;
