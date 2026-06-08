# 03 – AI-First-Design: KI-Fähigkeiten der Plattform

> **Zweck dieses Dokuments.** Dieses Dokument beschreibt das AI-First-Design unserer LkSG/CSDDD-Lieferketten-Risikoplattform. Leitprinzip: **maximaler KI-Einsatz überall dort, wo Arbeit automatisiert, beschleunigt oder qualitativ verbessert werden kann** – und gleichzeitig die strikte Trennung zwischen **deterministischer, regelbasierter Bewertung** (die 1–5-Index-Schwellen, ENV/HR-Composites, `max()`-Logik, UFLPA-Overlay bleiben reiner TypeScript-Code) und **KI-gestützter Extraktion, Recherche, Klassifikation, Urteilsbildung und Textgenerierung**. Die LLMs berechnen **niemals** den finalen Score – sie liefern Inputs, Begründungen und Adjudikation, die ein Mensch prüft. Das ist die Voraussetzung für Auditierbarkeit und Verteidigungsfähigkeit unter LkSG/CSDDD und EU AI Act.

> **Technische Grundlage.** Vercel AI SDK (v5/v6) als Agenten- und Structured-Output-Primitiv (`generateObject`/`streamObject` mit Zod-Schemas, `tool()`-Definitionen, Agenten-Loops via `stopWhen`/`stepCountIs`/`prepareStep`), hinter dem **Vercel AI Gateway** (ein Endpoint, 40+ Provider, automatisches Failover, Per-Feature-Kostenattribution, Observability). Modell-Routing: **Claude Sonnet-Klasse** für Hochvolumen-Extraktion/Klassifikation, **Claude Opus-Klasse** für mehrstufige Reasoning- und Adjudikationsaufgaben (1M Kontext, starke Long-Context-Retrieval- und agentische Tool-Use-Leistung), dedizierte Embedding-Modelle (z. B. Voyage) für Retrieval. Modell-Strings bleiben provider-agnostisch (`"provider/model"`), Default ist das jeweils neueste Claude-Modell. Lange Agenten laufen auf Fluid Compute.

> **Stack-Kontext.** Next.js 16 App Router + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Auth + Storage + RLS), Zod + react-hook-form, Deployment auf Vercel. Schwere Quantitativ-Rechnung (EXIOBASE-EEIO/MRIO, Leontief-Inverse via `pymrio`) läuft **offline in einem Python-Compute-Plane** und schreibt versionierte Snapshots nach Postgres; Next.js liest nur materialisierte Ergebnisse.

---

## 1. Inhaltsverzeichnis

1. AI Capability Map (Schritt-für-Schritt durch den gesamten Workflow)
2. Agentische Architektur (autonome Agenten, Tools, Orchestrierung)
3. Guardrails (Halluzinationskontrolle, Citation/Traceability, Evals, Confidence-Surfacing)
4. Feature-Priorisierung (Wert × Komplexität, MVP vs. später)
5. Regulatorische Einordnung & Designprinzipien

---

## 2. AI Capability Map

Für jeden Workflow-Schritt: KI-Technik, Modell/Tooling, In-/Outputs, Human-in-the-Loop- und Auditierungs-Guardrail. **Querschnittsregel:** Jeder konsequenzielle KI-Output trägt Quellen-Provenienz (Source-ID, abgerufen-am, Lizenz), ein Confidence-Level (VERY HIGH/HIGH/MEDIUM/LOW) und einen „Regulierungs-Stand als-of"-Zeitstempel; jeder KI-Output landet im append-only Audit-Log.

### 2.1 Lieferanten-/Produkt-Onboarding

- **KI-Technik:** Vision+LLM-Dokumentenextraktion (IDP) mit schema-erzwungener Ausgabe; LLM-gestütztes Mapping unsauberer Produkt-/Commodity-Namen auf die EXIOBASE-200-Produktgruppen-Konkordanz; Embeddings/Semantic Search für Fuzzy-Match gegen die bestehende Konkordanztabelle.
- **Modell/Tooling:** Vercel AI SDK `generateObject` + Zod-Schema (Produkt, Komponente, Resource-Type/Sub-Type, CoO, PFC, RCV-Tonnage/Cost, Branded-Flag, Sourcing-Office, ALDI-Taxonomie-Felder); Sonnet-Klasse über AI Gateway; Voyage-Embeddings für die Konkordanz-Suche.
- **Inputs:** Bill-of-Materials, Produktstammdaten-Uploads (XLSX/CSV/PDF), Lieferanten-Steckbriefe, Sourcing-Listen.
- **Outputs:** Normalisierte `products`- und `components`-Datensätze mit EXIOBASE-Produktgruppe + Code (z. B. Cocoa→`p01.h`, Cotton→`p01.g`→`p04.a`, Polyester→`p07.a`→`p04.b`, PVC→`p07.a`→`p08.a`, Registers→`p14.a`), Konfidenz pro Feld, Seiten-/Koordinaten-Provenienz pro extrahiertem Feld.
- **Guardrail:** Strikte Zod-Schema-Validierung; jedes Feld mit niedriger Konfidenz oder fehlendem Quell-Match wird in die Human-Review-Queue geroutet. Konkordanz-Vorschläge sind **Vorschläge** – ein Mensch bestätigt das EXIOBASE-Mapping, bevor es scoring-wirksam wird. Datenqualitäts-Artefakte (Tippfehler wie „United Stated", Prozente als Brüche `0.995…`, Komponenten-Prozente, die nicht auf 100 % summieren) werden explizit erkannt und geflaggt, nicht stillschweigend korrigiert.

### 2.2 Country-of-Origin-Inferenz & Gap Closure

- **KI-Technik:** Agentischer 3-Stufen-Workflow (Plausibilitäts-Check → EXIOBASE-A-Matrix-Upstream-Koeffizienten → korrigiertes CoO mit Konfidenz), kombiniert mit dem **adversarialen Zwei-LLM-Analyst/Reviewer-Pattern** für jede konsequenzielle CoO-Korrektur; LLM-generierte standardisierte Begründungs-Prosa (die heute arbeitsintensivste „Rationale/Evidence"-Spalte).
- **Modell/Tooling:** Opus-Klasse für die Adjudikation (Analyst-Modell schlägt CoO vor, Reviewer-Modell sucht Ablehnungsgründe; Dissens → Mensch); deterministische TypeScript-Tools für die EXIOBASE-Koeffizienten-Lookups und FAOSTAT/UN-Comtrade-Validierung, die der Agent **aufruft**, nicht selbst rechnet.
- **Inputs:** Erfasste CoO + PFC, Commodity, klimatisch-agronomische Plausibilitätsregeln, EXIOBASE-Handelskoeffizienten (vorberechnet), FAOSTAT-Bilateralhandel, UN-Comtrade-Spiegelstatistik.
- **Outputs:** Probabilistische CoO-Verteilung (kein Punktschätzer; z. B. Bangladesch-Textilien ≈ 45–50 % China, ≈ 20–25 % Indien, ≈ 10 % USA, ≈ 15–20 % domestic), korrigiertes CoO, Data-Gap-Type-Enum, 5-teiliger zitierter Begründungstext, Konfidenz.
- **Guardrail:** Beide Modell-Rationales werden geloggt; Dissens eskaliert in die Review-Queue. „Implausible CoO"-Fälle (Deutschland kann keinen Kakao anbauen → erfasstes Land ist Verarbeitungsland, nicht Ursprung) werden mit zitierter Begründung markiert. LOW-Konfidenz → Vorsorgeprinzip (Worst-Case-Origin) bis zur menschlichen Validierung in 30–60 Tagen.

### 2.3 n-Tier-Discovery (Lieferketten-Tiefenmapping)

- **KI-Technik:** **GraphRAG** über einen Knowledge Graph; LLM-gestützte Top-down/Bottom-up-Inferenz für Sub-Tier-Beziehungen; BoM-Inferenz für nicht erfasste Komponenten (z. B. Registrierkassen → PVC/Aluminium/Polysilizium/Stahl).
- **Modell/Tooling:** Knowledge Graph auf Postgres + `pgvector` + Apache AGE (Supabase) oder dediziert Neo4j; Modellierung von Produkten, Country-Sectors (EXIOBASE-Konkordanz), drei Lieferkettenstufen (Rohstoffursprung, Verarbeitung, Fertigung), Tier-N-Lieferanten, 16 Risikotypen, Indizes, regulatorischen Triplets. Opus-Klasse beantwortet n-Tier-Fragen, die klassisches RAG nicht kann („Welche Fertigprodukte sind betroffen, wenn Lieferant A ausfällt, und welche Alternativen sind regulierungskonform?").
- **Inputs:** Stammdaten, EXIOBASE-Upstream-Anteile pro Country-Sector, Handelsdaten, ggf. Lieferanten-deklarierte Beziehungen.
- **Outputs:** Multi-Tier-Lieferantennetz, versteckte Abhängigkeiten/Cluster-Risiken, „versteckte Tier-3-Hotspots" (z. B. China/Chemicals mit nur 2,8 % Supply-Chain-Anteil, aber höchster Pollution-Intensität – ohne MRIO unauffindbar).
- **Guardrail:** Jede inferierte Tier-N-Kante trägt Provenienz (statistische MRIO-Modellierung ≠ tatsächliches Supplier-Tracing – dieser Unterschied wird explizit gekennzeichnet) und Konfidenz; inferierte vs. lieferanten-deklarierte Kanten sind im Graph unterscheidbar.

### 2.4 Datenquellen-Mapping (Index-Katalog & BAFA-Provenienz)

- **KI-Technik:** LLM-gestütztes Schema-Mapping heterogener öffentlicher Datensätze (CSV/XLSX/API/SDMX/Geospatial) in das einheitliche `index_catalog`-Modell; LLM-/Fuzzy-Country-Reconciler (ISO3/RBA-Harmonisierung von „Congo (Democratic Republic of the)" vs. „DRC"); automatische Normalisierung jeder nativen Skala (0–100, 1–5, 0–1, −2,5..+2,5, invertiertes ITUC, binäre TVPRA-Flags, physikalische Intensitäten) auf eine gemeinsame Risiko-Skala via konfigurierbares MIN/MAX; LLM-Diff der BAFA-Quellenübersicht-PDF bei jeder neuen „Stand"-Version.
- **Modell/Tooling:** Sonnet-Klasse `generateObject` für Spalten-Mapping; deterministische Normalisierungsfunktionen (Code, nicht LLM); RAG über die 29 BAFA-Qualitativ-Reports + 124-Index-Katalog.
- **Inputs:** Die 124 katalogisierten Indizes (~31 BAFA-gelistet), die bestehenden `data/`-XLSX-Quellen, BAFA-Quellenübersicht-PDF, regulatorische Volltexte (LkSG §2, CSDDD-Annex, ESRS).
- **Outputs:** Versioniertes `index_catalog` (id, domain, risk_type, sub_category, publisher, scale_unit, update_frequency, latest_data_year, `bafa_listed`, url_access); LkSG-§2-Zitat als First-Class-Key pro Quelle; Diff-Report bei neuer BAFA-Version → Legal-Review-Queue.
- **Guardrail:** Jeder Datenpunkt trägt die exakte LkSG-Zitatkette (z. B. „§2 Abs. 2 Nr. 1, belegt durch [BAFA-Quelle]"); Mapping-Vorschläge werden gegen die kontrollierte Vokabular-Glossar (Abkürzungsverzeichnis) geprüft; alle Versionen historisiert.

### 2.5 Risiko-Scoring (16 Risikotypen, 1–5, Composites, UFLPA-Overlay)

- **KI-Technik:** **KEINE.** Das Scoring ist vollständig **deterministisch und regelbasiert** und wird exakt in TypeScript implementiert. LLMs liefern nur die Inputs (extrahierte Indexwerte, korrigiertes CoO, Commodity-Flags) und rufen die Scoring-Tools auf – sie berechnen den Score nie.
- **Modell/Tooling:** Reine TypeScript-Scoring-Engine; 16 Scoring-Funktionen je nach Aggregationslogik (MAX-of-Subscores für GHG/Biodiversity/Resource/Pollution; kombinierte OR-Logik für Climate/Discrimination/Working Conditions/Indigenous; Direct-Mapping für FoA/Security/Unethical/Wages/Safety/Fundamental HR; Override-Logik für Child/Forced Labor). Schwellen liegen als **editierbare Daten** vor (pro-Markt-Anpassung z. B. UK Modern Slavery Act vs. LkSG §2 ohne Code-Änderung).
- **Inputs:** Rohe Indexwerte (Sheet 9), Commodity×Country-Overrides (Sheet 10), EXIOBASE-Multiplikatoren (vorberechnet via `pymrio`).
- **Outputs:** Dual-Country-Scores (CoO mit Commodity-Overlay; PFC nur Country-Level außer PFC==CoO); ENV Composite = ROUND(mean of 5), HR Composite = ROUND(mean of 11), Overall = max(ENV,HR); Risk-Label-Bänder; Salient-Flag (≥ 3,5); Max-ENV/HR-Score und „Key Risk Dimensions" (alle Dims ≥ 4) gegen Mittelwert-Verdünnung.
- **Guardrail:** Automatischer Verifikations-/Audit-Modul leitet jeden Score aus Rohindex + Schwellenregel neu ab und asserted Konsistenz (16/16 Zeilen müssen passieren). Single-Source-of-Truth: keine duplizierten Score-Tabs (Lektion aus v3.7.1: abgeleitete Tabs verursachten Mismatches). Die Reproduzierbarkeit ist die Verteidigungsbasis unter Audit.

### 2.6 UFLPA-/Zwangsarbeits-Screening

- **KI-Technik:** RAG über UFLPA Entity List + FLETF-Strategie-Updates + CBP-WROs + Sheferield-Hallam-Reports zur Fuzzy-/transliterations-bewussten Lieferantennamen-Matchung; agentische XUAR-Content-Probability-Berechnung aus EXIOBASE-Upstream-Koeffizienten + UN-Comtrade; **adversariales Zwei-LLM-Pattern** für jede HIGH/CRITICAL-Bestimmung; LLM-Generierung der zeitgebundenen Maßnahmen-Playbooks (IMMEDIATE/30/60/90 Tage).
- **Modell/Tooling:** Opus-Klasse für Adjudikation; deterministische Tools für die FLETF-12-Sektor-Mitgliedschaftsprüfung, Entity-List-Lookup und die `+1 cap 5` / `override 5`-Overlay-Logik. Auto-Refresh der Entity List (144 Einträge, Stand Aug 2025) und High-Priority-Sektoren (Baumwolle, PVC, Aluminium, Silica/Polysilizium, Stahl, Kupfer, Lithium, Soda, Jujuben/Tomaten) via geplanter Ingestion aus FLETF/CBP/DHS mit Provenienz + Last-Verified-Timestamp.
- **Inputs:** Produkt-/Komponenten-Sektor, Lieferantennamen/Aliase, EXIOBASE-XUAR-Konzentrationsfakten (Baumwolle ≈ 90 % der CN-Produktion, PVC > 10 %, Aluminium 9–12 %), Entity-List.
- **Outputs:** `uflpa_applicable`, `uflpa_sectors`, Klassifikation CRITICAL/HIGH/Salient, Forced-Labor-Override (XUAR/Entity-List → 5), Maßnahmen-Playbook (inkl. isotopische Tests Oritain/Applied DNA für Xinjiang-Baumwolle, ASI-Zertifizierung für Aluminium).
- **Guardrail:** Dies ist das am aktivsten durchgesetzte Regime (77 % Denial-Rate bei Direkt-aus-China-Sendungen) → Entity-List monatlich auto-refreshed, jede Match-Entscheidung adversarial geprüft und vom Menschen bestätigt, bevor „cease sourcing" empfohlen wird. Match/Possible-Match/No-Match wird unterschieden, nie binär verschleiert.

### 2.7 Adverse-Media- & Event-Monitoring

- **KI-Technik:** Kontinuierliche LLM-basierte multilinguale Adverse-Media-Klassifikation; **adversariales Zwei-LLM-Analyst/Reviewer-Pattern** auf Narrative-Matching (Biografien, Positionsbeschreibungen) statt reinem Name-Matching – ökonomische Einsicht: „False Positives im Screening sind billig, wenn ein Mensch sie nie lesen muss"; Embeddings für Dedup.
- **Modell/Tooling:** Sonnet-Klasse für Hochvolumen-Klassifikation/Zusammenfassung, Opus-Klasse für Relevanz-Adjudikation; geplante Agenten (Vercel Cron / Workflow DevKit) ziehen GDELT 2.0 DOC-API (15-Min-Kadenz, gefiltert nach Lieferant/Land + negativem Tone + relevanten GKG-Themes) und OpenSanctions (Polling von `index.json`, Re-Fetch bei Hash-Änderung).
- **Inputs:** Globale News (GDELT, 65 Sprachen), Sanktions-/PEP-/Watchlist-Feeds (OpenSanctions), Lieferanten-Mapping.
- **Outputs:** Gefilterte, supplier-gemappte Alerts, klassifiziert in die 16 Risikotypen mit Konfidenz und Zitaten; Frühwarn-Signale.
- **Guardrail:** Primärquellen werden bevorzugt (Auditierbarkeit, geringere Bias-Verstärkung); jede Klassifikation zitierbar; Dissens zwischen Analyst- und Reviewer-Modell → Review-Queue. Kommerzielle OpenSanctions-Lizenz ist Launch-Voraussetzung (kommerzielle Nutzung kostenpflichtig).

### 2.8 Dokument-/SAQ-/Zertifikat-Extraktion

- **KI-Technik:** Vision+LLM-IDP (OCR + Vision-LLM) mit strikter Zod-Schema-Erzwingung; Per-Feld-Source-Location/Page-Capture; Low-Confidence-Routing.
- **Modell/Tooling:** Sonnet-Klasse `generateObject`; Schemas für SAQ (5.0/SMETA/PSCI: Labour, Health & Safety, Environment, Business Ethics, Management), Zertifikate (ISO, Codes of Conduct), Audit-PDFs, Feedstock-/Precursor-Nachweise (Calciumcarbid/Ethylen für PVC, PTA/MEG für Polyester).
- **Inputs:** Lieferanten-Uploads (Supabase Storage), die bestehende `data/_extracted`-Pipeline als Ingestion-Baseline.
- **Outputs:** Strukturierte, schema-validierte Felder mit Seiten-/Koordinaten-Provenienz und Konfidenz pro Feld; verifizierte BoMs/Origin-Deklarationen.
- **Guardrail:** LLMs degradieren auf komplexen Layouts → Output zwingend JSON-Schema-constrained; Low-Confidence- oder widersprüchliche Extraktionen automatisch in Human-Review. PII-Klassifikation und Retention-Controls für regulierten Einsatz.

### 2.9 Severity-/Likelihood-Urteil (CSDDD Art. 6)

- **KI-Technik:** LLM-gestützte Severity-Klassifikation (Scale/Scope/Irremediability) und Likelihood; **adversariales Zwei-LLM-Pattern** für die Klassifikation; deterministische Formel-Engine für die gewichtete Aggregation.
- **Modell/Tooling:** Opus-Klasse für die qualitative Einschätzung mit erklärbarer Begründung; deterministische TypeScript-Engine für `SevRaw = Scale(50%) + Scope(25%) + Irremediability(25%)` (Irremediability-Gewichtsvektor: FL=1.0, CL/Bio/Indigenous=0.9, FHR/Security=0.8, Climate/Pollution=0.7, GHG/Resources=0.6, FoA/Disc/Safety=0.5, Wages/Conditions/Unethical=0.4) und `LikRaw = GovernanceWeakness(40%) + CommodityExposure(30%) + Historical(30%)`.
- **Inputs:** Prävalenzdaten, Incident-History, Lieferkettenstruktur, die 16 Dimension-Scores.
- **Outputs:** CSDDD Severity (Very Low..Critical), Likelihood (Rare..Almost Certain / Remote..Likely), Salient-Flag, zitierte Begründung.
- **Guardrail:** Die qualitative Komponente (Scope-Zählung, Historical-Bewertung) ist KI-vorgeschlagen, aber die Aggregation ist deterministisch und reproduzierbar; menschlicher Review-Checkpoint vor jeder supplier-wirkenden Schlussfolgerung (EU-AI-Act Art. 14).

### 2.10 Confidence-Assessment

- **KI-Technik:** Klassifikation durch Zählen konvergierender unabhängiger Quellen + Detektion regulatorischer/enforcement-Bestätigung + EXIOBASE-Dominant-Origin > 50 %-Share; Auto-Generierung der Validierungs-Aktionsliste + SLA.
- **Modell/Tooling:** Sonnet-Klasse `generateObject` für die Klassifikation; deterministische Regeln für die Schwellen (VERY HIGH: ≥ 3 unabhängige Quellen inkl. 1 regulatorische; HIGH: ≥ 2 Quellen + EXIOBASE > 50 %; MEDIUM: 1 Primärquelle/Multi-Country; LOW: keine Direktquelle/RoW-Disaggregation).
- **Inputs:** Quellen-Konvergenz, Datenaktualität, Gap-Rating aus dem `coverage_assessment`.
- **Outputs:** Confidence-Level + Validierungs-Aktion + SLA (standard / 90 Tage / 30–60 Tage), inkl. konkreter Aktionen (Supplier-Data-Request, Experten-Interview, isotopische/DNA-Traceability, BoM/Supplier-Declarations).
- **Guardrail:** Confidence wird in jeder UI-Ansicht und jedem Export sichtbar gemacht (nicht versteckt); LOW-Konfidenz triggert automatisch das Vorsorgeprinzip und einen Eintrag in die Validierungs-Queue.

### 2.11 Report-Drafting (CSRD/ESRS, BAFA, Salient-Register)

- **KI-Technik:** Citation-First RAG-Narrative; KI-gestütztes ESRS/CSRD-Datapoint-Mapping, Double-Materiality- und Gap-Analyse; Auto-Generierung des Salient-Risk-Registers (Ranking + ENV/HR-Risk-Textlisten + Recommended Actions + Monitoring Indicators + Regulatory Scope).
- **Modell/Tooling:** Opus-Klasse für längere Narrative; `generateObject` für die strukturierten Register-Felder; RAG über die regulatorischen Triplets im Knowledge Graph; templatisierte Maßnahmen-Bibliothek (keyed auf Dimensionen + Regulatory Scope).
- **Inputs:** Scoring-Ergebnisse, Confidence, regulatorische Versionen (2023- vs. revidierte-2025-ESRS), CSDDD Art. 7/8, LkSG §2, UFLPA Sec. 3.
- **Outputs:** Zitierter, menschlich finalisierbarer Report-Entwurf; ESRS-Matching-Tabelle; rangiertes Salient-Register; mappt direkt auf die ~70 %-Reporting-Kostenreduktion, mit der BCG/Workiva werben.
- **Guardrail:** Jeder Satz trägt eine Source-ID; ein Post-Generation-Guardrail rejected/flaggt jede unzitierte Behauptung. Reports vermerken Regulierungsversion + Datenvintage → historische Assessments bleiben reproduzierbar. Mensch finalisiert, KI entwirft.

### 2.12 Empfohlene Maßnahmen (Recommended Actions)

- **KI-Technik:** LLM-Generierung tier-/sektor-/confidence-spezifischer Maßnahmen-Playbooks aus einer templatisierten Bibliothek; Alternativ-Lieferanten-Vorschläge.
- **Modell/Tooling:** Sonnet-Klasse mit RAG über die Maßnahmen-Bibliothek; deterministisches Mapping von UFLPA-Tier → SLA (CRITICAL=IMMEDIATE, HIGH=60 Tage, Salient=90 Tage).
- **Inputs:** Risikotyp, Severity, Confidence, UFLPA-Tier, Sektor.
- **Outputs:** Zeitgebundene Aktionsliste, Monitoring-Indikatoren, Dataset-Integrationsplan, Alternativ-Sourcing-Listen (z. B. Westlake/Shintech/INEOS/Vynova für PVC).
- **Guardrail:** Maßnahmen sind Empfehlungen mit Quellenbezug; geschäftskritische Empfehlungen (z. B. „cease sourcing") erfordern menschliche Freigabe und werden im Audit-Log mit Begründung festgehalten.

### 2.13 Regulatorische Q&A (Regulatory Copilot)

- **KI-Technik:** **RAG-over-Regulation, citation-first**, mit KG-of-Triplets-Grounding (Subject-Predicate-Object aus regulatorischen Dokumenten); Multi-Agent-Pipeline (Query Understanding, Retrieval, Reasoning, Citation); **AI-getriebener „Regulatory Horizon Scanner"** der EUR-Lex/Official Journal, Council, BAFA, FLETF/CBP/DHS, EUDR-System kontinuierlich ingestet und Diffs mit Effective-Dates + Zitaten surfaced.
- **Modell/Tooling:** Opus-Klasse; das LLM antwortet **ausschließlich** aus bereitgestelltem Kontext; Chain-of-Thought verankert in Legal-Citations. Versioned Regulatory-Rules-Engine (keine hartkodierten Schwellen/Daten – Omnibus I änderte CSDDD auf > 5.000 MA / > 1,5 Mrd. €, CSRD auf > 1.000 / > 450 Mio. €, Daten verschoben auf 2027–2029).
- **Inputs:** LkSG (Übergangsphase, BAFA-Reporting de facto ausgesetzt), CSDDD (post-Omnibus), CSRD/ESRS, UFLPA, EU Forced Labour Regulation (Marktverbot ab 14.12.2027), EUDR (verschoben auf 30.12.2026/30.06.2027), CBAM (definitive Phase ab 01.01.2026).
- **Outputs:** Zitierte Antworten mit Verweis auf konkrete Provisionen + Triplet-Provenienz; „enacted vs. proposed vs. administrativ-ausgesetzt"-Status; Multi-Regime-Mapping pro Country-Sector-Finding.
- **Guardrail:** Citation-Presence-Check rejected unzitierte Aussagen; Status-Differenzierung verhindert die Falschaussage „Pflicht ist weg", wenn sie nur de facto nicht durchgesetzt wird. Per-Jurisdiction-Parametrisierung (27 nationale Haftungsregime, da CSDDD-Art.-29-EU-Haftung gestrichen).

---

## 3. Agentische Architektur

Orchestrierungsprinzip: **Supervisor-Pattern.** Ein Orchestrator-Agent zerlegt Aufgaben und delegiert an spezialisierte Sub-Agenten; jeder Sub-Agent hat ein eng definiertes Tool-Set und schreibt in dasselbe Audit-Log. Agenten **rufen deterministische Tools auf** (Scoring, EXIOBASE-Lookups, Entity-List-Match) – die Tools rechnen, die Agenten orchestrieren und urteilen. Implementiert mit Vercel AI SDK `tool()`/`stopWhen`/`prepareStep`, deployed auf Fluid Compute (bis ~800 s), geroutet über AI Gateway mit Per-Agent-Kosten-Tags.

### 3.1 Agentenkatalog

| Agent | Aufgabe | Tools | Modellklasse |
|---|---|---|---|
| **Ingestion & Onboarding Agent** | Stammdaten/BoM extrahieren, EXIOBASE-Konkordanz mappen, Datensätze normalisieren | `extractDocument` (Vision+LLM), `matchConcordance` (Embeddings), `validateSchema` (Zod), `writeComponent` | Sonnet |
| **CoO-Resolution Agent** | 3-Stufen-Gap-Closure + Begründung | `checkPlausibility`, `lookupExiobaseCoefficients`, `validateTradeFAOSTAT`, `validateComtrade`, `draftRationale` | Opus (Adjudikation) |
| **n-Tier-Discovery Agent** | Sub-Tier-Mapping, versteckte Hotspots, BoM-Inferenz | `queryKnowledgeGraph` (GraphRAG), `inferBoM`, `computeSupplyShare` | Opus |
| **UFLPA/Forced-Labor Agent** | Sektor-Klassifikation, XUAR-Nexus, Entity-Match, Tier-Klassifikation | `matchEntityList`, `computeXuarProbability`, `classifyFletfSector`, `applyUflpaOverlay` (deterministisch) | Opus |
| **Adverse-Media/Monitoring Agent** | Kontinuierliches Screening, Klassifikation in 16 Typen, Re-Scoring-Trigger | `pullGdelt`, `pollOpenSanctions`, `classifyEvent`, `dedupeEmbeddings`, `triggerRescore` | Sonnet (+ Opus-Adjudikation) |
| **Severity & Confidence Agent** | CSDDD Art. 6 Severity/Likelihood + Confidence-Klassifikation | `assessSeverity`, `assessLikelihood`, `classifyConfidence`, `generateValidationActions` | Opus |
| **Reporting Agent** | ESRS-Mapping, Double-Materiality, Salient-Register, Narrative-Drafting | `mapEsrsDatapoints`, `ragRegulation`, `assembleSalientRegister`, `draftNarrative` | Opus |
| **Regulatory Horizon Agent** | Quellen-Ingestion, Diff-Detection, Regulatory Q&A | `ingestRegulatorySource`, `diffVersions`, `ragRegulationTriplets`, `flagLegalReview` | Opus |
| **Predictive-Distress Agent** | Forward-looking Supplier-Distress-Signal (90–180 Tage) | `runEnsembleModel` (XGBoost/LSTM, externer Python-Worker), `emitEarlyWarning` | n/a (ML-Ensemble, kein LLM) |
| **Orchestrator/Supervisor** | Aufgaben-Routing, Human-Review-Gating, Audit-Logging | delegiert an alle obigen, `enqueueHumanReview`, `appendAuditLog` | Opus |

### 3.2 Orchestrierungs-Flow

1. **Onboarding** → Ingestion-Agent normalisiert; unsichere Felder → Review-Queue.
2. **Anreicherung** → CoO-Resolution-Agent + n-Tier-Agent laufen; UFLPA-Agent screent parallel.
3. **Scoring** → deterministische Engine berechnet (kein Agent rechnet); Severity/Confidence-Agent reichert an.
4. **Monitoring** → geplante Agenten (Cron/Workflow DevKit) re-screenen und triggern Re-Scoring bei Index-/Trade-/Entity-List-Änderungen.
5. **Output** → Reporting-Agent entwirft; Regulatory-Horizon-Agent stempelt Regulierungs-Stand; Mensch finalisiert.
6. **Querschnitt** → jeder Schritt mit Human-Oversight-Checkpoint vor supplier-wirkender Schlussfolgerung; jeder Output ins append-only Audit-Log.

### 3.3 Trennung der Planes

- **Online-Plane (Next.js + Supabase):** Agenten, Structured Output, Serving, RLS, Review-Queues. Liest materialisierte Scores.
- **Offline-Compute-Plane (Python-Worker):** `pymrio`-Leontief-Rechnung (40+ GB, 30–45 min), Copernicus/CCKP-NetCDF-ETL, Bulk-CSV-Ingest, ML-Ensembles. Schreibt versionierte Snapshots via Service-Role-Key nach Postgres. **Niemals** in Next.js-Request-Handlern oder Edge Functions.
- **Scheduler (3 Stufen):** kontinuierlich (GDELT 15 min, OpenSanctions ~30 min Poll); jährlich/on-release (die meisten Indizes); periodischer Großrechenlauf (EXIOBASE, Klima-ETL).

---

## 4. Guardrails (für ein reguliertes, verteidigungsfähiges Tool)

Da das Tool Lieferanten-Entscheidungen beeinflusst, ist es ein **EU-AI-Act-High-Risk-System** (Art. 6–15; Hauptpflichten ab 02.08.2026). Human Oversight (Art. 14) und Traceability sind **rechtliche Anforderungen**, keine Optionen. Strafen bis 35 Mio. €/7 % Umsatz.

### 4.1 Halluzinationskontrolle

- **Strukturierte/typisierte Ausgabe** (Zod-Schemas via `generateObject`) eliminiert stille Fehler.
- **Tool-Name-Validierung** gegen das verfügbare Tool-Set fängt Function-Hallucination.
- **RAG-with-Evidence** + **Per-Satz-Citation-Presence-Check**: ein LLM darf nur behaupten, was in einer abgerufenen Passage oder einem KG-Triplet verankert ist; ein Post-Generation-Guardrail rejected/flaggt unzitierte Claims.
- **Adversariales Zwei-LLM-Pattern** (Analyst + Reviewer) für jede konsequenzielle Beurteilung; Dissens → Mensch.
- **Deterministik wo möglich:** alle 1–5-Scores, Composites, `max()`, UFLPA-Overlay, Severity-Aggregation sind Code, nicht LLM-Urteil.

### 4.2 Citation/Traceability

- Jeder konsequenzielle Output trägt **Source-ID, Publisher, abgerufen-am, Lizenz, LkSG-Zitatkette** und „Regulierungs-Stand als-of".
- **Immutable, append-only Audit-Log** jeder KI-Entscheidung: Inputs, Modell + Version, Prompt, abgerufene Quellen, Output, menschlicher Reviewer, Override.
- **Versionierung** aller regulatorischen und Index-Inhalte (LkSG, CSDDD, 2023- vs. revidierte-2025-ESRS, FLETF-Sektorliste, Entity List, die 124 Indizes) → Reports vermerken, gegen welche Version und welches Datenvintage sie generiert wurden.
- Provenienz unterscheidet **inferiert (MRIO-statistisch) vs. lieferanten-deklariert vs. enforcement-bestätigt**.

### 4.3 Evals

- **Gold-Set** aus den bestehenden ALDI-Case-Study-Spreadsheets (korrigiertes CoO, Scores, Severity) als Ground Truth.
- **Regelbasierte Checks:** Schema-Validität, Citation-Presence, Score-Reproduzierbarkeit (ENV=mean5, HR=mean11, Overall-Aggregationslogik), 16/16-Zeilen-Konsistenz.
- **LLM-Judge** für Narrative-Qualität + periodische **menschliche Spot-Checks** (analog zum MVO-Quality-Check-Sheet).
- **Guardrail-Pass/Fail- und Halluzinations-Raten** werden über die Zeit gemonitort; Releases werden darauf gegated.
- **Observability** via AI Gateway: Request-IDs, Passage-IDs, Per-Satz-Support-Flags, Token/TTFT/Spend pro Feature.

### 4.4 Confidence-Surfacing

- 4-Level-Framework (VERY HIGH/HIGH/MEDIUM/LOW) in **jeder UI-Ansicht und jedem Export sichtbar**, mit Links zu Quell-Seiten.
- LOW-Konfidenz triggert automatisch **Vorsorgeprinzip** + Validierungs-Queue mit SLA.
- „Why this score"-Erklärgenerator zitiert exakte BAFA-Quelle, Publisher, LkSG-Paragraph, Einheit – für Regulator-Anfragen.
- **Human-Oversight-Checkpoints** vor jeder supplier-wirkenden Schlussfolgerung; kompetente, geschulte, autorisierte Personen (Art. 14); Transparenz-Hinweise; PII-/Retention-Controls; SOC2/ISO27001-Ausrichtung.

---

## 5. Feature-Priorisierung (Wert × Komplexität, MVP vs. später)

| # | AI-Feature | Wert | Komplexität | Phase |
|---|---|---|---|---|
| 1 | Vision+LLM-Dokument-/SAQ-/Zertifikat-Extraktion (schema-constrained) | Hoch (eliminiert manuelle Dateneingabe, Onboarding-Beschleuniger) | Mittel | **MVP** |
| 2 | EXIOBASE-Konkordanz-Mapping (Embeddings + LLM-Vorschlag) | Hoch (Voraussetzung für Scoring) | Mittel | **MVP** |
| 3 | CoO-Plausibilität & Gap-Closure (3-Stufen + Begründungstext) | Sehr hoch (ersetzt arbeitsintensivste Analystenarbeit) | Hoch | **MVP** |
| 4 | Deterministische Scoring-Engine + Verifikations-/Audit-Modul | Sehr hoch (Kern-IP, Verteidigungsbasis) | Mittel (Logik klar dokumentiert) | **MVP** |
| 5 | UFLPA-RAG-Screening + Entity-Match + XUAR-Probability + Overlay | Sehr hoch (am aktivsten durchgesetztes Regime) | Hoch | **MVP** |
| 6 | Confidence-Auto-Klassifikation + Validierungs-Aktionen | Hoch (Auditierbarkeit, Differenzierung vs. Wettbewerb) | Niedrig–Mittel | **MVP** |
| 7 | Citation-First Report-Drafting (CSRD/ESRS, BAFA, Salient-Register) | Sehr hoch (~70 % Reporting-Kostenreduktion) | Hoch | **MVP** (Kernreport) / später (volle ESRS-Breite) |
| 8 | Adverse-Media-/Event-Monitoring (GDELT + OpenSanctions, 2-LLM) | Hoch (Always-on-Differenzierung vs. statischen Wettbewerbern) | Hoch | **Später** (Phase 2) |
| 9 | GraphRAG n-Tier-Discovery + versteckte Hotspots | Sehr hoch (Tier-N-Tiefe, „questionnaire-free") | Sehr hoch (KG-Aufbau) | **Später** (Phase 2) |
| 10 | CSDDD Art. 6 Severity/Likelihood-Adjudikation (2-LLM) | Hoch (CSDDD-Defensibilität) | Mittel–Hoch | **Später** (Phase 2) |
| 11 | Regulatory Horizon Scanner + Regulatory Q&A (RAG-over-Regulation) | Hoch (Differenzierung, Always-current) | Sehr hoch | **Später** (Phase 2/3) |
| 12 | Predictive Supplier-Distress (ML-Ensemble, 90–180 Tage) | Mittel (Forward-looking-Signal, ergänzend) | Hoch (separater ML-Worker) | **Später** (Phase 3) |
| 13 | BoM-Inferenz für nicht erfasste Komponenten | Mittel–Hoch (versteckte UFLPA-Exposition) | Mittel | **Später** (Phase 2) |
| 14 | Klimarisiko-Modul (physisch + transition, 28 Hazards, SSP/RCP) | Hoch (SUS-Service-Decks, Cross-Sell) | Sehr hoch (Klima-ETL, Provider-APIs) | **Später** (Phase 3) |

**Begründung der MVP-Schnittlinie:** Der MVP muss die ALDI-Methodik end-to-end reproduzierbar nachbilden (Onboarding → CoO → deterministisches Scoring → UFLPA → Confidence → Kernreport) und dabei jeden Output zitierbar und auditierbar machen. Always-on-Monitoring, GraphRAG-Tiefenmapping, Predictive Scoring und das Klimamodul sind hochwertige Differenzierer, aber abhängig von Infrastruktur (KG, ML-Worker, Klima-ETL, kommerzielle OpenSanctions-Lizenz), die nach validiertem Kern aufgebaut wird.

---

## 6. Regulatorische Einordnung & Designprinzipien (Zusammenfassung)

1. **Keine hartkodierten Schwellen/Daten.** Versionierte Regulatory-Rules-Engine mit Effective-Date-Metadaten (Omnibus I ist seit 18.03.2026 Gesetz: CSDDD > 5.000 MA / > 1,5 Mrd. €, CSRD > 1.000 / > 450 Mio. €, Daten 2027–2029).
2. **Multi-Regime-Modell.** Jedes Country-Sector-Finding mappt auf die spezifischen Pflichten/Enforcement-Venues (EU CSDDD, LkSG-Übergang, US UFLPA, EU Forced Labour Regulation, EUDR, CBAM) mit separaten Effective-Dates.
3. **Haftung fragmentiert & national.** Per-Jurisdiction-Parametrisierung (27 Mitgliedstaaten), 3 %-Verwaltungs-Fine-Cap.
4. **Voluntary-/Value-Chain-Positionierung.** Da ~70 % aus CSDDD-Direktscope fallen und LkSG-Reporting de facto ausgesetzt ist, zielt der Mehrwert auf kunden-kaskadierte Anforderungen, US-Import-Enforcement, Investor-Druck und 2027–2029-Readiness – Outputs auf Defensibilität/Audit-Readiness gerahmt.
5. **Deterministik bleibt der Kern.** LLMs extrahieren, recherchieren, klassifizieren, urteilen, entwerfen – sie berechnen den finalen Score nie. Das ist der entscheidende Unterschied zu „Black-Box"-Wettbewerber-Scores (Prewave 360, Interos i-Score, Sphera) und unsere Verteidigungsbasis.

---

*Stand: 2026-06-08. Dieses Dokument ist Teil der Research-Phase und informiert die nachgelagerten `/requirements`- und `/architecture`-Schritte. Alle methodischen Details sind gegen die Methodik-Dokumente und `data/`-Quellen zu verifizieren, nicht zu erfinden.*
