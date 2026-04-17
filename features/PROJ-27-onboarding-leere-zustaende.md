# PROJ-27: Onboarding & Leere Zustaende

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Keine

## User Stories
- Als neuer Nutzer moechte ich bei leeren Listen hilfreiche Hinweise sehen, was ich als naechstes tun kann.
- Als Nutzer moechte ich auf dem Dashboard einen Ueberblick ueber offene Aufgaben sehen.

## Acceptance Criteria
- [ ] Alle Listenansichten (Bereiche, Kategorien, Produkte, Icons, Farbfelder) zeigen bei 0 Eintraegen einen freundlichen Leer-Zustand
- [ ] Leer-Zustand enthaelt: passendes Icon, erklaerenden Text, CTA-Button ("Ersten Bereich anlegen")
- [ ] Produkt-Detail ohne Preise → "Noch keine Preise vorhanden. Klicke auf 'Neuer Preis'."
- [ ] Produkt ohne Bilder → "Lade ein Hauptbild hoch, damit das Datenblatt vollstaendig ist."
- [ ] Dashboard: "Aufgaben"-Widget zeigt unvollstaendige Produkte, fehlende Preise, leere Kategorien
- [ ] Erste-Schritte-Banner auf dem Dashboard (ausblendbar), das die Reihenfolge erklaert: Bereiche → Kategorien → Produkte → Preise

## Edge Cases
- Nach Migration (alles voll) → keine Leer-Zustaende sichtbar, Aufgaben-Widget zeigt "Alles erledigt"
- Aufgaben-Widget bei sehr vielen offenen Aufgaben → Top-10 mit "und X weitere"

## Technical Requirements
- Wiederverwendbare EmptyState-Komponente mit Props: icon, title, description, actionLabel, actionHref
- Dashboard-Widget mit Supabase-Queries fuer Vollstaendigkeits-Checks
- shadcn/ui Komponenten: Card, Button, Alert

---
<!-- Sections below are added by subsequent skills -->
