# Product Requirements Document — RiskGuard

> KI-native Lieferketten-Risikoplattform für LkSG / CSDDD / UFLPA und Klimarisiko.
> Detaillierter Bauplan, Methodik, KI-Konzept und Master-Build-Prompt: siehe
> [docs/PROJECT-PLAN.md](PROJECT-PLAN.md) und [docs/research/](research/).

## Vision
RiskGuard macht Lieferketten-Risiken nachvollziehbar, KI-automatisiert und rechtlich verteidigbar.
Die Plattform bewertet Produkte/Lieferanten deterministisch über **16 Risikotypen** (5 Umwelt + 11
Menschenrechte) auf Basis einer transparenten EXIOBASE-EEIO-Methodik, ergänzt um KI für Country-of-Origin-
Inferenz, Dokumentenanalyse, n-Tier-Discovery, Adverse-Media-Monitoring und zitierte Berichte. Ziel ist
ein Tool, das methodisch tiefer, transparenter und KI-nativer ist als Prewave, IntegrityNext, EcoVadis,
osapiens, Sedex, Achilles, Sphera und Interos.

## Target Users
- **Compliance-/Nachhaltigkeits-Teams** großer Handels-/Industrieunternehmen (ALDI-Typ), die LkSG-,
  CSDDD- und UFLPA-Pflichten nachweisbar erfüllen müssen. Schmerzpunkt: Black-Box-Scores sind vor BAFA/
  Audits schwer verteidigbar; manuelle Risikoanalysen sind langsam und teuer.
- **Risiko-/Procurement-Analysten**, die Produkt-/Lieferantenportfolios bewerten, Salient Risks
  priorisieren und Maßnahmen ableiten. Schmerzpunkt: Daten-Lücken bei Herkunft, Alert-Overload.
- **Management/CFO-Ebene**, die Risiko in EUR (Spend-/Revenue-at-Risk) und Entscheidungen übersetzt
  sehen will. Schmerzpunkt: „Detection-to-Decision"-Lücke der bestehenden Tools.
- Sekundär: **Mittelstand**, der eine günstigere, transparente Alternative zu Verisk Maplecroft sucht.

## Core Features (Roadmap)

> IDs verweisen auf den Feature-Breakdown in [docs/PROJECT-PLAN.md §4](PROJECT-PLAN.md) und
> [features/INDEX.md](../features/INDEX.md). Status wird dort gepflegt.

| Priorität | Feature-Block | PROJ-IDs | Status |
|-----------|---------------|----------|--------|
| **P0 (MVP)** | Auth & Multi-Tenant (invite-only, Rollen, RLS) + i18n + WDK-Durability | PROJ-1 | Planned |
| **P0 (MVP)** | Referenz-Datenmodell & Seed (16 Risikotypen, 124-Index-Katalog, BAFA-Crosswalk) | PROJ-2 | Planned |
| **P0 (MVP)** | Lieferanten-/Produkt-Import (CSV/Excel) | PROJ-3 | Planned |
| **P0 (MVP)** | EXIOBASE/EEIO Supply-Chain-Engine (offline, MRIO-Abstraktion) | PROJ-4 | Planned |
| **P0 (MVP)** | 16-Risikotyp-Scoring-Engine (deterministisch, Dual-Scoring) | PROJ-5 | Planned |
| **P0 (MVP)** | UFLPA / Forced-Labour-Modul | PROJ-6 | Planned |
| **P0 (MVP)** | CSDDD Severity/Likelihood & Confidence-Framework | PROJ-7 | Planned |
| **P0 (MVP)** | Salient-Risk-Register & Dashboard | PROJ-8 | Planned |
| **P0 (MVP)** | KI Country-of-Origin-Inferenz | PROJ-9 | Planned |
| **P0 (MVP)** | KI Dokument-/SAQ-Extraktion | PROJ-10 | Planned |
| **P0 (MVP)** | Regulatory RAG-Assistent (zitiert) | PROJ-11 | Planned |
| **P0 (MVP)** | Audit-Log & EU-AI-Act-Governance | PROJ-12 | Planned |
| P1 | Datenquellen-Ingestion-Pipeline | PROJ-13 | Planned |
| P1 | KI Adverse-Media-Monitoring (Precision-first) | PROJ-14 | Planned |
| P1 | KI Berichtsgenerierung (LkSG/CSRD/UFLPA) | PROJ-15 | Planned |
| P1 | Regulatory Horizon Scanner | PROJ-16 | Planned |
| P1 | Per-Markt-Schwellenwerte & Overrides | PROJ-17 | Planned |
| P1 | Notifications & Alert-Delivery + Triage | PROJ-22 | Planned |
| P1 | Supply-Chain Knowledge Graph & n-Tier-Discovery | PROJ-23 | Planned |
| P1 | ERP/Procurement-Connectors (Ariba/Coupa/Ivalua) | PROJ-24 | Planned |
| P1 | Billing, Plans & Metering (Stripe) | PROJ-25 | Planned |
| P1 | Alternative-Supplier & EUR-Exposure | PROJ-26 | Planned |
| P1 | Enterprise SSO/SAML (Azure AD/OIDC) | PROJ-29 | Planned |
| P1 | EU-AI-Act & GDPR Compliance-Artefakte (vollständig) | PROJ-28 | Planned |
| P2 | Climate-Risk-Modul (physisch + transitorisch, ESRS E1) | PROJ-18 | Planned |
| P2 | EUDR Geolocation-Modul | PROJ-19 | Planned |
| P2 | CBAM Embedded-Emissions-Modul | PROJ-20 | Planned |
| P2 | Predictive Supplier-Distress-Scoring | PROJ-21 | Planned |
| P2 | Lieferantenportal & Worker-Voice | PROJ-27 | Planned |

## Success Metrics
- **Methodische Korrektheit:** 100 % Reproduktion der ALDI-Gold-Set-Overall-Scores im Eval-Harness
  (Release-Gate).
- **KI-Präzision:** Adverse-Media-Relevanz-Precision ≥ 0,80 auf gelabeltem Eval-Set.
- **Verteidigbarkeit:** jede konsequenzielle KI-Ausgabe ist zitiert, versioniert und im Audit-Log
  nachvollziehbar (EU-AI-Act-/BAFA-tauglich).
- **Time-to-Value:** Portfolio-Import → erstes Salient-Risk-Register in < 1 Tag.
- **Geschäftlich:** zahlende Mandanten, Supplier-Count-Wachstum, Net Revenue Retention.

## Constraints
- **Stack vorgegeben:** Next.js 16 + TypeScript, Tailwind/shadcn, Supabase (Postgres/Auth/Storage/RLS),
  Zod + react-hook-form, Vercel; KI via Vercel AI SDK v6 + AI Gateway (Default: aktuelles Claude);
  Durability via Vercel Workflow DevKit. i18n DE-primär.
- **Datenlizenzen als Launch-Gates:** EXIOBASE ist CC-BY-SA-**NC** (nur Dev/Eval) → kommerzieller
  Release nur hinter MRIO-Source-Abstraktion mit kommerzieller Quelle (OECD ICIO / GLORIA / EXIOBASE-
  Lizenz); OpenSanctions-Commercial analog.
- **Regulatorik volatil:** alle regulatorischen Parameter config/version-getrieben (`regulatory_config`),
  nichts hartkodieren; Stand Juni 2026 ist nur Seed.
- **EU-AI-Act High-Risk:** Human-Oversight + Audit-Log + Art.-9–13-Artefakte sind Pflicht ab Tag 1.
- **Offline-Compute:** EXIOBASE-/Klima-Berechnung läuft außerhalb von Vercel (GitHub Actions Cron →
  Postgres via Service-Role).

## Non-Goals
- Kein Echtzeit-pymrio im Web-Request (nur vorberechnete, materialisierte Tabellen).
- Kein LLM-basiertes Berechnen der 1–5-Scores (Scoring bleibt deterministischer TypeScript-Code).
- Kein Aufbau einer eigenen kommerziellen Index-Datenbank wie Maplecroft (wir nutzen öffentliche
  Indizes + optionalen Maplecroft-Connector).
- Keine generische ESG-Rating-/Audit-Marktplatz-Funktion über den Risiko-Use-Case hinaus im MVP.
- Mobile-App (Web-responsive genügt im MVP).

---

Erstellt durch `/requirements` (Init) am 2026-06-08 auf Basis von `docs/PROJECT-PLAN.md`.
Nächste Feature-Specs werden via `/requirements PROJ-X` pro Feature erzeugt.
