-- PROJ-16 — Konto-Erweiterung: Markierung "eigenes Konto" vs. "Drittkonto".
--
-- Hintergrund: Die Pipeline soll Umbuchungen zwischen eigenen Konten als
-- Geldtransit (neutral) erkennen. Dafuer braucht sie ein explizites Flag
-- pro Konto. Default `true`, weil die bisher angelegten Konten dem Owner
-- gehoeren (Single-Tenant).
--
-- Separate Migration (statt im 0005-Profil-File), um die Verantwortlichkeit
-- sauber zu trennen: die `konto`-Tabelle stammt aus 0001, das neue Flag
-- ist eine reine Erweiterung. RLS-Policy aus 0001 deckt die neue Spalte
-- automatisch ab.

alter table konto
  add column ist_eigenes_konto boolean not null default true;
