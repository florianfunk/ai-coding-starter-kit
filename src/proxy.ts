import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { pruefeCsrf } from "@/lib/security/csrf";

const PUBLIC_PATHS = ["/login", "/auth"];

/** Refresht die Supabase-Session und schützt App-Routen. */
export async function proxy(request: NextRequest) {
  // Zentraler CSRF-Schutz: mutierende Cross-Site-Anfragen abweisen, bevor
  // irgendeine state-ändernde Logik (oder Session-Arbeit) läuft.
  const csrf = pruefeCsrf(request);
  if (!csrf.ok) {
    console.warn(
      JSON.stringify({
        ereignis: "csrf_blockiert",
        pfad: request.nextUrl.pathname,
        methode: request.method,
        grund: csrf.grund,
      }),
    );
    return NextResponse.json(
      { error: "Anfrage abgelehnt (CSRF-Schutz)." },
      { status: 403 },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
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

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // API-Routen schützen sich selbst via getApiUser() (401 JSON).
  // Nur HTML-Seiten werden zum Login umgeleitet.
  const isApi = path.startsWith("/api/");

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)).*)"],
};
