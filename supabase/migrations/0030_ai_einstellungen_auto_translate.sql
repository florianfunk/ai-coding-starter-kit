-- 0030_ai_einstellungen_auto_translate.sql
-- PROJ-46: Toggle für die automatische italienische Übersetzung beim Speichern.
--
-- Wenn aktiv (Default), wird beim Update eines Produkts mit geänderten
-- DE-Feldern die italienische Version im Hintergrund nachgezogen. Der Toggle
-- liegt in der bestehenden Singleton-Tabelle ai_einstellungen (id=1) — kein
-- separates Settings-Row nötig.

ALTER TABLE public.ai_einstellungen
  ADD COLUMN IF NOT EXISTS auto_translate_it boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ai_einstellungen.auto_translate_it IS
  'PROJ-46: Wenn true, wird die italienische Version automatisch nachgezogen, sobald ein deutsches Feld geändert wird. Default: an.';
