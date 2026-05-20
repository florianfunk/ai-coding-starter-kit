-- PROJ-15: Empfaenger-Kenntnis-Cache (Stufe 2)
-- Speichert pro normalisiertem Empfaenger einen Cache-Eintrag mit Branche,
-- Leistung und Web-Snippets. Beim ersten Vorkommen eines geschaeftlichen
-- Empfaengers wird ein einziger Firecrawl-Lookup ausgeloest und das Ergebnis
-- hier abgelegt; ab dem zweiten Treffer steht der Kontext dem LLM direkt zur
-- Verfuegung — kein zweiter Web-Call pro Empfaenger (bis zur TTL-Grenze).
--
-- Schluessel: (owner_id, empfaenger_norm). RLS owner-scoped. Trigger fuer
-- updated_at nutzt set_updated_at() aus 0001. Sekundaerindex auf cached_at
-- fuer "letzte 20 Eintraege"-Listen im Admin-UI.
--
-- quelle ∈ {web, manuell, llm}: woher der Eintrag stammt.
--  - web      = Firecrawl-Lookup
--  - llm      = aus erfolgreichem LLM-Lauf abgeleitet (Konfidenz >= 0.85)
--  - manuell  = vom Nutzer im Admin-UI gesetzt/korrigiert
-- recherche_versucht: cooldown-Flag, verhindert Endlos-Retries bei fehlendem
--   API-Key oder leerer Web-Antwort (Eintrag bleibt mit leeren Snippets liegen).

create table empfaenger_kenntnis (
  owner_id           uuid not null references auth.users(id) on delete cascade,
  empfaenger_norm    text not null,
  rohwert_beispiel   text,
  branche            text,
  leistung           text,
  web_snippets       jsonb,
  letzte_klassifikation_default jsonb,
  quelle             text not null check (quelle in ('web','manuell','llm')),
  recherche_versucht boolean not null default false,
  cached_at          timestamptz not null default now(),
  ttl_tage           integer not null default 180,
  updated_at         timestamptz not null default now(),
  primary key (owner_id, empfaenger_norm)
);

create trigger trg_empfaenger_kenntnis_updated
  before update on empfaenger_kenntnis
  for each row execute function set_updated_at();

create index idx_empfaenger_kenntnis_cached_at
  on empfaenger_kenntnis(owner_id, cached_at desc);

alter table empfaenger_kenntnis enable row level security;

create policy empfaenger_kenntnis_owner on empfaenger_kenntnis
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
