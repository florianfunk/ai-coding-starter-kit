-- PROJ-17: KI-Chat — Konversationen, Nachrichten, Aktions-Vorschläge.
--
-- Drei Tabellen für den Chat-Bereich:
--   1) chat_konversation — Chat-Faden (Titel, Owner, Timestamps)
--   2) chat_nachricht    — einzelne Beiträge (user/assistant/tool/system)
--                          inkl. Tool-Calls + Token-Verbrauch
--   3) chat_aktion       — Schreib-Aktions-Vorschläge (Confirm-Flow):
--                          pending_confirm → confirmed | cancelled | error
--
-- Alle drei sind owner-scoped per RLS. ON DELETE CASCADE auf den Owner,
-- damit ein gelöschter Account auch seine Chats mitnimmt. Ein Chat löschen
-- kaskadiert seine Nachrichten + Aktionen mit; ausgeführte Aktionen
-- bleiben über audit_eintrag.id zurückverfolgbar (das ist gewollt — die
-- Audit-Spur muss bestehen bleiben, auch wenn der Chat verschwindet).
--
-- Indizes:
--   - chat_konversation (owner_id, updated_at desc) für die Sidebar-Liste
--   - chat_nachricht (konversation_id, created_at) für den Verlauf
--   - chat_aktion (konversation_id, status, created_at desc) für Pending-Suche

-- =====================================================================
-- chat_konversation
-- =====================================================================
create table chat_konversation (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  titel       text not null default 'Neuer Chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_chat_konversation_updated
  before update on chat_konversation
  for each row execute function set_updated_at();

create index idx_chat_konversation_owner
  on chat_konversation(owner_id, updated_at desc);

alter table chat_konversation enable row level security;

create policy chat_konversation_owner on chat_konversation
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- =====================================================================
-- chat_nachricht
-- =====================================================================
create table chat_nachricht (
  id              uuid primary key default gen_random_uuid(),
  konversation_id uuid not null references chat_konversation(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  rolle           text not null check (rolle in ('user','assistant','tool','system')),
  inhalt          text not null default '',
  tool_calls      jsonb,
  tool_results    jsonb,
  tokens_in       integer,
  tokens_out      integer,
  created_at      timestamptz not null default now()
);

create index idx_chat_nachricht_konv
  on chat_nachricht(konversation_id, created_at);

alter table chat_nachricht enable row level security;

create policy chat_nachricht_owner on chat_nachricht
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- =====================================================================
-- chat_aktion (Confirm-Flow für Schreib-Tools)
-- =====================================================================
create table chat_aktion (
  id                uuid primary key default gen_random_uuid(),
  konversation_id   uuid not null references chat_konversation(id) on delete cascade,
  nachricht_id      uuid not null references chat_nachricht(id) on delete cascade,
  owner_id          uuid not null references auth.users(id) on delete cascade,
  aktion            text not null,         -- Tool-Name, z. B. 'bucheBuchungenUm'
  parameter         jsonb not null,        -- validierte Tool-Parameter
  vorschau          text not null,         -- Klartext-Beschreibung
  vorher_nachher    jsonb,                 -- optionale Tabelle (UI-Anzeige)
  status            text not null default 'pending_confirm'
                    check (status in ('pending_confirm','confirmed','cancelled','error')),
  audit_eintrag_id  uuid references audit_eintrag(id) on delete set null,
  fehler_text       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_chat_aktion_updated
  before update on chat_aktion
  for each row execute function set_updated_at();

create index idx_chat_aktion_konv
  on chat_aktion(konversation_id, status, created_at desc);

alter table chat_aktion enable row level security;

create policy chat_aktion_owner on chat_aktion
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
