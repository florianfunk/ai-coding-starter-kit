# PROJ-25: Toast-Benachrichtigungen

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Keine (sonner ist bereits installiert)

## User Stories
- Als Nutzer möchte ich nach jeder Aktion (Speichern, Löschen, Duplizieren) eine kurze Bestätigung sehen.
- Als Nutzer möchte ich Fehlermeldungen als auffällige Benachrichtigung sehen, nicht nur als kleinen roten Text im Formular.

## Acceptance Criteria
- [ ] Erfolgs-Toast (grün) bei: Speichern, Erstellen, Löschen, Duplizieren, Import, Bulk-Aktion
- [ ] Fehler-Toast (rot) bei: Server-Fehler, Validierungsfehler, Netzwerk-Timeout
- [ ] Info-Toast (blau) bei: Katalog-Export gestartet, Import läuft
- [ ] Toasts erscheinen oben rechts, stacken sich (max 3 sichtbar)
- [ ] Auto-Dismiss nach 4 Sekunden (Erfolg) / 8 Sekunden (Fehler)
- [ ] Manuell schließbar per X-Button
- [ ] Alle bestehenden Server Actions nachrüsten (Bereiche, Kategorien, Produkte, Preise, Icons, Einstellungen)

## Edge Cases
- Viele schnelle Aktionen hintereinander → maximal 3 Toasts sichtbar, ältere werden verdrängt
- Toast bei Seitenwechsel → wird beibehalten (toast() ist app-weit)

## Technical Requirements
- sonner als Toast-Library (bereits installiert)
- Toaster-Komponente im Root-Layout
- Einheitliche Toast-Helper-Funktionen: `showSuccess()`, `showError()`, `showInfo()`
- shadcn/ui Komponenten: Sonner/Toaster

---
<!-- Sections below are added by subsequent skills -->
