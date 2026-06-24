# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Planned** - `/requirements` done, spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

| ID | Feature | Status | Spec | Created |
|----|---------|--------|------|---------|
| PROJ-1 | Auth & Firmen-/Steuerprofil-Stammdaten | Approved | [Spec](PROJ-1-auth-firmen-steuerprofil.md) | 2026-05-15 |
| PROJ-2 | Konfigurierbarer EÜR-Kontenrahmen & Steuerregeln | Approved | [Spec](PROJ-2-euer-kontenrahmen-steuerregeln.md) | 2026-05-15 |
| PROJ-3 | Paperless-Integration (Beleg- & OCR-Import) | Approved | [Spec](PROJ-3-paperless-integration.md) | 2026-05-15 |
| PROJ-4 | Kontoauszug-Import (Excel/CSV, Multi-Konto) | Approved | [Spec](PROJ-4-kontoauszug-import.md) | 2026-05-15 |
| PROJ-5 | Autonome Klassifizierung: Steuerrelevanz & privat/geschäftlich | Approved | [Spec](PROJ-5-autonome-klassifizierung.md) | 2026-05-15 |
| PROJ-6 | Beleg↔Buchung-Auto-Matching & Fehlliste | Approved | [Spec](PROJ-6-beleg-buchung-matching.md) | 2026-05-15 |
| PROJ-7 | Prüfliste & Lernregeln (Ausnahmen-Workflow) | Approved | [Spec](PROJ-7-pruefliste-lernregeln.md) | 2026-05-15 |
| PROJ-8 | Umsatzsteuer-Voranmeldung (Vorschlag) | Deployed | [Spec](PROJ-8-umsatzsteuer-voranmeldung.md) | 2026-05-15 |
| PROJ-9 | Jahres-EÜR (§4 Abs.3 EStG) | Approved | [Spec](PROJ-9-jahres-euer.md) | 2026-05-15 |
| PROJ-10 | Einkommensteuer-Vorschau & Privatentnahmen-Aufstellung | Approved | [Spec](PROJ-10-est-vorschau-privatentnahmen.md) | 2026-05-15 |
| PROJ-11 | Export (PDF, CSV/DATEV-ähnlich, ELSTER-konforme Kennzahlen) | Approved | [Spec](PROJ-11-export.md) | 2026-05-15 |
| PROJ-12 | Dashboard & Buchungsstatus-Übersicht | Approved | [Spec](PROJ-12-dashboard-status.md) | 2026-05-15 |
| PROJ-13 | Adminbereich (Systemkonfiguration & Benutzerverwaltung) | Approved | [Spec](PROJ-13-adminbereich.md) | 2026-05-19 |
| PROJ-14 | Kategorien-Analyse & Inline-Bearbeitung | Approved | [Spec](PROJ-14-kategorien-analyse.md) | 2026-05-20 |
| PROJ-15 | Klassifizierung-Pro: Empfänger-Cache, Regex- & Split-Regeln | Deployed | [Spec](PROJ-15-klassifizierung-pro.md) | 2026-05-20 |
| PROJ-16 | Mein Profil — persönliche Stammdaten als LLM-Kontext | Deployed | [Spec](PROJ-16-mein-profil-stammdaten.md) | 2026-05-21 |
| PROJ-17 | KI-Chat zu Buchungen & Finanzdaten (Lese + Schreib mit Confirm) | Approved | [Spec](PROJ-17-ki-chat-finanzen.md) | 2026-05-21 |
| PROJ-18 | Lieferanten-Tab (wiederkehrende Empfänger ohne Abo) | Deployed | [Spec](PROJ-18-lieferanten-tab.md) | 2026-05-21 |
| PROJ-19 | Kündigungsliste für wiederkehrende Empfänger | Deployed | [Spec](PROJ-19-kuendigungsliste.md) | 2026-06-13 |
| PROJ-20 | Merkliste (Buchungen für späteres Review merken) | Deployed | [Spec](PROJ-20-merkliste.md) | 2026-06-14 |
| PROJ-21 | Lieferanten-Notizen (Notizen pro wiederkehrendem Empfänger) | Deployed | [Spec](PROJ-21-lieferanten-notizen.md) | 2026-06-15 |
| PROJ-22 | Globaler Jahreswähler (app-weiter Jahres-Modus) | Deployed | [Spec](PROJ-22-globaler-jahreswaehler.md) | 2026-06-16 |
| PROJ-23 | Vorjahres-Übernahme (deterministischer Vor-Pass der Klassifizierung) | Deployed | [Spec](PROJ-23-vorjahres-uebernahme.md) | 2026-06-16 |
| PROJ-24 | Klassifizierung-Center (Menüpunkt, Statistik, Auto-Continue, Manuell-First) | Deployed | [Spec](PROJ-24-klassifizierung-center.md) | 2026-06-17 |
| PROJ-25 | Auto-Erkennung Boost (Cache-Default, Konsens-Konfidenz, LLM-Ausfall-Fallback) | Deployed | [Spec](PROJ-25-auto-erkennung-boost.md) | 2026-06-23 |
| PROJ-26 | Prüflisten-Speedrun (Keyboard-Triage, Inline-Begründung, Sofort-Lernregel) | Deployed | [Spec](PROJ-26-pruefliste-speedrun.md) | 2026-06-23 |
| PROJ-27 | Cockpit-Dashboard (Health-Score, USt-VA-Fristen-Countdown, Aktivitäts-Feed) | Deployed | [Spec](PROJ-27-cockpit-dashboard.md) | 2026-06-23 |
| PROJ-28 | Few-Shot aus Korrekturen (lernende LLM-Klassifizierung) | Deployed | [Spec](PROJ-28-fewshot-korrekturen.md) | 2026-06-23 |
| PROJ-29 | Command-Palette (Cmd+K — globale Sprung-Navigation) | Deployed | [Spec](PROJ-29-command-palette.md) | 2026-06-24 |
| PROJ-30 | Trend-Sparklines im Dashboard (Verlauf der Kern-KPIs) | Deployed | [Spec](PROJ-30-trend-sparklines.md) | 2026-06-24 |
| PROJ-31 | Vorjahresvergleich (YoY) der Dashboard-KPIs | In Progress | [Spec](PROJ-31-yoy-vergleich.md) | 2026-06-24 |
| PROJ-32 | E-Mail-Fristen-Erinnerung (USt-VA-Frist) | In Progress | [Spec](PROJ-32-email-fristen-erinnerung.md) | 2026-06-24 |
| PROJ-33 | Batch-LLM — Durchsatz der Klassifizierung | In Progress | [Spec](PROJ-33-batch-llm-durchsatz.md) | 2026-06-24 |
| PROJ-34 | Command-Palette v2 — Buchungs- & Empfänger-Volltextsuche | In Progress | [Spec](PROJ-34-command-palette-v2-suche.md) | 2026-06-24 |

<!-- Add features above this line -->

## Next Available ID: PROJ-35
