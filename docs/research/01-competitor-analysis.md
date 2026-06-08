# Wettbewerbsanalyse: Lieferketten-Risiko-Tools (LkSG / CSDDD)

> Rigorose Analyse von acht Wettbewerbern im Markt für Lieferketten-Risiko- und Sorgfaltspflichten-Software. Erstellt fuer das Produktteam als Grundlage fuer den Aufbau eines neuen, konsequent AI-first ausgerichteten Tools auf Basis der EXIOBASE-/16-Risikotypen-Methodik (ENV + Menschenrechte, EEIO/MRIO-Leontief-Attribution, UFLPA-Overlay, CSDDD-Art.-6-Severity, vierstufiges Confidence-Framework).

**Stand der Recherche:** Mitte 2026. Alle Aussagen stammen aus den im Anhang je Anbieter gelisteten Quellen. Nicht belegte Faehigkeiten werden ausdruecklich als Luecke markiert.

---

## 1. Executive Summary

Der Markt fuer Lieferketten-Sorgfaltspflichten-Software ist 2025/2026 stark in Bewegung. Getrieben durch LkSG, CSDDD, CSRD, EUDR, CBAM und UFLPA positionieren sich alle acht analysierten Anbieter zunehmend als "AI-first" - in sehr unterschiedlicher Tiefe und Glaubwuerdigkeit.

**Drei strukturelle Lager lassen sich erkennen:**

1. **Echte AI-native Plattformen mit proprietaeren Modellen** - allen voran **Prewave** (eigene NLP-Modelle in 400+ Sprachen, 4,5 Mio. Datenpunkte/Tag, Gartner-MQ-Leader 2025 und 2026) und in zweiter Reihe **Interos** (groesster B2B-Knowledge-Graph mit ~11 Mrd. Beziehungen, i-Score, neue Predictive-Plattform iQ). Beide stark, aber jeweils mit klaren Schwaechen: Prewave bei Methodentransparenz und ohne sichtbaren generativen Copilot, Interos mit ESG/Menschenrechte nur als eines von sechs Risikofeldern und ohne dezidierten LkSG/CSDDD-Workflow.

2. **Netzwerk-/Daten-Moats mit nachgeruesteter AI** - **EcoVadis** (de-facto Standard fuer ESG-Ratings, 175.000+ bewertete Lieferanten, Analysten-validiert, Gemini-Agentic-AI ab 2026), **IntegrityNext** (2 Mio.+ First-Party-Lieferantenprofile, XMINDS-AI-Initiative 2026), **Sedex** (verifizierte SMETA-Audits als Moat, aber bis Mitte 2026 ohne jegliche beworbene AI) und **Achilles** (verifizierte Audits + AI per Akquisition zugekauft).

3. **Breite Plattformen mit Compliance als Teilbereich** - **osapiens** (25+ Apps auf einer DB, Unicorn 2026, agentic AI per Lucent-AI-Zukauf, erste Module Q2 2026) und **Sphera** (Operational-Intelligence-Suite mit EHS/LCA/Operational Risk; Lieferketten-Due-Diligence ist nur eine Faehigkeit unter vielen).

**Gemeinsame, branchenweite Schwaechen - und damit unsere Chancen:**

- **Kein einziger Anbieter** legt eine transparente, quantitative Index-/Schwellenwert-Methodik offen, wie sie unser 16-Risikotypen-Modell (1-5 gegen dokumentierte Indices) bietet. Scoring ist durchgaengig entweder fragebogen-/signalgetrieben oder eine proprietaere Blackbox ("99,98 % Relevanz", "i-Score", "Prewave 360").
- **Keiner** nutzt nachweislich eine EEIO/MRIO-Attribution (EXIOBASE/Leontief) mit FAOSTAT/UN-Comtrade-Gap-Closure ueber die drei Lieferkettenstufen (Rohstoffursprung / Verarbeitung / Fertigung). Carbon/Scope-3-Module beruhen fast ueberall auf lieferantengemeldeten Daten.
- **UFLPA als echtes Overlay** (FLETF-Sektoren + XUAR-Nexus + Entity List) ist nur bei Interos sauber produktisiert; bei den meisten anderen ist UFLPA editorial/generisch oder gar nicht abgedeckt (osapiens).
- Ein **CSDDD-Art.-6-Severity-Modell** (Scale/Scope/Irremediability x Likelihood) und ein **explizites Confidence-/Unsicherheits-Framework** fehlen bei allen acht.
- Echte **generative/agentic LLM-Copiloten** sind erst im Entstehen (osapiens Lucent AI, IntegrityNext XMINDS, Sphera AI, EcoVadis/Gemini) - vielfach Roadmap, nicht ausgeliefert. Der AI-first-Vorsprung ist also noch verteidigbar.

**Fazit:** Der starke Gegner ist Prewave (Markenstaerke, Scale, proprietaere AI), der breiteste EcoVadis (Netzwerk, Standard). Aber: Methodentransparenz, EEIO-Fundierung, ein sauberes UFLPA-Overlay, CSDDD-Severity und ein nativer agentic Analyst sind branchenweite Luecken. Genau dort kann ein neues, konsequent AI-first und methodisch transparentes Tool gewinnen.

---

## 2. Wettbewerberprofile

### 2.1 Prewave

**Positionierung.** Wiener AI-Plattform (gegruendet 2017 von Lisa Smith und Harald Nitschinger), die sich als "Supply Chain Superintelligence" vermarktet - eine durchgaengige, AI-first-Plattform fuer Resilienz, Nachhaltigkeit und Compliance. Kernversprechen: Millionen von Risikoereignissen ueber Sprachen und Netzwerke hinweg zu fokussierten, handlungsfaehigen Alerts verdichten. Gartner-MQ-Leader fuer Supplier Risk Management 2025 UND 2026.

**Zielkunden.** Grosse Enterprise-Teams in Procurement, Supply Chain, Risk und Sustainability - Schwerpunkt Automotive, Elektronik, Industriegueter, Aerospace/Maritime/Defense, Transport und Food. 200+ Enterprise-Kunden (VW, Audi, Porsche, BMW, Volvo, Ferrari, Toyota, Magna, Lufthansa, Hilti, Kaercher, Dr. Oetker). Basis Europa (LkSG/CSDDD-getrieben), USA als Expansionsziel.

**Module.** Monitoring & Alerting; Scoring (Prewave 360 Score, 200+ Risikokategorien, Risk Matrix); Tier-N Transparency (Multi-Tier-Mapping top-down + bottom-up, 500.000+ Tier-N-Lieferanten, "questionnaire-free"); Action Platform (Maturity/Security Assessments, One-Click-Reporting, Partner fuer Audits/TUV SUD, Worker Surveys); Integrations (SRM/ERP, o9, SAP Business Network, JAGGAER, Coface); Scoping & Rapid Onboarding; Carbon 360 (Scope-3, CBAM/CSRD-Reporting); EUDR-Solution (Satellitenverifikation via Satelligence, TRACES).

**AI-Features.** Proprietaere, in-house entwickelte Risk-Detection-Modelle (Ursprung in der PhD-Forschung der Mitgruenderin 2012, kein blosser LLM-Wrapper); multilinguale NLP-Adverse-Media-Erkennung in 400+ Sprachen/Dialekten, 140-200+ Risikotypen; ~4,5 Mio. Datenpunkte/Tag gefiltert (ROI-Claims: 40x weniger DD-Aufwand, 3 Tage schnellere Reaktion); AI-ESG-Scoring gegen Expertenurteil benchmarkt (1.430 Commodities, 195 Laender); AI-Tier-N-Mapping; Predictive Analytics; AI-Satelliten-Deforestation-Monitoring (EUDR); AI-automatisiertes Compliance-Reporting (BAFA/CSRD/CBAM/EUDR).

**Datenquellen.** Proprietaeres Web-Scraping oeffentlicher Medien in 400+ Sprachen; 4,5 Mio. Datenpunkte/Tag; 1,6 Mio. registrierte Lieferanten (~1,3 Mio. AI-gemappt, 500.000+ Tier-N); Lieferanten-Self-Assessments und Worker Surveys; Satellitenbilder (Satelligence); EU TRACES; Bonitaets-/Insolvenzdaten (Coface); externe Risk-Feeds via SAP/o9/JAGGAER.

**Regulatorische Abdeckung.** LkSG (inkl. BAFA-Reporting), CSDDD, CSRD/ESRS, EUDR, CBAM, UFLPA (im Forced-Labour-Modul), Norwegisches Transparenzgesetz, franzoesisches Devoir de Vigilance, Schweizer VSoTr, kanadisches Forced/Child Labour Act.

**Staerken.** AI-first-Marke mit starker Drittvalidierung (Gartner-Leader 2025+2026, Forrester, Hackett); genuin proprietaere AI/NLP-Modelle; massive Echtzeit-Scale; breiteste regulatorische Abdeckung der Kategorie; Closed-Loop-Action-Platform; marken-starke Logo-Basis; Best-in-Class Tier-N-Mapping; gut finanziert (~98 Mio. USD, ~219-232 MA, ~43,9 Mio. USD Umsatz 2025).

**Schwaechen.** Alert-Overload/Rauschen (Rezensenten: "zu viel Information", Praezisionsluecke); begrenzte Transparenz der Scoring-Methodik (keine offen gelegten Index-Quellen, Confidence-Level oder Severity-Breakdowns); kein klar beworbener konversationeller/agentic AI-Copilot Mitte 2026; Carbon/Scope-3 vermutlich auf lieferantengemeldeten Daten statt EEIO/MRIO-Baseline; EUDR/mehrere Compliance-Faehigkeiten via Drittpartner (Satelligence); enterprise-lastig und sales-led, lange Onboarding-Zeiten; opake Enterprise-Preise; Breite-vor-Tiefe-Risiko ueber 10+ Regulierungen.

**Entwicklungen 2025/2026.** Gartner-MQ-Leader 2026 (zweites Jahr in Folge); Forrester SVM Landscape Q1 2026; Hackett SolutionMap Validated Spring 2026; Engage-2025-Konferenz mit UX-2.0-Redesign; Sustainability-Scoring auf 1.430 Commodities/195 Laender erweitert; neue SAP-Business-Network-Partnerschaft; Forrester-TEI-Studie; Partnerschaften o9/Capgemini/Coface; Series B (63 Mio. EUR / 67,5 Mio. USD, Hedosophia, angekuendigt Juni 2024).

**Pricing.** Subscription/SaaS, enterprise-sales-led, nicht transparent veroeffentlicht. Skaliert primaer ueber Anzahl ueberwachter Lieferanten. Aggregator-Einstiegspreise (ab ~249 EUR/Monat) bilden reale Enterprise-Deals nicht ab; effektiv: nicht offengelegt, quote-basiert.

---

### 2.2 IntegrityNext

**Positionierung.** Muenchner SaaS-Plattform fuer Lieferketten-Nachhaltigkeit und Compliance; positioniert sich als "Intelligence- und Orchestrierungsschicht fuer nachhaltige Lieferketten". Modell zentriert auf ein Self-Assessment-Lieferantennetzwerk (2 Mio.+ Profile, 190+ Laender) plus Echtzeit-Risk-Intelligence. 2026 stark als "AI-first" repositioniert (XMINDS-Initiative, AI Intelligence Layer). 500-600+ Enterprise-Kunden; 100 Mio. EUR EQT-Growth-Investment (2023).

**Zielkunden.** Grosse Unternehmen und mittlere/grosse Procurement-/Compliance-/Sustainability-Teams, vorwiegend Europa (insb. Deutschland). Branchen: Automotive, Elektronik, Industrie, Bau, Chemie, Energie, Finance, Pharma, Public Sector. Kunden: SAP, Infineon, Texas Instruments, Canon, Telefonica, Samsung, Heidelberg Materials, Hilti, Wuerth, Swiss Re, thyssenkrupp, Clariant.

**Module.** Supply Chain Due Diligence (Self-Assessments 5-22 Ja/Nein-Fragen); Sustainable Procurement; Forced Labor Prevention; Multi-Tier-Visibility (AI-Mapping aus Produktnamen); Carbon Emissions Navigator (Scope-3, SBTi, CBAM); Product Compliance (ab Mai 2026 strategische Saeule: AI-BoM-Parsing, virtuelle BoM, REACH/RoHS/PFAS/3TG/DPP/Battery/EPR); Sustainability Reporting (CSRD/ESRS); EUDR; AI Intelligence Layer (querschnittlich).

**AI-Features.** AI Screening (Maerz 2026; analysiert oeffentliche Lieferanteninfos, klassifiziert Evidenz als strong/partial/none mit Quellenzitaten, deckt Non-Responder in Minuten ab); Predictive Supply Chain Mapping; Smart Supplier Prioritization (ML auf 10 Mio.+ Handelsbeziehungen); Echtzeit-Signal-/Sentiment-Monitoring; AI-Augmented Data Collection; AI-assisted Assessments (XMINDS); NLP-Regulatory-Monitoring-Agents; Product-Compliance-AI-Agents; Risk Agents (governed agentic AI, Roadmap); Automated Follow-Up & Remediation.

**Datenquellen.** First-Party-Netzwerk: 2 Mio.+ Lieferantenprofile in 190+ Laendern (angeblich groesstes First-Party-Sustainability-Dataset); Zertifikate/Dokumente; Millionen externer News/Signale; oeffentliche Lieferanten-Webinhalte (AI Screening); zehn Millionen Handelsbeziehungen (ML-Training); Laender-/Branchen-Referenzdaten; Regulatory-Change-Feeds.

**Regulatorische Abdeckung.** LkSG, CSDDD, CSRD/ESRS, EUDR, CBAM, UFLPA, EU-Forced-Labour-Regulation, Norwegisches Transparenzgesetz, Schweizer VSoTr, REACH/RoHS/PFAS/POPs, 3TG/EMRT, DPP/ESPR/Battery/EPR/PPWR, SBTi.

**Staerken.** Sehr grosses First-Party-Self-Assessment-Netzwerk (echte deklarierte Daten); breite Single-Platform-Abdeckung; starke EU/DE-Position und LkSG/CSDDD-Tiefe; vorgebaute ERP/Procurement-Konnektoren (Ariba, Coupa, Ivalua, Celonis); glaubwuerdige AI-first-Repositionierung mit Explainability-Framing; Drittvalidierung (Verdantix 180 % 3-Jahres-ROI, Gartner Market Guide); niedrige Onboarding-Friktion (kurze Ja/Nein-Fragebogen, kostenlose Profile).

**Schwaechen.** Stark abhaengig von lieferantengemeldeten Daten/Zertifikaten (potenziell niedrige Qualitaet, unverifiziert); kein EEIO/MRIO-Spend-Attribution offengelegt; Scoring nicht transparent quantitativ/index-getrieben; begrenzte Tiefe bei Umwelt-Sub-Risiken (Biodiversitaet, physisches Klimarisiko, Ressourcen); Multi-Tier raeumt "long tail" ein; duenne unabhaengige Review-Basis (~6 G2-Reviews); opakes Pricing; AI-Faehigkeiten sehr jung (2026), Teile noch Roadmap; kein UFLPA-Overlay oder CSDDD-Severity-Framework; relativ kleines Unternehmen (~17,5 Mio. USD ARR, ~160-200 MA).

**Entwicklungen 2025/2026.** 5. Mai 2026: Product Compliance als strategische Saeule (AI-BoM-Parsing); 24. Maerz 2026: AI Screening gelauncht; 19. Maerz 2026: BearingPoint-Partnerschaft; 12. Maerz 2026: XMINDS (AI-first-Transformation, governed agentic AI); 10. Maerz 2026: Verdantix 180-%-ROI-Studie; Feb 2026: Simon Jaehnig als Chief Strategy & Innovation Officer; April 2026 Gartner Market Guide (18 representative vendors).

**Pricing.** Nicht oeffentlich. Subscription/SaaS, sales-led; skaliert ueber Anzahl Lieferanten und Modulzugang. Lieferanten koennen kostenlose teilbare Profile anlegen. Konkrete Zahlen nur per Angebot.

---

### 2.3 EcoVadis

**Positionierung.** Globale Nachhaltigkeits-/ESG-Intelligence-Plattform - "Alle Nachhaltigkeitsdaten. Eine Plattform" / "One Brain for the Supply Chain". Kernfranchise ist das EcoVadis Rating: ein evidenzbasiertes Scorecard (0-100) ueber vier Themen (Environment, Labour & Human Rights, Ethics, Sustainable Procurement, 21 Kriterien), ausgerichtet an UN Global Compact, GRI und ISO 26000, mit Medaillen (Bronze/Silber/Gold/Platinum, seit 2024 perzentil-basiert). De-facto Industriestandard fuer Lieferanten-ESG-Ratings mit zweiseitigem Netzwerk. 2025/2026 Repositionierung von der Compliance-Rating-Behoerde hin zu "resilience-led procurement" plus agentic AI.

**Zielkunden.** Grosse Unternehmen mit Procurement-/Sustainability-Teams (1.500+ Buying Orgs) plus die bewerteten Lieferanten. Bewertetes Netzwerk: 175.000+ Unternehmen (IQ-Plus-Netzwerk 3 Mio.+ Profile), ~230 Branchen, 180+ Laender. Schwerpunkt Manufacturing, Retail/CPG, Automotive, Pharma, Financial Services.

**Module.** Ratings (Scorecards, Gewichtung Policies 25 % / Actions 40 % / Results 35 %); IQ / IQ Plus (contactless AI-Risk-Mapping, 100 % der Lieferantenbasis ohne Outreach, DocScan + Live News Monitoring); DocScan (AI-Dokumentenmining, bis 27 verifizierte Docs/Lieferant, "ScanRisk"); Live News Monitoring (24/7, 100.000-400.000+ Quellen, 8 Sprachen); Vitals (kostenlose Self-Assessments, 14 Sprachen); Carbon Action Manager / Scope 3 (2025: Carbon Data Network + PCF Exchange nach PACT); Worker Voice (Ulula, Grievance-/Worker-Surveys); 360 Watch / Sanctions Checks; CS3D- & CSRD-Value-Chain-Compliance-Solution (Taylor-Wessing-Rechtsgutachten); Academy & Community; Multilingual GenAI AI Assistant.

**AI-Features.** Multilingualer GenAI-Assistant (auf Azure OpenAI; Scorecard-Zusammenfassung, Lieferantenvergleich, Prioritaeten); AI-Dokumentenanalyse in Assessments (Augmentation, jedes Rating von 2+ Analysten geprueft); AI-DocScan (bis 30 Mio. Docs/Monat); AI Adverse-Media/LNM (400.000+ Quellen, 8 Sprachen); Predictive Risk Profiling (Land/Branche/Spend/Dokument-Transparenz); Agentic AI via Google Cloud / Gemini Enterprise (April 2026); taegliches AI-Web-Crawling von Lieferantenseiten.

**Datenquellen.** Zweiseitiges Netzwerk 175.000+ bewertete Unternehmen; IQ-Plus 3 Mio.+ Profile (20.000+ woechentlich neu); ecotrek-Datenbank 5 Mio.+ Profile; bis 30 Mio. ESG-Dokumente/Monat gescreent; 400.000+ Quellen, 8 Sprachen; Self-Assessments (Vitals); Worker Voice (Ulula) Primaerdaten; Carbon Data Network (verifizierte Scope-1/2/3- und PCF-Daten); Sanktionslisten/360 Watch; 500+ globale Standards.

**Regulatorische Abdeckung.** LkSG (eigenes Dashboard), CSDDD (eigene Value-Chain-Solution, Taylor-Wessing-Gutachten), CSRD/ESRS (alle topical standards), EUDR, CBAM, UFLPA, EU-Forced-Labour-Regulation, Modern Slavery Acts (UK/AUS/CAN), Frankreich Duty of Care, Norwegen, Dutch Child Labor, SEC Climate, California SB 253/261, SFDR, EU Taxonomy, RoHS.

**Staerken.** Dominante Marke / de-facto Standard, grosses zweiseitiges Netzwerk = starker Lock-in; analysten-validierte, evidenzbasierte Methodik (jedes Rating von 2+ von 500+ Analysten); Breite (Ratings + IQ-Plus + Carbon + Worker Voice); sehr weite regulatorische Abdeckung mit Dashboards und Rechtsgutachten; tiefer Daten-Moat (30 Mio. Docs/Monat, Carbon Data Network); starke Cloud/AI-Partner (Azure OpenAI, Gemini Enterprise); gut finanziert (~732 Mio. USD); Procurement-Integrationen (Ivalua).

**Schwaechen.** Bewertet Managementsysteme/Policies statt realer Wirkung ("was Firmen sagen, dass sie tun"); langsame, arbeitsintensive Analysten-Ratings (Wochen, keine Echtzeit, 50-500+ Personenstunden Lieferantenaufwand); 2024er-Scoring-Ueberarbeitung frustrierte Lieferanten; teuer und opak, schwache SME-Value-Perception; Analyse wirke "automated and robotic"; Coverage-Luecke bei echter Sub-Tier-/Rohstoffursprungs-Attribution; keine granulare Per-Risikotyp-Index-Methodik vergleichbar mit 16-Risikotypen/UFLPA-Overlay/CSDDD-Severity; Carbon/PCF stark adoptionsabhaengig.

**Entwicklungen 2025/2026.** April 2026: Google-Cloud/Gemini-Enterprise-Partnerschaft (agentic AI, custom Business Agents); 2026: ~2,5 Bio. USD Spend ueber EcoVadis-Insights, Narrativ "from compliance to resilience-led procurement"; 2025: Carbon Data Network + PCF Exchange (PACT/ISO/GHG); 2025: GenAI-Assistant; IQ/IQ-Plus als contactless Engine; 2025er Methodik-Updates (exakte Pillar-Scores, perzentil-Medaillen, striktere Doku); Ivalua-Partnerschaft erweitert; Basis: ecotrek-Akquisition, 500-Mio.-USD-Series-D.

**Pricing.** Subscription, nicht transparent. Lieferanten zahlen gestaffelt (Basic/Premium/Select/Corporate), Berichte: ~489 EUR/Jahr (sehr klein) bis ~11.000 USD (groessere/Premium). Buyer-Seite enterprise-quoted; kleine/mittlere Programme (50-200 Lieferanten) berichtet ~15.000-80.000 USD/Jahr. Vielfach als teuer und opak kritisiert, mit hohen versteckten internen Aufwandskosten.

---

### 2.4 osapiens

**Positionierung.** Mannheimer "sustainable growth" SaaS; einziges Cloud-Produkt osapiens HUB buendelt 25+ Enterprise-Compliance- und Operations-Apps auf einer Plattform mit zentraler DB. "AI-driven" One-Stop-Plattform fuer ein breites Spektrum EU/globaler ESG- und Produkt-Compliance-Regulierungen (CSRD, EUDR, CBAM, LkSG, CSDDD, NIS2, PPWR) plus operative Effizienz-Apps. Unicorn (>1 Mrd. USD) durch 100-Mio.-USD-Series-C (Maerz 2026, BlackRock/Temasek Decarbonization Partners). 2.500+ Kunden, 550+ MA.

**Zielkunden.** Breit: Grossunternehmen und Mittelstand plus "EASY START for SMEs"-Flatrates. Sieben Vertikalen: Technical Industries; Utilities & Services; Hospital/Health; Finance & Insurance; FMCG/Retail; Automotive & Manufacturing; Medical Devices. Referenzen: OTTO, Einhell. Horizontal/regulierungsgetrieben statt branchenfokussiert.

**Module.** Supply Chain Compliance (LkSG/CSDDD, BAFA-Reporting, NTA/VSoTr); Supplier Risk Management (360-Grad-Screening, explainable source-linked Scores); EUDR (mobile Datenerfassung, Satellitenbilder, AI-Deforestation, custom Algorithmus); CBAM; CSRD/Double Materiality; Reporting Cockpit (VSME/CSRD/ISSB); Disclosure Management (XBRL); Corporate Carbon Footprint; Product Carbon Footprint; EU Taxonomy; X-Degree Compatibility (XDC); Product Compliance (PPWR/PFAS/REACH/RoHS/SCIP); Digital Product Passport; Medical Devices (MDR/EUDAMED/FDA/TGA); Food Traceability/TPD/Brand Protection; NIS2; Complaint Management; SRM & Audit Management; Effizienz-Apps (CMMS, CAFM, Distribution, Service).

**AI-Features.** AI Engine (unsupervised Anomaly Detection, Klassifikation, Regression, Python-Scripting, ML-Import); AI Adverse-Media/News-Screening (source-linked Scores); EUDR-AI-Deforestation; Anomaly Detection fuer illegalen Handel; Forecasting & Route-Optimierung; Lucent AI agentic Risk Agents (Dez 2025 akquiriert, erste Module Q2 2026).

**Datenquellen.** Sanktionslisten/Watchlists; Public Records und globale Medien (AI-curated Adverse Media); Drittpartei-ESG-Scoring; geopolitische Feeds; Satelliten/Geolocation (EUDR, teils Drittpartner); osapiens-Datennetzwerk (700+ EUDR-"industry champions", osapeers.org); Kundendaten via Manual/Bulk/REST/SAP-Connector.

**Regulatorische Abdeckung.** LkSG, CSDDD, CSRD/ESRS (inkl. Double Materiality), EUDR, CBAM, EU Taxonomy, NIS2, PPWR/PFAS/REACH/RoHS/SCIP, ESPR/DPP, MDR/EUDAMED/FDA/TGA, TPD, ISSB/VSME/XBRL, NTA/VSoTr (referenziert).

**Staerken.** Sehr breite, modulare One-Platform-Suite (25+ Apps, eine DB) ueber Compliance + Operations; stark finanziert (Unicorn, 100-Mio.-USD-Series-C, 2.500+ Kunden); tiefe EUDR-Positionierung (Satellit/Geolocation + 700+ Partnernetz, SAP-nativer Connector); gelobte UI/schnelle Implementierung/Datenzentralisierung; explainable source-linked Scores, BAFA-konformes LkSG-Reporting out of the box; aggressive AI-Roadmap (Lucent AI).

**Schwaechen.** Keine explizite UFLPA-, EU-Forced-Labour- oder Modern-Slavery-Abdeckung auf den geprueften Seiten - klare Luecke; Methodik fragebogen-/signalgetrieben, keine transparenten Index-Schwellen, kein EEIO/MRIO oder Multi-Stage-Country-Sector-Modeling; Geospatial/EUDR teils Drittpartner-abhaengig; AI aktuell ueberwiegend klassisches ML plus "AI-curated" Medien (agentic Lucent AI erst Q2 2026); Reviews bemaengeln AI-Genauigkeit, umstaendliches Datenhandling, langsame Performance, steile Lernkurve, fehlende Export-Funktionen; Breite-vor-Tiefe-Risiko (Maintenance/Medical Devices verwaessern Fokus); begrenzte Methodentransparenz (keine Indices/Severity/Confidence offengelegt).

**Entwicklungen 2025/2026.** Maerz 2026: 100-Mio.-USD-Series-C (Decarbonization Partners), Unicorn; Dez 2025: Akquisition Lucent AI (agentic Risk, Module Q2 2026); Kundenbasis auf 2.500+ gewachsen; Okt 2025: Einhell-Case-Study; 2025: EUDR-Push vor 30.12.2025 inkl. IFS-Partnerschaft und SME-Flatrate.

**Pricing.** Modulare Subscription, kostet skaliert mit Modulen/Customization/Reports/Rollen/Support. EUDR- und SME-Angebote als transparente Flatrate ("EASY START", kein Onboarding-Cost); einige Operations-Apps mit Tiers inkl. kostenlosem Starter (bis 5 User). Enterprise-Module per Quote. Keine oeffentlichen Per-Modul-Listenpreise.

---

### 2.5 Sedex

**Positionierung.** "Your partner in Ethical and Sustainable Supply Chain Management" - "die einzige Plattform mit verifizierten SMETA-Audits". Ethical-Trade-Membership-/Data-Exchange-Geschaeft im Kern (20+ Jahre), kombiniert geteilte Lieferantendatenplattform, SMETA-On-Site-Sozialaudit-Methodik, Country/Sector/Site-Risk-Tool und Beratungsdienste. Modell um auditierte Lieferantennetzwerke und standardisierte Selbstauskunft gebaut, NICHT um algorithmische Intelligence.

**Zielkunden.** Grosse Buyer, Procurement/Compliance/Sustainability in Consumer Goods, Retail, F&B, Manufacturing, Agriculture - plus deren Lieferanten (inkl. SMEs fuer Marktzugang). Netzwerk ~100.000 Unternehmen, ~115.000 Sites, 180 Laender, 35 Sektoren. Kunden: Nestle, Unilever, KFC, Sainsbury's, Tesco, DuPont, Japan Airlines.

**Module.** Sedex Platform (Mapping/Visibility, Site-Profile, Risk-Screening, SAQ, Audit-Storage, Corrective Action, Reporting; ~20 Mio. GBP Upgrade via LDC); Risk Assessment Tool (Radar; Country/Sector/Site 1-10 je Ethical Issue, jaehrlich aktualisierte Drittdaten); SMETA Audit (4-Saeulen-Sozialaudit, SMETA 7.0 2025 mit Management Systems Assessment und "Collaborative Action Required"-Findings); SAQ; Corrective Action/Remediation; Reporting & Dashboards (GRI-Software-Partner 2025); System/Customer-API (SAP/Oracle/Ariba/Coupa); e-Learning/Training; Supplier Directory; Sustainability Consulting Services (2025); Supplier Engagement & Community.

**AI-Features.** KEINE beworbenen AI/ML/LLM-Features (Stand Mitte 2026) - bestaetigte Luecke, nicht nur unbeschrieben. Multi-Source-Risk-Scoring ist regel-/datengetrieben (1-10), kein ML/Predictive. "Audit Intelligence" ist Positionierungsbegriff (Apax-Plaene 2026), kein Produkt-AI-Feature.

**Datenquellen.** ~115.000 registrierte Site-Profile (geteilte Member-Daten); SMETA-Audit-Ergebnisse (Kern-Asset); SAQs; inhaerente Country-Risk-Daten aus externen Drittindices (jaehrlich aktualisiert); Sector-Risk; Site-Daten; GlobalG.A.P.-Zertifizierungsdaten (Agrar); GRI-Framework.

**Regulatorische Abdeckung.** CSDDD, CSRD, LkSG, Modern Slavery Acts, UFLPA, Norwegen, UNGPs, ETI Base Code, HREDD-Framework, GRI.

**Staerken.** Einzigartiges proprietaeres Asset: verifizierte On-Site-SMETA-Sozialaudit-Daten at scale; sehr grosses etabliertes Netzwerk/Data-Exchange (Netzwerkeffekte); 20+ Jahre Markenvertrauen / de-facto Standard im Ethical Trade; SMETA 7.0 (MSA + CAR) bringt Root-Cause-Tiefe 2025; vorgebaute Procurement-Integrationen; starke Finanzierung (LDC 20-Mio.-GBP-Upgrade, >2x Umsatzwachstum 2022-2025; Apax kauft Mehrheit Mai 2026); GRI-Reporting-Partner; wachsende Services-Schicht.

**Schwaechen.** Keine AI/ML/LLM-Faehigkeit beworben - groesste Oeffnung fuer AI-first-Wettbewerber; starke Abhaengigkeit von manuellen, punktuellen On-Site-Audits (teuer, langsam, nicht Echtzeit); Reviews bemaengeln schwer navigierbare Plattform, Cookie-/Refresh-Workarounds, schwache Analyse/Reporting, fehlende Echtzeit-Updates; begrenzte tiefe Multi-Tier-/Upstream-Visibility; stark sozial/Menschenrechte, vergleichsweise flach bei quantitativem Umwelt-/Klimamodelling (kein EEIO/MRIO, keine GHG/Klima/Biodiversitaet-Composites); Country/Sector-Risk nur jaehrlich aktualisiert (nicht Echtzeit); regulatorische Abdeckung partiell (EUDR/CBAM/EU-Forced-Labour-Regulation nicht klar abgedeckt); qualitative/audit-zentrierte Methodik ohne transparentes quantitatives Composite-Framework (Severity x Likelihood); Membership-Lock-in und Datenqualitaets-Abhaengigkeit von SAQ.

**Entwicklungen 2025/2026.** Mai 2026: Apax-Funds erwerben kontrollierende Beteiligung an SIEL (Ziel u. a. "enhance audit intelligence"); 2025: SMETA 7.0 (MSA + CAR); 2025: GRI-Software-Partner; 2025: Sustainability Consulting Services (sechs Angebote); 2023-2025 (LDC): ~20-Mio.-GBP-Upgrade, geografische Expansion, >2x Umsatz; 2025/26: erweiterter Customer-API-Zugang; jaehrlicher Refresh der Country-Risk-Drittdaten.

**Pricing.** Nicht im Detail offengelegt. Membership/Subscription (gestaffelt Buyer/Supplier) plus bezahlte SMETA-Audits (durch Drittauditoren) plus Add-on-Consulting und API-Zugang. Keine transparenten Per-Seat-Preise; quote-basiert.

---

### 2.6 Achilles

**Positionierung.** "Der globale Standard in Supplier-Prequalification, ESG-Supply-Chain-Risk-Management und Auditing", 30+ Jahre, 19-22 Standorte, Risk-Intelligence ueber 200.000+ Lieferanten in 140+ Laendern. Verbindet ein Buyer-Supplier-Prequalification-Netzwerk mit physischen/Desktop-Audits, ESG-Scoring, Carbon-Accounting und AI-gestuetztem Non-Financial-Reporting. Kern-Differenzierung: verifizierte Daten (physische Dokumentenpruefung, On-Site-Audits, menschliche Validierung statt nur Scraping). Bridgepoint-backed (2021); aggressive AI-Akquisitionsstrategie 2024/2025.

**Zielkunden.** Grossunternehmen, Government-Procurement, Finanzinstitute in asset-heavy/regulierten Vertikalen: Energie (Oil & Gas, Renewables, Utilities), Mining, Bau, Defense/Aerospace, Rail, Maritime, Transport, Manufacturing, Chemie, Pharma, Retail, Seafood, Real Estate, Banking. Stark in Nordics, Iberien, UK, Nordamerika, LATAM.

**Module.** Achilles Platform; SupplyChain360; Comply360 (Non-Financial-Reporting; AI fuellt bis 94 % der ESG-Disclosures, CSRD/ESRS/IFRS/GRI, Carbon Estimator IEA/Defra, 10 Sprachen); Achilles Analytics (Feb 2025, Echtzeit-ESG-Dashboards, ESG+Financial-Profile, CSRD/CSDDD/BRSR/LkSG); Achilles Sustainability Score; AchillesAI Predictive Scoring (no-touch ESG/Country-Risk fuer Long-Tail, Insights in 7 Tagen, ~5pp von Vollassessment); Carbon Solutions (Scope 1/2/3, SBTi/CDP/TCFD); Controlar (Contractor-Verification/Site-Access); Achilles Audits (On-Site + Worker-Interviews + Desktop); Cyber Risk Management; Assurance Statement; Supplier Networks (Global/Maritime/Energy/Nordic).

**AI-Features.** AchillesAI Predictive Scoring (no-touch, Sept 2025); AI-Dokumentenextraktion/Data-Mining (InfoControl, 95 %+ Genauigkeit, mehrsprachig, Maerz 2025); Echtzeit-Questionnaire-/Data-Validation (Okt 2025); NLP-Modern-Slavery-Detection; Predictive Compliance-Breach-Analytics; Anomaly Detection in ESG-Disclosures; Intelligent Automation Stack (AI + RPA + OCR); AI-Emissionsberechnung (IEA/Defra); Enterprise-grade Foundation Models (LLM) mit RAG-style per-Lieferant-Vector-DB; Sentiment-Analyse; Questionnaire-Pre-Population.

**Datenquellen.** Proprietaere 30-Jahres-Lieferantendatenbank (200.000+ Lieferanten, 140+ Laender); prequalifiziertes Buyer-Supplier-Netzwerk (800+ Buyer, ~500.000 Lieferanten, inkl. Maritime/Energy/Nordic); physische On-Site-Audits, Dokumentenpruefung, Worker-Interviews (verifizierte Primaerdaten); Lieferanten-Questionnaires/Dokumente; oeffentliche Daten (no-touch Scoring); GHG-Emissionsfaktoren (IEA/Defra); Green-Project-Technologies-Scope-3-Primaerdaten; ERP-/Drittsystem-Integrationen.

**Regulatorische Abdeckung.** LkSG, CSDDD, CSRD, ESRS, IFRS/IFRS S2, GRI, EU-Forced-Labour-Regulation (editorial/advisory), Modern Slavery Act (+Canada Bill S-211), BRSR Core (Indien), Norwegisches Transparenzgesetz, UAE Federal Decree-Law No. 11, SBTi/CDP/TCFD.

**Staerken.** Verifizierte, auditierte Primaerdaten (physische Audits, Worker-Interviews) - defensiv vs. Scraping-Only; massives zweiseitiges Netzwerk (800+ Buyer, 200.000+ Lieferanten, 140+ Laender), tief in Energie/Mining/Infrastruktur; 30+ Jahre proprietaere Daten; breite Suite (Prequalification, Audits, ESG, Carbon, Contractor-Access, Reporting); aggressive AI-Roadmap via Bridgepoint und vier Akquisitionen (GoSupply 2024, GRMS 2025, InfoControl 2025, Green Project 2025); Enterprise-Security (ISO 27001, SOC 2, EU-Hosting, GDPR); no-touch Predictive Scoring fuer Long-Tail.

**Schwaechen.** AI per Akquisition "aufgepfropft" statt AI-native, ueber Produkte fragmentiert und inkonsistent beschrieben; Reputationsproblem bei Lieferanten (Pay-to-be-verified, ~1.000 GBP/Jahr fuer SMEs, "Middle-Man"); schlechte Usability-/Support-Reputation ("technically flawed", steile Lernkurve, "painfully slow portals"); aggressive Sales-Taktiken; keine oeffentliche, strukturierte Risikotypen-Taxonomie vergleichbar mit 16-Risikotypen/Index-Schwellen; kein EEIO/EEIO-MRIO oder Multi-Stage-Modeling, Country-of-Origin-Gap-Closure schwaecher; duenne UFLPA/EUDR/CBAM-Tools (meist editorial, kein FLETF/XUAR-Engine); vage Datenquellen ("publicly available data") ohne Index-Katalog; umstaendliche Customization/Implementierung.

**Entwicklungen 2025/2026.** Feb 2025: Achilles Analytics; Maerz 2025: AI-Dokumentenvalidierung (95 %+); 14. April 2025: InfoControl-Akquisition; 20. Mai 2025: Green-Project-Partnerschaft (Scope 3); Aug 2025: Swire Shipping; 3. Sept 2025: AchillesAI Predictive Scoring; Okt 2025: Echtzeit-Questionnaire-Validation; 2025: GRMS-Akquisition (Nordamerika); 2025: Comply360-Launch; 2025: Business-Disruption-Alerts +33 % YoY (~44.000 -> ~59.000).

**Pricing.** Nicht im Detail offengelegt. Subscription mit Tiers; via Direktvertrieb und Reseller (SoftwareOne). Lieferanten zahlen Akkreditierungs-/Verifizierungsgebuehren (~1.000 GBP/Jahr fuer SMEs) plus optionale Enhancements. Enterprise-Buyer-Pricing quote-basiert.

---

### 2.7 Sphera

**Positionierung.** "The Operational Intelligence Platform" - vereint Operational Risk, EHS&S (Environment, Health, Safety & Sustainability), Product Stewardship/LCA und Supply-Chain-Risk/Transparency auf einer Enterprise-Plattform (SpheraCloud) plus proprietaere Daten und Consulting. Breiter, reifer EHS/ESG/Operational-Risk-Incumbent (30+ Jahre, ~8.000-8.500 Kunden, 1 Mio.+ User, ~100 Laender), Blackstone-Eigentum (Akquisition von Genstar fuer 1,4 Mrd. USD, 2023). Supply-Chain-Risk via riskmethods (2022), Sustainability via SupplyShift (Okt 2024 integriert). Ab 1. Dez 2025 Cross-Product-Layer "Sphera AI". Relativ zu einem fokussierten LkSG/CSDDD-Tool ist Sphera eine horizontale Operational-Risk/EHS-Suite, in der Due Diligence nur eine Faehigkeit unter vielen ist.

**Zielkunden.** Grosse globale Unternehmen in asset-heavy/regulierten Branchen: Chemie & Life Sciences, Industrials & Manufacturing, Oil & Gas, Consumer Goods/Services & Tech, Financial Services, Gefahrstoff-Handler. Kunden: NASA, BP, Dow, Kinder Morgan, Siemens, Evonik. Personas: EHS-Manager, Process-Safety-/Operational-Risk-Leads, Sustainability-Manager, Product Stewards, Procurement/CPOs.

**Module.** SpheraCloud (Plattform); Sphera AI (Intelligence-Layer, Dez 2025); EHS&S; Operational Risk Management (Bow-Tie, Konsequenz-Modeling, Live-Risk-Matrizen); Process Safety Management & Control of Work (Permit-to-Work, JHA, FMEA-Pro); Product Stewardship - LCA (LCA FE, ehemals GaBi; Managed LCA Content ~20.000 Datensaetze); Product Stewardship - Chemical Management & Compliance (SDS, Hazmat); Supply Chain Risk Management / Supplier 360 (ehemals riskmethods; Risk Radar, Impact Analyzer, Action Planner, N-Tier Intelligence); Supply Chain Sustainability / Supplier Engagement (ehemals SupplyShift; 20+ Assessments, SupplyScreen, Supplier-PCF-Calculator); Regulatory Compliance Assessments (Human Rights, Human Trafficking, Biodiversity, CBAM, CTPAT, PPWR); Sustainability Consulting.

**AI-Features.** Sphera AI (agentic AI, Dez 2025; analysiert Informationen und ergreift proaktive, kontextbewusste Aktionen; auf 500.000+ Emissionsfaktoren und ~20.000 LCA-Datensaetzen); Supplier 360 Intelligence (fine-tuned generative AI Risk-Summaries, Okt 2025, "60-Sekunden-Supplier-Check" aus ~400 Indikatoren); Risk Radar AI Media-Monitoring (Millionen Quellen, 99,98 % Relevanz-Claim, human-in-the-loop-Vetting); Predictive EHS Incident Prevention; Automated LCA / PCF-Generierung (TUV-zertifiziert, mit Evonik, bis 10x schneller).

**Datenquellen.** 500.000+ proprietaere Emissionsfaktoren; ~20.000 jaehrlich aktualisierte, drittpartei-verifizierte LCA-Datensaetze (Managed LCA Content); 100+ bis ~400 Supplier-Risk-Indikatoren (riskmethods); unstrukturierte Daten (Millionen Medienquellen); strukturierte Daten von Regulatory/Commercial/Specialty-Providern (Financial, Natural-Hazard, Cyber, Geopolitical); ERP/Supplier-Management-Integration; Supplier-Assessments (20+); menschliche Risk-Research-Experten; Verite-Content (Human Trafficking); Accountability-Framework-Guidance (Deforestation); EUDR-Plot-Level-Daten.

**Regulatorische Abdeckung.** LkSG (Human Rights Compliance Assessment), CSDDD, CSRD/ESRS (modular, Double Materiality, E1), EUDR (Geo/Plot-Level), CBAM, UFLPA (referenziert), UK Modern Slavery Act, Scope 3/GHG Protocol, PPWR, EU Taxonomy, CTPAT, adjazent: ESPR, Construction Products Regulation, Batteries Regulation, US Buy Clean.

**Staerken.** Sehr breite, integrierte Suite ueber Operational Risk, EHS, Process Safety, LCA und Supply Chain auf einer Plattform; tiefer proprietaerer Daten-Moat (500K+ Emissionsfaktoren, ~20K verifizierte LCA-Datensaetze, GaBi-Erbe - eines der autoritativsten LCA-/Emissions-Assets); reife, vertrauenswuerdige Enterprise-Marke (NASA, BP, Dow, Siemens, Blackstone-backed); starke Supply-Chain-Risk-Pedigree (riskmethods + SupplyShift); human-in-the-loop-Validierung der AI-Alerts; konkrete AI-Proof-Points (Supplier 360 Okt 2025, Sphera AI Dez 2025, TUV-zertifizierte LCA Sept 2025); proprietaere Jahresforschung (2026 Supply Chain Risk Report, 800 CPOs); starke Analyst/Peer-Ratings.

**Schwaechen.** Lieferketten-Due-Diligence ist NICHT das Kernprodukt - nur eine Faehigkeit in einer weitlaeufigen EHS/Operational-Risk-Suite, daher LkSG/CSDDD-spezifische Tiefe und Country-Sector-Granularitaet duenner als bei einem Purpose-Built-Tool; starke Abhaengigkeit von zusammengestueckelten Akquisitionen (riskmethods + SupplyShift, erst Okt 2024 vereint - Integrationsfriktion, ueberlappende/umbenannte Module); kein EEIO/MRIO-Spend-Attribution oder transparente Country-of-Origin-Gap-Closure; keine transparente Index-/Schwellen-Methodik oder Confidence-Framework (opakes "weighted risk scoring", 99,98-%-Claims = Marketing); UFLPA generisch (kein XUAR-Nexus/FLETF/Entity-List-Overlay); AI neu gebrandet (Dez 2025), wenig technisches Detail; Implementierungskomplexitaet, Trainingsbedarf, UI-Lag; Generalist-Positionierung nicht auf deutschen Mittelstand/Retail-LkSG-Buyer (ALDI-Typ) optimiert; begrenzte Per-Risikotyp-Granularitaet (breite Kategorien statt 16-Risikotypen-Taxonomie).

**Entwicklungen 2025/2026.** 1. Dez 2025: Sphera AI (agentic + generativer Intelligence-Layer); 9. Okt 2025: Supplier 360 Intelligence (60-Sekunden-Check); 10. Sept 2025: TUV-zertifizierte automatisierte LCA mit Evonik (10x schneller, 1.000+ Produkte); 22. Jan 2026: 2026 Supply Chain Risk Report (800 CPOs, "confidence paradox": 98-100 % Vertrauen, 73 % Disruptionsverluste); Kontext 17. Okt 2024: riskmethods + SupplyShift zu einer Supply-Chain-Transparency-Solution integriert (CSDDD/LkSG/CBAM/EUDR).

**Pricing.** Nicht offengelegt. Sphera publiziert keine Preise; Verkauf via Enterprise-Quote/Demo (sales-led), Custom-Contracts. LCA for Experts bietet 45-Tage-Trial als einzigen sichtbaren kommerziellen Einstieg.

---

### 2.8 Interos (interos.ai)

**Positionierung.** AI-getriebene Supply-Chain-Risk- und Operational-Resilience-Plattform, "Resilient by Design" - automatisiertes Supply-Chain-Mapping und kontinuierliches Risk-Monitoring at scale. Kernpitch: Unternehmen sehen nur ~2 % ihrer Lieferketten (~98 % exponiert; ~2,5 Bio. USD Jahresverluste zitiert), daher AI fuer Multi-Tier-Mapping und kontinuierliches Scoring via proprietaerem i-Score. Gegruendet 2005 (Jennifer Bisceglie; Ted Krantz CEO seit April 2024). Unicorn ($1B), ~224 Mio. USD raised. Stark auf US-Federal-Government und Fortune 1000 ausgerichtet, mit Schwerpunkt Cyber, Geopolitik, Financial und Sanctions/Restrictions - nicht primaer ESG/Menschenrechte.

**Zielkunden.** Fortune 1000 / Global 500 und US-Bundesbehoerden (DoD, NASA, US Navy, GSA SCRIPTS BPA via Carahsoft, AWS Marketplace). Kunden: L3Harris, Freddie Mac, Accenture, Mastercard, Singapurs DSTA. Personas: Procurement/Supply-Chain, Risk-Executives, Compliance Officers, zunehmend C-Suite/CFO (iQ). Best Fit: grosse Orgs mit sehr grossen Lieferantenbasen (~1.700+). Branchen: Financial Services, Aerospace & Defense, Airlines, Federal, Energy & Utilities, Retail, Tech.

**Module.** Resilience Watchtower (Flagship Continuous Monitoring); iQ (2. Generation, 28. April 2026; "erste vollproduktisierte Predictive-Analytics-Plattform", ERP-Orchestrierung + Knowledge-Graph, Dollar-Exposure, Alternativlieferanten-Empfehlung; Module i_tariffs, i_tracing, i_reputation); i_tracing (Produkt/SKU-Level-Visibility, BoM, Lineage-/Provenance-Reports); i_reputation (Reputationsrisiko via Dataminr, ~20-Min-Refresh); i_tariffs (Tarif-Mapping + Dollar-Impact); i-Score (AI-Composite ueber mehrere Faktoren); Procurement Risk Management; Cyber Resilience; Compliance Risk Management (Sanctions, UFLPA, Section 889); Operational Resilience; Catastrophic Risk Visibility; Continuous Risk Management; Supply Chain Mapping; TPRM; Relationship Context.

**AI-Features.** Interos Knowledge Graph (ML+NLP, 230-400 Mio.+ Unternehmen, ~11 Mrd. Beziehungen - "groesste B2B-Beziehungsdatenbank"); i-Score AI-Risk-Scoring (sechs Faktoren: Finance, Cyber, ESG, Geopolitical, Catastrophic, Restrictions); Predictive Analytics (iQ); AI-Financial-Exposure-Quantifizierung (ERP-Match zu Dollar-Exposure); AI-Alternativlieferanten-Empfehlung; NLP-Adverse-Media/Reputational (Dataminr, ~20-Min); Automated Supply-Chain-Mapping; ERP-Orchestrierung mit AI-Recommendations.

**Datenquellen.** Proprietaerer Knowledge Graph (230-400 Mio.+ Unternehmen, ~11 Mrd. Beziehungen); tausende proprietaere Datenpunkte (i-Score); Dataminr (Echtzeit-Event/News/Social, ~20-Min); ESG Book (erweitertes ESG-Datenmodell: Scope 1/2/3, Forced-Labor/Human-Rights-Policies); Government/Sanctions/Prohibited-Party-Listen (UFLPA Entity List, Section 889, OFAC, FLETF); Kunden-ERP-Daten (iQ); Corporate-Ownership-/Government-Ties-Daten.

**Regulatorische Abdeckung.** UFLPA (Entity List + XUAR-Nexus, in Restrictions/ESG integriert), Section 889 (NDAA), CSDDD, LkSG, CSRD, EUDR (referenziert via Lineage-Reporting), EU-Forced-Labour-Regulation (referenziert), California SB 253, SEC Climate, DORA, GSCA.

**Staerken.** Massiver Multi-Tier-Knowledge-Graph (230-400 Mio.+ Entitaeten, ~11 Mrd. Beziehungen) - tiefe Sub-Tier-/Hidden-Relationship-Discovery, schwer replizierbarer Daten-Moat; Echtzeit, kontinuierlich, automatisiert at scale vs. Point-in-Time; breites Multi-Domain-Risk in einem i-Score (stark bei Cyber und Geopolitik/Sanctions); tiefe US-Federal/Defense-Glaubwuerdigkeit und -Vertriebskanaele; 2025/26 Produktmomentum (i_tracing SKU/BoM, iQ Predictive, ERP-Integration, Dollar-Exposure, Alternativlieferanten); Dataminr-Reputational-Intelligence; Unicorn-Finanzierung und etablierte Marke/Analyst-Praesenz.

**Schwaechen.** ESG/Menschenrechte ist nur einer von sechs Faktoren und historisch via Partner (ESG Book) - KEINE Purpose-Built-LkSG/CSDDD-Methodik, schwacher Fit fuer ein granulares 16-Risikotypen-Modell; kein Beleg fuer EEIO/MRIO oder FAOSTAT/Comtrade-Country-Sector-Attribution (Modell entitaets-/beziehungs-graph-zentrisch, kein Commodity/Country-of-Origin-Flow-Modeling ueber Stufen); regulatorische Abdeckung in Blogs erwaehnt, aber nicht als Compliance-by-Framework-Workflows produktisiert (EUDR/CBAM/CSRD-ESRS keine First-Class-Module); kein transparentes Confidence-/Unsicherheits-Framework, i-Score ist Blackbox; stark US/Federal- und Cyber/Geopolitik-zentriert (weniger auf EU-Mittelstand/Retail mit LkSG/CSDDD-Deliverables getunt); opakes/Custom-Pricing, enterprise-only; iQ-Predictive nur in Limited Release; begrenzte Hinweise auf generative/agentic LLM-Features (AI = ML/NLP/Predictive; kein klar beworbener LLM-Copilot/agentic Workflow/Dokument-Auto-Generierung - Luecke fuer ein AI-first-Tool).

**Entwicklungen 2025/2026.** 28. April 2026: iQ-Launch (2. Generation, Predictive, ERP-Integration, Dollar-Exposure, Alternativlieferanten; Module i_tariffs/i_tracing/i_reputation, Limited Release); Jan 2026: "2026 Predictions Report"; Okt 2025: i_tracing-Launch (Risk Intelligence Summit, SKU/Produkt-Level, Revenue-at-Risk, Lineage; "Relationship Context"); 2025: Dataminr-Partnerschaft erweitert; April 2025: GSA SCRIPTS BPA via Carahsoft; Okt 2024: 40-Mio.-USD-PE-Runde (Blue Owl); April 2024: Ted Krantz CEO.

**Pricing.** Nicht oeffentlich - Custom/Enterprise-SaaS-Subscription. AWS Marketplace listet Contract-Duration/Terms-basiert (Private Offer); via GSA SCRIPTS BPA fuer Federal. Keine Per-Seat-/Tier-Listenpreise; effektiv quote-basiert fuer Fortune 1000 und Government.

---

## 3. Feature-Vergleichsmatrix

Legende: **Ja** = klar vorhanden/beworben; **Teilweise** = vorhanden, aber eingeschraenkt, generisch, Roadmap, per Partner oder nicht Kernfokus; **Nein** = nicht vorhanden/nicht beworben.

| Capability | Prewave | IntegrityNext | EcoVadis | osapiens | Sedex | Achilles | Sphera | Interos |
|---|---|---|---|---|---|---|---|---|
| **n-Tier-/Multi-Tier-Mapping** | Ja (Tier-N top-down+bottom-up, "questionnaire-free", 500k+ Tier-N) | Ja (AI-Mapping aus Produktname; "long tail" bleibt) | Teilweise (contactless IQ Plus; schwach bei echtem Sub-Tier/Rohstoff) | Teilweise (custom Maps, fragebogengetrieben) | Teilweise (Site-fokussiert; schwache Upstream-Visibility) | Teilweise (Netzwerk-/Prequalification, kein tiefes MRIO-Mapping) | Ja (N-Tier Intelligence aus riskmethods) | Ja (Knowledge Graph, ~11 Mrd. Beziehungen - staerkstes Sub-Tier) |
| **Adverse-Media-AI / Echtzeit-Signale** | Ja (proprietaer, 400+ Sprachen, 4,5 Mio./Tag) | Ja (Echtzeit-Signal/Sentiment, Mio. Quellen) | Ja (Live News Monitoring, 400k+ Quellen, 8 Sprachen) | Ja (AI-curated Adverse Media + Sanctions) | Nein (keine AI; nur jaehrl. Drittindices) | Teilweise (NLP/Sentiment, Disruption-Alerts) | Ja (Risk Radar, 99,98%-Claim, human-vetted) | Ja (i_reputation via Dataminr, ~20-Min-Refresh) |
| **ESG-Ratings / Scorecards** | Teilweise (360 Score, ESG-Scoring) | Teilweise (Self-Assessment-basierte Scores) | Ja (Flagship-Standard, 0-100, 4 Themen/21 Kriterien, analystenvalidiert) | Teilweise (Supplier-Scores) | Teilweise (1-10 Risk-Scores, audit-zentriert) | Ja (Sustainability Score, Predictive Scoring) | Teilweise (Supplier 360, Assessments) | Teilweise (ESG als 1 von 6 i-Score-Faktoren, via ESG Book) |
| **LkSG** | Ja (inkl. BAFA-Reporting) | Ja (Kernfokus) | Ja (eigenes Dashboard) | Ja (BAFA-konform out of the box) | Ja | Ja | Ja (Human Rights Compliance Assessment) | Teilweise (erwaehnt, nicht als Workflow produktisiert) |
| **CSDDD / CS3D** | Ja | Ja | Ja (Value-Chain-Solution, Rechtsgutachten) | Ja | Ja | Ja | Ja | Teilweise (erwaehnt) |
| **CSRD / ESRS** | Ja (AI-generierte Reports) | Ja | Ja (alle topical standards) | Ja (Double Materiality) | Teilweise (GRI-Partner, eigene Loesung geplant) | Ja (Comply360, bis 94% Auto-Fill) | Ja (modular, E1) | Teilweise (erwaehnt) |
| **EUDR** | Ja (Satellit via Satelligence + TRACES) | Ja (eigenes Modul) | Ja (eigene Seite) | Ja (Satellit/Geolocation + AI, 700+ Partnernetz) | Nein (nicht klar abgedeckt) | Teilweise (editorial/advisory) | Teilweise (Plot-Level-Daten) | Teilweise (via Lineage-Reporting) |
| **CBAM** | Ja (Carbon 360) | Ja (Carbon Navigator) | Ja (eigene Seite) | Ja (eigenes Modul) | Nein | Teilweise (Carbon Estimator) | Ja (CBAM Solution) | Nein |
| **UFLPA-Overlay (FLETF/XUAR/Entity List)** | Teilweise (im Forced-Labour-Modul, generisch) | Teilweise (UFLPA genannt) | Teilweise (eigene Seite, kein Overlay-Logikdetail) | Nein (nicht beworben) | Teilweise (UFLPA genannt) | Teilweise (editorial, kein FLETF/XUAR-Engine) | Teilweise (generisch, kein XUAR/Entity-List-Overlay) | Ja (Entity List + XUAR-Nexus + Section 889 produktisiert) |
| **On-Site-Audits / SAQ** | Teilweise (Audits via TUV SUD-Partner; Self-Assessments) | Ja (SAQ-Kern; keine eigenen On-Site-Audits) | Ja (Vitals-SAQ; Ratings analystenvalidiert, keine eigenen On-Site) | Ja (SAQ, Audit Management) | Ja (SMETA On-Site-Audit = Kern-Moat + SAQ) | Ja (physische On-Site-Audits + Worker-Interviews) | Teilweise (20+ Assessments; keine eigenen On-Site) | Nein |
| **Klimarisiko (physisch/Transition, GHG/Scope 3)** | Teilweise (Carbon 360, Scope 3 lieferantengemeldet) | Teilweise (Scope 3, SBTi) | Ja (Carbon Action Manager, CDN, PCF) | Ja (CCF, PCF, XDC 1,5C-Szenario) | Nein | Teilweise (Scope 1/2/3, TCFD) | Ja (LCA-Daten-Moat, 500k+ Emissionsfaktoren) | Teilweise (ESG-Faktor; Catastrophic Risk; kein LCA) |
| **Sanctions-/Watchlist-Screening** | Teilweise (via Coface/Risk-Feeds) | Teilweise (Signal-Monitoring) | Ja (360 Watch, Sanctions Checks) | Ja (kontinuierliches Sanctions-Scanning) | Nein | Teilweise (Cyber/Compliance) | Ja (Compliance/strukturierte Feeds) | Ja (Compliance Risk, OFAC/Section 889/UFLPA) |
| **Reporting / Export** | Ja (One-Click, BAFA/CSRD/CBAM/EUDR) | Ja (CSRD-/Framework-Reporting) | Ja (Compliance-Dashboards, Scorecards) | Ja (Reporting Cockpit, XBRL) | Teilweise (Reviews bemaengeln Reporting/Export) | Ja (Comply360, Analytics-Dashboards) | Ja (modulares ESRS-Reporting) | Ja (Lineage-/Provenance-Reports, Dashboards) |
| **Lieferantenportal / Engagement** | Ja (Action Platform, Worker Surveys, Onboarding) | Ja (kostenlose teilbare Profile, Netzwerk) | Ja (zweiseitiges Netzwerk, Academy, Worker Voice) | Ja (SRM, Complaint Management) | Ja (Member-Netzwerk, Directory, e-Learning) | Ja (Buyer-Supplier-Netzwerk, Controlar) | Ja (Supplier Engagement / SupplyShift) | Teilweise (TPRM; weniger Engagement-fokussiert) |
| **API / ERP-Integration** | Ja (SAP Business Network, o9, JAGGAER, SRM/ERP) | Ja (Ariba, Coupa, Ivalua, Celonis, REST) | Ja (Ivalua u. a.) | Ja (SAP-nativer Connector, REST, Bulk) | Ja (SAP, Oracle, Ariba, Coupa) | Ja (ERP, Comply360) | Ja (ERP/Supplier-Management) | Ja (ERP-Orchestrierung in iQ, AWS/GSA) |
| **Generativer/agentic AI-Copilot** | Nein (kein beworbener LLM-Copilot Mitte 2026) | Teilweise (XMINDS Risk Agents, ueberw. Roadmap) | Ja (GenAI-Assistant + Gemini Enterprise agentic 2026) | Teilweise (Lucent AI agentic, Module erst Q2 2026) | Nein | Teilweise (Foundation Models/RAG in Comply360) | Teilweise (Sphera AI agentic, Dez 2025, wenig Detail) | Teilweise (AI=ML/NLP/Predictive; kein klarer LLM-Copilot) |
| **EEIO/MRIO-Spend-Attribution (EXIOBASE-Stil)** | Nein | Nein | Nein | Nein | Nein | Nein | Nein (LCA-Daten, aber kein MRIO-Supply-Share-Modell) | Nein |
| **Transparente Index-/Schwellen-Methodik + Confidence-Framework** | Nein (Marketing-Scoring) | Nein | Teilweise (analystenvalidiert/evidenzbasiert, aber kein Index-Schwellen-/Confidence-Framework) | Nein (source-linked, aber keine Indices/Severity) | Teilweise (1-10-Skala dokumentiert, aber regelbasiert, keine Confidence) | Nein | Nein (opakes "weighted scoring") | Nein (i-Score Blackbox) |
| **CSDDD-Art.-6-Severity (Scale/Scope/Irremediability x Likelihood)** | Nein | Nein | Nein | Nein | Nein | Nein | Nein | Nein |
| **Drittvalidierung (Analyst/Studie)** | Ja (Gartner-Leader 2025+2026, Forrester, Hackett) | Teilweise (Gartner Market Guide, Verdantix-ROI) | Ja (Standard, Rechtsgutachten, Gartner) | Teilweise (Funding-Validierung, wenig Analyst) | Teilweise (GRI-Partner, SSCI-Benchmark) | Teilweise (Gartner-Reviews, gemischt) | Ja (Gartner Peer Insights ~4,5, eigene Studie) | Ja (Gartner TPRM Market Guide, Federal-Accreditierung) |

---

## 4. "Best-of"-Synthese: das uebernahmenswerteste Feature je Tool

- **Prewave - proprietaere multilinguale Adverse-Media-Engine (400+ Sprachen, 4,5 Mio. Datenpunkte/Tag).** Die echte, verteidigbare AI-Tiefe der Kategorie. Lehre: Echtzeit-Event-Detection in vielen Sprachen mit hoher Scale ist ein Muss - aber wir muessen das Praezisions-/Rausch-Problem (Alert-Overload) loesen, das Prewave-Nutzer bemaengeln.
- **IntegrityNext - AI Screening oeffentlicher Lieferanten-Webinhalte mit Evidenz-Klassifikation (strong/partial/none + Quellenzitate).** Schliesst die Non-Responder-Luecke in Minuten und liefert quellenverlinkte Evidenz. Lehre: jede AI-Aussage muss mit zitierter Quelle und Konfidenzgrad belegt sein - passt direkt zu unserem Confidence-Framework.
- **EcoVadis - "Built with AI, Backed by experts": jedes Rating von 2+ Analysten validiert + zweiseitiges Netzwerk.** Lehre: Human-in-the-Loop-Validierung und wiederverwendbare, geteilte Lieferantenbewertungen schaffen Auditierbarkeit und Lock-in. Wir koennen das als optionalen Verifikations-Layer ueber unserem quantitativen Modell abbilden.
- **osapiens - EUDR mit Satellit/Geolocation + AI-Deforestation auf einer DB, plus transparente Flatrate-Einstiege ("EASY START").** Lehre: geospatiale Plot-Verifikation und ein niedrigschwelliger, transparenter Preis-Einstieg senken die Adoptionshuerde gerade im Mittelstand.
- **Sedex - verifizierte SMETA-On-Site-Sozialaudit-Daten + SMETA 7.0 (Management Systems Assessment, Collaborative Action Required).** Lehre: verifizierte Primaerdaten aus Audits sind ein Trust-Anker, den reine Datenmodelle nicht haben. Als Daten-Input/Validierung in unser Scoring integrierbar (Audit-Ergebnis hebt/senkt Confidence).
- **Achilles - no-touch Predictive Scoring fuer Long-Tail-Lieferanten (Insights in 7 Tagen, ~5pp von Vollassessment) + verifizierte Audits.** Lehre: skalierbares Scoring ohne Lieferanten-Engagement fuer die lange Tail-Coverage, kombiniert mit verifizierten Audits fuer kritische Lieferanten - ein abgestuftes Tiefenmodell.
- **Sphera - autoritativer LCA-/Emissions-Daten-Moat (500K+ Emissionsfaktoren, ~20K verifizierte LCA-Datensaetze) + human-vetted AI-Alerts.** Lehre: ein tiefes, verifiziertes Umwelt-Datenfundament ist die Grundlage glaubwuerdiger ENV-Scores - komplementaer zu unserer EEIO/MRIO-Attribution.
- **Interos - groesster B2B-Knowledge-Graph (~11 Mrd. Beziehungen) + iQ ERP-zu-Dollar-Exposure + Alternativlieferanten-Empfehlung.** Lehre: Risiko in die Sprache des CFO uebersetzen (Spend-/Revenue-at-Risk in Euro) und konkrete Handlungsoptionen (Alternativlieferanten) liefern - nicht nur Scores. Das ist der Sprung von Detection zu Decision.

---

## 5. Luecken & Chancen: wo ein AI-first-Tool mit EXIOBASE-/16-Risikotypen-Methodik gewinnt

Die folgenden Luecken sind aus den Quellen belegt - keine erfundenen Features.

**1. Transparente, quantitative Index-/Schwellen-Methodik (offen bei ALLEN acht).**
Kein Anbieter legt eine dokumentierte, nachvollziehbare 1-5-Bewertung gegen offen gelegte Indices und Schwellenwerte offen. Scoring ist entweder fragebogen-/signalgetrieben (IntegrityNext, osapiens, Sedex) oder eine proprietaere Blackbox (Prewave 360, Sphera "weighted scoring" mit 99,98-%-Claim, Interos i-Score). Selbst EcoVadis (analystenvalidiert) bewertet Managementsysteme/Policies statt realer Wirkung. **Chance:** ein offen dokumentiertes, auditierbares Index-Threshold-Modell ueber 16 Risikotypen (5 ENV + 11 HR) als Vertrauens- und Compliance-Differenzierung.

**2. EEIO/MRIO-Spend-Attribution (EXIOBASE/Leontief) - bei KEINEM vorhanden.**
Keiner modelliert Lieferketten-Anteile pro Country-Sector ueber die drei Stufen (Rohstoffursprung / Verarbeitung / Fertigung) via Leontief-Inverse, mit FAOSTAT/UN-Comtrade-Gap-Closure fuer das Country-of-Origin. Carbon/Scope-3 beruht ueberall auf lieferantengemeldeten Daten (Prewave, IntegrityNext, EcoVadis CDN, osapiens, Achilles); Sphera hat einen LCA-Daten-Moat, aber kein MRIO-Supply-Share-Modell; Interos ist beziehungs-graph-, nicht commodity-flow-zentrisch. **Chance:** eine spend-basierte EEIO-Baseline liefert eine vollstaendige, lueckenlose Risiko-Attribution auch ohne Lieferantenantwort - genau dort, wo Fragebogen-Modelle den "long tail" einraeumen.

**3. UFLPA als echtes Overlay - nur Interos sauber produktisiert.**
FLETF-High-Priority-Sektoren + XUAR-Nexus + Entity List als regelbasiertes Overlay (HIGH = +1 gedeckelt 5, CRITICAL = Override 5) ist branchenweit selten. Bei Prewave/EcoVadis/IntegrityNext/Sedex/Achilles/Sphera ist UFLPA generisch oder editorial; osapiens bewirbt es gar nicht. **Chance:** ein transparentes, regelbasiertes UFLPA-Overlay als integraler Bestandteil des Overall-Scores (max(ENV,HR) + UFLPA-Overlay).

**4. CSDDD-Art.-6-Severity-Modell + Confidence-Framework - bei KEINEM vorhanden.**
Severity entlang Scale/Scope/Irremediability x Likelihood und ein vierstufiges Confidence-Framework (VERY HIGH/HIGH/MEDIUM/LOW) mit definierten Validierungsaktionen findet sich bei keinem der acht. Sphera nennt sogar selbst ein "confidence paradox" (98-100 % Vertrauen, 73 % Verluste). **Chance:** explizite Severity- und Unsicherheitsmodellierung macht Priorisierung verteidigbar und schliesst direkt an die Rechtspflichten an.

**5. Nativer generativer/agentic AI-Analyst - branchenweit noch unausgereift.**
Prewave hat Mitte 2026 keinen beworbenen LLM-Copilot; Sedex hat gar keine AI; Interos beschreibt AI als ML/NLP/Predictive ohne LLM-Copilot. Agentic-Ansaetze sind ueberall Roadmap/fruh: IntegrityNext XMINDS-Risk-Agents, osapiens Lucent AI (Module erst Q2 2026), Sphera AI (Dez 2025, wenig Detail), EcoVadis/Gemini (Rollout 2026). **Chance:** ein konsequent AI-native Analyst (auto-generierte, quellenbelegte Due-Diligence-Narrative, konversationelle Abfrage, agentic Workflows ueber dem 16-Risikotypen-Modell) ist ein offenes Feld - genau hier setzt die geplante Architektur (Vercel AI SDK v6 + AI Gateway, Default Claude) an.

**6. Praezision statt Alert-Overload.**
Prewave-Nutzer bemaengeln "zu viel Information"; viele Alerts sind irrelevant. **Chance:** lieferanten-/risikotyp-gemappte, konfidenzgewichtete und priorisierte Alerts (Severity x Likelihood x Confidence) statt undifferenzierter Event-Flut.

**7. Mittelstands-/Retail-Tauglichkeit und transparentes Pricing.**
Alle acht sind enterprise-sales-led mit opakem Pricing; Sphera/Interos sind enterprise/asset-heavy bzw. US/Federal; EcoVadis/Achilles haben SME-Reputationsprobleme (Aufwand, Pay-to-be-verified). Nur osapiens bietet transparente Flatrate-Einstiege. **Chance:** ein auf deutschen Mittelstand/Retail (ALDI-Typ) optimiertes Tool mit transparentem, niedrigschwelligem Einstieg und schnellem Time-to-Value.

**8. Tiefe statt Breite bei Umwelt-Sub-Risiken.**
IntegrityNext/Sedex/Interos haben duenne oder fehlende diskret bewertete Umwelt-Sub-Risiken (Biodiversitaet, physisches Klimarisiko, Ressourcenverbrauch). **Chance:** alle 5 ENV-Risikotypen als eigenstaendig bewertete Dimensionen (GHG, physisches Klima, Biodiversitaet, Ressourcen, Verschmutzung) mit ENV-Composite - kombiniert mit den SUS-Decks (physisches + Transitions-Klimarisiko) als Service-Layer.

**Strategische Quintessenz fuer das Produktteam:** Nicht ueber Breite (osapiens, Sphera) oder Netzwerkgroesse (EcoVadis, IntegrityNext, Sedex) konkurrieren, sondern ueber **methodische Tiefe + Transparenz + AI-Nativitaet**. Die verteidigbare Position ist die Kombination, die kein Wettbewerber hat: EEIO/MRIO-fundierte, quantitativ-transparente 16-Risikotypen-Bewertung mit UFLPA-Overlay und CSDDD-Severity, ausgeliefert ueber einen nativen agentic AI-Analysten mit quellenbelegten Narrativen und priorisierten, konfidenzgewichteten Alerts.

---

## Anhang: Quellen

Quellen je Anbieter sind in den urspruenglichen Recherchedaten (JSON) gelistet und umfassen u. a. die offiziellen Anbieterseiten, Pressemitteilungen 2025/2026, Gartner/G2/Capterra-Reviews, Verdantix/Forrester-Analysen sowie Finanzierungs- und Branchenberichte. Alle Aussagen in diesem Dokument sind aus diesen Quellen abgeleitet; nicht belegte Faehigkeiten sind explizit als Luecke gekennzeichnet.
