// PROJ-17 — KI-Chat-Seite (Server Component).
//
// Minimal: laedt Initial-Daten via Mock-API und reicht sie an die
// Client-Komponente weiter. Das spaetere Backend lade hier per
// Supabase-SSR direkt aus chat_konversation + chat_nachricht (siehe
// Spec, Abschnitt "API-Route GET /api/chat/...").

import { requireUser } from "@/lib/auth/guard";
import { ChatPageInhalt } from "@/components/chat/chat-page-inhalt";
import {
  mockKonversationen,
  mockNachrichten,
} from "@/lib/chat/mock-daten";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KI-Chat · STEUERAGENT",
};

export default async function ChatPage() {
  // Auth-Guard wie bei den anderen App-Seiten (PROJ-1).
  await requireUser();

  // TODO Backend:
  //   const konversationen = await holeKonversationen(user.id);
  //   const aktive = konversationen[0]?.id ?? null;
  //   const nachrichten = aktive ? await holeNachrichten(aktive, user.id) : [];
  const konversationen = mockKonversationen();
  const aktiveId = konversationen[0]?.id ?? null;
  const nachrichten = aktiveId ? mockNachrichten(aktiveId) : [];

  return (
    <div className="-mx-6 -my-8 h-[calc(100vh-56px)] md:-mx-8 md:-my-8 md:h-[calc(100vh-56px)]">
      {/*
        Volle Hoehe fuer den Chat — wir kompensieren das Standard-Padding
        des AppLayouts (px-6 py-8 / md:px-8) und rechnen die Topbar (56 px)
        raus, damit das Chat-Panel exakt den Viewport ausfuellt.
      */}
      <div className="h-full px-4 py-4 md:px-6 md:py-6">
        <ChatPageInhalt
          initialKonversationen={konversationen}
          initialAktiveId={aktiveId}
          initialNachrichten={nachrichten}
        />
      </div>
    </div>
  );
}
