-- PROJ-25 (AC1): Der Cache-Default-Pass übernimmt eine frühere MANUELLE
-- Korrektur desselben Empfängers deterministisch und setzt quelle='cache'.
-- Die CHECK-Constraint buchung_quelle_check erlaubte bislang nur
-- 'regel','ki','manuell','vorjahr' (siehe 0013). Ohne diese Erweiterung würde
-- JEDER Cache-Übernahme-Treffer beim UPDATE am CHECK scheitern → Buchung bliebe
-- 'offen' (derselbe Hänger-Bug wie bei PROJ-23/0013). Constraint um 'cache'
-- erweitern.
alter table buchung drop constraint if exists buchung_quelle_check;
alter table buchung add constraint buchung_quelle_check
  check (quelle = any (array['regel'::text, 'ki'::text, 'manuell'::text, 'vorjahr'::text, 'cache'::text]));
