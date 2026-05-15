-- STEUERAGENT — Initiales Schema (alle 12 Features)
-- Single-Tenant: genau ein Nutzer. RLS bindet alle Daten an auth.uid().
-- Siehe docs/ARCHITECTURE.md Abschnitt 4 (gemeinsames Datenmodell).

-- =====================================================================
-- Helper: updated_at Trigger
-- =====================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- =====================================================================
-- PROJ-1: Firmenprofil (genau ein Datensatz pro Account)
-- =====================================================================
create table firmenprofil (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  firmenname    text not null,
  inhaber       text not null,
  steuernummer  text,
  ust_idnr      text,
  strasse       text,
  plz           text,
  ort           text,
  finanzamt     text,
  rechtsform    text not null default 'einzelunternehmer'
                 check (rechtsform in ('einzelunternehmer','freiberufler')),
  ust_status    text not null default 'regelbesteuerung'
                 check (ust_status in ('regelbesteuerung','kleinunternehmer')),
  wirtschaftsjahr_beginn smallint not null default 1 check (wirtschaftsjahr_beginn between 1 and 12),
  ust_va_rhythmus text not null default 'monatlich'
                 check (ust_va_rhythmus in ('monatlich','quartalsweise','jaehrlich')),
  rhythmus_gueltig_ab date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id)
);
create trigger trg_firmenprofil_updated before update on firmenprofil
  for each row execute function set_updated_at();

-- =====================================================================
-- PROJ-3: Paperless-Verbindung (Token verschlüsselt in app-Layer)
-- =====================================================================
create table paperless_verbindung (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  base_url      text not null,
  token_cipher  text not null,            -- app-seitig verschlüsselt, nie Klartext
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id)
);
create trigger trg_paperless_updated before update on paperless_verbindung
  for each row execute function set_updated_at();

-- =====================================================================
-- PROJ-2: EÜR-Kontenrahmen-Kategorien
-- =====================================================================
create table kategorie (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  bezeichnung   text not null,
  typ           text not null check (typ in ('einnahme','ausgabe','privat','neutral')),
  ust_satz      numeric(5,2) check (ust_satz in (0,7,19) or ust_satz is null),
  euer_zeile    text,
  elster_kennzahl text,
  aktiv         boolean not null default true,
  gueltig_ab    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, bezeichnung)
);
create trigger trg_kategorie_updated before update on kategorie
  for each row execute function set_updated_at();
create index idx_kategorie_owner on kategorie(owner_id);
create index idx_kategorie_aktiv on kategorie(owner_id, aktiv);

-- =====================================================================
-- PROJ-4: Bankkonten + Mapping-Vorlage
-- =====================================================================
create table konto (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  bezeichnung   text not null,
  typ           text not null check (typ in ('bank','paypal','kreditkarte')),
  mapping       jsonb,                    -- Spalte→Feld Vorlage
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_konto_updated before update on konto
  for each row execute function set_updated_at();
create index idx_konto_owner on konto(owner_id);

-- =====================================================================
-- PROJ-3: Belege (aus Paperless)
-- =====================================================================
create table beleg (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  paperless_id  bigint not null,
  titel         text,
  beleg_datum   date,
  korrespondent text,
  betrag        numeric(14,2),
  tags          text[],
  dokumenttyp   text,
  ocr_text      text,
  quell_link    text,
  inhalt_hash   text,
  status        text not null default 'importiert'
                 check (status in ('importiert','unvollstaendig','quelle_entfernt')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, paperless_id)
);
create trigger trg_beleg_updated before update on beleg
  for each row execute function set_updated_at();
create index idx_beleg_owner on beleg(owner_id);
create index idx_beleg_datum on beleg(owner_id, beleg_datum);

-- =====================================================================
-- PROJ-7: Lernregeln (Regel-Engine, Vorrang vor KI)
-- =====================================================================
create table lernregel (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  bezeichnung   text not null,
  bedingung     jsonb not null,           -- {empfaenger_muster, zweck_muster, konto_id, betrag_min, betrag_max}
  aktion        jsonb not null,           -- {kategorie_id, ust_satz, klassifikation}
  prioritaet    integer not null default 100,
  aktiv         boolean not null default true,
  treffer_zaehler integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_lernregel_updated before update on lernregel
  for each row execute function set_updated_at();
create index idx_lernregel_owner on lernregel(owner_id, aktiv, prioritaet);

-- =====================================================================
-- PROJ-4/5/7: Buchungen (Kontobewegungen + Klassifikation)
-- =====================================================================
create table buchung (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  konto_id        uuid not null references konto(id) on delete cascade,
  buchung_datum   date not null,
  betrag          numeric(14,2) not null,
  verwendungszweck text,
  empfaenger      text,
  waehrung        text not null default 'EUR',
  duplikat_hash   text not null,
  import_quelle   text,
  -- Klassifikation (PROJ-5)
  klassifikation  text check (klassifikation in ('privat','geschaeftlich','unklar','neutral')),
  steuerrelevant  boolean,
  kategorie_id    uuid references kategorie(id) on delete set null,
  ust_satz        numeric(5,2),
  begruendung     text,
  konfidenz       numeric(4,3),
  quelle          text check (quelle in ('regel','ki','manuell')),
  regel_id        uuid references lernregel(id) on delete set null,
  status          text not null default 'offen'
                   check (status in ('offen','auto_verbucht','zur_pruefung','manuell_bestaetigt')),
  pruef_grund     text,
  -- Aufteilung (PROJ-7 Split)
  parent_buchung_id uuid references buchung(id) on delete cascade,
  split_anteil    numeric(5,4),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, duplikat_hash)
);
create trigger trg_buchung_updated before update on buchung
  for each row execute function set_updated_at();
create index idx_buchung_owner on buchung(owner_id);
create index idx_buchung_konto on buchung(konto_id);
create index idx_buchung_status on buchung(owner_id, status);
create index idx_buchung_datum on buchung(owner_id, buchung_datum);
create index idx_buchung_kategorie on buchung(kategorie_id);

-- =====================================================================
-- PROJ-6: Beleg↔Buchung-Zuordnung (N:M)
-- =====================================================================
create table beleg_buchung (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  beleg_id      uuid not null references beleg(id) on delete cascade,
  buchung_id    uuid not null references buchung(id) on delete cascade,
  match_score   numeric(4,3),
  kriterien     jsonb,
  status        text not null default 'auto'
                 check (status in ('auto','manuell','unsicher')),
  gesperrt      boolean not null default false,  -- manuell = vor Re-Match geschützt
  created_at    timestamptz not null default now(),
  unique (owner_id, beleg_id, buchung_id)
);
create index idx_bb_owner on beleg_buchung(owner_id);
create index idx_bb_beleg on beleg_buchung(beleg_id);
create index idx_bb_buchung on beleg_buchung(buchung_id);

-- =====================================================================
-- PROJ-8/9: Steuerperioden (USt-VA & Wirtschaftsjahr) mit Snapshot
-- =====================================================================
create table steuerperiode (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  art           text not null check (art in ('ust_va','wirtschaftsjahr')),
  jahr          smallint not null,
  periode       smallint,                 -- Monat/Quartal bei ust_va, NULL bei Jahr
  status        text not null default 'offen'
                 check (status in ('offen','geprueft','abgeschlossen')),
  snapshot      jsonb,                    -- eingefrorene Kennzahlen
  abgeschlossen_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, art, jahr, periode)
);
create trigger trg_periode_updated before update on steuerperiode
  for each row execute function set_updated_at();
create index idx_periode_owner on steuerperiode(owner_id, art, jahr);

-- =====================================================================
-- PROJ-10: ESt-Tarif-Stammdaten (jahresabhängig)
-- =====================================================================
create table est_tarif (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  jahr          smallint not null,
  grundfreibetrag numeric(12,2) not null,
  zonen         jsonb not null,           -- Progressionszonen-Definition
  soli_satz     numeric(5,4) not null default 0.055,
  soli_freigrenze numeric(12,2) not null default 18130,
  created_at    timestamptz not null default now(),
  unique (owner_id, jahr)
);

-- =====================================================================
-- PROJ-3/4/5: Job/Sync-Läufe (Hintergrund-Status)
-- =====================================================================
create table job_lauf (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  art           text not null check (art in ('paperless_sync','konto_import','klassifizierung','matching')),
  status        text not null default 'laeuft'
                 check (status in ('laeuft','fertig','fehler')),
  fortschritt   integer not null default 0,
  gesamt        integer,
  ergebnis      jsonb,                    -- {neu, aktualisiert, fehler[]}
  fehler_text   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_job_updated before update on job_lauf
  for each row execute function set_updated_at();
create index idx_job_owner on job_lauf(owner_id, art, created_at desc);

-- =====================================================================
-- PROJ-5/7: Audit-Trail
-- =====================================================================
create table audit_eintrag (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  entitaet      text not null,            -- z.B. 'buchung'
  entitaet_id   uuid,
  aktion        text not null,            -- z.B. 'klassifiziert','manuell_korrigiert'
  quelle        text,                     -- 'regel:<id>' | 'ki' | 'nutzer'
  details       jsonb,
  created_at    timestamptz not null default now()
);
create index idx_audit_owner on audit_eintrag(owner_id, entitaet, entitaet_id);

-- =====================================================================
-- ROW LEVEL SECURITY — jede Tabelle, alle Operationen
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'firmenprofil','paperless_verbindung','kategorie','konto','beleg',
    'lernregel','buchung','beleg_buchung','steuerperiode','est_tarif',
    'job_lauf','audit_eintrag'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy %1$s_owner on %1$s
      using (owner_id = auth.uid()) with check (owner_id = auth.uid())$p$, t);
  end loop;
end $$;
