-- Icon-Reihenfolge pro Kategorie persistieren (Drag & Drop im IconPicker)
-- Produkte haben diese Spalte bereits (siehe 0001_initial_schema.sql#L212).
-- Für Kategorien fehlte sie bisher — wird jetzt additiv ergänzt.

alter table public.kategorie_icons
  add column if not exists sortierung integer not null default 0;

create index if not exists kategorie_icons_kategorie_sortierung_idx
  on public.kategorie_icons (kategorie_id, sortierung);
