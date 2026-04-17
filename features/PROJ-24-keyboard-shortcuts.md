# PROJ-24: Keyboard-Shortcuts

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: Grundlegende App-Struktur

## User Stories
- Als Nutzer möchte ich häufige Aktionen per Tastatur auslösen können, damit ich schneller arbeiten kann.
- Als Nutzer möchte ich eine Übersicht aller verfügbaren Shortcuts sehen können.

## Acceptance Criteria
- [ ] `Cmd+K` → Globale Suche (PROJ-22)
- [ ] `Cmd+S` → Aktuelles Formular speichern (preventDefault auf Browser-Save)
- [ ] `Escape` → Dialog/Modal/Inline-Edit schließen
- [ ] `N` → Neues Element erstellen (kontextabhängig: auf /produkte → neues Produkt)
- [ ] `?` → Shortcut-Übersicht anzeigen (Hilfe-Modal)
- [ ] Shortcuts nur aktiv wenn kein Input fokussiert
- [ ] Shortcuts-Hilfe-Modal zeigt alle verfügbaren Shortcuts gruppiert

## Edge Cases
- Shortcut-Konflikt mit Browser-Shortcuts → nur Cmd+S muss verhindert werden
- Input-Felder → Shortcuts deaktiviert (außer Escape und Cmd+S)

## Technical Requirements
- Custom React Hook `useKeyboardShortcuts` für zentrale Registrierung
- shadcn/ui Komponenten: Dialog (für Hilfe-Modal), Kbd (für Tasten-Darstellung)
- Shortcuts-Konfiguration als zentrales Array (einfach erweiterbar)

---
<!-- Sections below are added by subsequent skills -->
