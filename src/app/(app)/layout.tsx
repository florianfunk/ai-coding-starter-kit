import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { JahrProvider } from "@/components/jahr/jahr-provider";
import { JahresWaehler } from "@/components/jahr/jahres-waehler";
import { ladeJahrKontext } from "@/lib/jahr/aktives-jahr";

/*
 * App-Shell im Editorial-Stil:
 *   ┌──────────┬─────────────────────────┐
 *   │ Sidebar  │ Topbar (56 px)          │
 *   │ 232 px   ├─────────────────────────┤
 *   │          │ Content (max 1320 px)   │
 *   │          │                         │
 *   └──────────┴─────────────────────────┘
 * Grid + overflow:hidden auf dem Wrapper, Content scrollt separat.
 */

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // PROJ-22: globalen Jahres-Kontext serverseitig laden (aktives Jahr + Auswahl).
  const supabase = await createClient();
  const { aktivesJahr, verfuegbareJahre } = await ladeJahrKontext(
    supabase,
    user.id,
    new Date().getFullYear(),
  );

  return (
    <JahrProvider
      initialAktivesJahr={aktivesJahr}
      verfuegbareJahre={verfuegbareJahre}
    >
      <div
        className="md:grid md:h-screen md:grid-cols-[232px_1fr] md:overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        <AppSidebar />
        <main className="flex flex-col md:overflow-hidden">
          <div
            className="hidden min-h-[56px] items-center gap-3 px-6 md:flex"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div
              className="text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              STEUERAGENT
              <span
                className="mx-2"
                style={{ color: "var(--text-faint)" }}
              >
                /
              </span>
              <span style={{ color: "var(--text)" }}>Arbeitsbereich</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* PROJ-29: Command-Palette — Topbar-Trigger + globaler ⌘K-Dialog. */}
              <CommandPalette />
              <JahresWaehler />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8 md:pb-14">
            <div className="mx-auto w-full max-w-[1320px]">{children}</div>
          </div>
        </main>
      </div>
    </JahrProvider>
  );
}
