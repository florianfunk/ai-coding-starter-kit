-- PROJ-23/24-Fix: Die Vorjahres-Übernahme setzt quelle='vorjahr', aber die
-- CHECK-Constraint buchung_quelle_check erlaubte nur 'regel','ki','manuell'.
-- Folge: JEDER Vorjahres-Treffer schlug beim UPDATE fehl → die Buchung blieb
-- 'offen' (Hänger), via_vorjahr blieb 0. Constraint um 'vorjahr' erweitern.

alter table buchung drop constraint if exists buchung_quelle_check;
alter table buchung add constraint buchung_quelle_check
  check (quelle = any (array['regel'::text, 'ki'::text, 'manuell'::text, 'vorjahr'::text]));
