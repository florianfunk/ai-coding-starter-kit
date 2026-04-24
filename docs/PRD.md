# Product Requirements Document — Lichtengross Produktkatalog

## Vision
Eine interne Web-Anwendung, die die bestehende FileMaker-Datenbank „Lichtstudio V1.3" von LICHT.ENGROS / Eisenkeil als modernes Webprojekt ablöst. Das Tool dient der Pflege von Beleuchtungsprodukten (LED Strips, Leuchten, Driver, Profile u.v.m.) mit allen technischen, lichttechnischen und mechanischen Daten sowie der Generierung von Produktdatenblättern und einem kompletten Produktkatalog als PDF.

## Target Users
**Interne Produktpflege (3 Nutzer)** bei LICHT.ENGROS / Eisenkeil, die:
- Produktdaten und Preise laufend aktualisieren müssen
- einzelne Datenblätter für Kunden/Projekte erstellen
- regelmäßig den Gesamtkatalog in verschiedenen Varianten (Layout Lichtengros/Eisenkeil, Preisänderung ±%, Währung EUR/CHF) als PDF ausgeben
- heute mit FileMaker arbeiten und eine web-basierte, wartungsarme Alternative brauchen, die vom jedem Browser aus nutzbar ist

Pain Points heute: FileMaker-Lizenzkosten, keine parallele Bearbeitung, schwerer Zugriff von unterwegs, starre Layouts.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1 Authentifizierung & Nutzerverwaltung | Planned |
| P0 (MVP) | PROJ-2 Datenmodell & FileMaker-XML-Migration | Planned |
| P0 (MVP) | PROJ-3 Bereiche verwalten (CRUD) | Planned |
| P0 (MVP) | PROJ-4 Kategorien verwalten (CRUD) | Planned |
| P0 (MVP) | PROJ-5 Produkte/Artikel verwalten (CRUD) | Planned |
| P0 (MVP) | PROJ-6 Preisverwaltung pro Produkt | Planned |
| P0 (MVP) | PROJ-7 Suche & Filter | Planned |
| P0 (MVP) | PROJ-8 Filialen- & Katalog-Einstellungen | Planned |
| P0 (MVP) | PROJ-9 PDF-Export: Einzel-Datenblatt | Planned |
| P0 (MVP) | PROJ-10 PDF-Export: Gesamtkatalog | Planned |
| P1       | PROJ-36 Datenblatt-Felder pflegen (UI) | Planned |

## Success Metrics
- Alle bestehenden FileMaker-Daten (20 Bereiche, ~70 Kategorien, ~400+ Produkte, Preise, Bilder) erfolgreich migriert
- Einzel-Datenblatt-PDF optisch 1:1 zur aktuellen FileMaker-Ausgabe
- Gesamtkatalog-PDF mit allen Parametern (Layout, Preis±%, Währung) korrekt generierbar
- 3 interne Nutzer können parallel und ohne FileMaker-Installation Produkte pflegen
- Migrationsaufwand von FileMaker auf Web: keine Datenverluste

## Constraints
- **Team:** 1 Entwickler (mit Claude Code)
- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase + Vercel
- **Sprache MVP:** nur Deutsch (Mehrsprachigkeit später)
- **Zugriff:** intern, nur authentifizierte Nutzer, keine öffentliche Katalog-Website
- **PDF-Layouts:** zwei Marken (Lichtengros + Eisenkeil) müssen pixelgenau zum bestehenden Katalog passen

## Non-Goals (aktuell nicht geplant)
- Öffentliche Katalog-Website für Endkunden
- E-Commerce / Bestellungen / Warenkorb
- Mehrsprachigkeit (nur Deutsch im MVP)
- Rollen/Rechte-Differenzierung (alle 3 Nutzer haben gleiche Rechte)
- Mehrere Datenblatt-Versionen pro Produkt (genau eine Version)
- Integration mit ERP/Warenwirtschaft
- Mobile App (Web-App ist responsive, aber keine native App)

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
