# 02 – Risikomethodik (Authoritative Spec)

> **Status:** Verbindliche Methodik-Spezifikation, die unsere Software implementieren MUSS.
> **Grundlage:** Ausschließlich die analysierten Projektdokumente (ALDI LkSG/CSDDD-Lieferketten-Risikobewertung v3 / v3.5 / v3.7.x, EXIOBASE/EEIO-Methodik, UFLPA-Fallstudien v3–v5, Datenquellen-Katalog v4 mit 124 Indizes, BAFA Risikodatenbank Quellenübersicht Stand 20.12.2023, Klimarisikoanalyse-Decks Sustainable AG).
> **Zweck:** Diese Datei definiert die exakte Scoring-Logik, das Datenmodell und die Workflows. Wo Quellen voneinander abweichen (z. B. mehrere dokumentierte Schwellenwert-Bänder), ist dies explizit als Varianten markiert. **Schwellenwerte und Konkordanzen sind als Daten zu speichern, nicht hart zu kodieren.**

---

## 0. Grundprinzipien

- **16 Risikotypen** = 5 ENV (Umwelt) + 11 HR (Menschenrechte), jeweils auf einer **Ganzzahl-Skala 1–5** bewertet.
- Jeder 1–5-Score leitet sich **deterministisch** aus dokumentierten Schwellenwert-Bändern auf benannten, zitierbaren öffentlichen Indizes ab (MAX-/Kombinations-/Direkt-Mapping-Logik je Dimension). Die Software berechnet diese Scores deterministisch; KI-Wert liegt in Datenaufbereitung, Concordance-Mapping, Gap-Closure und Narrativ-Generierung — **nicht** im Raten der Scores.
- **Duale Bewertung pro Zeile:** Vollständiger 16-Dimensionen-Block für **Country of Origin (CoO)** UND ein paralleler Block für **Production Facility Country (PFC)**.
- **Aggregation:** ENV-Composite = Mittelwert der 5 ENV; HR-Composite = Mittelwert der 11 HR; Overall = MAX(ENV, HR); dann **UFLPA-Overlay** (HIGH = +1 gedeckelt auf 5; CRITICAL = Override auf 5).
- **Drei Lieferkettenstufen:** (1) Rohstoffursprung (abgebaut/geerntet/gefördert), (2) Verarbeitungsland, (3) Herstellungsland (höchster Wertschöpfungsanteil).
- **Rechtliche Rückführbarkeit:** Jeder Score muss auf den exakten LkSG-§2-Unterpunkt und/oder CSDDD-Annex-Bezug sowie die zugrunde liegende benannte Quelle (mit Edition/Jahr) zurückführbar sein (BAFA-Defensibilität).

---

## 1. End-to-End Risikomanagement-Workflow

Der vollständige Ablauf von der Produkt-/Lieferanten-Erfassung bis zum Salient-Risk-Register und den Maßnahmenempfehlungen:

1. **Intake / Produkt- & Komponentenerfassung.** Erfasse pro Produkt: Typ (Merchandise / GNFR / Service), Retailer-Taxonomie (Category / Commodity Group / Sub-Commodity Group mit Codes, z. B. „03-90-01 - Cereals"), Sourcing Office, Retailer Market, Production Facility Country (PFC), PF-Typ (Main PF / Grower), Resource Type, Resource Sub-Type, Country of Origin (Original), Max. Resource in product (%), RCV Tonnage, RCV Cost (EUR), Max. Net Weight (kg). Hinweis: Komponenten-Prozentsätze summieren sich pro Produkt **nicht zwingend auf 100 %** (nur priorisierte Rohstoffe).
2. **EXIOBASE-Concordance-Mapping.** Mappe jede Retailer-Commodity auf eine EXIOBASE-Produktgruppe + Code (z. B. Cocoa→p01.h „Crops nec"; Nüsse→p01.d; Sugar→p01.f; Cotton→p01.g→p04.a Textiles; Polyester→p07.a→p04.b; PVC→p07.a→p08.a; Registers/Kassen→p14.a; Eggs→p01.m; Milk→p01.n).
3. **CoO-Plausibilitätsprüfung & Gap-Closure (3-Schritt).** (a) Plausibilitätscheck: Kann das Land den Rohstoff physisch produzieren (Klima/Anbaukapazität)? (b) EXIOBASE-A-Matrix-Upstream-Koeffizienten gegen FAOSTAT bilaterale Handelsmatrizen + UN Comtrade + Branchen-Intelligence validieren. (c) Korrigierte CoO mit Confidence-Rating ableiten → ergibt **probabilistische CoO-Verteilung**, keine Punktschätzung (z. B. Bangladesh-Textil: ~45–50 % China, ~20–25 % Indien, ~10 % USA, ~15–20 % domestic). Klassifiziere `Data Gap Type` (Enum siehe §6).
4. **Stufe-1-Bewertung (Abstract Country Risk).** Pro Land 16 Risikotypen aus Länderindizes (Sheet „Raw Index Data") gemäß Schwellenwert-Tabellen scoren → Country Risk Scores (Land × Risikotyp).
5. **Stufe-2-Bewertung (Commodity × Country Overlay).** Wende Commodity-spezifische Overrides **nur auf CoO/Rohstoffstufe** an (EXIOBASE-Multiplikatoren, FAOSTAT-Intensität, WFN, Trase, TVPRA-Flags, Sector-Pollution/Water-Adjustment).
6. **Duale Score-Berechnung (CoO + PFC).** Score CoO-Block (mit Commodity-Overlay) und PFC-Block. **PFC nutzt nur Länderindizes** (kein Commodity-Overlay), außer wenn PFC == CoO. Ausnahme: UFLPA-Sektor + China-PFC → Forced Labor = 5.
7. **Composite & Overall.** ENV-Composite (Mittelwert 5), HR-Composite (Mittelwert 11) je Block; Overall CoO = MAX(ENV, HR), Overall PFC analog; Overall Risk = MAX(Overall CoO, Overall PFC).
8. **UFLPA-Overlay.** Klassifiziere CRITICAL / HIGH / NOT APPLICABLE (siehe §4) und wende Elevation/Override an.
9. **CSDDD-Bewertung.** Berechne Severity (Scale/Scope/Irremediability) + Likelihood (siehe §5).
10. **Klassifikation & Flags.** Risk-Label-Band setzen, Salient-Flag (>= 3.5 → YES; UFLPA-WATCH → ELEVATED), Max-ENV/Max-HR-Score und „Key Risk Dimensions" (alle Dims >= 4 mit Ort + Score) ausweisen — gegen Mittelwert-Verwässerung.
11. **Confidence-Klassifikation.** 4-Level-Framework anwenden (VERY HIGH / HIGH / MEDIUM / LOW) + Validierungsaktionen + SLA generieren (siehe §5.3).
12. **Verifikations-/Audit-Lauf.** Jeden Score aus Rohindex + Schwellenregel neu ableiten und Konsistenz prüfen (ENV = Mittelwert 5, HR = Mittelwert 11, Overall = Aggregations- + UFLPA-Logik). Label-vs-Score-Mismatches, stale Cross-Sheet-Werte, Duplikate erkennen (Lehre v3.7.1: abgeleitete Duplikat-Tabs wurden entfernt → Single Source of Truth).
13. **Salient-Risk-Register & Maßnahmen.** Produkte nach Overall Risk ranken; pro Eintrag ENV-Risiken/HR-Risiken-Textliste, empfohlene Maßnahmen (zeitgebunden IMMEDIATE/30/60/90 Tage je UFLPA-Tier), Monitoring-Indikatoren, Regulatory Scope (CSDDD Art.7/8, LkSG §2, UFLPA Sec.3, CSRD ESRS) zusammenstellen.
14. **Aggregation & Reporting.** Marktspezifische und gruppenweite Aggregation, Commodity-Heatmaps (16 Dimensionen), Country/Sector-Hotspot-Identifikation (high share × high risk, inkl. versteckter Tier-3-Hotspots wie China/Chemicals bei nur 2,8 % Anteil aber höchster Pollution-Intensität).
15. **Continuous Monitoring.** Quellen-Cadence überwachen (Entity List monatlich, DOL TVPRA jährlich/biennial, Indizes jährlich, GFW-Alerts wöchentlich); bei score-ändernden Updates re-scoren (L5-Recalculation auf jeder Layer-Änderung).

---

## 2. Die 16 Risikotypen: Indizes & 1–5 Schwellenwert-Logik

> **Aggregationstypen:** MAX-of-Subscores (GHG, Biodiversity, Resource, Pollution) · OR-/Kombinations-Logik (Climate, Discrimination, Working & Living, Indigenous) · Direkt-Mapping (FoA, Security, Unethical, Wages, Safety, Fundamental HR) · Override-Logik (Child Labor, Forced Labor).
> Wo Quellen abweichende Bänder dokumentieren, sind beide als **Variante A / B** notiert; Software speichert Bänder als editierbare Daten (Retailer-Market-spaltenfähig, z. B. UK Modern Slavery Act strenger als LkSG §2).

### 2.1 ENV — Umwelt (5)

**(1) GHG Emissions** — `MAX(EPI, EXIOBASE, FAOSTAT)`
- EPI (Yale): >=65→1; 50–64→2; 35–49→3; 25–34→4; <25→5.
- EXIOBASE GHG (tCO2eq/Mio EUR), Var. A: 800–1499→2; 1500–2499→3; 2500–3999→4; >=4000→5. Var. B: <500→1; 500–1500→2; 1500–3000→3; 3000–5000→4; >5000→5.
- FAOSTAT (kgCO2/kg): 2–4.9→3; 5–9.9→4; >=10→5.

**(2) Physical Climate Risk** — `MAX(ND-GAIN_sector, INFORM)`, OR-Logik, höheren Wert nehmen
- Score 5: NDG>0.6 OR INFORM>6; Score 4: NDG>0.5 OR INFORM>5 (bzw. NDG 0.50–0.60 OR INFORM 5–6); Score 3: NDG>0.4 OR INFORM>4 (NDG 0.35–0.50 OR INFORM 4–5); Score 2: NDG>0.3 OR INFORM>2.5 (NDG 0.25–0.35 OR INFORM 2.5–4); sonst Score 1 (NDG<=0.25 AND INFORM<=2.5).
- Sektor-NDG: Agrar nutzt MAX(Food, Water) Sub-Index; Industrie MAX(Ecosystem, Aggregate). Alt. ND-GAIN-Food-only: <0.3→1; 0.3–0.45→2; 0.45–0.6→3; 0.6–0.75→4; >0.75→5. (Reine Länder-Dimension, keine Commodity-Overrides.)

**(3) Biodiversity Loss** — `MAX(BII, Land Use, Trase)`
- NHM BII (Intaktheit %), Var. A: >=80→1; 65–79→2; 55–64→3; 40–54→4; <40→5. Var. B (Band-Variante): 80/65/50/35.
- EXIOBASE Land (km²/Mio EUR): 2–3.9→2; 4–6.9→3; 7–9.9→4; >=10→5.
- Trase Deforestation (0–1): <0.2→1; 0.2–0.39→3; 0.4–0.69→4; >=0.7→5. **Trase nur wenn Trase Coverage = YES** (nur ~5–10 Commodities: Soja, Palmöl, Rind, Kakao, Kaffee, Holz; z. B. Cocoa/CIV — NICHT Indien/Baumwolle). Sonst Ersatz GFW Tree-Cover-Loss; Platzhalter 0.1 → Score 1, nie bindend in MAX().
- Elevation +1, wenn EUDR-regulierte Commodity mit dokumentierter Entwaldungsverbindung.

**(4) Resource Consumption** — `MAX(Aqueduct, WFN)` + Sector-Water-Adjustment (kann nicht unter MAX reduzieren)
- WRI Aqueduct (0–5 Stress): <=1→1; 1–2→2; 2–3→3; 3–4→4; >4→5.
- WFN Water Footprint (m³/Tonne): 2000–4999→2; 5000–9999→3; 10000–14999→4; >=15000→5.

**(5) Pollution** — `MAX(EPI, Sector Pollution Adj)`
- EPI (Yale), Var. A wie GHG (>=65→1 … <25→5); Var. B: >70→1; 50–70→2; 35–50→3; 20–35→4; <20→5.
- Sector Pollution Adj (0–1): 0.3–0.49→3; 0.5–0.69→4; >=0.7→5.
- Elevation, wenn sektorspezifische EXIOBASE-Luftemissionen im obersten Dezil.

### 2.2 HR — Menschenrechte (11)

**(6) Child Labor** — Override-Logik (Commodity-TVPRA dominiert)
- **Commodity TVPRA CL = 1 → automatisch Score 5** (überschreibt alles).
- Country TVPRA CL = 1 → mindestens Score 4.
- Sonst HDI-Basis: HDI>=0.75 & kein TVPRA→1; 0.65–0.74→2; 0.55–0.64→3; HDI<0.55→4. (Kein Flag + UNICEF CRI <0.2 → Score 1.) *Hinweis: ältere Doku nennt „TVPRA-Flag = mind. 4, +systemische Prävalenzstudie = 5"; der gerechnete Product-#18-Walkthrough nutzt automatisch 5.*

**(7) Forced Labor** — Override-Logik (Commodity-TVPRA-Flag aus Sheet 10, **nicht** Country-TVPRA)
- **XUAR-Verbindung → automatisch Score 5.** UFLPA-Sektor + China-PFC → 5 (regardless).
- Commodity TVPRA FL=1 **AND** Walk Free>5 → 5; staatlich gefördert + Enforcement → 5.
- Commodity TVPRA FL=1 allein → 4; Walk Free (per 1000)>8 → 4.
- Walk Free-Basis: <=2→1; 2–4→2; 4–8→3.

**(8) Discrimination & Harassment** — kombiniert WEF GGI + WB WBL
- Score 1: GGI>=0.75 AND WBL>=85; Score 2: GGI 0.68–0.74 AND WBL 70–84; Score 3: GGI 0.60–0.67 OR WBL 55–69; Score 4: GGI<0.60 OR WBL<55; Score 5: GGI<0.55 AND WBL<40.

**(9) Freedom of Association** — Direkt-Mapping ITUC Global Rights Index
- 1→1; 2→2; 3→3; 4→4 („Systematic violations"); 5 / 5+ → 5 („No guarantee of rights").

**(10) Indigenous Peoples' / Land Rights** — kombiniert FSI + WGI Voice & Accountability
- FSI<=40→1; FSI 40–60→2; FSI 60–75→3; FSI>75 AND WGI<-0.5→4; FSI>90 AND WGI<-1→5.

**(11) Security Forces** — Direkt-Mapping FSI (Security-Apparatus-Indikator C1)
- <=35→1; 35–55→2; 55–75→3; 75–95→4; >95→5.

**(12) Unethical Business Behaviour** — Direkt-Mapping TI CPI (invertiert)
- >=60→1; 45–59→2; 30–44→3; 20–29→4; <20→5.

**(13) Wages & Income** — GLWC Living-Wage-Gap %
- <=10→1; 10–25→2; 25–45→3; 45–60→4; >60→5.

**(14) Workplace Safety** — ILO Injury Rate (pro 100k)
- <=2→1; 2–4→2; 4–8→3; 8–12→4; >12→5.

**(15) Working & Living Conditions** — kombiniert HDI + WHO UHC
- Score 1: HDI>=0.85 AND UHC>=75; Score 2: HDI 0.75–0.84 AND UHC 65–74; Score 3: HDI 0.65–0.74 OR UHC 50–64; Score 4: HDI<0.65 OR UHC<50; Score 5: HDI<0.55 AND UHC<40.
- Manueller Override für sektorspezifische Evidenz möglich (z. B. Bangladesh-Textil auf 4 gehalten).

**(16) Fundamental Human Rights** — Direkt-Mapping Freedom House FITW
- >=75→1; 55–74→2; 35–54→3; 15–34→4; <15→5.

---

## 3. EEIO / EXIOBASE-Engine

### 3.1 Mathematik
- **A** = Matrix direkter Input-Koeffizienten.
- **L = (I − A)⁻¹** = Leontief-Inverse (Total-Requirements-Matrix; gesamter Vorleistungsbedarf inkl. aller Upstream-Stufen).
- **F** = direkte Umweltintensitäts-Matrix (z. B. kgCO2eq/EUR).
- **M = F × L** = totale Multiplikator-Matrix = vollständiger Umwelt-Fußabdruck von 1 EUR Endnachfrage inkl. aller vorgelagerten Stufen.
- Extrahiere GHG-/Wasser-/Land-/Luft-Multiplikatoren je `[Land × Sektor]`. Zugriff via **PyMRIO**; Dateien `A.txt`, `F.txt`, `F_Y.txt`, `unit.txt`.

> Die Sheet-10-Werte (z. B. GHG 1.450 tCO2eq/Mio EUR, Water 145.000 m³/Mio EUR, Land 6,8 km²/Mio EUR) sind **totale Supply-Chain-Multiplikatoren aus M**, nicht nur direkte Intensitäten.

### 3.2 Supply-Chain-Share-Attribution
```
Risk(product, risk_type) = Σ über (countries, sectors) [
    supply_chain_share(product, country, sector) × risk_score(country, sector, risk_type)
]
```
Dies deckt versteckte Tier-3-Hotspots auf (z. B. China/Chemicals: nur 2,8 % Anteil, aber höchste Pollution-Intensität — ohne MRIO unsichtbar).

### 3.3 Country-of-Origin Gap-Closure
EXIOBASE-Handelskoeffizienten ARE die verifizierte globale Handelsdatenquelle (validiert gegen nationale Statistiken, FAO, Comtrade). 3-Schritt-Verfahren (siehe Workflow §1.3): Plausibilität → A-Matrix-Upstream-Attribution validiert gegen FAOSTAT bilaterale Handelsmatrizen + UN Comtrade Mirror-Statistik → korrigierte CoO + Confidence. Ergebnis ist eine **probabilistische CoO-Verteilung**.

### 3.4 EXIOBASE-Strukturgrenzen (zu dokumentieren)
- **RoW-Disaggregation:** Côte d'Ivoire = RoW Africa, Bangladesh/Pakistan = RoW Asia, Zimbabwe = RoW Africa → mit Länderdaten supplementieren.
- **Temporal Mismatch:** EXIOBASE Basisjahr 2022 vs. Index-Jahre.
- **Aggregierte Produktgruppen:** „Crops nec", „Basic metals" sind grobkörnig → FAOSTAT für Food-Granularität.
- Editionen: v3.9.4 (neueste) / v3.8.2 (im Framework genutzt); 44 Länder (49 Regionen inkl. 5 RoW) × 163 Industrien × 200 Produktgruppen; Lizenz CC-BY-SA-NC.

### 3.5 Drei Lieferkettenstufen
| Stufe | Beschreibung | Scoring-Quellen |
|---|---|---|
| 1. Rohstoffursprung (CoO) | abgebaut/geerntet/gefördert | Commodity-Overlay (Sheet 10) + Länderindizes |
| 2. Verarbeitungsland | letzte substanzielle Transformation | Länderindizes |
| 3. Herstellungsland (PFC) | höchster Wertschöpfungsanteil | nur Länderindizes (außer PFC==CoO) |

Konsequente Regel: **Commodity-spezifische Overrides am Punkt der agrarischen/extraktiven Produktion, Länder-Governance-Indizes am Punkt der Herstellung.**

---

## 4. Composite-, Overall- & UFLPA-Logik

### 4.1 Composites
- **ENV-Composite = ROUND(Mittelwert der 5 ENV-Scores)** — Standardrundung (0,5 rundet auf); auf 1 Dezimalstelle wo angezeigt.
- **HR-Composite = ROUND(Mittelwert der 11 HR-Scores)**.
- Beispiel (verifiziert): Cocoa CoO ENV 4,6 = mean(4,5,5,5,4); HR 4,0 = mean(5,4,3,4,4,4,3,5,4,5,3).

### 4.2 Overall
- Overall CoO = MAX(CoO ENV, CoO HR); Overall PFC = MAX(PFC ENV, PFC HR).
- **Overall Risk Score = MAX(Overall CoO, Overall PFC).**
- Surface zusätzlich **Max ENV Score, Max HR Score** und **Key Risk Dimensions** (Liste aller Dims >= 4 mit Ort + Score), um Mittelwert-Verwässerung entgegenzuwirken (v3.7.2-Fix).

### 4.3 Risk-Label-Bänder (auf Overall Risk Score)
| Band | Label |
|---|---|
| <=1.5 | Very Low |
| <=2.5 | Low |
| <=3.5 | Medium |
| <=4.5 | High |
| >4.5 | Very High |

(Zusätzlich verwendet: Risk >= 4.0 = „High"-Schwelle in Severity/Likelihood-Ableitung.)

### 4.4 UFLPA-Overlay
- **CRITICAL** (direkte XUAR-Produktion ODER Entity-List-Match): Overall Risk = **5 Override** (gem. 19 U.S.C. §1307 — Waren ganz/teilweise aus XUAR gelten vermutet als Zwangsarbeit). Forced Labor wird auf 5 gesetzt.
- **HIGH** (indirekte XUAR via Vorleistungen ODER High-Priority-Sektor ohne Entity-List-Match): Overall = `MAX(Composites) + 1`, gedeckelt auf 5.
- **NOT APPLICABLE:** kein Nexus → keine Änderung.
- **12 FLETF High-Priority-Sektoren:** Aluminum, Apparel, Caustic Soda, Copper, Cotton, Lithium, PVC (designiert Juli 2024), Red Dates, Seafood, Silica-based/Polysilicon, Steel (2025 hinzugefügt), Tomatoes. (Polyester = „adjacent", flaggt aber ist nicht designiert.)
- **XUAR-Nexus-Erkennung:** probabilistische Content-Schätzung via EXIOBASE-Vorleistungsanteile (z. B. ~90 % des chinesischen Cotton aus XUAR; chinesisches Garn/Gewebe = 60–70 % der Bangladesh-Textil-Vorleistungen; XUAR = >10 % der China-PVC-Produktion; XUAR-Aluminium-Smelter-Anteil 9–12 %).
- **Entity-List-Matching:** gegen CBP UFLPA Entity List (144 Entities Stand Aug 2025, monatliche Updates; benannte Entities z. B. Xinjiang Zhongtai Chemical, Xinjiang Tianye, China Hongqiao, Xinfa Group). Fuzzy- und Transliterations-fähiges Supplier-Name-Matching: match / possible-match / no-match.

### 4.5 UFLPA-Tier-Klassifikation
- **CRITICAL:** XUAR-Konzentration + Entity-List-Match/-Möglichkeit (z. B. PVC China) ODER Konvergenz mehrerer (4) UFLPA-Sektoren in einem Produkt (z. B. Kassen: PVC + Aluminum + Silica-based/Polysilicon + Steel).
- **HIGH:** ein einzelner FLETF-Sektor (z. B. Cotton-Textil).
- **Salient (kein UFLPA):** auffälliges CL/Entwaldungsrisiko, aber kein UFLPA-Sektor (Kakao, Haselnüsse).

---

## 5. CSDDD Severity & Likelihood + Confidence-Framework

### 5.1 CSDDD Art.6 Severity
`SevRaw = Scale(50 %) + Scope(25 %) + Irremediability(25 %)`
- **Scale** = höchster Einzel-Dimensions-Score / 5 (Schweregrad/Gravity).
- **Scope** = Anzahl Dimensionen >= 4, gemappt auf 0 / 0.3 / 0.6 / 1.0 für Buckets 0 / 1–3 / 4–7 / 8+ (betroffene Menschen/Umwelt, volumengewichtet).
- **Irremediability** = gewichteter Durchschnitt der Dimensions-Gewichte für Dims >= 4: FL = 1.0; CL/Biodiversity/Indigenous = 0.9; Fundamental HR/Security = 0.8; Climate/Pollution = 0.7; GHG/Resources = 0.6; FoA/Discrimination/Safety = 0.5; Wages/Conditions/Unethical = 0.4.
- **Severity-Bänder:** <0.25 Very Low; 0.25–0.39 Low; 0.40–0.54 Medium; 0.55–0.74 High; >=0.75 Critical.

### 5.2 CSDDD Likelihood
`LikRaw = GovernanceWeakness(40 %) + CommodityExposure(30 %) + Historical(30 %)`
- **GovernanceWeakness** = MAX(Fundamental HR, Unethical Business) über CoO und PFC / 5.
- **CommodityExposure** = 1.0 wenn TVPRA CL oder FL = 5; 0.6 wenn >= 4; sonst 0.3.
- **Historical** = höchster Einzel-Dimensions-Score / 5.
- **Likelihood-Bänder:** <0.30 Rare; 0.30–0.44 Unlikely; 0.45–0.59 Possible; 0.60–0.74 Likely; >=0.75 Almost Certain.

### 5.3 Abgeleitete Flags (Schwellen)
- Salient = YES wenn Risk >= 3.5; CSDDD Severity „High" wenn Risk >= 4.0; CSDDD Likelihood „Likely" wenn Risk >= 4.0.

### 5.4 4-Level Confidence-Framework
| Level | Threshold-Kriterien | Validierungsaktion / SLA |
|---|---|---|
| **VERY HIGH** | >= 3 unabhängige Quellen konvergieren; >= 1 regulatorische/Enforcement-Quelle bestätigt direkt (UFLPA Entity List, FLETF); keine plausible Alternative | Standard-Monitoring (jährlich) |
| **HIGH** | >= 2 unabhängige Quellen stimmen überein; EXIOBASE dominanter Single-Country-Anteil >50 %; FAO/Comtrade-Korroboration | Jährliche Review (Expert-Konsultation ergänzen wenn eine Dim >= 3) |
| **MEDIUM** | 1 Primärquelle; Multi-Country-Ursprung ohne >50 %-Dominanz / Blending | Aktive Validierung binnen 90 Tagen (Supplier-Daten anfordern, Traceability z. B. isotopischer Cotton-Test) |
| **LOW** | keine direkte Quelle; stützt sich auf EXIOBASE-RoW-Disaggregation / Branchenannahmen | Dringende Validierung binnen 30–60 Tagen; Vorsorgeprinzip = Worst-Case-Ursprung |

Validierungsaktions-Bibliothek: Supplier Name + Facility Address anfordern, Abgleich Entity List, BoM/Supplier-Declarations, Feedstock/Precursor-Origin-Docs (Calciumcarbid/Ethylen für PVC; PTA/MEG für Polyester), isotopische/DNA-Traceability (Oritain, Applied DNA Sciences), ASI-Zertifizierung (Aluminium), RMI (Metalle), BCI/Supima (Cotton), EUDR-GPS-Polygon-Nachweis (Kakao), CBP-Admissibility-Dokumentation.

> Auditerfahrung (v3.1): China Discrimination 3→2 (GGI 0.741 im Band 0.7–0.8), FoA 4→5 (ITUC=5), Unethical 4→3 (CPI 42 im 35–50-Band), Working/Living 4→3 (HDI 0.788), Fundamental HR 4→5 (Freedom House 9 < 15); CdI-Kakao HR-Composite-Mittel 3,55 rundet auf 4. Von 15 Audit-Findings erfordern **0** eine Score-Änderung für Product #18 (Trase-Platzhalter 0.1 → Score 1, nie bindend in MAX()).

---

## 6. Datenmodell (Schema-Skizze, rekonstruiert aus den ALDI-Workbooks)

> Workbook-Struktur File 03 (12 Sheets): 1. Product Data · 2. EXIOBASE-EEIO Methodology (Concordance) · 3. Risk Assessment (Fact-Tabelle) · 4. Salient Risks & Actions · 5. Data Architecture (5 Layer) · 6. Risk Framework & Thresholds · 7. Confidence Framework · 8. Quality Check (MVO) · 9. Raw Index Data · 10. Commodity × Country Data · Country Risk Scores · Changelog. File 04 (Final Delivery, 7 Sheets, client-facing): READ ME FIRST · Data Gap Analysis · Dummy Data Services · Risk Analysis Merch & GNFR · Risk Analysis Services · Salient Risks · Confidence Framework.

**Kern-Entities:** Product → 1..n Component → Country (CoO/PFC), Sector (EXIOBASE), RiskType (16), SubScore, Index/DataSource, CompositeScore, ConfidenceLevel, UFLPAFlag, SeverityRating, LikelihoodRating, SupplyChainShare [product × country × sector].

```
product
  id, type (Merch|GNFR|Service), category, commodity_group, sub_commodity_group,
  product_description, branded_flag, sourcing_office, retailer_market,
  production_facility_country, pf_type (Main PF|Grower), max_product_net_weight_kg

component  -- Grain: 1 Zeile = Product × Resource Sub-Type × Country
  id, product_id, resource_type, resource_sub_type, max_pct, rcv_tonnage,
  rcv_cost_eur, rcv_cost_pct_category_spend,
  country_of_origin_original, country_of_origin_corrected,
  data_gap_type ENUM('Implausible CoO','Plausible — retained',
    'Retained (supplier declared)','Plausible — retained but flagged',
    'Missing CoO — estimated','Missing CoO/PF/Resource — estimated'),
  estimation_method, confidence, rationale_evidence, uflpa_flag

country
  iso3, name, ...

risk_type            -- 16 Zeilen
  id, name, domain ENUM('ENV','HR'), lksg_citation, csddd_annex_ref

country_risk_score   -- Lookup, Grain = Country (20 Länder im Sample)
  country_id, <16 risk_type scores 1-5>, env_composite, hr_composite, overall_risk

raw_index_data       -- Lookup, Grain = Country (24 Roh-Indexspalten)
  country_id, ti_cpi, freedom_house_fitw, ituc, yale_epi, nhm_bii,
  ndgain_vuln, inform, aqueduct, wef_ggi, wb_wbl, walk_free_prev, ffp_fsi,
  wgi_voice_accountability, undp_hdi, who_uhc, glwc_wage_gap, ilo_injury_rate,
  tvpra_cl_flag, tvpra_fl_flag, source_year,
  ndgain_food_vuln, ndgain_water_vuln, ndgain_ecosystem_vuln
  -- Sonderzeile 'China (XUAR)': Walk Free=12, TVPRA FL=1 Override

commodity_country_data  -- Lookup, Grain = Commodity × Country; Overlay NUR CoO/Rohstoff
  commodity, country_id, exiobase_sector_code,
  exiobase_ghg_tco2eq_mioeur, exiobase_water_m3_mioeur, exiobase_land_km2_mioeur,
  faostat_ghg_kgco2_kg, wfn_water_m3_ton, trase_defor_score, trase_coverage BOOL,
  sector_pollution_adj, sector_water_adj, tvpra_cl_commodity, tvpra_fl_commodity, source

risk_assessment       -- Fact-Tabelle, Grain = Product-Component-Zeile (~63 Spalten)
  id, product_id, component_id, retailer_market,
  -- CoO-Block (16 Dims): coo_ghg ... coo_fund_hr, coo_env_avg, coo_hr_avg, overall_coo
  -- PFC-Block (16 Dims): pfc_ghg ... pfc_fund_hr, pfc_env_avg, pfc_hr_avg, overall_pfc
  overall_env, overall_hr, overall_risk_score, risk_label,
  salient_risk ENUM('YES','WATCH','NO','ELEVATED'), priority_rank,
  max_env_score, max_hr_score, key_risk_dimensions TEXT,
  uflpa_applicable, uflpa_sectors, csddd_severity, csddd_likelihood

service_assessment    -- Single 16-Dim-Block, Input = Service Type + Market Country
  id, service_type, market_country, <16 dims>, overall_env, overall_hr,
  overall_risk_score, risk_label, salient_risk, priority_rank, max_env, max_hr,
  key_risk_dimensions, uflpa_*, csddd_severity, csddd_likelihood

exiobase_concordance  -- Sheet 2
  retailer_commodity, exiobase_product_group, exiobase_code

salient_risk_register -- Sheet 4 / Final Delivery
  rank, product_id, product_name, market, sourcing_office, coo, priority,
  overall_risk, environmental_risks TEXT, human_rights_risks TEXT,
  uflpa_applicability, regulatory_scope, recommended_actions,
  monitoring_indicators

risk_framework_thresholds -- Sheet 6, editierbare Schwellen-Daten
  risk_type_id, domain, sub_dimensions, primary_indices,
  threshold_1..threshold_5, aggregation_logic, lksg_coverage,
  csddd_annex_coverage, data_gaps_limitations

confidence_framework  -- Sheet 7
  level, definition, threshold_criteria, validation_actions, examples

quality_check_mvo     -- Sheet 8 (Zweitmeinung)
  product, component, coo, retailer_market, workplace_safety_score,
  mvo_assessment_range, labour_conditions_explanation, source

changelog
  version, date, sheet, change_type, description

uflpa_sector_registry
  sector, designation_date, status ENUM('designated','adjacent')

uflpa_entity_list
  entity_name, aliases, listing_date, capacity_metadata, source_cycle
```

**Datenqualitäts-Hinweise (im Quell-Material beobachtet, robust behandeln):** Tippfehler („United Stated", „estimaded", trailing spaces in Ländernamen), Prozente als Brüche (0.9950248756218905), Komponenten-% summieren nicht auf 100 %, `#VALUE!`/`#N/A`/`#REF!`-Propagation → explizite Missing-Data-States statt Error-Propagation, als LOW Confidence ausweisen. **Single Source of Truth:** keine abgeleiteten Duplikat-Tabs (v3.7.1-Lehre).

---

## 7. Datenquellen-Katalog & 4-Layer-Ansatz

### 7.1 Katalog-Übersicht
- **124 quantitative Indizes** über 16 Risikotypen + 5 Commodity-Cross-Cutting (Rows 120–124); **~31 BAFA-gelistet**. Coverage-Rating: **11/16 HIGH gap, 5/16 MEDIUM**.
- Pro Index erfasst: id, domain, risk_type, sub_category, index_name, publisher, type (Country / Country×Product / Geospatial / MRIO / Commodity×Country / Composite), coverage, scale_unit, update_frequency, latest_data_year, **bafa_listed**, url_access.
- **Bezahlte Alternative:** Verisk Maplecroft (30+ HR-Indizes, 200+ Commodities, 198 Länder, quartalsweise, ~$50K–$150K+/Jahr) — als toggle-bare Connector-Abstraktion modellieren.

### 7.2 Index-Counts je Risikotyp (BAFA-gelistet in Klammern)
GHG 11 (0) · Physical Climate 8 (0) · Biodiversity 20 (1) · Resource Consumption 21 (2) · Pollution 33 (16) · Child Labor 4 (3) · Forced Labor 2 (2) · Discrimination 3 (1) · Freedom of Assoc. 2 (1) · Indigenous/Land 2 (1) · Security Forces 2 (2) · Unethical Business 2 (1) · Wages 3 (2) · Workplace Safety 2 (0) · Working & Living 3 (3) · Fundamental HR 2 (2).

### 7.3 Primärquellen je Dimension (Kurzliste)
GHG: FAOSTAT kgCO2eq/kg + EXIOBASE + EDGAR/Climate Watch · Physical Climate: ND-GAIN + INFORM (+FAO ASIS, ThinkHazard, WB CCKP) · Biodiversity: NHM BII + EXIOBASE Land + Trase/GFW (+EII, IBAT, ENCORE) · Resource: WRI Aqueduct + WFN (+WWF Water Risk Filter) · Pollution: Yale EPI + CEIP-Schadstoffe + UNEP Mercury (+SoilGrids, Sensoneo) · Child Labor: DOL TVPRA + UNICEF CRI + Save the Children · Forced Labor: Walk Free GSI + DOL TVPRA · Discrimination: WEF GGI + WB WBL + UNDP GII · FoA: ITUC + ILO NORMLEX · Indigenous: FAO SDG 1.4.2 + LandMark + FSI/WGI · Security: FSI C1 + WGI Gov Effectiveness · Unethical: TI CPI + WGI Control of Corruption · Wages: GLWC/Anker + OECD Kaitz + ILO Wage Report · Safety: ILOSTAT Injuries + ILO LEGOSH · Working & Living: HDI + WHO UHC · Fundamental HR: Freedom House FITW + WGI Voice & Accountability.

### 7.4 BAFA-Defensibilität
- BAFA Risikodatenbank Quellenübersicht (Stand 20.12.2023, Referat 711): 5 Kategorien — **Menschenrechtsrisiken** (→ LkSG §2 Abs.2 Nr.X), **Umweltrechtsrisiken** (→ LkSG §2 Abs.3 Nr.X), **Kontextinformationen**, **Branchenrisiken**, **Rohstoffrisiken**; 3 Dimensionen Branchen/Länder/Rohstoffe.
- LkSG §2 Abs.2-Mapping (Auszug): Nr.1&2 Kinderarbeit; Nr.3&4 Zwangsarbeit/Sklaverei; Nr.6 Vereinigungsfreiheit; Nr.7 Ungleichbehandlung; Nr.8 angemessener Lohn; Nr.9 Umweltverunreinigung; Nr.10 Landrechte; Nr.11 Sicherheitskräfte. §2 Abs.3: Nr.1–3 Quecksilber; Nr.4–5 POPs; Nr.6–8 Basler Übereinkommen (Abfall).
- Software MUSS pro Score den exakten LkSG-Zitatstring als First-Class-Key führen und versionierte Quellenlisten (mit „Stand"-Datum + Audit-Trail) halten; explizite Vollständigkeits-Disклаimer respektieren (BAFA aktualisiert regelmäßig).

### 7.5 4-Layer-Ansatz (Recommended Approach + Data Architecture)
1. **Layer 1 — Abstract Country Risk:** Länderindizes → Traffic-Light je Risikotyp & ENV-Sub-Kategorie. Schwellen: ITUC>=4 high; CPI<40 elevated; EPI<40 elevated; BII<70 % elevated; Freedom House „NF" elevated; Aqueduct>3 high water stress; GCSI<50 high spillover.
2. **Layer 2 — Commodity × Country Matrix:** Sourcing × TVPRA/Trase/Aqueduct/FAOSTAT/EXIOBASE/BII/Walk Free/ITUC/WEF; TNFD via ENCORE (Dependency) + IBAT (Site-Level).
3. **Layer 3 — EXIOBASE + GCSI Integration:** Multiplikatoren via PyMRIO (200 Produkte × 44 Länder + 5 RoW); GCSI ergänzt Trade-embedded-Spillover (~146 Länder).
4. **Layer 4 — Final Risk Database:** Grain = Commodity × Country (z. B. „Coffee – Brazil"); 20-Spalten-Schema (Sourcing vol, CL/FL flags, ITUC, WEF GGR, FSI, CPI, Freedom House, Kaitz, EPI, FAO tenure, FAOSTAT kgCO2eq/kg, Aqueduct, GFW, BII/EII, EXIOBASE, GCSI spillover, ENCORE dependency, Composite HR, Composite ENV, Salient Risk Flag).
- **Normalisierung:** jeder native Scale (0–100, 1–5, 0–1, −2.5..+2.5, invertiert ITUC, binär TVPRA, physische Intensitäten) via konfigurierbares MIN/MAX auf gemeinsame Risikoskala (Legacy: 0–10; Framework: 1–5) mit Richtungs-Handling. Update-Cadence: jährlich (LkSG-Zyklus), quartalsweise bei Maplecroft-Abo.
- Die ~29 BAFA-qualitativen Quellen (Branchen-/Rohstoffrisiken-Reports) als separate, nicht-scorebare RAG-Referenzbibliothek halten.

---

## 8. Klimarisiko-Modul (physisch + transitorisch)

> Grundlage: Sustainable AG Klimarisikoanalyse-Methodik (CSRD/EU-Taxonomie). Zwei parallele Stränge.

### 8.1 Kernformel & Stränge
- **Risiko = Klimagefahr × Exposition × Sensitivität** (Bruttorisiko); Anpassungsmaßnahmen → **Nettorisiko**.
- **Physisch:** standort-/asset-bezogen, unter **High-Emissions-Szenario** bewertet.
- **Transitorisch:** auf Geschäftsbereichs-/Konzernebene, unter **1,5 °C / Low-Carbon-Szenario** (gegenläufige Szenarien decken breitestes Risikoband ab).

### 8.2 4-Schritt-IBMR-Prozess
1. **Identify** — Systemgrenzen / Wertschöpfungskette / Zeithorizonte.
2. **Assess** — finanzielle Wesentlichkeit kurz/mittel/lang.
3. **Manage** — wesentliche Risiken in Strategie integrieren.
4. **Report** — gem. EU-Taxonomie / CSRD / TCFD.

### 8.3 Gefahren-Taxonomie & Szenarien
- **28 physische Klimagefahren** (CSRD/EU-Taxonomie-Annex; teils als 29 zitiert), chronisch + akut, 4 Familien: **Temperature** (Hitzestress, Temperaturvariabilität; akut: Hitze-/Kältewelle), **Wind** (Windmuster; akut: Zyklon/Tornado/Sturm), **Water** (Niederschlag/Hydrologie, Meeresspiegel, Wasserknappheit, Versalzung; akut: Dürre, Starkregen, Flut, Gletscherseeausbruch), **Solid Mass/Feststoffe** (Küsten-/Bodenerosion, Permafrosttauen, Solifluktion; akut: Lawine, Erdrutsch, Wald-/Flächenbrand, Bodensenkung).
- **4 Szenarien:** SSP1-2.6 / SSP2-4.5 / SSP3-7.0 / SSP5-8.5 (äquivalent RCP2.6–RCP8.5).
- **2 Zeithorizonte:** aktuell ~2015–2034; Zukunft ~2031–2050 (auch 2025/2030/2050 bzw. 2041–2060).
- **5-stufige Expositionsskala mit „Red Flag" als höchster Kategorie.** Red Flag im SSP5-8.5 → mandatorisches Experten-/Standort-Interview; Red Flag im SSP5-8.5 = wesentliches Risiko.

### 8.4 Transitorisches Risiko & Maßnahmen
- **Long List → Short List:** Treiber-Kategorien Political&legal / Reputation / Market / Technology, priorisiert nach Likelihood × Zeithorizont (kurz <1J / mittel 2–5J / lang >5J), abgestimmt auf **NGFS Net-Zero-2050** + **IEA Net-Zero**.
- **Risk-Treatment:** Vermeiden / Vermindern / Übertragen (Teilen) / Tragen.
- **Maßnahmen-Taxonomie:** Typ (behavioral/informational/physical/financial/value-chain/technological) × Intervention (reaktiv/detektierend/präventiv) × Horizont.
- **Cost-Benefit/ROI:** jeder investierte USD in Anpassung = Payback 2–19 USD; parametrische Versicherung (CelsiusPro/NDF) als Transfer-Instrument (Trigger-Modell X+Y=Z); Loan-Break-Even-Logik (rentabel ab ~16,7 Mio € Kredit/5J bzw. ~27,8 Mio €/3J bei 15 bp Klima-Aufschlag).

### 8.5 Supply-Chain-Hotspot-Variante (Schwarz/UdSG)
Hotspot-Record: Hotspot (z. B. Kaffee) | Klimagefahr | Exposition (z. B. ~70 % aus 2 Hochrisiko-Regionen) | Sensitivität (Ertragsausfall → Preisspitzen) | Geschäftsrisiko (Beschaffungskosten +15–25 %). Fallback via **Scope 3.1**-Volumen + Country-of-Origin, wenn Primärdaten fehlen.

### 8.6 Reporting & Daten
- Output-Bezug zu **ESRS E1-Datenpunkten: SBM-3, IRO-1, E1-2, E1-3, E1-9**; plus EU-Taxonomie, TCFD, CDP, SEC 20-F.
- Klimadaten: **meteoblue** (primär; CMIP6, 10 m / Gebäude-Auflösung, City Climate Monitoring); Alternativen Munich RE, Correntics, Climate Analytics (Regio Crops), FAO CRTB; DWD (vorhandene Klimagefahrenanalyse).
- Unsicherheits-Klassifikation pro Gefahr (direct/combined/proxy/no-data) und nach Hawkins & Sutton (interne Variabilität / Modell / Szenario).

---

## 9. Implementierungs-Pflichten (Build Requirements, konsolidiert)

- 16 deterministische Scoring-Funktionen, Schwellen als editierbare Daten (Retailer-Market-spaltenfähig).
- Duales CoO/PFC-Scoring + Composite-Engine (ENV=Mittel 5, HR=Mittel 11, ROUND 0,5 auf) + Overall=MAX-Logik.
- UFLPA-Overlay-Engine (CRITICAL/HIGH/NOT APPLICABLE; 12-Sektoren-Test; XUAR-Content via EXIOBASE-Vorleistungsanteile; Entity-List mit monatlicher CBP-Ingestion + Fuzzy-Matching).
- EXIOBASE/EEIO-Compute-Modul (A, L=(I−A)⁻¹, M=F×L; PyMRIO; RoW-Disaggregation via GDP/Comtrade/FAOSTAT).
- Concordance-Tabelle, Data-Ingestion-Layer mit Source-Year-Metadaten + Audit-Update-Workflow.
- Gap-Closure-Modul (probabilistische CoO + Confidence).
- 4-Level-Confidence-Engine mit auto-generierten Validierungsaktions-Listen + SLA-Timer (30/60/90 Tage).
- CSDDD-Modul (Severity Scale/Scope/Irremediability + Likelihood Governance/CommodityExposure/Historical + Band-Funktionen).
- Score-Verifikations-/Audit-Modul (re-derive jeden Score, Konsistenz-Assertion, Label-vs-Score-Mismatch-Detection).
- Regulatory-Coverage-Mapping (16 Risikotypen → LkSG §2 + CSDDD Annex Part I/II Konventionen: ICCPR, ICESCR, CRC, ILO 87/98/29+Protokoll/105/138/182/100/111; Cartagena/Nagoya, CITES, Minamata, Stockholm POPs, Rotterdam PIC, Montreal, Basel, World Heritage, Ramsar, MARPOL, UNCLOS).
- Output-Generatoren: Heatmaps, Hotspot-Identifikation, Salient-Register, markt-/gruppenweite Aggregation.
- Services-Pfad (Single 16-Dim-Block), MVO-Zweitmeinung-View, Changelog/Versionierung, Multilingual (DE primär, EN).
- **KI-Maximierung** (überall wo automatisierbar): CoO-Gap-Closure-Agent + Rationale-Generierung, SKU→EXIOBASE-Concordance-Mapper (Embedding-basiert), Index-Freshness-Monitoring + Auto-Re-Scoring, NLP-Extraktion von TVPRA/Entity-List/FLETF/EUDR-Flags, LLM-CSDDD-Severity/Likelihood mit erklärbarem Rationale, Confidence-Auto-Klassifikation, Geospatial-Zonal-Aggregation (BII-Raster, Aqueduct-Sub-Basin), Proxy-Gap-Filling (z. B. GLWC außerhalb ~40 Ländern), NL-Query/Report-Generierung, BoM-Inferenz für versteckte UFLPA-Exposition, LLM-as-Judge-QC, Per-Market-Threshold-Customization-Assistant, proposed „Manufacturing Sector Adjustment"-Layer (parallel zu Sheet 10) für Fabrik-Level-Risiken am PFC.
