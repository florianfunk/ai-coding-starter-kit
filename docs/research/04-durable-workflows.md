# Durable Orchestration mit dem Vercel Workflow DevKit (WDK)

> Design-Dokument: Wie die KI-first-Risikomanagement-Plattform langlaufende, ausfallsichere
> und human-in-the-loop-Prozesse mit dem **Vercel Workflow DevKit** (`workflow`, `@workflow/ai`)
> umsetzt. Ergänzt `03-ai-capabilities.md` (KI-Techniken) und `docs/PROJECT-PLAN.md` (Gesamtarchitektur).
>
> Stack-Kontext: Next.js 16 (App Router) · Supabase (Postgres/Auth/Storage/RLS) · Vercel AI SDK v6
> + AI Gateway (modell-agnostische `"provider/model"`-Strings, Default: aktuelles Claude-Modell) ·
> Deployment auf Vercel (Fluid Compute).

---

## 1. Warum WDK für ein Risikomanagement-Tool?

Risikomanagement besteht zu großen Teilen aus **langlaufenden, mehrstufigen, unterbrechbaren** Abläufen,
die heute bei den Wettbewerbern (Prewave, IntegrityNext, Interos …) als Backend-Pipelines laufen.
WDK macht genau diese Abläufe **crash-sicher, wiederaufnehmbar und auditierbar** – ein direkter
Vorteil für ein reguliertes Tool (LkSG/CSDDD-Nachweispflicht).

| Anforderung im Risk-Tool | WDK-Mechanismus | Geschäftsnutzen |
|---|---|---|
| Adverse-Media-Monitoring läuft täglich, darf nie „verloren“ gehen | `"use workflow"` + Vercel Cron → `start()` | Kein Job geht bei Deploy/Crash verloren |
| KI-Schritte (LLM, OCR) sind teuer & flaky | `"use step"` mit automatischem Retry + Result-Persistenz | Replay ohne teure Neuberechnung |
| Mensch muss kritische Risiken freigeben | `createHook()` (pause/resume) | Echtes Human-in-the-Loop, Tage-langes Warten möglich |
| Due-Diligence-Agent arbeitet autonom über viele Schritte | `DurableAgent` aus `@workflow/ai` | Agent überlebt Neustarts, behält State |
| Jeder Bewertungsschritt muss revisionssicher dokumentiert sein | Step-Results werden persistiert (Replay-Log) | **Lückenloser Audit-Trail = LkSG/CSDDD-Nachweis** |
| Live-Fortschritt im Dashboard | `getWritable()` (ggf. namespaced) | Streaming-UI ohne eigenes WebSocket-Setup |

**Kernregel (aus der WDK-Doku):** Orchestrierung in `"use workflow"`-Funktionen (sandboxed VM),
gesamte I/O-/Node-Logik (DB, fetch, KI, Python-Aufrufe) in `"use step"`-Funktionen (voller Node-Zugriff,
Retry, Persistenz).

---

## 2. Welche Plattform-Prozesse werden zu Workflows?

```
                 ┌──────────────────────────────────────────────────────────┐
                 │  Next.js API Routes  →  start(workflow, [...])             │
                 └──────────────────────────────────────────────────────────┘
   Onboarding ──▶ supplierAssessmentWorkflow   (CoO-Inferenz → EXIOBASE → 16-Risiken → Review-Hook)
   Cron daily ──▶ adverseMediaMonitorWorkflow  (Fetch → LLM-Klassifikation → Alerts → Triage-Hook)
   On demand  ──▶ nTierDiscoveryWorkflow        (DurableAgent: rekursive Tier-N-Lieferanten via GraphRAG)
   Upload     ──▶ documentExtractionWorkflow    (Vision+LLM-Extraktion → Validierung → Korrektur-Hook)
   Cron weekly▶ dataIngestionWorkflow           (Download Index → Normalisieren → Postgres → Rescore)
   On demand  ──▶ reportGenerationWorkflow       (Daten sammeln → DurableAgent-Draft → Freigabe → PDF)
```

### 2.1 `supplierAssessmentWorkflow` — Lieferant/Produkt bewerten

Der Kern-Ablauf aus der ALDI-Methodik (Country-of-Origin → EXIOBASE-Attribution → 16-Risikotypen →
Composite/UFLPA → Confidence → menschliche Freigabe).

```typescript
// app/workflows/supplier-assessment.ts
import { createHook, sleep } from "workflow";
import { z } from "zod";

// --- Steps: voller Node-Zugriff (DB, Python-Bridge, KI) ---
async function inferCountryOfOrigin(productId: string) {
  "use step";
  // LLM-gestützte CoO-Plausibilisierung + Trade-Flow-Begründung (siehe 03-ai-capabilities.md)
  // schreibt Begründung + Confidence nach Supabase
  return { rawMaterialOrigin: "CIV", processing: "DE", manufacturing: "DE", confidence: "MEDIUM" };
}

async function computeSupplyChainShares(productId: string) {
  "use step";
  // EXIOBASE/EEIO: Leontief-Inverse → country-sector shares.
  // pymrio läuft NICHT in Node → vorberechnete Multiplikator-Tabellen in Postgres
  // ODER Aufruf eines Python-Microservice / Vercel Python Function (siehe §6).
  return [{ country: "CIV", sector: "Crops nec", share: 0.62 }];
}

async function scoreRiskType(productId: string, riskType: string) {
  "use step";
  // 1–5-Score aus Index-Schwellenwerten (deterministisch) + LLM-Begründungstext
  return { riskType, score: 4, rationale: "...", sources: ["TVPRA", "Walk Free"] };
}

async function persistAssessment(productId: string, payload: unknown) {
  "use step";
  // Supabase upsert; setzt Status, Composites, UFLPA-Flag, Confidence
}

// --- Orchestrierung: nur Steuerlogik ---
export async function supplierAssessmentWorkflow(productId: string) {
  "use workflow";

  const coo = await inferCountryOfOrigin(productId);
  const shares = await computeSupplyChainShares(productId);

  const RISK_TYPES = ["GHG", "PhysicalClimate", "Biodiversity", "Resource", "Pollution",
    "ChildLabor", "ForcedLabor", "Discrimination", "FreedomOfAssociation", "IndigenousRights",
    "SecurityForces", "UnethicalBusiness", "Wages", "WorkplaceSafety", "WorkingConditions",
    "FundamentalHR"];

  const scores = [];
  for (const rt of RISK_TYPES) scores.push(await scoreRiskType(productId, rt)); // jeder Step: retry+persistiert

  await persistAssessment(productId, { coo, shares, scores });

  // Human-in-the-Loop: bei niedriger Confidence oder Overall-Risk = 5 zur Freigabe stoppen
  const needsReview = coo.confidence === "LOW" || scores.some((s) => s.score === 5);
  if (needsReview) {
    const hook = createHook<{ approved: boolean; reviewer: string; notes?: string }>({
      token: `assessment-review:${productId}`, // deterministischer Token für die Review-UI
    });
    const decision = await hook; // Workflow pausiert – Stunden/Tage ok
    await persistAssessment(productId, { reviewDecision: decision });
  }

  return { productId, status: "assessed" };
}
```

> Freigabe per API-Route: `await resumeHook(`assessment-review:${productId}`, { approved: true, reviewer })`.

### 2.2 `adverseMediaMonitorWorkflow` — kontinuierliches Event-Monitoring

Geplant per **Vercel Cron** (täglich). Pro Portfolio/Lieferant: Quellen abfragen (GDELT, News-API,
OpenSanctions), LLM-Klassifikation (Relevanz, Risikotyp, Severity), Deduplizierung, Alert-Erzeugung.

```typescript
import { sleep, RetryableError } from "workflow";

async function fetchSignals(supplierId: string) {
  "use step"; // Retry bei 429/5xx
  // GDELT / News-API / OpenSanctions … gibt Rohtreffer zurück
}
async function classifyAndDedupe(signals: unknown[]) {
  "use step";
  // LLM: ist relevant? → Risikotyp (1 von 16), Severity (CSDDD scale/scope/irremediability), Dedupe vs. bekannte Events
}
async function raiseAlerts(supplierId: string, events: unknown[]) {
  "use step"; // upsert Events + Benachrichtigungen
}

export async function adverseMediaMonitorWorkflow(supplierId: string) {
  "use workflow";
  const signals = await fetchSignals(supplierId);
  const events = await classifyAndDedupe(signals);
  if (events.length) await raiseAlerts(supplierId, events);
  return { supplierId, newEvents: events.length };
}
```

### 2.3 `nTierDiscoveryWorkflow` — n-Tier-Lieferketten-Discovery (DurableAgent)

Agentischer GraphRAG-Aufbau der mehrstufigen Lieferkette. `DurableAgent` übersteht Neustarts und
behält den Konversations-/Tool-State. Tools = Steps mit Node-/DB-Zugriff.

```typescript
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import type { UIMessageChunk } from "ai";
import { z } from "zod";

async function searchSupplierRelations({ company }: { company: string }) {
  "use step";
  // Web/registry lookup + bestehende Graph-Daten aus Supabase
  return { directSuppliers: ["..."] };
}
async function upsertGraphEdge(edge: { from: string; to: string; tier: number; evidence: string }) {
  "use step";
  // schreibt Kante in den Supply-Chain-Graph (Postgres, ggf. mit pgvector für Evidenz-Embeddings)
}

export async function nTierDiscoveryWorkflow(rootCompany: string, maxTier: number) {
  "use workflow";
  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4-5", // via AI Gateway, modell-agnostisch
    system: "Du baust einen mehrstufigen Lieferketten-Graphen. Nutze Tools, zitiere Belege, "
      + `gehe höchstens ${maxTier} Tiers tief. Kennzeichne Unsicherheiten.`,
    tools: {
      searchSupplierRelations: {
        description: "Findet direkte Zulieferer eines Unternehmens",
        inputSchema: z.object({ company: z.string() }),
        execute: searchSupplierRelations,
      },
      upsertGraphEdge: {
        description: "Speichert eine Lieferbeziehung als Graph-Kante",
        inputSchema: z.object({ from: z.string(), to: z.string(), tier: z.number(), evidence: z.string() }),
        execute: upsertGraphEdge,
      },
    },
  });

  const result = await agent.stream({
    messages: [{ role: "user", content: `Baue den Lieferketten-Graphen für ${rootCompany}.` }],
    writable: getWritable<UIMessageChunk>(), // Live-Stream ins Dashboard
    maxSteps: 40,
  });
  return result.messages;
}
```

### 2.4 `documentExtractionWorkflow` — SAQ / Zertifikat / Audit-PDF

Upload → Vision+LLM-Extraktion → Schema-Validierung (Zod) → Lücken markieren → optionaler
Mensch-Korrektur-Hook → strukturierte Daten in Postgres. (Ersetzt manuelle SAQ-Auswertung der
Wettbewerber.)

### 2.5 `dataIngestionWorkflow` — Index-/Datensatz-Refresh

Pro öffentlichem Index (FAOSTAT, WRI Aqueduct, DOL TVPRA, Walk Free, ITUC, INFORM, ND-GAIN …):
Download → Normalisieren auf 1–5-Schwellen → Postgres-Load (idempotent) → betroffene
Produkt-Scores neu berechnen (`rescore`-Child-Workflow). Cadence je Quelle (siehe Datenstrategie im
Projektplan). Idempotenz über Content-Hash, damit Replays nicht doppelt laden.

### 2.6 `reportGenerationWorkflow` — LkSG-/CSRD-Bericht

Daten sammeln (Steps) → `DurableAgent` erzeugt zitierten Berichtsentwurf (RAG über Regulatorik +
eigene Risikodaten) → Freigabe-Hook (Compliance-Verantwortliche) → PDF/Export. Pause/Resume erlaubt
Reviewzyklen über Tage.

---

## 3. Human-in-the-Loop (Freigaben, Triage, Korrekturen)

Hooks sind der entscheidende Baustein für ein **defensibles** Tool:

```typescript
// Einmal-Event (Freigabe)
const hook = createHook<{ approved: boolean }>({ token: `review:${id}` });
const { approved } = await hook;

// Mehrere Events (z.B. iterative Korrekturen an einem Dokument)
const hook = createHook<{ field: string; value: string; done?: boolean }>({ token: `edit:${docId}` });
for await (const ev of hook) { await applyCorrection(ev); if (ev.done) break; }
```

Resume aus einer API-Route: `await resumeHook(token, payload)`. Für externe Systeme/Webhooks
`createWebhook()` (immer zufällige Tokens, kein `token`-Argument).

---

## 4. Fehlerbehandlung & Idempotenz

```typescript
import { FatalError, RetryableError } from "workflow";
if (res.status === 429) throw new RetryableError("Rate limited", { retryAfter: "5m" });
if (res.status >= 400 && res.status < 500) throw new FatalError(`Client error ${res.status}`);
```

- **Steps müssen idempotent sein** (Upsert statt Insert, Content-Hashes), da sie bei Replay erneut laufen können.
- Externe API-Limits (News, Sanctions, FAOSTAT) → `RetryableError` mit `retryAfter`.
- Dauerhaft falsche Eingaben → `FatalError` (kein Retry), Workflow meldet Fehler sauber.

## 5. Streaming & Observability

- `getWritable()` (in Steps oder via Step aus dem Workflow) für Live-Fortschritt im Dashboard.
- **Namespaced Streams** trennen wichtige Ergebnisse von Debug-Logs:
  `getWritable({ namespace: "agent:thoughts" })` vs. Default-Stream für Endergebnisse — wichtig bei
  langen Monitoring-Läufen (Replay nur der relevanten Events).
- CLI/Dashboard: `npx workflow web`, `npx workflow inspect run <id>` (Debugging/Observability).

## 6. EXIOBASE / pymrio — die Python-Einschränkung

EEIO/MRIO-Berechnungen (`pymrio`, Leontief-Inverse) sind **Python**, nicht Node. Optionen:
1. **Vorberechnung (empfohlen für MVP):** Multiplikatoren & Country-Sector-Shares offline mit pymrio
   berechnen, Ergebnis-Tabellen nach Postgres laden. Der `computeSupplyChainShares`-Step liest nur noch.
2. **Python-Microservice / Vercel Python Function:** Step ruft per `fetch` einen Python-Endpoint
   (Fluid Compute unterstützt Python 3.13/3.14) für On-the-fly-Berechnungen auf.
3. **Reines Node-Approximationsmodell** nur als Fallback (Genauigkeitsverlust).

> Empfehlung: MVP mit Vorberechnung (Variante 1), später Python-Service (Variante 2) für
> kundenspezifische Produktkörbe.

## 7. Auditierbarkeit = Compliance-Vorteil

Jeder Step persistiert sein Ergebnis (Replay-Journal). Daraus ergibt sich quasi kostenlos ein
**revisionssicherer Audit-Trail**: Welcher Index-Wert, welches LLM-Urteil, welche menschliche Freigabe
zu welchem Score geführt hat — exakt das, was LkSG-/CSDDD-Prüfungen verlangen. Kombiniert mit
Quellenzitaten (RAG) und Confidence-Scores aus `03-ai-capabilities.md` entsteht ein nachweisbar
begründetes Risikoassessment statt einer „Black Box“.

## 8. Setup-Checkliste (für die spätere Implementierung, NICHT jetzt)

- [ ] `npm i workflow @workflow/ai` (+ `@workflow/next`); `withWorkflow` in `next.config` integrieren
- [ ] Workflows unter `app/workflows/`, Trigger über API-Routes (`start()`), Cron in `vercel.ts`/`vercel.json`
- [ ] AI Gateway-Key als Env-Var; Modell-Strings `"anthropic/<model>"` modell-agnostisch
- [ ] Supabase-Schema für Audit-/Event-/Graph-Tabellen (siehe Projektplan & Methodik-Doku)
- [ ] `@workflow/vitest` für Integrationstests (Hooks/Sleep/Retry) – passt zur bestehenden Vitest-Konvention
- [ ] WDK-Doku gegenlesen: nach Installation `node_modules/workflow/docs/**` (Skill verlangt aktuelle Doku)

---

### Einordnung
WDK ist die **Orchestrierungs-/Durability-Schicht**; die **KI-Techniken** stehen in
`03-ai-capabilities.md`, die **fachliche Methodik** in `02-risk-methodology.md`, der
**Gesamtplan + Master-Build-Prompt** in `docs/PROJECT-PLAN.md`. Nach Abschluss der Hintergrund-Recherche
werden WDK-Bausteine dort referenziert (Architektur-Abschnitt + Build-Prompt).
