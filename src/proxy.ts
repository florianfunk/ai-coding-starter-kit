import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const handleI18n = createMiddleware(routing);

// Paths (after stripping the locale prefix) reachable without a session.
const PUBLIC_PREFIXES = [
  "/login",
  "/reset-password",
  "/update-password",
  "/accept-invite",
  "/auth/",
];

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  if (segments.length > 1 && hasLocale(routing.locales, segments[1])) {
    return "/" + segments.slice(2).join("/");
  }
  return pathname;
}

function localeOf(pathname: string): string {
  const seg = pathname.split("/")[1];
  return hasLocale(routing.locales, seg) ? seg : routing.defaultLocale;
}

export async function proxy(request: NextRequest) {
  // 1. Locale routing first — produces the response we attach cookies to.
  const response = handleI18n(request);

  // 2. Until Supabase is configured we run in preview mode: no auth handling.
  if (!hasSupabaseEnv) return response;

  // 3. Refresh the session and persist any rotated tokens onto the response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = stripLocale(request.nextUrl.pathname) || "/";
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => path === p || path.startsWith(p),
  );
  const locale = localeOf(request.nextUrl.pathname);

  // 4. Route protection (carry refreshed cookies onto any redirect).
  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${target}`;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && !isPublic) return redirectTo("/login");
  if (user && (path === "/login" || path === "/")) return redirectTo("/dashboard");

  return response;
}

export const config = {
  // Run on everything except Next internals, API routes, Workflow's internal
  // paths (.well-known/workflow), and files with an extension.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.well-known/workflow|.*\\..*).*)",
  ],
};
