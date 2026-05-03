import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Cache-bust: regenerate nft trace
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except: Next.js internals, static assets, and the
    // image-proxy/auth-callback routes (which handle their own access checks).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
