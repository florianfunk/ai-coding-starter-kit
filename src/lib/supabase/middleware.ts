import { NextResponse, type NextRequest } from "next/server";

// Auth temporarily disabled — every route is public.
// Re-enable by restoring the Supabase session check.
export async function updateSession(_request: NextRequest) {
  return NextResponse.next();
}
