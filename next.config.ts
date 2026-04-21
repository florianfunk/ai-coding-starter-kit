import type { NextConfig } from "next";

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
};

export default nextConfig;
