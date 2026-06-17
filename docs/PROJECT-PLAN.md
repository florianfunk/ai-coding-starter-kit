# PROJECT PLAN — AI-First LkSG/CSDDD Supply-Chain Risk Platform

> Master-Deliverable. Definiert Produkt, Scope, Feature-Breakdown (PROJ-1…PROJ-28), Architektur, Datenstrategie und enthält am Ende den fertigen, **selbst-tragenden MASTER BUILD PROMPT (zum Kopieren)** für den Coding-Agenten — er verweist verbindlich auf die vier Research-Docs (`docs/research/01–04`) und deckt alle Differenzierer ab: EEIO/MRIO, 16-Typ-Scoring, UFLPA-Overlay, CSDDD-Severity, Confidence-Framework, n-Tier-Knowledge-Graph (GraphRAG), WDK-Durability, ERP-Connectors, Billing, Alternativ-Lieferanten, i18n, EU-AI-Act/GDPR-Artefakte und ein ausführbares Eval-Gate.
>
> **Arbeitsname:** *Sentinel* (intern). **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Auth + Storage + RLS) · Zod + react-hook-form · Vercel · Vercel AI SDK v6 + AI Gateway (model-agnostisch, Default: aktuelles Claude). **Workflow:** `/requirements` → `/architecture` → `/frontend` → `/backend` → `/qa` → `/deploy`, Feature-Tracking als PROJ-X in `features/INDEX.md`.
>
> **Stand der Recherche:** Juni 2026. Regulatorik: Omnibus I in Kraft (18.03.2026), LkSG-Berichtspflicht de-facto ausgesetzt, EUDR/CBAM/UFLPA-Status siehe Abschnitt 6/9.

---

## 1. Vision & Value Proposition

**Vision.** Eine KI-native Software, die eine LkSG/CSDDD-/UFLPA-konforme Lieferketten-Risikoanalyse von einer manuellen Analysten-Excel-Arbeit (4–8 Wochen) zu einer kontinuierlichen, prüfbaren, weitgehend automatisierten Pipeline macht — und dabei methodisch tiefer ist als alle benannten Wettbewerber.

**Der methodische Kern (unser Burggraben).** Wir kombinieren zwei Dinge, die kein Wettbewerber zusammen anbietet:

1. **Quantitative EEIO/EXIOBASE-Fundierung.** EXIOBASE 3 MRIO (Leontief-Inverse `L = (I-A)^-1`, Multiplikatoren `M = F × L`) attribuiert Lieferketten-Anteile pro Land-Sektor über drei Stufen (Rohstoff-Ursprung, Verarbeitung, Fertigung), ergänzt durch FAOSTAT/UN Comtrade zum Schließen von Country-of-Origin-Lücken. Damit finden wir versteckte Tier-3-Hotspots (z. B. China/Chemie bei nur 2,8 % Anteil, aber höchster Pollution-Intensität), die questionnaire-basierte Tools strukturell übersehen.
2. **Deterministisches 16-Risikotypen-Scoring (1–5).** 5 Umwelt- + 11 Menschenrechts-Dimensionen, jede gegen dokumentierte Index-Schwellenwerte gescort, ENV-Composite = Mittel der 5, HR-Composite = Mittel der 11, Overall = `max(ENV, HR)`, plus UFLPA-Overlay (HIGH = +1 gedeckelt auf 5; CRITICAL = Override 5). Jeder Score ist auf eine benannte, zitierbare Quelle und eine LkSG-§2-/CSDDD-Annex-Position rückführbar.

**Warum wir Prewave / IntegrityNext / EcoVadis / osapiens / Sedex / Achilles / Sphera / Interos schlagen:**

| Schwäche der Wettbewerber | Unsere Antwort |
|---|---|
| **Keine EEIO/MRIO-Attribution** (alle 8 stützen sich auf Supplier-Self-Assessment, Adverse-Media oder Beziehungsgraphen) | EXIOBASE-Leontief-Engine als nachweisbare, spend-basierte Supply-Share-Quelle; Tier-N ohne Fragebogen rechnerisch herleitbar |
| **Intransparente, nicht zitierbare Scoring-Methodik** ("weighted score", "99,98 % Relevanz" = Marketing) | Voll dokumentierte 1–5-Schwellenwerte, jeder Score zeigt Rohindex + Schwelle + Quelle + Konfidenz + LkSG/CSDDD-Mapping |
| **Self-reported Daten** (IntegrityNext, EcoVadis, Sedex SAQ/SMETA) — "was Firmen sagen, nicht was sie tun" | Impact- und exposure-basierte öffentliche Indizes (124 katalogisiert, ~31 BAFA-gelistet) + EEIO; SAQ nur als Ergänzung, KI-verifiziert |
| **Kein LLM-natives, agentisches Analysten-Erlebnis** (Prewave UX-Redesign statt Copilot; Sedex hat 0 KI) | Agentische Pipeline: CoO-Inferenz-Agent, UFLPA-Agent, Adverse-Media-Agent, Regulatory-RAG-Assistent — alle mit Audit-Trail (EU-AI-Act-konform) |
| **Schwache UFLPA-Tiefe** (Achilles/Sphera/osapiens generisch, kein FLETF/XUAR/Entity-List-Engine) | First-Class UFLPA-Modul: 12 FLETF-Sektoren, XUAR-Nexus aus EXIOBASE-Importanteilen, Entity-List-Fuzzy-Match, monatlicher Auto-Refresh |
| **Physische + transitorische Klimarisiken fehlen oder sind getrennt** | Integriertes Klimarisiko-Modul (28 CSRD/EU-Taxonomie-Gefahren, SSP-Szenarien, `Risiko = Gefahr × Exposition × Sensitivität`) im selben Produkt |
| **Alert-Overload / Noise** (Prewave: "zu viele irrelevante Alerts") | Adversariale Zwei-LLM-Analyst/Reviewer-Schleife filtert Adverse-Media; nur score-verändernde Signale eskalieren |
| **Breite statt Tiefe**, hoher Preis, lange Onboarding-Zeit | Fokus auf rigorose HR+ENV-Methodik; öffentliche Daten = nahezu Null-Datenkosten als günstigere "Maplecroft-Alternative" |

**Positionierung:** *"Die einzige Lieferketten-Risikoplattform, die jeden Risiko-Score quantitativ aus EXIOBASE-Lieferketten-Modellierung plus benannten öffentlichen Indizes herleitet — KI-automatisiert, prüfbar, und gegen Regulator-Anfragen verteidigbar."*

---

## 2. Target Users & Primary Use Cases

**Primäre Nutzer:**
- **Compliance-/Sustainability-Teams großer Händler & Markenhersteller** (ALDI-Typ, FMCG, Textil, Industrie), die unter CSDDD ab 2028/2029 oder via Kunden-Kaskadierung in der Pflicht stehen.
- **Beratungs-/Audit-Dienstleister**, die LkSG/CSDDD/UFLPA-Risikoanalysen und Klimarisiko-Decks als Service liefern (Multi-Mandant, Wiederverwendung von Methodik über Klienten).
- **Procurement-/Risk-Manager**, die Salient-Risk-Register, Sourcing-Entscheidungen und UFLPA-Importrisiken managen.
- **Investor-/ESG-Reporting-Funktionen** (CSRD/ESRS-Output, Double Materiality).

**Primäre Use Cases:**
1. Produkt-/Lieferanten-Portfolio importieren → KI korrigiert Country-of-Origin, scort 16 Risikotypen über CoO + Production-Facility-Country, liefert Overall-Risk + Salient-Flag.
2. UFLPA-Importrisiko screenen (FLETF-Sektor, XUAR-Nexus, Entity-List) inkl. zeitgebundener Maßnahmen.
3. Kontinuierliches Monitoring: Adverse-Media + Index-Updates + Sanktions-/Entity-List-Änderungen re-triggern Re-Scoring und Alerts.
4. Salient-Risk-Register + Heatmaps + CSDDD-Severity/Likelihood erzeugen, mit Konfidenz und Quellen.
5. Klimarisiko-Analyse (physisch je Standort, transitorisch je Geschäftsbereich) für CSRD ESRS E1.
6. Berichte generieren (LkSG-Dokumentation, CSRD/ESRS, UFLPA-Dossier) — KI-Entwurf, Mensch finalisiert, jeder Satz zitiert.
7. Regulatorik-Fragen im RAG-Assistenten ("Welche LkSG-§2-Position deckt Kinderarbeit, und welche BAFA-Quelle?") mit Zitaten.

---

## 3. Scope: MVP (P0) vs P1 vs P2 — Roadmap

| Bereich | P0 (MVP) | P1 | P2 |
|---|---|---|---|
| **Daten** | Supplier/Produkt-Import (CSV/Excel), versioniertes Index-Schema, ~12 Kern-Indizes geseedet | Auto-Ingestion-Pipeline aller ~30 öffentlichen Indizes mit Freshness-Monitoring | Verisk-Maplecroft-Connector (paid), UN Comtrade Premium-Bulk |
| **EEIO** | Vorberechnete EXIOBASE-Supply-Shares (Python-Batch, in Postgres) + Konkordanztabelle | pymrio-Recompute-Workflow on-demand, RoW-Disaggregation, GLORIA-Cross-Validation | GPU-beschleunigte Multiplikatoren, sub-nationale Auflösung |
| **Scoring** | Deterministische 16-Typ-Engine, CoO+PFC-Dual, Composites, UFLPA-Overlay, Score-Verifikation | Customizable Per-Market-Thresholds, manuelle Overrides mit Begründung | Probabilistische CoO-Verteilungen, Szenario-Scoring |
| **KI** | CoO-Inferenz, Doc/SAQ-Extraktion, Regulatory-RAG-Assistent | Adverse-Media-Agent (GDELT), CSDDD-Severity-Adjudikation, Konfidenz-Auto-Klassifikation | Predictive Supplier-Distress (XGBoost/LSTM), autonome Monitoring-Agenten |
| **Compliance** | UFLPA-Modul, CSDDD-Severity/Likelihood, Confidence-Framework, Audit-Log, EU-AI-Act-Artefakte (Art. 9–13), GDPR/EU-Residency-Posture | LkSG/CSRD-Reportgenerator, Regulatory-Horizon-Scanner | EUDR-Geolocation-Modul, CBAM-Embedded-Emissions, EU-Forced-Labour-Markt-Ban |
| **Klima** | — | Klimarisiko-Modul (28 Gefahren physisch, SSP, Standort-Exposition) | Transition-Risk (NGFS/IEA, Long-/Short-List), ESRS-E1-Datapoints, parametrische Versicherung, ROI/Loan-Break-Even, meteoblue-API |
| **Graph** | — | Supply-Chain-Knowledge-Graph / n-Tier-Discovery (pgvector + Apache AGE, GraphRAG) | Sub-nationale Graph-Auflösung, Cluster-Risiko-Analytics |
| **Integration** | Export-/Results-API (read-only, maschinenlesbar) | ERP/Procurement-Connectors (SAP Ariba, Coupa, Ivalua, SAP Business Network) | o9, JAGGAER, weitere Connectors; bidirektionaler Sync |
| **Engagement** | — | Lieferantenportal (SAQ-Collection), Worker-Voice/Grievance-Intake (optional) | Zweiseitiges Netzwerk, geteilte Profile, Benchmarks |
| **Kommerz** | Billing/Plans (Stripe, Supplier-Count-/Seat-Metering, transparente Tiers) | Self-Service-Upgrade, Usage-Dashboards | White-Label, Mandanten-übergreifende Benchmarks |
| **Plattform** | Auth + Multi-Tenant (RLS), Salient-Register + Dashboard, i18n (DE primär, EN), Alert-Delivery-Kanäle | Rollen/Berechtigungen, Benachrichtigungs-Triage, Alternativ-Lieferanten/EUR-Exposure | White-Label, Mandanten-übergreifende Benchmarks |

---

## 4. Feature Breakdown (PROJ-X) — Pro Feature `/requirements` ausführen

> Reihenfolge entspricht der empfohlenen Build-Sequenz. Pro Zeile genau ein Feature (Single Responsibility). Für jedes Feature: `/requirements PROJ-X …` → `/architecture` → `/frontend` → `/backend` → `/qa` → `/deploy`. Status in `features/INDEX.md` pflegen.

| ID | Feature | One-Liner | Phase |
|---|---|---|---|
| **PROJ-1** | Auth & Multi-Tenant Foundation | Supabase-Auth, Organisations-/Workspace-Modell, RLS-Tenant-Isolation, Rollen (Admin/Analyst/Viewer). | P0 |
| **PROJ-2** | Reference Data Model & Seed | Versioniertes Postgres-Schema: countries, risk_types(16), index_catalog(124), country_risk_scores, raw_index_data, commodity_country_data, exiobase_concordance, regulatory_sources(BAFA/LkSG/CSDDD) inkl. Effective-Date-Metadaten; Seed aus den ALDI-Case-Study-Daten. | P0 |
| **PROJ-3** | Supplier/Product Data Ingestion | Import von Produkt-/Komponenten-Portfolios (CSV/Excel/Manuell): product → component(resource_type, max_pct, rcv_cost, CoO, PFC, market) inkl. ALDI-Taxonomie-Felder; Daten-Qualitäts-Handling (Tippfehler, Bruch-Prozente). | P0 |
| **PROJ-4** | EXIOBASE/EEIO Supply-Chain Engine | Vorberechnete Leontief-Multiplikatoren `M=F×L` + Supply-Shares pro [Produkt×Land×Sektor] über 3 Stufen, aus Python-pymrio-Batch in Postgres geladen; Konkordanz Commodity→EXIOBASE-Produktgruppe. | P0 |
| **PROJ-5** | 16-Risk-Type Scoring Engine | Deterministische TypeScript-Scoring-Funktionen (MAX/OR/Direct/Override-Logik je Dimension), CoO+PFC-Dual-Scoring, ENV/HR-Composites, `Overall=max(ENV,HR)`, Score-Verifikations-/Audit-Modul. | P0 |
| **PROJ-6** | UFLPA / Forced-Labour Module | FLETF-12-Sektor-Registry (mit Designations-Daten), XUAR-Nexus aus EXIOBASE-Importanteilen, Entity-List-Store mit Fuzzy-Match, Klassifikation CRITICAL/HIGH/NOT-APPLICABLE + Forced-Labor-Override. | P0 |
| **PROJ-7** | CSDDD Severity/Likelihood & Confidence Framework | Art.6-Severity (Scale 50/Scope 25/Irremediability 25) + Likelihood (Governance 40/Commodity 30/Historical 30), Salient-Flag (≥3.5), 4-Level-Konfidenz mit Validierungsaktionen + SLAs. | P0 |
| **PROJ-8** | Salient-Risk Register & Dashboard | Ranked Register (Overall≥3.5=YES, UFLPA-WATCH=ELEVATED), 16-Dimensions-Heatmaps, Hotspot-Identifikation (high-share×high-risk), Filter nach Markt/Sektor/UFLPA/Konfidenz. | P0 |
| **PROJ-9** | AI Country-of-Origin Inference | LLM-Agent: 3-Schritt-Logik (Plausibilität → EXIOBASE-Trade-Coefficient → korrigierte CoO + Konfidenz) + generierte 5-teilige Begründung pro Zeile; adversariale Zwei-LLM-Schleife, Human-Review-Queue. | P0 |
| **PROJ-10** | AI Document/SAQ Extraction | Vision+LLM-Extraktion aus SAQ/Zertifikaten/Audit-PDFs mit Zod-Schema-Constraint, Per-Field-Provenance (Seite/Koordinate) + Konfidenz, Low-Confidence-Routing in Review. | P0 |
| **PROJ-11** | Regulatory RAG Assistant | Citation-first RAG über LkSG/CSDDD/ESRS/BAFA-Quellenübersicht (KG-of-Triplets-Grounding); Antworten nur aus Kontext, jeder Satz mit Quell-ID + Konfidenz; Versionierung der Regelwerks-Inhalte. | P0 |
| **PROJ-12** | Audit Log & EU-AI-Act Governance | Append-only Audit-Log jeder KI-Entscheidung (Input, Modell+Version, Prompt, Quellen, Output, Reviewer, Override); Human-Oversight-Checkpoints; Transparenz-Hinweise; "Regulation-Version-as-of"-Stempel. | P0 |
| **PROJ-13** | Data-Source Ingestion Pipeline | Tiered Scheduler: jährliche/on-release API-Pulls (World Bank, FAOSTAT, ILOSTAT SDMX, ND-GAIN, INFORM, Aqueduct, GFW), Bulk-File-Fetch (TVPRA, CPI, Freedom House, ITUC, Walk Free); versionierte Snapshots, nur score-verändernde Updates flaggen. | P1 |
| **PROJ-14** | AI Adverse-Media Monitoring | GDELT 2.0 + OpenSanctions kontinuierlich; LLM klassifiziert/summiert Treffer in 16 Risikotypen mit Konfidenz+Zitaten; adversariale Relevanz-Filterung; Early-Warning-Alerts + Re-Scoring-Trigger. | P1 |
| **PROJ-15** | AI Report Generation (LkSG/CSRD/UFLPA) | Mappt Assessment-Output auf ESRS-Datenpunkte + LkSG-§2-Positionen, Double-Materiality + Gap-Analyse, zitierte Narrative je Produkt/Salient-Risk; Mensch finalisiert; Export. | P1 |
| **PROJ-16** | Regulatory Horizon Scanner | Ingestiert EUR-Lex/OJ, Council, BAFA, FLETF/CBP/DHS, EUDR-System; erkennt Diffs mit Effective-Date + Zitat; unterscheidet enacted/proposed/administrativ-ausgesetzt. | P1 |
| **PROJ-17** | Per-Market Threshold Customization & Overrides | Editierbare Schwellenwert-Tabellen je Retailer-Markt (UK MSA vs LkSG §2) ohne Code-Change; manuelle Score-Overrides mit Pflicht-Begründung + Audit-Eintrag. | P1 |
| **PROJ-18** | Climate-Risk Module | 28 CSRD/EU-Taxonomie-Gefahren, SSP1-2.6…5-8.5 × 2 Horizonte, 5-stufige Red-Flag-Skala, `Risiko=Gefahr×Exposition×Sensitivität` brutto→netto, Standort-/Hotspot-Modell, ESRS-E1-Mapping. | P2 |
| **PROJ-19** | EUDR Geolocation Module | Plot-Level-Geolocation, Satellitenbild-Verifikation, Due-Diligence-Statements für 7 Commodities (Rinder, Kakao, Kaffee, Palmöl, Kautschuk, Soja, Holz); eigene Pflicht-/Datumsstruktur. | P2 |
| **PROJ-20** | CBAM Embedded-Emissions Module | CBAM-Güter (Eisen/Stahl, Alu, Zement, Dünger, Strom, Wasserstoff), 50-t-De-minimis, Authorized-Declarant-Status, Surrender-Deadlines; Anbindung an GHG-Risikotyp + EXIOBASE. | P2 |
| **PROJ-21** | Predictive Supplier-Distress Scoring | ML-Ensemble (Random Forest/XGBoost/LSTM) forecastet Lieferanten-Distress 90–180 Tage voraus als separates Signal neben dem deterministischen Composite. | P2 |
| **PROJ-22** | Notifications & Alert-Delivery | Precision-first Alert-Inbox + Triage-UX (nur score-verändernde Signale eskalieren); Transport: In-App + E-Mail (Resend/SES) + Webhooks; konfigurierbare Digest-Kadenz (sofort/täglich/wöchentlich) + Eskalationsregeln nach Severity×Confidence; Review-Queues, Maßnahmen-Tracking (zeitgebundene Recommended Actions/SLAs), Kommentare. | P1 |
| **PROJ-23** | Supply-Chain Knowledge Graph & n-Tier Discovery | Knowledge Graph auf Postgres + `pgvector` + **Apache AGE** (Supabase; Neo4j als optionale Alternative hinter Abstraktion); modelliert Produkte, Country-Sectors (EXIOBASE-Konkordanz), 3 Lieferkettenstufen, Tier-N-Lieferanten, 16 Risikotypen, regulatorische Triplets; **GraphRAG**-Abfrage; `nTierDiscoveryWorkflow` (DurableAgent) baut Graph rekursiv auf; inferierte (MRIO-statistisch) vs. lieferanten-deklarierte vs. enforcement-bestätigte Kanten getrennt + mit Provenienz/Konfidenz. Schlägt Interos' 11-Mrd.-Edge-Graph und Prewave 500k+ Tier-N methodisch. | P1 |
| **PROJ-24** | ERP / Procurement Connectors | Connector-Abstraktion + erste Adapter: **SAP Ariba, Coupa, Ivalua, SAP Business Network** (P1); o9, JAGGAER (P2). Importiert Lieferanten-Stammdaten, Spend/PO-Daten, BoM; mappt auf `products`/`components`; inkrementeller Sync + Konflikt-Handling. Table-Stakes für Enterprise-Adoption (alle 8 Wettbewerber liefern Connectors). | P1 |
| **PROJ-25** | Billing, Plans & Metering | **Stripe**-Integration; transparente Tiers (Mittelstand-tauglicher Low-Threshold-Einstieg analog osapiens EASY START); Metering nach Supplier-Count + Seats; Self-Service-Upgrade/Downgrade; Usage-Limits + Soft-Caps; Plan-Gating der Features (RLS-/Policy-getrieben). | P0 (Basis) / P1 (Self-Service) |
| **PROJ-26** | Alternative-Supplier & EUR-Exposure Recommendations | First-Class-Datenmodell für Spend-/Revenue-at-Risk in EUR (aus RCV-Cost × Risiko × Salience) und regulierungskonforme Alternativ-Lieferanten-Vorschläge (z. B. PVC: Westlake/Shintech/INEOS/Vynova). Übersetzt Risiko in CFO-Sprache („detection-to-decision", Interos-iQ-Lehre). | P1 |
| **PROJ-27** | Supplier Portal & Worker-Voice (optional) | Zweiseitige Engagement-Schicht: Lieferanten-Self-Service-Portal zur SAQ-Erfassung (5.0/SMETA/PSCI-Schemas), Dokument-Upload, Korrektur-Feedback; optionaler Worker-Voice-/Grievance-Intake-Kanal. SAQ-Daten fließen als KI-verifizierter Ergänzungs-Input ins Scoring (heben/senken Confidence). | P2 |
| **PROJ-28** | EU-AI-Act & GDPR Compliance Artifacts | Operationalisiert die High-Risk-Pflichten über das Audit-Log (PROJ-12) hinaus: Risk-Management-File (Art. 9), Daten-Governance-Doku (Art. 10), Technische Dokumentation/Annex IV (Art. 11), Logging-Spezifikation (Art. 12), Deployer-Instructions/Transparenz (Art. 13), Conformity-Assessment-/CE-Posture; GDPR: DPA-Modell, EU-Daten-Residency, Retention-Schedule, Data-Subject-Request-Handling, Sub-Processor-Liste. | P0 (Skelett) / P1 (vollständig) |

> **Cross-cutting (kein einzelnes PROJ, sondern Architektur-Mandat über alle Features):** Die **Vercel-Workflow-DevKit-Durability-Schicht** (`workflow` / `@workflow/ai`) ist die verbindliche Orchestrierungs- und Auditierbarkeits-Schicht für ALLE langlaufenden, mehrstufigen, human-in-the-loop-Prozesse (Supplier-Assessment, Adverse-Media-Monitoring, n-Tier-Discovery, Doc-Extraktion, Data-Ingestion, Report-Generierung). Details in `docs/research/04-durable-workflows.md`. Ebenso cross-cutting: **i18n (next-intl, DE primär ab PROJ-1)**, **Evals-Harness** (gegen `data/_extracted`-Gold-Set, Release-Gate), **Security-/Compliance-Posture** (Anbindung der bestehenden `docs/production/`-Guides: Security-Headers, Rate-Limiting, DB-Optimierung, Error-Tracking, Performance).

---

## 5. Technical Architecture

### 5.1 Zwei Ebenen (kritisch)

```
Offline Compute Plane (Python)            Online Serving Plane (Next.js + Supabase)
─────────────────────────────            ──────────────────────────────────────────
pymrio EXIOBASE Batch  ──┐               Next.js 16 App Router (RSC + Server Actions)
Climate ETL (Copernicus) ├──> Postgres ──> liest NUR materialisierte Scores/Shares
Bulk-CSV-Ingests         │   (Supabase)    AI-Layer: Vercel AI SDK v6 + AI Gateway
GDELT/OpenSanctions poll ─┘               Background: Vercel Cron + Workflow DevKit
```

**Regel:** EXIOBASE-Leontief-Mathematik (40+ GB, 30–45 Min, GPU-affin) und NetCDF-Klimaverarbeitung laufen **nie** im Next.js-Request — sondern als externer Python-Worker (GitHub Actions Cron / kleine VM), der via Service-Role-Key in Supabase schreibt. Die App liest ausschließlich vorberechnete Tabellen → Sub-Sekunden-Antworten.

### 5.2 Supabase-Schema-Skizze (Kerntabellen + RLS)

```sql
-- Tenancy
organizations(id, name, created_at)
memberships(user_id, org_id, role)              -- role: admin|analyst|viewer

-- Referenz (global, read-only für Tenants)
countries(iso3, name)
risk_types(id, name, domain)                     -- 16 Zeilen: 5 ENV + 11 HR
index_catalog(id, domain, risk_type_id, index_name, publisher, scale_unit,
              update_frequency, latest_data_year, bafa_listed, url_access,
              -- Normalisierung heterogener nativer Skalen auf gemeinsame 1–5-Skala:
              native_scale, direction, native_min, native_max, inverted)  -- z.B. CPI/ITUC invertiert
raw_index_data(country_iso3, index_id, value, source_year, vintage, retrieved_at)
threshold_config(risk_type_id, retailer_market, variant, sub_dimension,
              band_1, band_2, band_3, band_4, band_5, aggregation_logic,
              effective_date, source_citation, is_default)  -- Variant A/B editierbar; ALDI-Gold-Set-Default markiert
coverage_assessment(country_iso3, risk_type_id, vintage, source_count,
              has_regulatory_source, dominant_origin_share, gap_rating)  -- Input für Confidence-Engine
country_risk_scores(country_iso3, risk_type_id, score, vintage)  -- 1-5
commodity_country_data(commodity, country_iso3, exio_ghg, exio_water, exio_land,
              faostat_ghg, wfn_water, trase_defor, sector_pollution_adj,
              tvpra_cl, tvpra_fl, trase_coverage, vintage)
exiobase_concordance(commodity, exio_product_group, exio_code)
exiobase_supply_share(product_id, stage, country_iso3, exio_sector, share, vintage)
regulatory_sources(id, framework, citation, source_name, publisher, effective_date,
              status, version_stand_date)        -- status: enacted|proposed|suspended
regulatory_config(id, framework, key, value, effective_date, source_url, source_citation,
              as_of_date, status)                 -- VERSIONIERTE Regulatorik-Daten statt Prosa:
              -- z.B. ('UFLPA','entity_list_count', current, ..., 'https://www.dhs.gov/uflpa-entity-list', ...),
              -- ('CSDDD','threshold_employees', ...), ('CBAM','de_minimis_tonnes', ...). NICHTS hartkodieren.
regulatory_corpus(id, framework, doc_title, source_url, retrieved_at, version,
              text_chunk, embedding vector, lksg_citation)  -- Primärtexte für PROJ-11/16 RAG
lksg_crosswalk(risk_type_id, lksg_citation, csddd_annex_ref, ilo_convention,
              iccpr_icescr_ref, bafa_category)     -- BAFA-Defensibilitäts-Backbone (02 §7.4/§9)
uflpa_sectors(id, sector_name, designation_date, adjacent_flag)
uflpa_entities(id, name, aliases[], listing_date, capacity)

-- Knowledge Graph (PROJ-23): pgvector + Apache AGE; inferierte vs. deklarierte vs. enforcement-bestätigte Kanten
supply_chain_nodes(id, node_type, ref_id, label, metadata jsonb)  -- product|company|country_sector|tier_n
supply_chain_edges(id, from_node, to_node, tier, edge_kind, provenance, confidence,
              evidence, evidence_embedding vector, vintage)  -- edge_kind: inferred|declared|enforcement_confirmed

-- Kommerz (PROJ-25)
plans(id, name, price_monthly, supplier_quota, seat_quota, features jsonb)
subscriptions(org_id, plan_id, stripe_customer_id, stripe_subscription_id, status,
              current_period_end, supplier_count, seat_count)

-- Tenant-Daten (RLS: org_id = aktueller Tenant)
products(id, org_id, description, category, commodity_group, sourcing_office, market, ...)
components(id, product_id, resource_type, resource_sub_type, max_pct, rcv_cost,
           country_of_origin, coo_corrected, pf_country, pf_type, data_gap_type,
           estimation_method, confidence, rationale, uflpa_flag)
risk_assessments(id, component_id, vintage,
           coo_scores jsonb, pfc_scores jsonb,    -- je 16 Dimensionen
           coo_env_avg, coo_hr_avg, pfc_env_avg, pfc_hr_avg,
           overall_env, overall_hr, overall_risk, risk_label, salient_flag,
           priority_rank, max_env, max_hr, key_risk_dimensions,
           uflpa_applicable, uflpa_sectors, csddd_severity, csddd_likelihood,
           confidence_level, regulation_version_asof)
audit_log(id, org_id, actor, ai_model, ai_version, action, inputs jsonb,
          retrieved_sources jsonb, output jsonb, reviewer, override, created_at)  -- append-only
adverse_media_events(id, org_id, supplier_ref, risk_type_id, summary, tone,
          source_url, relevance, confidence, created_at)
```

**RLS-Hinweise:** Referenztabellen (`countries`, `risk_types`, `index_catalog`, `threshold_config`, `coverage_assessment`, `raw_index_data`, `country_risk_scores`, `commodity_country_data`, `exiobase_*`, `regulatory_sources`, `regulatory_config`, `regulatory_corpus`, `lksg_crosswalk`, `uflpa_*`, `plans`) sind global read-only via Policy `auth.role() = 'authenticated'`. Tenant-Tabellen (`products`, `components`, `risk_assessments`, `audit_log`, `adverse_media_events`, `supply_chain_nodes`, `supply_chain_edges`, `subscriptions`) erhalten Policy `org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())`. `audit_log` ist insert-only (kein UPDATE/DELETE per Policy). Schreibende Batch-Jobs nutzen den Service-Role-Key (umgeht RLS bewusst). **RLS-Tests sind Pflicht** (Vitest/pgTAP): jede Tenant-Tabelle muss Cross-Tenant-Lesezugriff nachweislich verweigern; die Tests sind Teil des `/qa`-Release-Gates.

### 5.3 AI-Layer

- **Vercel AI SDK v6:** `generateObject` + Zod-Schema für jede strukturierte Aufgabe (Extraktion, Klassifikation, Severity-Rating). `tool()` + Agent-Loop (`stopWhen`/`stepCountIs`, `prepareStep`) für CoO-Inferenz-, UFLPA- und Monitoring-Agenten. Lange Läufe auf Fluid Compute.
- **Vercel AI Gateway:** ein Endpoint, Auto-Failover, Cost-Attribution pro Feature. **Sonnet-Klasse** für High-Volume-Extraktion/Klassifikation, **Opus-Klasse** für Adjudikation/Multi-Step-Reasoning, dediziertes **Embeddings-Modell** für RAG. Default: aktuelles Claude (model-agnostische "provider/model"-Strings).
- **Embeddings/RAG (konkret):** Default-Embedding-Modell **Voyage** (`voyage-3`-Klasse) über das Gateway; einheitliche Dimension pro Index festlegen und in `regulatory_corpus.embedding`/`supply_chain_edges.evidence_embedding` als `pgvector` speichern. **Index-Strategie:** HNSW (`vector_cosine_ops`) für RAG-Retrieval und Graph-Evidenz-Suche; Embedding-Modell + Dimension sind config-getrieben (austauschbar), nicht hartkodiert.
- **Deterministik-Regel:** Die 1–5-Scores berechnet **immer** reiner TypeScript-Code (Tools, die der Agent aufruft) — **nie** ein LLM. LLMs machen Extraktion, Retrieval, Klassifikation, Narrative, Adjudikation. Das sichert Reproduzierbarkeit unter Audit.
- **Reliability-Layer:** schema-constrained Output, Tool-Name-Validierung, Per-Satz-Citation-Check, Evals (Rule-based + LLM-Judge + Human-Spot-Check), Guardrail-Pass/Fail-Monitoring.
- **Prompt-Injection-/Data-Poisoning-Abwehr:** Ingestion- und Adverse-Media-Agenten verarbeiten **nicht vertrauenswürdige** Web-/News-/PDF-Inhalte. Untrusted Content wird klar von Instruktionen getrennt (Spotlighting/Delimiter), niemals als System-Prompt interpretiert; Tool-Aufrufe sind allowlist-begrenzt; extrahierte Claims müssen gegen Primärquelle zitierbar sein, sonst werden sie geflaggt; folgenreiche Outputs durchlaufen das adversariale Zwei-LLM-Pattern + Human-Checkpoint, bevor sie supplier-wirksam werden.
- **Kosten-Guardrails:** Per-Feature-Token-Caps und Budget-Alerts über das Gateway; **Model-Downgrade-Regel** (Sonnet → Haiku-Klasse für triviale High-Volume-Klassifikation); **Batch statt Real-time** für nicht-zeitkritische Massen-Extraktion; GDELT-15-Min-Polling filtert vor LLM-Aufruf (Lieferant/Land + negativer Tone + relevante GKG-Themes), damit nur Kandidaten klassifiziert werden.

### 5.4 Background Jobs

- **Tier 1 (kontinuierlich):** GDELT (15-Min-Takt), OpenSanctions (poll `index.json` ~30 Min, refetch ≥6 h bei Hash-Änderung) → Vercel Cron triggert externe Worker.
- **Tier 2 (jährlich/on-release):** Index-Pulls als Supabase Edge Functions + pg_cron.
- **Tier 3 (periodischer Recompute):** EXIOBASE-pymrio + Klima-ETL als externer Python-Worker.

### 5.5 Durability-Schicht (Vercel Workflow DevKit) — verbindlich

Alle langlaufenden, mehrstufigen, unterbrechbaren Prozesse werden als **WDK-Workflows** (`workflow`, `@workflow/ai`) implementiert — **nicht** als fire-and-forget API-Routes. `"use workflow"`-Funktionen orchestrieren (sandboxed), `"use step"`-Funktionen kapseln I/O (DB, fetch, KI, Python-Aufruf) mit Auto-Retry + Result-Persistenz. Human-in-the-Loop via `createHook()` (pause/resume über Tage). Die persistierten Step-Results sind **gleichzeitig der revisionssichere Audit-Trail** (LkSG/CSDDD-Nachweis). Workflows: `supplierAssessmentWorkflow`, `adverseMediaMonitorWorkflow`, `nTierDiscoveryWorkflow` (DurableAgent), `documentExtractionWorkflow`, `dataIngestionWorkflow`, `reportGenerationWorkflow`. Steps müssen idempotent sein (Upsert + Content-Hash). Vollständiges Design: `docs/research/04-durable-workflows.md`.

### 5.6 Repo-Layout & Offline-Compute-Hosting (entschieden)

Monorepo mit zwei Planes, **eine geteilte Supabase-Schema-Quelle**:

```
/                       Next.js 16 App (App Router, RSC, Server Actions, WDK-Workflows)
  app/                  Pages + app/workflows/ (WDK)
  src/lib/db/           Supabase-Migrations (Single Source of Truth für das Schema)
  src/lib/scoring/      Deterministische 16-Typ-Engine (TypeScript)
  evals/                Eval-Harness (parst data/_extracted, asserted Gold-Set-Reproduktion)
  messages/             i18n-Kataloge (de.json primär, en.json)
/compute                Python-Plane (eigenes Package, eigene Deps)
  pymrio_batch/         EXIOBASE-Leontief-Compute (M=F×L)
  climate_etl/          Copernicus/CCKP-NetCDF-ETL
  ingest/               Bulk-CSV-Ingests, GDELT/OpenSanctions-Poller
  schema/               generierte/synchronisierte Tabellen-Kontrakte (read-from migrations)
```

- **Hosting der Python-Plane (entschieden):** **GitHub Actions Cron** als Standard-Scheduler (Tier-3-Recompute, Bulk-Ingests); schreibt via **Service-Role-Key** in dieselbe Postgres-Instanz. Für On-the-fly-Kundenkörbe optional Vercel Sandbox / Python Function (Fluid Compute, Python 3.13/3.14) als Variante 2. Reines Node-Approximationsmodell nur als Fallback.
- **Schema-/Typ-Sync-Kontrakt:** Die TS-Migrations in `src/lib/db/` sind die **alleinige Schema-Wahrheit**. Der Python-Worker liest dieselbe Postgres-Instanz und hält in `/compute/schema/` einen aus den Migrations generierten Tabellen-Kontrakt; TS-Typen kommen aus `supabase gen types`. Materialisierte Schreib-Tabellen des Workers (`exiobase_supply_share`, `commodity_country_data`, `country_risk_scores`, Klima-Tabellen) haben ein dokumentiertes, versioniertes (vintage) Write-Schema; die App liest sie ausschließlich.

### 5.7 Evals & Release-Gate (ausführbar)

Ein lauffähiges `evals/`-Package (Vitest) ist Release-Gate für `/qa` und CI:
- Deterministisches Seed/ETL-Skript parst die konkreten `data/_extracted/*.txt`-Dumps (mit bekannten Artefakten: Tippfehler, Bruch-Prozente, nicht-100%-Komponentensummen) in das Schema.
- Asserted **100 % Reproduktion** der ALDI-Gold-Set Overall-Scores (ENV=Mittel5, HR=Mittel11, Overall=MAX + UFLPA-Overlay) gegen `03_Analysis__ALDI_Case_Study_v6` + `04_Final_Delivery__…RfP_Case_Study` + UFLPA-Case-Studies.
- Prüft **Citation-Presence** (jeder konsequenzielle Output zitiert) und **Schema-Validität** (Zod).
- **Adverse-Media-Precision-Ziel** als messbares Akzeptanzkriterium (siehe Abschnitt 7 — Definition of Done).
- Releases nur bei grünen Evals; Guardrail-Pass/Fail- und Halluzinations-Raten werden über AI Gateway gemonitort.

---

## 6. Data Strategy

**Zuerst ingestieren (frei, P0/P1):**

| Quelle | Risikotyp(en) | Zugang | Cadence | Lizenz |
|---|---|---|---|---|
| EXIOBASE 3 (Zenodo, pymrio) | ENV-Attribution + Supply-Shares | pymrio Auto-Download, Python-Batch | bei neuem Jahrgang | CC-BY-SA-NC |
| FAOSTAT | GHG, CoO-Gap-Closure | Public API + Bulk | jährlich | frei |
| UN Comtrade (Free API) | CoO-Gap-Closure | API (Rate-Limit) | jährlich | frei (Bulk = paid) |
| WRI Aqueduct 4.0 | Resource Consumption | GitHub/GEE/Data360 | on-release | CC-BY-4.0 |
| Global Forest Watch | Biodiversity/Deforestation | Data API (Key, 1 J. Ablauf) | near-real-time | frei |
| ND-GAIN, INFORM | Physical Climate Risk | CSV-Zip / HDX | jährlich | frei |
| ILOSTAT (SDMX/Bulk) | Workplace Safety, Child Labor | SDMX-REST + Bulk | jährlich | frei |
| World Bank v2 Indicators | Governance, Income | API (kein Key) | jährlich | frei |
| US DOL TVPRA | Child/Forced Labor, UFLPA-Signal | PDF/Sweat&Toil-Parse | jährlich | frei |
| TI CPI, Freedom House, ITUC, Walk Free | Unethical, Fundamental HR, FoA, Forced Labor | Bulk-File-Fetch | jährlich | frei |
| OpenSanctions | Sanktionen/PEP/UFLPA-Entity | Bulk (frei) / API (paid kommerziell) | täglich/6h | kommerziell = **paid** |
| GDELT 2.0 | Adverse Media | DOC-API | 15 Min | frei |
| World Bank CCKP, Copernicus CDS, ThinkHazard | Physical Climate | S3 / Token-API / JSON-API | on-release | frei |

**Bezahlt/eingeschränkt (später):** UN Comtrade Premium-Bulk, OpenSanctions-Commercial-Lizenz (Launch-Voraussetzung, da kommerzielles Produkt), Trase (nur Bulk-Downloads, kein turnkey-API), Verisk Maplecroft (optionaler Connector).

### 6.1 Lizenz-Gates (entschieden — KEINE offenen Fragen mehr)

Zwei Datenquellen sind **kommerzielle Launch-Gates**, nicht „später zu klären":

- **EXIOBASE = CC-BY-SA-NC (Non-Commercial).** Die NC-Klausel schließt kommerzielle Nutzung der frei verfügbaren EXIOBASE-Daten aus. **Entscheidung:** PROJ-4 wird **hinter einer MRIO-Source-Abstraktion** gebaut (`MrioSource`-Interface: `loadA()`, `loadF()`, `computeMultipliers()`), sodass die Engine die Quelle austauschen kann. **Kommerzieller Pfad (vor Launch zu sichern, in dieser Reihenfolge zu prüfen):** (1) **kommerzielle EXIOBASE-Lizenz** beschaffen; sonst (2) **OECD ICIO** (kommerziell nutzbar); sonst (3) **GLORIA** (GMRIO). MVP-Entwicklung/Evals dürfen gegen frei verfügbares EXIOBASE laufen (Forschung/Validierung), aber **kein kommerzieller Release** ohne gesicherte kommerzielle MRIO-Quelle. Die Konkordanz- und Scoring-Schicht bleibt MRIO-Quellen-unabhängig.
- **OpenSanctions = kommerzielle Lizenz erforderlich** (Bulk frei, kommerzielle Nutzung kostenpflichtig). **Gate:** Adverse-Media-/Entity-Monitoring (PROJ-14) wird ebenfalls hinter einer Provider-Abstraktion gebaut; der **kommerzielle Live-Betrieb startet erst nach gesicherter OpenSanctions-Commercial-Lizenz**. Entwicklung/Evals gegen die freie Bulk-Variante zulässig.

**Seed-Quelle & deterministischer ETL-Kontrakt:** Die `data/_extracted/*.txt` sind **Roh-Dumps von XLSX** (keine sauberen Tabellen) — der Build MUSS ein **deterministisches Seed-/ETL-Skript** schreiben, das diese konkreten Dateien parst: `01_Datenquellen__Supply_Chain_Risk_Assessment_Datasets_Indices.xlsx.txt` (→ 124-Index-Katalog + 16-Typ-Mapping), `03_Analysis__ALDI_Case_Study_v6.xlsx.txt` + `04_Final_Delivery__20260227_ALDI_Risk_Assessment_RfP_Case_Study.xlsx.txt` (→ Gold-Set: korrigiertes CoO, 16-Dim-Scores, Composites, Severity), `03_Analysis__UFLPA_Case_Study_*` (→ UFLPA-Gold-Set), `lksg_risikodatenbank.pdf.txt` + `02_Methodology__Case_Study_Refined_v2_Methodology.docx.txt` (→ LkSG-§2-Crosswalk, BAFA-Kategorien), ILOSTAT/FSI/HDR-GII/ALIGN/Child-Labour-DB-Dumps (→ `raw_index_data`). Das Skript muss die bekannten Daten-Artefakte robust behandeln: Tippfehler („United Stated", „estimaded", trailing spaces), Prozente als Brüche (`0.9950248756…`), Komponenten-% die nicht auf 100 % summieren, `#VALUE!`/`#N/A`/`#REF!` → explizite Missing-Data-States (LOW Confidence), nicht stillschweigend korrigieren. Ohne dieses Skript sind die Gold-Set-Evals nicht ausführbar.

### 6.2 Methodik-Pinning für die Gold-Set-Reproduktion (verbindlich)

Damit die Engine deterministisch gegen das Gold-Set reproduzierbar ist, sind die in `docs/research/02-risk-methodology.md` als **Variante A / B** dokumentierten Mehrdeutigkeiten hier aufgelöst und als **seedbare `threshold_config`-Default-Zeilen** (`is_default = true`) anzulegen — abweichende Bänder bleiben als Nicht-Default-Varianten editierbar (z. B. UK MSA strenger als LkSG §2):

- **Threshold-Varianten (ALDI-Gold-Set-Default):** GHG → **EXIOBASE-Var. A** (800–1499→2 … ≥4000→5); Pollution-EPI → **Var. A** (≥65→1 … <25→5, wie GHG-EPI); Biodiversity-BII → **Var. A** (≥80→1; 65–79→2; 55–64→3; 40–54→4; <40→5); Child Labor → Commodity-TVPRA-CL=1 ⇒ **automatisch 5** (der gerechnete Product-#18-Walkthrough nutzt 5, nicht „mind. 4"). Diese Defaults sind gegen das Gold-Set zu verifizieren; bei Konflikt gewinnt der gerechnete Walkthrough-Wert und der Konflikt wird im Eval-Report geflaggt.
- **Rounding-Regel (eindeutig):** Composites für **Labels/Anzeige** = `ROUND(mean, half-up)` (HR-Mittel 3,55 → 4, verifiziert). **Salient-Flag (≥3.5), CSDDD-Severity-„High" (≥4.0) und Likelihood-„Likely" (≥4.0) verwenden den UNGERUNDETEN Overall-Wert** (Boundary-Reproduktion); Anzeige optional auf 1 Dezimalstelle. Engine speichert sowohl den ungerundeten als auch den gerundeten Wert.
- **RoW-Disaggregations-Algorithmus** (für Bangladesch/Pakistan = RoW Asia, Côte d'Ivoire/Zimbabwe = RoW Africa — exakt die Hochrisiko-Länder): Wo EXIOBASE nur eine RoW-Region liefert, wird der Länder-Anteil innerhalb der RoW-Region **proportional zu commodity-spezifischem bilateralem Handel (UN Comtrade / FAOSTAT) bzw. ersatzweise zum BIP** geschätzt; das Ergebnis ist eine **probabilistische CoO-Verteilung** mit **LOW Confidence** + Vorsorgeprinzip (Worst-Case-Origin) bis zur Validierung. Der Algorithmus ist als deterministisches, dokumentiertes TS-Tool zu implementieren (Inputs: RoW-Region-Anteil, Comtrade/FAOSTAT-Shares; Output: Länder-Shares + Confidence).
- **Normalisierung heterogener Skalen:** Jeder native Index wird über `index_catalog.native_min/native_max/direction/inverted` auf die 1–5-Skala gemappt; **invertierte Indizes** (CPI, ITUC, Freedom House „höher = besser") sind als `inverted = true` zu seeden, sonst sind die Scores falsch.
- **Services vs. Merchandise (MVP-Scope entschieden):** Der MVP deckt **Merchandise + GNFR** ab (Dual-CoO/PFC-Block). Der **Services-Pfad** (Single-16-Dim-Block, `service_assessment`-Tabelle) ist **P1** — Schema wird in PROJ-2 mit angelegt, aber der Scoring-Pfad erst in P1 aktiviert.

**Caveats (in Konfidenz-/Methodik-Layer encoden):** NGFS Phase-V Physical-Risk (Kotz-2024-Retraction) flaggen; GFW-Key-Ablauf (1 J.) auto-renew/alert; Copernicus-CDS-Migration (Feb 2025, Personal Access Token); EXIOBASE 2022 vs. Index-Jahre = temporaler Mismatch dokumentieren.

---

## 7. Phased Delivery Plan / Milestones

- **M0 — Foundation (PROJ-1, PROJ-2, PROJ-12, PROJ-25-Basis, PROJ-28-Skelett):** Auth/Multi-Tenant + i18n (DE primär), Referenz-Schema + deterministischer Seed-ETL, Audit-Log-Skelett, Billing-Basis (Stripe + Metering), EU-AI-Act/GDPR-Posture-Skelett. WDK-Durability-Schicht von Tag 1 aufgesetzt.
- **M1 — Deterministic Core (PROJ-3, PROJ-4, PROJ-5):** Import → EXIOBASE-Shares (hinter MRIO-Abstraktion) → 16-Typ-Scoring; reproduzierbar gegen ALDI-Gold-Set verifiziert (Eval-Harness grün).
- **M2 — Compliance Engine (PROJ-6, PROJ-7, PROJ-8):** UFLPA-Modul, CSDDD-Severity/Likelihood + Konfidenz, Salient-Register + Dashboard. → **demo-fähiges MVP.**
- **M3 — AI Layer (PROJ-9, PROJ-10, PROJ-11):** CoO-Inferenz, Doc/SAQ-Extraktion, Regulatory-RAG (Corpus-Ingestion). Evals + Guardrails (inkl. Prompt-Injection) grün.
- **M4 — Automation & Graph (PROJ-13, PROJ-14, PROJ-16, PROJ-22, PROJ-23, PROJ-26):** Ingestion-Pipeline, Adverse-Media-Monitoring, Horizon-Scanner, Alert-Delivery, Knowledge-Graph/n-Tier-Discovery, Alternativ-Lieferanten/EUR-Exposure.
- **M5 — Reporting, Integration & Customization (PROJ-15, PROJ-17, PROJ-24, PROJ-28-vollständig):** Report-Generator, Per-Market-Thresholds/Overrides, ERP/Procurement-Connectors, EU-AI-Act-Artefakte vollständig.
- **M6 — Expansion (PROJ-18, PROJ-19, PROJ-20, PROJ-21, PROJ-27):** Klima (physisch + transitorisch + ESRS-E1), EUDR, CBAM, Predictive, Supplier-Portal/Worker-Voice.

Jede Milestone schließt mit `/qa` (inkl. Score-Reproduzierbarkeit gegen Gold-Set + RLS-Tests) und Status-Update in `features/INDEX.md`.

### 7.1 Definition of Done / Akzeptanzkriterien (pro Phase messbar)

- **MVP-Exit-Bar (global):** **100 %** der ALDI-Gold-Set Overall-Scores reproduziert (deterministisch, gegen `data/_extracted`); 16/16 Score-Zeilen-Konsistenz pro Produkt; jeder konsequenzielle KI-Output zitiert (Citation-Presence-Check grün); alle RLS-Cross-Tenant-Tests bestehen; Audit-Log enthält jede KI-Entscheidung.
- **UFLPA (PROJ-6):** Entity-List-Fuzzy-Match unterscheidet match/possible-match/no-match; CRITICAL/HIGH/NOT-APPLICABLE + Overlay-Arithmetik (`+1 cap 5` / `override 5`) reproduzieren die UFLPA-Gold-Set-Klassifikationen.
- **Adverse-Media (PROJ-14):** **Precision ≥ 0,80** auf einem gelabelten Eval-Set (Ziel: Anti-Alert-Overload — nur score-verändernde Signale eskalieren), gemessen im Eval-Harness; Recall als Sekundärmetrik berichtet.
- **CoO-Inferenz (PROJ-9):** korrigierte CoO + probabilistische Verteilung stimmen mit dem Gold-Set-CoO überein; Dissens im Zwei-LLM-Pattern → Review-Queue (nachweisbar).
- **Report-Generierung (PROJ-15):** 0 unzitierte Behauptungen (Post-Generation-Guardrail); ESRS-Datapoint-Mapping vorhanden; Regulierungs-Stand + Daten-Vintage gestempelt.
- **Performance:** App-Antworten lesen nur materialisierte Tabellen (Sub-Sekunde); keine pymrio-/NetCDF-Rechnung im Request.

---

## 8. MASTER BUILD PROMPT (zum Kopieren)

> Kopiere den gesamten folgenden Block und übergib ihn dem Coding-Agenten (Claude Code). Er ist selbsterklärend.

```
Du baust eine KI-native Lieferketten-Risikoplattform (Arbeitsname „Sentinel“) für LkSG/CSDDD/UFLPA-
und Klimarisiko-Analysen. Ziel: methodisch tiefer und KI-automatisierter als Prewave, IntegrityNext,
EcoVadis, osapiens, Sedex, Achilles, Sphera und Interos.

PFLICHT-LEKTÜRE VOR DEM START (lies ALLE fünf Dateien vollständig — der Build-Prompt ist eine
Zusammenfassung, die Details stehen dort und sind verbindlich):
- docs/PROJECT-PLAN.md          → Vision, Feature-Breakdown (PROJ-1…PROJ-28), Architektur (inkl. Repo-
                                  Layout 5.6, Durability 5.5, Evals 5.7), Datenstrategie, Schema (5.2),
                                  Lizenz-Gates (6.1), Methodik-Pinning (6.2), Definition of Done (7.1).
- docs/research/01-competitor-analysis.md → die zu schlagenden Best-Features je Wettbewerber + die 8
                                  branchenweiten Lücken (EEIO, Transparenz, UFLPA-Overlay, CSDDD-
                                  Severity, agentic Analyst, Anti-Alert-Overload, transparentes Pricing,
                                  ENV-Tiefe) = unsere Differenzierer.
- docs/research/02-risk-methodology.md    → AUTORITATIVE Scoring-Spec: exakte 1–5-Schwellen je Risikotyp
                                  (inkl. Variante A/B), EEIO-Mathematik, UFLPA-Logik, CSDDD-Severity/
                                  Likelihood, Confidence-Framework, Datenmodell, BAFA-Crosswalk (§7.4/§9).
- docs/research/03-ai-capabilities.md     → vollständige AI Capability Map, Agentenkatalog (§3.1),
                                  Supervisor-Pattern, Guardrails (§4: Halluzination, Citation, Evals,
                                  Confidence), Feature-Priorisierung. Bei JEDER KI-Aufgabe hier nachsehen.
- docs/research/04-durable-workflows.md   → Vercel Workflow DevKit (WDK) Durability-Schicht: die 6
                                  Kern-Workflows, Hooks (human-in-the-loop), Idempotenz, EXIOBASE-Python-
                                  Einschränkung. ALLE langlaufenden Prozesse sind WDK-Workflows.

REPO-KONVENTIONEN (zwingend einhalten):
- Stack: Next.js 16 (App Router) + TypeScript, Tailwind + shadcn/ui (NIE shadcn-Komponenten selbst
  nachbauen), Supabase (Postgres + Auth + Storage + RLS), Zod + react-hook-form, Deploy auf Vercel.
- KI: Vercel AI SDK v6 + AI Gateway, model-agnostische "provider/model"-Strings, Default aktuelles Claude.
  Embeddings: Voyage-Klasse (config-getrieben), pgvector + HNSW (vector_cosine_ops) für RAG/Graph-Evidenz.
- DURABILITY: Vercel Workflow DevKit (workflow / @workflow/ai) ist VERBINDLICH für alle langlaufenden,
  mehrstufigen, human-in-the-loop-Prozesse (Assessment, Monitoring, n-Tier-Discovery, Doc-Extraktion,
  Ingestion, Report). KEINE fire-and-forget API-Routes für diese Abläufe. Steps idempotent (Upsert +
  Content-Hash). Persistierte Step-Results = Audit-Trail. Details: docs/research/04.
- i18n: next-intl von PROJ-1 an, DE primär + EN; Texte in messages/de.json (primär) / en.json. KEINE
  English-only-UI bauen (Retrofit ist teuer).
- REPO-LAYOUT (Monorepo, zwei Planes): Next.js-App im Root (app/, app/workflows/, src/lib/scoring/,
  src/lib/db/ = Schema-Single-Source, evals/, messages/); Python-Plane unter /compute (pymrio_batch/,
  climate_etl/, ingest/, schema/). Siehe PROJECT-PLAN.md §5.6.
- Workflow PRO FEATURE: /requirements -> /architecture -> /frontend -> /backend -> /qa -> /deploy.
- Tracking: jedes Feature ist PROJ-X in features/INDEX.md; eine Feature-Spec pro Datei
  (features/PROJ-X-name.md); Status nach jeder Phase aktualisieren (Write-Then-Verify).
- Commits: type(PROJ-X): description. Human-in-the-loop: vor Finalisierung jeder Phase Freigabe einholen.
- Arbeite ein Feature nach dem anderen in der Reihenfolge der PROJ-Tabelle in docs/PROJECT-PLAN.md.
  Beginne mit: /requirements PROJ-1 (Auth & Multi-Tenant + i18n-Setup).

PRODUKT: Importiere Produkt-/Komponenten-Portfolios (CSV/Excel + ERP-Connectors SAP Ariba/Coupa/Ivalua/
SAP Business Network); korrigiere per KI das Country-of-Origin; berechne deterministisch 16 Risikotypen
je Produkt; baue einen n-Tier-Lieferketten-Knowledge-Graph (GraphRAG); zeige Salient-Risk-Register,
UFLPA-Exposition, CSDDD-Severity/Likelihood, Konfidenz, Klimarisiko, Spend-/Revenue-at-Risk in EUR +
regulierungskonforme Alternativ-Lieferanten; generiere zitierte Berichte; überwache kontinuierlich mit
precision-first Alert-Delivery (E-Mail/In-App/Webhook). Kommerziell: transparente Plan-Tiers (Stripe,
Supplier-Count-/Seat-Metering), maschinenlesbare Results-/Export-API. Optional: Lieferantenportal (SAQ)
+ Worker-Voice. Alles mehrsprachig (DE primär, EN).

METHODIK — 16 RISIKOTYPEN, SKALA 1–5 (deterministisch in TypeScript, NIE per LLM berechnen):
5 UMWELT: GHG Emissions, Physical Climate Risk, Biodiversity Loss, Resource Consumption, Pollution.
11 MENSCHENRECHTE: Child Labor, Forced Labor, Discrimination, Freedom of Association, Indigenous/Land
Rights, Security Forces, Unethical Business, Wages & Income, Workplace Safety, Working & Living
Conditions, Fundamental Human Rights.
Aggregations-Logik je Dimension:
- MAX-von-Subscores: GHG = MAX(EPI, EXIOBASE-GHG, FAOSTAT); Biodiversity = MAX(BII, Land, Trase);
  Resource = MAX(Aqueduct, WFN) + Sektor-Wasser-Adj; Pollution = MAX(EPI, Sektor-Pollution).
- OR-/Kombi-Logik: Physical Climate (ND-GAIN OR INFORM); Discrimination (GGI + WBL);
  Working&Living (HDI + UHC); Indigenous (FSI + WGI).
- Direkt-Mapping: Freedom of Association (ITUC 1–5), Security Forces (FSI), Unethical (CPI invertiert),
  Wages (GLWC Wage-Gap %), Workplace Safety (ILO Injury/100k), Fundamental HR (Freedom House).
- Override: Child Labor (Commodity-TVPRA-CL=1 -> 5; Country-TVPRA -> 4); Forced Labor (XUAR -> 5;
  TVPRA-FL+WalkFree>5 -> 5; TVPRA-FL allein -> 4).
Schwellenwerte als DATEN speichern (threshold_config, editierbar, nicht hartkodiert), pro Retailer-Markt
anpassbar. Wo 02 zwei Bänder dokumentiert (Variante A/B bei GHG, Biodiversity, Pollution, Child Labor):
seede die in PROJECT-PLAN.md §6.2 festgelegten Defaults (is_default=true), Varianten bleiben editierbar.
Normalisiere invertierte Indizes (CPI, ITUC, Freedom House) via index_catalog.inverted=true — sonst falsch.
Composites: ENV = ROUND(Mittel der 5, half-up), HR = ROUND(Mittel der 11, half-up) NUR für Label/Anzeige;
Overall = MAX(ENV, HR). SPEICHERE zusätzlich den UNGERUNDETEN Overall — Salient-Flag (>=3.5), CSDDD-
Severity-"High" (>=4.0) und Likelihood-"Likely" (>=4.0) verwenden den UNGERUNDETEN Wert (Boundary-Repro).
Dual-Scoring: je Komponente getrennt für Country-of-Origin (mit Commodity-Overlay) UND Production-
Facility-Country (nur Länder-Indizes, außer PFC==CoO); Overall ENV = max(CoO ENV, PFC ENV) etc.
UFLPA-Overlay: CRITICAL (XUAR direkt / Entity-List) -> Overall=5; HIGH (indirekt XUAR / FLETF-Sektor
ohne Entity-Match) -> max(Composites)+1 gedeckelt auf 5; NOT APPLICABLE -> keine Änderung.
12 FLETF-Sektoren: Aluminum, Apparel, Caustic Soda, Copper, Cotton, Lithium, PVC, Red Dates, Seafood,
Silica/Polysilicon, Steel, Tomatoes. XUAR-Nexus aus EXIOBASE-Importanteilen (China-Anteil) herleiten.
Risk-Label-Bänder: <=1.5 Very Low, <=2.5 Low, <=3.5 Medium, <=4.5 High, >4.5 Very High.
Salient = YES bei Overall>=3.5; UFLPA-WATCH = ELEVATED.
CSDDD-Severity = Scale(50%)+Scope(25%)+Irremediability(25%); Likelihood = Governance(40%)+
CommodityExposure(30%)+Historical(30%). 4-Level-Konfidenz (VERY HIGH/HIGH/MEDIUM/LOW) mit
Validierungsaktionen + SLAs (annual / 90 Tage / 30–60 Tage).

EEIO/MRIO: L=(I-A)^-1, M=F×L. Berechne Leontief-Mathematik AUSSCHLIESSLICH offline in einem Python-
Batch unter /compute/pymrio_batch (GitHub Actions Cron, schreibt via Service-Role-Key in Postgres) und
persistiere nur die Ergebnis-Tabellen (Supply-Shares pro [Produkt×Land×Sektor] über 3 Stufen: Rohstoff-
Ursprung, Verarbeitung, Fertigung). Die Next.js-App liest NUR vorberechnete Werte — NIE pymrio im Request.
WICHTIG (Lizenz-Gate, siehe §6.1): EXIOBASE ist CC-BY-SA-NC (non-commercial). Baue PROJ-4 HINTER einer
MRIO-Source-Abstraktion (MrioSource: loadA/loadF/computeMultipliers), sodass die Quelle austauschbar ist
(kommerzielle EXIOBASE-Lizenz / OECD ICIO / GLORIA). Entwicklung/Evals gegen freies EXIOBASE OK; KEIN
kommerzieller Release ohne gesicherte kommerzielle MRIO-Quelle. Konkordanz Commodity->EXIOBASE-Produkt-
gruppe als Lookup. RoW-Disaggregation (Bangladesch/Pakistan=RoW Asia, Côte d'Ivoire/Zimbabwe=RoW Africa):
deterministisches TS-Tool, das den Länder-Anteil innerhalb der RoW-Region proportional zu Comtrade/FAOSTAT-
Handel (ersatzweise BIP) schätzt → probabilistische Verteilung mit LOW Confidence + Vorsorgeprinzip (§6.2).
CoO-Gap-Closure: Plausibilität -> MRIO-Trade-Coefficient -> korrigierte CoO + Konfidenz, validiert gegen
FAOSTAT/UN-Comtrade; probabilistische CoO-Verteilungen.

KI-ANFORDERUNGEN (maximale Automatisierung, aber prüfbar):
- generateObject + Zod-Schema für jede strukturierte Aufgabe; tool()-Agent-Loops für CoO-Inferenz,
  UFLPA, Monitoring. Routing über AI Gateway: Sonnet-Klasse für Massen-Extraktion/Klassifikation,
  Opus-Klasse für Adjudikation/Reasoning, separates Embeddings-Modell für RAG.
- Adversariale Zwei-LLM-Analyst/Reviewer-Schleife für folgenreiche Urteile (korrigierte CoO,
  Severity, Adverse-Media-Relevanz, UFLPA HIGH/CRITICAL); Dissens -> Human-Review-Queue.
- Citation-first RAG über LkSG/CSDDD/ESRS/BAFA-Quellenübersicht (KG-of-Triplets): Antworten nur aus
  Kontext, jeder Satz mit Quell-ID + Konfidenz; uncited claims werden geflaggt/abgelehnt.
- Vision+LLM-Doc/SAQ-Extraktion mit Zod-Schema, Per-Field-Provenance + Konfidenz, Low-Confidence ->
  Human-Review.
- Adverse-Media via GDELT 2.0 + Sanktions-/Entity-List via OpenSanctions; LLM klassifiziert in die 16
  Risikotypen, nur score-verändernde Signale eskalieren (Anti-Alert-Overload). MESSBARES ZIEL:
  Precision >= 0,80 auf gelabeltem Eval-Set (siehe §7.1). OpenSanctions-Provider hinter Abstraktion;
  kommerzieller Live-Betrieb erst nach gesicherter OpenSanctions-Commercial-Lizenz (Gate §6.1).
- n-Tier-Knowledge-Graph (PROJ-23): GraphRAG über Postgres + pgvector + Apache AGE (Neo4j optional hinter
  Abstraktion); modelliere Produkte, Country-Sectors, 3 Stufen, Tier-N, 16 Risikotypen, regulatorische
  Triplets; Kanten tragen Provenienz (inferiert/deklariert/enforcement-bestätigt) + Konfidenz; Aufbau via
  nTierDiscoveryWorkflow (DurableAgent, @workflow/ai). Das ist der Burggraben gegen Interos/Prewave.
- Alternativ-Lieferanten + Spend-/Revenue-at-Risk in EUR (PROJ-26) als First-Class-Datenmodell
  (detection-to-decision, Interos-iQ-Lehre) — nicht nur als Beiläufigkeit im Maßnahmen-Text.
- Prompt-Injection-Abwehr für Ingestion-/Adverse-Media-Agenten: untrusted Web/News/PDF-Inhalte strikt von
  Instruktionen trennen (Delimiter/Spotlighting), nie als System-Prompt; Tool-Allowlist; Claims müssen
  zitierbar sein; folgenreiche Outputs durchlaufen Zwei-LLM-Pattern + Human-Checkpoint.
- Kosten-Guardrails: Per-Feature-Token-Caps + Budget-Alerts (Gateway); Model-Downgrade-Regel; Batch statt
  Real-time für nicht-zeitkritische Massen-Extraktion; GDELT-Vorfilter vor LLM-Klassifikation.
- Report-Generator: Output -> ESRS-Datenpunkte + LkSG-§2-Positionen, zitierte Narrative, Mensch
  finalisiert.

REGULATORIK (config/version-getrieben — HARTKODIERE NICHTS in Code ODER Prompt): Lege ALLE regulatorischen
Parameter als versionierte regulatory_config-Zeilen an (key, value, effective_date, source_url,
source_citation, as_of_date, status enacted/proposed/suspended). Der nachstehende Stand Juni 2026 ist
NUR SEED-DATEN (nicht als Code-Wahrheit baken — er veraltet): Omnibus I in Kraft (18.03.2026); CSDDD
>5.000 MA & >1,5 Mrd. EUR (ab 26.07.2029), EU-Zivilhaftung gestrichen (27 nationale Regime); CSRD
>1.000 MA & >450 Mio. EUR (FY2027 in 2028); LkSG-Berichtspflicht de-facto ausgesetzt, Kernpflichten
bleiben; EUDR verschoben (30.12.2026 / 30.06.2027); UFLPA-Entity-List-Count + FLETF-Sektoren als
regulatory_config mit Quelle (Entity-List source_url = CBP/DHS UFLPA Entity List, monatlicher Auto-Refresh
statt hartkodiertem Count); EU-Forced-Labour-Regulation (Markt-Ban) ab 14.12.2027; CBAM definitive Phase
seit 01.01.2026 (50-t-De-minimis). Modelliere Multi-Regime (LkSG/CSDDD/UFLPA/EUFLR/EUDR/CBAM) mit
Effective-Date-Metadaten. Jedes Finding mappt auf Pflichten + Enforcement-Venue. BAFA-DEFENSIBILITÄT:
seede die lksg_crosswalk-Tabelle (16 Risikotypen -> exakter LkSG-§2-Zitatstring als First-Class-Key, z.B.
"§2 Abs.2 Nr.1" Kinderarbeit, "Abs.3 Nr.1-3" Quecksilber; + CSDDD-Annex Part I/II ILO-Konventionen
87/98/29/105/138/182/100/111, ICCPR/ICESCR/CRC; Basel/Minamata/Stockholm) aus 02 §7.4/§9.

REGULATORY-RAG-KORPUS (PROJ-11/16): Der RAG-Korpus existiert nicht von selbst. dataIngestionWorkflow muss
die Primärtexte beschaffen und versionieren: LkSG (gesetze-im-internet.de), CSDDD + Annex (EUR-Lex), ESRS
(EFRAG/EUR-Lex), UFLPA + FLETF-Strategie (CBP/DHS), BAFA-Quellenübersicht-PDF. Chunks + Voyage-Embeddings
in regulatory_corpus (pgvector), mit version/retrieved_at/source_url. Antworten nur aus diesem Kontext,
jeder Satz zitiert; bei neuer BAFA-"Stand"-Version: Diff -> Legal-Review-Queue.

GOVERNANCE (EU-AI-Act High-Risk, ab 02.08.2026): Append-only Audit-Log jeder KI-Entscheidung (Input,
Modell+Version, Prompt, Quellen, Output, Reviewer, Override); Human-Oversight-Checkpoints vor jeder
supplier-impacting Conclusion; Transparenz-Hinweise; jede Ausgabe trägt "Regulation-Version-as-of"-
Stempel und Daten-Vintage. Über das Audit-Log HINAUS (PROJ-28) operationalisiere die High-Risk-Pflichten:
Risk-Management-File (Art. 9), Daten-Governance-Doku (Art. 10), Technische Dokumentation/Annex IV (Art. 11),
Logging-Spezifikation (Art. 12), Deployer-Instructions/Transparenz (Art. 13), Conformity/CE-Posture — als
versionierte Markdown-Artefakte unter docs/compliance/. GDPR-POSTURE: EU-Daten-Residency (Supabase EU-
Region), Retention-Schedule, DPA-Modell, Data-Subject-Request-Handling, Sub-Processor-Liste; PII-
Klassifikation + Retention-Controls. SECURITY: implementiere RLS-Cross-Tenant-Tests (Pflicht-Gate), und
binde die bestehenden docs/production/-Guides ein (security-headers.md, rate-limiting.md, database-
optimization.md, error-tracking.md, performance.md) — diese sind Build-Schritte, nicht nur Referenz.
EVALS-HARNESS gegen das ALDI/UFLPA-Gold-Set (data/_extracted) BEVOR skaliert wird, als lauffähiges
evals/-Package (Vitest) + CI-Gate: 100% Score-Reproduktion (ENV=Mittel5, HR=Mittel11, Overall+UFLPA-Logik),
Citation-Presence, Schema-Validität, Adverse-Media-Precision >= 0,80, RLS-Tests; Releases nur bei grün.

DATEN: Zwei Ebenen — Offline Python-Compute-Plane (pymrio, Klima-ETL, Bulk-Ingests, GDELT/OpenSanctions-
Poll) schreibt versionierte Snapshots via Service-Role-Key in Postgres; Online Next.js+Supabase liest
nur materialisierte Scores. Tiered Scheduler: kontinuierlich (GDELT 15 Min, OpenSanctions ~30 Min),
jährlich/on-release (Indizes), periodischer Recompute (MRIO/Klima). Zuerst freie Quellen:
EXIOBASE(nur Dev/Eval, siehe Lizenz-Gate), FAOSTAT, UN-Comtrade(free), Aqueduct, GFW, ND-GAIN, INFORM,
ILOSTAT, World-Bank-v2, TVPRA, CPI, Freedom House, ITUC, Walk Free, OpenSanctions(bulk), GDELT,
CCKP/Copernicus/ThinkHazard. SEED-ETL (Pflicht, deterministisch): schreibe ein Skript, das die konkreten
data/_extracted/*.txt-Dumps parst (Supply_Chain_Risk_Assessment_Datasets_Indices -> Index-Katalog +
16-Typ-Mapping; ALDI_Case_Study_v6 + RfP_Case_Study + UFLPA_Case_Study_* -> Gold-Set; lksg_risikodatenbank
+ Case_Study_Refined_v2_Methodology -> LkSG-Crosswalk; ILOSTAT/FSI/HDR-GII/ALIGN/Child-Labour -> raw_index_
data) und die bekannten Artefakte robust behandelt (Tippfehler "United Stated", Bruch-Prozente
0.99502..., nicht-100%-Komponentensummen, #VALUE!/#N/A/#REF! -> explizite Missing-States als LOW
Confidence). Caveats encoden: NGFS-Kotz-2024-Retraction, GFW-Key-Ablauf, Copernicus-Token-Migration,
EXIOBASE-2022-Temporal-Mismatch, CC-BY-Attribution (Aqueduct).

KLIMA (PROJ-18, P2 — beide Stränge): PHYSISCH (standort-/asset-bezogen, High-Emissions-Szenario): 28
CSRD/EU-Taxonomie-Gefahren in 4 Familien (Temperature/Wind/Water/Solid Mass), SSP1-2.6…5-8.5 × 2
Horizonte, 5-stufige Red-Flag-Skala, Risiko=Gefahr×Exposition×Sensitivität (brutto->netto). TRANSITORISCH
(Geschäftsbereich, 1,5°C-Szenario): Long-List->Short-List-Treiber (Political&legal/Reputation/Market/
Technology) abgestimmt auf NGFS Net-Zero-2050 + IEA Net-Zero; Risk-Treatment (Vermeiden/Vermindern/
Übertragen/Tragen); parametrische Versicherung + Loan-Break-Even/ROI. ESRS-E1-Mapping (SBM-3, IRO-1,
E1-2, E1-3, E1-9). Provider: meteoblue (primär). Quelle: SUS-Service-Decks (data/sus) als Cross-Sell.

SCHEMA (Supabase, RLS): Referenztabellen global read-only (inkl. threshold_config, coverage_assessment,
regulatory_config, regulatory_corpus, lksg_crosswalk, plans); Tenant-Tabellen (products, components,
risk_assessments, audit_log, adverse_media_events, supply_chain_nodes, supply_chain_edges, subscriptions)
per RLS auf org_id der memberships gescoped; audit_log insert-only. Kerntabellen siehe docs/PROJECT-
PLAN.md Abschnitt 5.2. Versioniere alle Index- und Regelwerk-Inhalte (vintage / effective_date), damit
historische Assessments reproduzierbar bleiben. RLS-Cross-Tenant-Tests sind Pflicht-Gate.

VORGEHEN: Prüfe zuerst, ob das Projekt initialisiert ist (docs/PRD.md, features/INDEX.md). Aktualisiere
docs/PRD.md mit dieser Produktvision. Setze in PROJ-1 zugleich i18n (next-intl, DE primär) und die WDK-
Durability-Schicht auf. Lege dann PROJ-1 via /requirements an und arbeite die PROJ-Liste (PROJ-1…PROJ-28)
sequenziell ab; sichere die Lizenz-Gates (EXIOBASE/OpenSanctions, §6.1) vor kommerziellem Release.
Verifiziere nach jedem Schritt mit Re-Read, dass features/INDEX.md und die Feature-Spec tatsächlich
aktualisiert wurden. Halte die Definition of Done (§7.1) je Feature ein. Schlage nach jedem Feature das
nächste vor ("Next step: /requirements PROJ-X").
```

---

## 9. Risks, Assumptions, Open Questions

**Risiken:**
- **MRIO-Offline-Compute** ist Infrastruktur außerhalb Vercel/Supabase (`/compute`, GitHub Actions Cron — §5.6). Operativer Aufwand + GPU-Kosten bei häufigem Recompute.
- **MRIO-Lizenz (kommerziell):** EXIOBASE CC-BY-SA-NC blockiert kommerzielle Nutzung → Launch-Gate via MRIO-Source-Abstraktion + kommerzielle Quelle (§6.1). Mitigiert, aber Beschaffung/Budget einplanen.
- **Regulatorische Volatilität** (Omnibus I, LkSG-Novelle in Bundestags-Ausschuss, EUDR-Verschiebungen): Hartkodierte Schwellen/Daten = sofort veraltet → strikt config/version-getrieben bauen (`regulatory_config`, keine prompt-/code-baked Werte).
- **EU-AI-Act High-Risk-Einstufung:** Human-Oversight + Audit-Log + Art.-9–13-Artefakte (PROJ-28) sind Rechtspflicht, kein Nice-to-have → von Tag 1 mitbauen, sonst teurer Rebuild.
- **Datenlizenzen:** OpenSanctions-Commercial (Launch-Gate) + ggf. UN-Comtrade-Premium sind Kostenpflicht; Trase nur Bulk; Maplecroft optional. Budget einplanen.
- **LLM-Halluzination + Prompt-Injection in Compliance-Kontext:** mitigiert durch deterministisches Scoring + Citation-first RAG + Zwei-LLM-Pattern + Injection-Guardrails + Evals — aber Restrisiko bleibt.
- **MRIO-Strukturgrenzen:** RoW-Disaggregation (Bangladesch/Pakistan = RoW Asia, Côte d'Ivoire/Zimbabwe = RoW Africa) per dokumentiertem Algorithmus (§6.2), aggregierte Produktgruppen ("Crops nec"), 2022-Basisjahr — als Konfidenz-Caveat dokumentieren.
- **Time-to-Value vs. Scope:** PROJ-Liste auf 28 Features gewachsen → strikt am MVP-Schnitt (M0–M3) und der Definition of Done (§7.1) entlang priorisieren, Differenzierer (Graph, Monitoring, Connectors) in P1.

**Annahmen:**
- Kunden akzeptieren öffentliche-Index-Methodik als verteidigbare, günstigere Maplecroft-Alternative.
- Die in `data/` extrahierte ALDI-Methodik (v3.7.x) ist die maßgebliche Spec; Detail-Schwellen werden gegen die Dateien verifiziert, nicht erfunden.

**Entschieden (vormals offene Fragen — jetzt im Plan verankert):**
- **EXIOBASE-NC-Lizenz:** Launch-Gate, nicht „später" (§6.1). MRIO-Source-Abstraktion; kommerzieller Pfad EXIOBASE-Lizenz → OECD ICIO → GLORIA; kein kommerzieller Release ohne kommerzielle MRIO-Quelle. OpenSanctions analog gegated.
- **Hosting Python-Worker:** GitHub Actions Cron als Standard, Vercel Sandbox / Python Function als On-the-fly-Variante; Repo-Layout `/compute` (§5.6).
- **Services vs. Merchandise im MVP:** MVP = Merchandise + GNFR; Services-Pfad (Single-16-Dim-Block) ist P1, Schema bereits in PROJ-2 angelegt (§6.2).
- **Tier-N im MVP:** Knowledge-Graph/n-Tier (PROJ-23) ist P1; MVP-Attribution EEIO-rechnerisch, lieferanten-deklarierte Kanten ergänzen ab P1 (im Graph getrennt mit Provenienz).
- **Markt-Schwellen-Profile:** Default = LkSG §2 (gegen ALDI-Gold-Set gepinnt, §6.2); UK MSA / CSDDD-Annex als editierbare Nicht-Default-Varianten in `threshold_config`.

**Verbleibende offene Fragen:**
- Initiale Tier-Preisgrenzen für PROJ-25 (Supplier-Count-/Seat-Schwellen je Plan) — marktabhängig festzulegen.
- Verisk-Maplecroft-Connector: Pflicht-Differenzierung oder erst auf Kundenwunsch?
- Welche ERP-Connectoren zuerst priorisieren (Ariba vs. Coupa vs. SAP Business Network) — nach erster Buyer-Pipeline.
