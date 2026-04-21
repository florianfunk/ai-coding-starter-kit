import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Muss Node.js sein — Supabase Storage Downloads benötigen Full-Node-APIs.
export const runtime = "nodejs";

// Nur bekannte Buckets zulassen.
const ALLOWED_BUCKETS = new Set(["produktbilder", "assets", "kataloge"]);

// Content-Type aus Dateiendung herleiten (fallback, wenn der Storage-Download
// keinen Typ liefert).
function contentTypeFromPath(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return null;
}

type RouteContext = {
  params: Promise<{ bucket: string; path: string[] }>;
};

export async function GET(_request: NextRequest, ctx: RouteContext) {
  // ---- 1) Auth-Gate -------------------------------------------------------
  // Nur authentifizierte Nutzer dürfen Bilder laden.
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- 2) Param-Validierung ----------------------------------------------
  const { bucket, path: pathSegments } = await ctx.params;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Unknown bucket" }, { status: 400 });
  }
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // Pfad-Traversal verhindern.
  const path = pathSegments.join("/");
  if (path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // ---- 3) Storage-Download (mit Service-Role, bypasst RLS sicher) --------
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.storage.from(bucket).download(path);

  if (error || !data) {
    const status = /not[\s-]?found/i.test(error?.message ?? "") ? 404 : 500;
    return NextResponse.json(
      { error: error?.message ?? "Download failed" },
      { status },
    );
  }

  // ---- 4) Response bauen mit Cache-Headern --------------------------------
  const arrayBuffer = await data.arrayBuffer();
  const type = data.type || contentTypeFromPath(path) || "application/octet-stream";

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "content-type": type,
      "content-length": String(arrayBuffer.byteLength),
      // Edge caching: 1h frisch, bis zu 1 Tag stale-while-revalidate.
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
