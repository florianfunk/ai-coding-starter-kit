-- PROJ-15 P1 — Defense-in-Depth-CHECKs für Lernregeln (Regex + Split).
--
-- Hinweis zur Nummerierung: Die Aufgabe nannte "0011", das war zum Zeitpunkt
-- der Umsetzung jedoch bereits vergeben (0011_lieferant_notiz.sql, zuletzt
-- 0013). Daher 0014, der nächste freie Slot.
--
-- `lernregel.bedingung` und `lernregel.aktion` sind JSONB. Die Validierung
-- läuft primär im Zod-Schema (src/lib/validation/regel.ts) + im ReDoS-Linter
-- (regex-engine.ts). Diese CHECKs sind die DB-seitige zweite Verteidigungslinie
-- und spiegeln das Schema:
--   - Regex-Felder (empfaenger_regex, zweck_regex) max. 200 Zeichen.
--   - Split-Anteile (anteil_geschaeftlich, anteil_privat) müssen echt in (0,1)
--     liegen und sich auf 1 summieren (Float-Toleranz 1e-6).
--
-- RLS bleibt unangetastet — diese Migration fügt ausschließlich CHECK-
-- Constraints hinzu und ändert KEINE Policies.

-- --------------------------------------------------------------------------
-- Regex-Längenlimit (max. 200 Zeichen je Regex-Feld; NULL/fehlend ist ok)
-- --------------------------------------------------------------------------
alter table lernregel drop constraint if exists lernregel_regex_laenge_check;
alter table lernregel add constraint lernregel_regex_laenge_check
  check (
    (
      bedingung->>'empfaenger_regex' is null
      or length(bedingung->>'empfaenger_regex') <= 200
    )
    and (
      bedingung->>'zweck_regex' is null
      or length(bedingung->>'zweck_regex') <= 200
    )
  );

-- --------------------------------------------------------------------------
-- Split-Anteile gültig: beide echt in (0,1) und Summe = 1 (± 1e-6).
-- Greift nur, wenn aktion.split gesetzt ist; Regeln ohne Split sind unberührt.
-- --------------------------------------------------------------------------
alter table lernregel drop constraint if exists lernregel_split_anteile_check;
alter table lernregel add constraint lernregel_split_anteile_check
  check (
    aktion->'split' is null
    or (
      (aktion->'split'->>'anteil_geschaeftlich') is not null
      and (aktion->'split'->>'anteil_privat') is not null
      and (aktion->'split'->>'anteil_geschaeftlich')::numeric > 0
      and (aktion->'split'->>'anteil_geschaeftlich')::numeric < 1
      and (aktion->'split'->>'anteil_privat')::numeric > 0
      and (aktion->'split'->>'anteil_privat')::numeric < 1
      and abs(
        (aktion->'split'->>'anteil_geschaeftlich')::numeric
        + (aktion->'split'->>'anteil_privat')::numeric
        - 1
      ) < 1e-6
    )
  );
