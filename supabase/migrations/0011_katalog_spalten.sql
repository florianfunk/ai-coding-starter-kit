-- Kategorie-Spalten für den Katalog (T1-T9 aus FileMaker)
-- Pro Kategorie wird definiert, welche Produktfelder in Spalte 1-9 der
-- Varianten-Tabelle im Katalog angezeigt werden.
alter table public.kategorien
  add column if not exists spalte_1 text,
  add column if not exists spalte_2 text,
  add column if not exists spalte_3 text,
  add column if not exists spalte_4 text,
  add column if not exists spalte_5 text,
  add column if not exists spalte_6 text,
  add column if not exists spalte_7 text,
  add column if not exists spalte_8 text,
  add column if not exists spalte_9 text;
