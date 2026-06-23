-- PROJ-27 (AC4): Dauerfristverlängerung im Firmenprofil.
-- Wird vom USt-VA-Fristen-Rechner (src/lib/dashboard/fristen.ts) benötigt:
-- bei Dauerfristverlängerung verschiebt sich die Abgabefrist um einen Monat
-- (Ende + 10 Tage + 1 Monat). Ohne dieses Feld wäre der Countdown falsch.
-- Default false = konservativ (Standardfall ohne Verlängerung).
alter table firmenprofil
  add column if not exists dauerfristverlaengerung boolean not null default false;
