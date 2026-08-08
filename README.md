# Steueragent

Steueragent ist eine private, mandantengeschützte Next.js-Anwendung für
Kontoimporte, Paperless-ngx-Belege, Klassifizierung, Beleg-Buchungs-Matching,
EÜR-Auswertungen sowie USt- und ESt-Vorschauen.

> Steueragent erstellt nachvollziehbare Vorschläge und Auswertungen, ersetzt
> aber keine steuerliche Beratung und übermittelt derzeit keine Erklärung
> automatisch an ELSTER.

## Funktionsumfang

- Supabase-Authentifizierung mit optionaler Single-Tenant-E-Mail-Allowlist
- CSV-/Excel-Kontoauszugimport mit Duplikaterkennung
- Paperless-ngx-Synchronisation und OCR-/Custom-Field-Auswertung
- Regel-, Vorjahres-, Cache- und LLM-gestützte Klassifizierung
- Sicheres Beleg-Buchungs-Matching mit manueller Bestätigung bei Mehrdeutigkeit
- Prüflisten, Lernregeln, Kategorien- und Finanzanalysen
- USt-VA-Vorschau mit ELSTER-Kennzahlen
- Jahres-EÜR und Einkommensteuer-Vorschau
- PDF-/CSV-Exporte, Dashboard, Admin- und Profilbereich
- USt-Fristenerinnerungen per E-Mail nach ausdrücklichem Opt-in

## Technischer Aufbau

- Next.js 16 / React 19 / TypeScript
- Supabase Auth und PostgreSQL mit Row Level Security
- Vitest für Fach- und Integrationslogik
- Playwright für Browser- und API-Smoke-Tests
- Vercel für Produktion und Cron-Ausführung

## Lokale Einrichtung

Voraussetzung ist Node.js 22 oder neuer.

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Die Anwendung läuft anschließend unter `http://localhost:3000`.

Erforderliche Variablen und die Einrichtung von Supabase, Paperless, KI und
E-Mail-Versand sind in [docs/SETUP.md](docs/SETUP.md) beschrieben. Secrets
dürfen weder mit `NEXT_PUBLIC_` beginnen noch in Git eingecheckt werden.

## Qualitätsprüfung

```bash
npm run lint
npm test -- --maxWorkers=1 --no-file-parallelism
npm run test:e2e
npm run build
npm audit --audit-level=low
```

Die E2E-Suite startet automatisch einen isolierten Dev-Server auf Port 3010
und prüft Chromium sowie Mobile Safari. Angemeldete, schreibende E2E-Flows
benötigen künftig einen separat verwalteten Test-Account; Produktionsdaten
werden von der vorhandenen Smoke-Suite nicht verändert.

## Datenbankmigrationen

Migrationen liegen unter `supabase/migrations/` und werden in Reihenfolge
angewendet. Vor jedem Produktionslauf müssen Migrationen in einer Transaktion
oder einer Supabase-Branch validiert und anschließend mit den Security- und
Performance-Advisors kontrolliert werden.

## Fachliche Grenzen

- Die USt-Ansicht weist Vorsteuer ohne Beleg bewusst als vorläufig abziehbar
  aus und zeigt den unbelegten Anteil separat.
- AfA-Verteilung ist im derzeitigen EÜR-MVP nicht enthalten.
- Steuerfreie, nicht steuerbare und Reverse-Charge-Umsätze benötigen eine
  eigene Sachverhaltsklassifikation; sie werden nicht pauschal als 0-%-Umsatz
  ausgegeben.
- Mehrdeutige Matches werden niemals automatisch bestätigt.

## Deployment

Produktionsdeployments erfolgen erst nach erfolgreichem Lint, Unit-Test,
E2E-Test, Build und Datenbankcheck. Datenbankmigrationen werden vor dem
Vercel-Deployment angewendet, damit neue Anwendungsversionen kein veraltetes
Schema antreffen.
