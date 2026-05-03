# Feature-Backlog (Ideen-Sammlung)

> Brainstorming-Liste mit Ideen, die noch keine eigene PROJ-Nummer haben.
> Wenn eine Idee umgesetzt werden soll: `/requirements` ausführen → bekommt eine PROJ-X-Nummer und wandert in `INDEX.md`.
>
> Erstellt: 2026-05-03 (nach kompletter QA-Review)

---

## Quick Wins (1–2 Tage, hoher Wert)

### 1. Datenblatt per E-Mail senden
**Was:** Aus der Produkt-Detailseite heraus ein PDF direkt per E-Mail versenden, ohne erst downloaden und dann im E-Mail-Client anhängen zu müssen.
**Wert:** Spart 3–4 Klicks pro Kundenanfrage — täglich relevant bei 3 aktiven Pflegern.
**Komplexität:** S
**Tech-Hinweis:** Resend oder Nodemailer + bestehendes LaTeX-Render-Routing wiederverwenden.

### 2. Mediathek-Picker überall einbinden
**Was:** Mediathek-Picker auch in Bereich-Bild, Produkt-Hauptbild und Datenblatt-Slots verfügbar machen (aktuell nur in Kategorie-Slots aktiv, laut PROJ-43 Restschuld).
**Wert:** Verhindert Doppel-Uploads, vervollständigt die Mediathek-Logik.
**Komplexität:** S
**Tech-Hinweis:** Copy-Pattern aus der Kategorien-Einbindung.

### 3. Katalog-Job-Status im Header anzeigen
**Was:** Wenn ein Katalog-Job läuft oder fertig ist, kleines Status-Badge im Nav sichtbar machen — kein separater Tab-Wechsel zur Export-Seite nötig.
**Wert:** Bei 25 MB-PDFs, die 60+ Sekunden brauchen, muss der Nutzer aktuell auf der Export-Seite warten.
**Komplexität:** S
**Tech-Hinweis:** Polling + globaler State (z.B. Context oder SWR).

### 4. Produkt-Schnellvorschau auf Hover
**Was:** Kleines Tooltip-Panel mit Hauptbild, Artikelnummer, Preisspur und Vollständigkeits-Ampel beim Hover über eine Zeile in `/produkte`.
**Wert:** 400+ Produkte durchsuchen ohne jede Detailseite öffnen zu müssen.
**Komplexität:** S–M
**Tech-Hinweis:** Kein neuer API-Call — Daten sind in der Liste schon geladen.

---

## Game Changers (1–2 Wochen, transformiert Workflow)

### 5. Kunden-Angebots-PDF
**Was:** Über den bestehenden Katalog-Wizard eine dritte Ausgabe-Option: nicht nur Lichtengros/Eisenkeil-Branding, sondern ein Kunden-Angebot mit Kunden-Firmenname, optionalem Kunden-Logo und einer Anschreiben-Deckseite.
**Wert:** Größter Pain im FileMaker-Alltag — personalisierte Produktauswahl pro Kunde geht heute nur mit manueller PDF-Nachbearbeitung.
**Komplexität:** M
**Tech-Hinweis:** Neues LaTeX-Layout + erweiterter Wizard-Schritt 1 + Logo-Upload.

### 6. Gespeicherte Wizard-Presets ("Kunden-Profile")
**Was:** Eine Vorauswahl-Konfiguration speichern ("Kunde Müller — Leuchten + Profile, CHF, Eisenkeil-Preis +5%"), die per Dropdown geladen werden kann. PROJ-37 hat das bewusst out-of-scope gehalten — das ist der logische Nachfolger.
**Wert:** Wiederholungsgeschäft — dieselben 3–5 Kunden bekommen quartalsweise einen aktualisierten Auszug; heute jedes Mal von vorne aufbauen.
**Komplexität:** M
**Tech-Hinweis:** Neue Tabelle `katalog_presets` + Wizard-Erweiterung + Name/Laden/Überschreiben-UI.

### 7. „Was ist neu seit X?"-Diff im Katalog
**Was:** Beim Katalog-Export eine Option "Nur Änderungen seit [Datum] markieren" — neue Produkte bekommen einen "NEU"-Aufkleber im PDF, geänderte Preise einen Pfeil-Indikator.
**Wert:** Außendienstler brauchen genau das für Kundengespräche: "Was hat sich seit dem letzten Katalog geändert?" — heute komplett manuell.
**Komplexität:** M
**Tech-Hinweis:** Timestamp-Vergleich in DB + LaTeX-Marker-Logik + Datum-Picker im Wizard.

### 8. Bulk-Mediathek-Upload mit Auto-Zuweisung
**Was:** ZIP mit 50 Produktfotos hochladen — die App erkennt anhand des Dateinamens (Artikelnummer im Filename) automatisch welches Produkt gemeint ist und weist das Hauptbild zu.
**Wert:** Bei Saison-Updates oder Lieferanten-Bildpaketen werden heute 50–100 Bilder einzeln hochgeladen und zugewiesen — das dauert Stunden.
**Komplexität:** M
**Tech-Hinweis:** ZIP-Parsing + Filename-Matching-Logik + Server-Action + Vorschau-Modal mit Treffer-Übersicht.

### 9. KI-Daten-Vervollständigung aus Produktname
**Was:** Aus Artikelname/-nummer technische Felder vorausfüllen: Kelvinzahl, CRI, Schutzklasse, Leistung. Hybrid: erst regelbasiertes Pattern-Matching auf den 423 vorhandenen Produkten, dann LLM-Fallback.
**Wert:** Neues Produkt anlegen kostet aktuell 10–20 Min manueller Dateneingabe — die Hälfte der Felder könnte vorausgefüllt werden.
**Komplexität:** M
**Tech-Hinweis:** Prompt-Engineering auf technischen Beleuchtungsdaten + Review-Modal vor Übernahme.

---

## Moonshots (ambitioniert, Phase 2+)

### 10. Pixel-Diff zwischen PDF-Versionen
**Was:** Zwei PDF-Generierungen automatisch screenshotten (per `pdftoppm`) und seitenweise vergleichen (per `pixelmatch`). Übersicht zeigt "Seite 89: 18 % Pixel anders" → gezielte manuelle Prüfung statt 200 Seiten Blindflug.
**Wert:** LaTeX-Template-Änderungen sind heute Blindflug — erst beim Drucken merkt man Probleme.
**Komplexität:** L
**Hinweis:** Wahrscheinlich Overkill bei seltenen Template-Änderungen. Leichtere Alternative siehe **10b**.

### 10b. Smoke-Test-Katalog (leichte Alternative zu #10)
**Was:** Nach jedem Template-Change automatisch einen Test-Katalog mit ~5 repräsentativen Produkten bauen — nur diese 5 Seiten manuell checken statt 200.
**Wert:** 80 % des Werts von #10 mit deutlich weniger Aufwand.
**Komplexität:** M

### 11. Live-Preiskalkulator für Außendienst
**Was:** Schlanke, separierte Ansicht (Token-geschützt, kein vollständiger Login nötig), wo Außendienstler eine Produktauswahl + Aufschlag + Währung eingeben und sofort die kalkulierten Preise sehen — ohne PDF-Generierung, direkt im Browser.
**Wert:** In Kundengesprächen vor Ort schnelle Preisauskünfte ohne 25 MB Katalog generieren.
**Komplexität:** L
**Tech-Hinweis:** Read-only Sub-App + Auth-Token-Konzept + Auslieferungs-Mechanismus.

### 12. Internationalisierungs-Datenblatt (FR/EN)
**Was:** LaTeX-Template um zweiten Sprach-Slot erweitern: technische Feldbezeichnungen aus Übersetzungstabelle, Beschreibung via DeepL-API. Das "Sprache"-Dropdown im Wizard ist heute bewusst disabled — dies wäre der Weg, es scharf zu schalten.
**Wert:** Exportgeschäft in die Schweiz (FR) und internationale Kunden.
**Komplexität:** L
**Tech-Hinweis:** DeepL-Integration + LaTeX-Zweispaltigkeit + Übersetzungstabelle für Feldnamen + Qualitäts-Review-Flow.

### 13. Kunden-ShareLink-Katalog
**Was:** Für einen Kunden einen dauerhaften, read-only Katalog-Link generieren — zeigt immer den aktuellen Stand der für diesen Kunden freigegebenen Produkte und Preise, als Web-Ansicht oder per Klick als frisch generiertes PDF.
**Wert:** Statt quartalsweise PDFs per E-Mail zu schicken, gibt es einen Link pro Großkunden — Preisänderungen sind automatisch aktuell.
**Komplexität:** L
**Tech-Hinweis:** Token-Auth für Shared-Views + Client-seitige Produkt-Filterung + Auto-PDF-Generierung + Verfalldatum.

---

## Workflow

Wenn eine Idee umgesetzt werden soll:
1. `/requirements <Beschreibung>` ausführen → erstellt `PROJ-X-name.md` mit User-Stories, Acceptance Criteria, Edge Cases
2. Eintrag in `features/INDEX.md` ergänzen (nächste freie ID: siehe INDEX.md "Next Available ID")
3. Eintrag aus dieser Backlog-Datei entfernen oder mit "→ PROJ-X" markieren
