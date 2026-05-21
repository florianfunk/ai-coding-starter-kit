# Product Requirements Document — STEUERAGENT

## Vision
STEUERAGENT ist ein autonomer Steuer- und Buchhaltungs-Agent für **eine einzige Firma** (Einzelunternehmen/Freiberufler, USt-pflichtige Regelbesteuerung). Der Agent zieht alle Buchhaltungsbelege aus einer vorhandenen Paperless-ngx-Instanz (bereits per Paperless-AI/OCR ausgelesen), arbeitet sie selbständig durch und ordnet sie einem konfigurierbaren EÜR-Kontenrahmen zu. Parallel importiert er Kontoauszüge (Bank, PayPal, 2 Kreditkarten) per Excel/CSV, entscheidet anhand der Buchungstexte über Steuerrelevanz, lagert private Ausgaben aus und gleicht Geschäftsbuchungen mit den Paperless-Belegen ab, um fehlende Belege aufzudecken. Daraus erzeugt er Vorschläge für Umsatzsteuer-Voranmeldung, Jahres-EÜR und eine Einkommensteuer-Vorschau. Der Agent arbeitet **voll autonom** — nur unsichere Fälle landen in einer Prüfliste — und lernt aus Korrekturen.

## Target Users

**Einziger Nutzer: Der Firmeninhaber (Einzelunternehmer/Freiberufler)**
- Betreibt eine eigene Firma, will Buchhaltung & Steuervorbereitung weitgehend automatisieren
- Pain Point: Belege manuell den richtigen EÜR-Kategorien zuordnen, Kontoauszüge durchgehen, privat/geschäftlich trennen, fehlende Belege finden — zeitraubend und fehleranfällig
- Braucht: einen Agenten, der das eigenständig erledigt, nur bei echter Unsicherheit nachfragt und korrekte Steuer-Vorschläge liefert
- Erwartung: Voll autonomes Arbeiten mit nachvollziehbarer Begründung; behält Kontrolle über Ausnahmen und die finale Steuerübermittlung

Single-Tenant: keine Mandanten-, Kanzlei- oder Mehrbenutzerverwaltung.

## Core Features (Roadmap)

| Priorität | Feature | Status |
|-----------|---------|--------|
| P0 (MVP) | PROJ-1 — Auth & Firmen-/Steuerprofil-Stammdaten | Approved |
| P0 (MVP) | PROJ-2 — Konfigurierbarer EÜR-Kontenrahmen & Steuerregeln | Approved |
| P0 (MVP) | PROJ-3 — Paperless-Integration (Beleg- & OCR-Import) | Approved |
| P0 (MVP) | PROJ-4 — Kontoauszug-Import (Excel/CSV, Multi-Konto) | Approved |
| P0 (MVP) | PROJ-5 — Autonome Klassifizierung: Steuerrelevanz & privat/geschäftlich | Approved |
| P0 (MVP) | PROJ-6 — Beleg↔Buchung-Auto-Matching & Fehlliste | Approved |
| P0 (MVP) | PROJ-7 — Prüfliste & Lernregeln (Ausnahmen-Workflow) | Approved |
| P0 (MVP) | PROJ-8 — Umsatzsteuer-Voranmeldung (Vorschlag) | Approved |
| P1 | PROJ-9 — Jahres-EÜR (§4 Abs.3 EStG) | Approved |
| P1 | PROJ-10 — Einkommensteuer-Vorschau & Privatentnahmen-Aufstellung | Approved |
| P1 | PROJ-11 — Export (PDF, CSV/DATEV-ähnlich, ELSTER-konforme Kennzahlen) | Approved |
| P2 | PROJ-12 — Dashboard & Buchungsstatus-Übersicht | Approved |
| P2 | PROJ-13 — Adminbereich (Systemkonfiguration & Benutzerverwaltung) | Approved |
| P2 | PROJ-14 — Kategorien-Analyse & Inline-Bearbeitung | Approved |
| P2 | PROJ-15 — Klassifizierung-Pro: Empfänger-Cache, Regex- & Split-Regeln | In Progress |
| P2 | PROJ-16 — Mein Profil — persönliche Stammdaten als LLM-Kontext | Planned |
| P2 | PROJ-17 — KI-Chat zu Buchungen & Finanzdaten (Lese + Schreib mit Confirm) | Planned |

## Success Metrics
- **Automatisierungsgrad:** ≥ 85 % aller Kontobuchungen werden vom Agenten ohne Nachfrage korrekt klassifiziert (geschäftlich/privat + EÜR-Kategorie)
- **Belegabgleich:** ≥ 95 % der Geschäftsbuchungen automatisch einem Paperless-Beleg zugeordnet; fehlende Belege vollständig in der Fehlliste
- **Lerneffekt:** Korrektur-Quote sinkt über die Zeit messbar (gemerkte Regeln greifen)
- **Zeitersparnis:** Komplette Monatsbuchhaltung in < 30 Min. Prüfaufwand statt manueller Vollerfassung
- **Steuer-Endprodukt:** ≥ 1 vollständige USt-VA-Periode und eine Jahres-EÜR end-to-end als belastbarer Vorschlag erzeugt

## Constraints
- **Datenschutz/DSGVO:** Hochsensible Steuerdaten. Supabase in EU-Region, Auth, verschlüsselte Ablage des Paperless-API-Tokens und der Kontodaten. Single-User, aber RLS/Absicherung trotzdem strikt.
- **Tech-Stack:** Next.js 16 (App Router), TypeScript, Tailwind + shadcn/ui, Supabase (PostgreSQL/Auth/Storage), Vercel.
- **KI-Ansatz:** LLM liest OCR-/Buchungstext und ordnet in den konfigurierbaren EÜR-Kontenrahmen ein; Korrekturen werden als wiederverwendbare Regeln gespeichert. Konkrete LLM-/RAG-Strategie je Feature in `/architecture`. Kein eigenes OCR — Paperless liefert bereits extrahierten Text.
- **Steuerprofil:** Einzelunternehmer/Freiberufler, USt-pflichtige Regelbesteuerung (19 %/7 %/0 %, Vorsteuerabzug). Profil als Stammdaten konfigurierbar.
- **Fachliche Korrektheit:** USt-VA, EÜR und Einkommensteuer-Vorschau müssen rechnerisch belastbar sein; alle Ausgaben sind unverbindliche Vorschläge in Verantwortung des Inhabers.
- **Externe Abhängigkeit:** Erreichbare Paperless-ngx-REST-API; Kontoauszüge liegen als Excel/CSV vor (Bank, PayPal, 2 Kreditkarten).
- **Single-Tenant:** Genau eine Firma, ein Nutzer — keine Mandanten-/Mehrbenutzerlogik.

## Non-Goals
- **Keine direkte ELSTER-Übermittlung** — der Agent bereitet ELSTER-konforme Kennzahlen auf; die finale Übermittlung ans Finanzamt macht der Inhaber bzw. sein Steuerberater separat.
- **Keine doppelte Buchführung / Bilanzierung** — ausschließlich EÜR.
- **Keine Lohnbuchhaltung** — keine Gehaltsabrechnung / Lohnsteuer.
- **Keine verbindliche Steuer-/Rechtsberatung** — Vorschläge ohne Gewähr; finale Verantwortung beim Inhaber.
- **Kein Multi-Mandanten-/Kanzleibetrieb** — bewusst Single-Tenant.
- **Kein automatischer Bankabruf im MVP** — Kontodaten ausschließlich per Excel/CSV-Upload (Banking-API ggf. später).
- **Kein eigenes OCR / keine Belegerkennung** — wird vollständig von Paperless-AI übernommen.

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
