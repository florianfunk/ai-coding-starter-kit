# Agententeam & Entwicklungsorganisation — STEUERAGENT

> Stand: 2026-06-19 · Auftraggeber: Florian · Strategische Leitung (CEO): Tom · Koordination: Claude
> Status: **Freigegeben durch Tom** (Single-Tenant bestätigt, Modellwahl & Priorisierung an Koordinator delegiert, 100 % Tempo + Qualität, Budget unbegrenzt)

Dieses Dokument hält das virtuelle Entwicklungsteam, die Rollenverantwortung, die Modellentscheidung und die Phasen-Roadmap fest. Es ist die übergabefähige Referenz für die weitere Arbeit.

---

## 1. Grundprinzip

Es wird strukturiert in klaren Rollen gearbeitet, nicht ungeordnet durch einen Einzel-Agenten. **Tom** entscheidet strategisch und priorisiert; **Florian** ist Auftraggeber und entscheidet mit Tom über Budget, Prioritäten, Freigaben. **Claude** koordiniert das Agententeam und setzt um.

Wichtiger Realitäts-Check: STEUERAGENT ist **kein Greenfield**. 24 Features sind spezifiziert, viele Deployed. Wir **härten und erweitern** ein laufendes, bewusst **Single-Tenant** Produkt (eine Firma, ein Nutzer) — keine Mandantenfähigkeit.

---

## 2. Das Agententeam (Rollen & Verantwortung)

Die meisten Rollen existieren bereits als spezialisierte Agenten/Skills im Projekt und werden genutzt statt neu erfunden.

| Rolle | Verantwortung | Umsetzung im Projekt |
|-------|---------------|----------------------|
| **Product Owner** | Vision, Priorisierung, MVP/V1-Schnitt, User Stories, Akzeptanzkriterien | `/requirements` + PRD + `features/INDEX.md` (Tom-nah) |
| **Solution Architect** | Gesamtarchitektur, Datenmodell, API-Design, Skalierbarkeit, Integrationen | `/architecture` + `Plan`-Agent |
| **Backend Developer** | API-Endpunkte, Supabase-Schema/RLS, Geschäftslogik (EÜR/USt), LLM-/Paperless-Schnittstellen | `Backend Engineer`-Agent + `/backend` |
| **Frontend Developer** | Dashboards, Tabellen, Detailansichten, Formulare (shadcn/ui-first) | `Frontend Engineer`-Agent + `/frontend` |
| **UX/UI Design** | Nutzerführung, Design-System, Apple-inspirierte Reduktion von Komplexität | `frontend-design` + `ui-ux-pro-max` Skills |
| **AI / Automation** *(Kernrolle)* | Prompt-Design, Klassifizierungs-Qualität, LLM-Kostenkontrolle, Caching, Lernregel-Mechanik | Koordinator + `Backend Engineer`; Code in `src/lib/classifier/*`, `src/lib/chat/*` |
| **Security & Compliance** | DSGVO/EU-Region, Token-/Kontodaten-Verschlüsselung, RLS-Audit, Audit-Trail | `Security Auditor`-Agent (**kein** Multi-Tenant-Rollenmodell) |
| **QA / Testing** | Testfälle gg. Akzeptanzkriterien, Vitest/Playwright, Regression, Security-Smoke | `QA Engineer/Frontend/Backend`-Agenten + `/qa` |
| **DevOps** | Vercel-Deploy, Env-/Secret-Hygiene, Monitoring (Sentry) — kein eigener Serverbetrieb | `DevOps`-Agent + `/deploy` |
| **Documentation** | Feature-Specs, Architekturübersicht, Entscheidungsprotokolle, dieses Dokument | `Documentation Agent` |

**Bewusst ausgeklammert:** Mandantenfähigkeit / Mehrbenutzer-Rollenmodell (widerspricht Single-Tenant-PRD), eigener Serverbetrieb/Backup (Vercel + Supabase Managed).

---

## 3. Modellentscheidung (durch Koordinator, von Tom delegiert)

**Default-Sprachmodell: Claude Opus 4.8 (`anthropic/claude-opus-4-8`).**

Begründung gegen die Entscheidungslogik:
- **Geschäftsnutzen:** Höchste Genauigkeit bei der EÜR-Klassifizierung, privat/geschäftlich-Trennung und im KI-Chat — direkt auf die Success-Metrik „≥ 85 % autonom korrekt" einzahlend. Tom: „bestes Ergebnis, Kosten egal".
- **Technisch sauber:** 1M-Kontextfenster zum Standard-API-Preis ($5/$25 pro MTok), Structured Outputs (für `generateObject`), adaptives Thinking. Bestehender Code (`generateObject` + Zod) ist kompatibel; nur der Modell-Slug ändert sich.
- **Sicher / DSGVO:** Opus 4.8 hat **keine** 30-Tage-Mindest-Datenhaltung und ist auch unter Zero-Data-Retention nutzbar — relevant für hochsensible Steuerdaten. (Claude Fable 5 wäre noch leistungsfähiger, ist aber **nicht** unter ZDR verfügbar und teurer → für dieses sensible Single-User-Tax-Tool bewusst **nicht** gewählt.)
- **Einfach:** Modell bleibt im Admin-Bereich (PROJ-13) pro Nutzer überschreibbar; Opus 4.8 ist neuer Default.

**Kostenkontrolle trotz „Kosten egal":** Prompt-Caching wird für den Klassifizierungs-System-Prompt + Profil-/Kontenrahmen-Kontext eingeführt (Cache-Read ~0,1×). Das senkt Latenz **und** Kosten bei der Hochvolumen-Klassifizierung, ohne Qualitätsverlust.

Modell-IDs Referenz: Opus 4.8 `claude-opus-4-8` (1M Kontext, 128K Output). Gateway-Slug `anthropic/claude-opus-4-8`.

---

## 4. Ist-Stand der offenen Features (Analyse 2026-06-19)

| Feature | INDEX-Status | Tatsächlicher Code-Stand | Nächster Schritt |
|---------|--------------|--------------------------|------------------|
| PROJ-15 Klassifizierung-Pro | In Progress | **P0 fertig & produktionsreif** (Normalisierung, Empfänger-Cache, Historie, Konsistenz-Pass). **P1 (Regex- & Split-Regeln) NICHT begonnen.** P2 offen. | P1 implementieren (echte Feature-Arbeit) |
| PROJ-16 Mein Profil | Planned | **Vollständig implementiert** (Migrationen 0007/0008, Service, API, UI, 45 Tests) — nur fehl-etikettiert | Status korrigieren → deploy |
| PROJ-17 KI-Chat | Approved | **Vollständig implementiert** (11 Read- + 10 Write-Tools, Confirm-Flow, Streaming) | Migration 0009 anwenden → deploy |
| PROJ-19 Kündigungsliste | In Review | **Komplett, alle AC erfüllt**, 694 Tests grün | promoten → deploy |
| PROJ-20 Merkliste | In Review | **Komplett, alle AC erfüllt**, 694 Tests grün | promoten → deploy |

---

## 5. Phasen-Roadmap

| Phase | Inhalt | Beteiligte | Status |
|-------|--------|-----------|--------|
| **1 — Analyse & Architektur** | Bestandsaufnahme (oben), Modellwahl, Datenmodell-Sicht | PO, Architect, AI, Security | ✅ erledigt |
| **2 — MVP-Restscope schließen** | PROJ-19/20 promoten, PROJ-16 Status korrigieren, PROJ-17 Migration; Opus-4.8-Umstellung + Prompt-Caching | Backend, AI, QA, DevOps | 🟡 in Arbeit |
| **3 — Feature: Klassifizierung-Pro P1** | Regex-Bedingungen (mit ReDoS-Schutz) + Split-Regeln in Pipeline & Regel-Dialog | AI, Backend, Frontend, QA | ⏳ als Nächstes |
| **4 — Testing & Sicherheit** | DSGVO-/RLS-Audit, Token-Verschlüsselung verifizieren, Regression | Security, QA | ⏳ |
| **5 — Deployment** | Vercel-Härtung, Monitoring, Migrationen remote anwenden | DevOps | ⏳ (Freigabe-pflichtig) |
| **6 — Optimierung** | Lerneffekt messen (Korrektur-Quote ↓), Performance, UX-Politur | AI, UX/UI, Frontend | ⏳ |

---

## 6. Offene Freigaben / Gates

- **Deploy & Remote-DB-Migrationen** (PROJ-16/17, Modellumstellung live): produktionswirksam und schwer reversibel → wird **vor Ausführung** mit Tom/Florian bestätigt, nicht still durchgeführt.
- **Single-Tenant bleibt** (Entscheidung 1, Tom): keine Mandantenfähigkeit, kein Mehrbenutzer-Rollenmodell.

---

## 7. Entscheidungsprotokoll

| Datum | Entscheidung | Durch |
|-------|--------------|-------|
| 2026-06-19 | Single-Tenant beibehalten; keine Mandantenfähigkeit | Tom |
| 2026-06-19 | Default-LLM = Claude Opus 4.8; Prompt-Caching einführen | Koordinator (delegiert) |
| 2026-06-19 | Build-Reihenfolge: Phase 2 (Restscope) → Phase 3 (PROJ-15 P1) | Koordinator (delegiert) |
| 2026-06-19 | 100 % Tempo + Qualität, Budget unbegrenzt | Tom/Florian |
| 2026-06-22 | Rück-Übernahme 2026→2025 (Ausreißer-Schutz bewusst übergangen) | Florian |
| 2026-06-22 | Apple → Software/IT/Cloud, Amazon → Wareneinkauf (Sammel + Lernregeln) | Florian |
| 2026-06-22 | Kombinierter Prod-Deploy (PROJ-15 + Codex-Security), 0009-Chat bewusst NICHT | Florian |

---

## 8. Live-Stand & offene Punkte (Stand 2026-06-22)

**In Produktion** (https://steueragent.vercel.app, Deploy via `vercel --prod` CLI vom `feat/steueragent-mvp`-Branch — etablierter Weg dieses Projekts; `origin/main` ist bewusst stale):
- Default-LLM **Opus 4.8**; PROJ-15 **P1** (Regex/Split) + **P2 #1/#3** (Re-Klassifizierung, Häufige-Empfänger); PROJ-16/19/20 mit deployt.
- Commits: `b8d4b15` (PROJ-15 + Opus 4.8), `82e8499` (Codex-Security: CSRF/SSRF/Krypto/Header/Middleware). Security-Header live verifiziert.
- Migrationen **0014** (Regex/Split-CHECKs) + **0015** (Index) angewendet.
- Daten: 361 Prüflisten-Fälle 2025 gelöst (55 Rück-Übernahme + 171 Apple + 135 Amazon) + 2 Lernregeln; alles auditiert/reversibel.

**Bewusst offen / Handoff:**
1. **PROJ-15 P2 #2** (konfigurierbarer Web-Recherche-Schwellwert in `app_einstellung`) — einziger offener PROJ-15-Teil; Codex-Block aufgelöst, jederzeit nachziehbar.
2. **PROJ-17 Chat**: Code live, aber **Migration 0009 NICHT angewendet** (Guardrail-gated, außerhalb Scope) → Chat-Menüpunkt nicht funktionsfähig bis 0009 freigegeben. Unverändert zum Vorzustand.
3. **343 offene 2025-Prüflisten-Fälle** (kleine Einmal-Empfänger ohne 2026-Pendant) — brauchen einen eingeloggten Klassifizierungs-Lauf (live-UI: Prüfliste-Multiselect „Neu klassifizieren").
4. **Migrations-Tracking-Anomalie**: `0003`/`0004` nicht in `schema_migrations` (Objekte existieren) → **kein** `supabase db push` ohne vorherige Korrektur.
5. **Prompt-Caching Klassifizierung**: auf Opus 4.8 wirkungslos (stabiler Prefix < 4096 Tokens); echter Hebel wäre KI-Chat-Caching (nach 0009).
