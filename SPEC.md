# VC Brain — Implementation Spec (designed by orchestrator; implement exactly)

Local Next.js 15 App-Router app (this repo) implementing VC Sourcing → Screening → Diligence → Decision. TypeScript, Tailwind (already scaffolded), zod + openai installed, `tsx` dev-dep available for scripts. No DB — `data/` JSON files. All LLM calls server-side. Env in `.env.local`: `OPENAI_API_KEY`, `CB_MODE=dump`, `MODEL_MAIN=gpt-4o`, `MODEL_CHEAP=gpt-4o-mini`.

**Global rules:**
- Model names ONLY from `config/models.ts`.
- Every LLM call via `lib/llm.ts` (zod-validated JSON output, retry once on parse failure, emits a TraceEvent).
- Memory is append-only. Never mutate/overwrite past evidence or score history.
- Never fabricate data for memo gaps — emit explicit `gaps: ["Cap table: not disclosed", ...]`.
- Axis scores are NEVER averaged into one number anywhere (code or UI).
- One full opportunity analysis must finish < ~90s: concurrency cap 5, max 4 team members, max 5 competitors, per-agent timeout 60s with graceful partial results.
- If an LLM call ultimately fails, degrade gracefully (skip that agent, record a trace event `action: "error"`), never crash the pipeline.

## 1. Verbatim foundation files

Create these EXACTLY as given (they are the designed contracts).

### config/models.ts
```ts
export const MODELS = {
  main: process.env.MODEL_MAIN ?? "gpt-5.6-sol",     // smartest: screening, memo, decision
  agent: process.env.MODEL_AGENT ?? "gpt-5.6-luna",  // fastest: research swarm agents
  cheap: process.env.MODEL_CHEAP ?? "gpt-5.6-terra", // mini: trace summary, extraction, outreach
} as const;

export const TEMPS = { screening: 0.2, memo: 0.3, agent: 0.4, summary: 0.2 } as const;

export const LIMITS = {
  maxConcurrency: 5,
  maxTeamMembers: 4,
  maxCompetitors: 5,
  perAgentTimeoutMs: 60_000,
  opportunityBudgetMs: 90_000,
} as const;

export const HIGH_SIGNAL_INVESTORS = [
  "Sequoia Capital","Andreessen Horowitz","a16z","Y Combinator","Benchmark","Accel",
  "Founders Fund","Greylock","Index Ventures","Lightspeed Venture Partners","General Catalyst",
  "Khosla Ventures","First Round Capital","Kleiner Perkins","Insight Partners","Tiger Global",
  "Bessemer Venture Partners","New Enterprise Associates","Thrive Capital","SV Angel",
];
```

### lib/schemas.ts
```ts
import { z } from "zod";

export const EvidenceEntry = z.object({
  id: z.string(),
  founder_id: z.string(),
  source: z.string(),
  ts: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  hash: z.string().optional(),
});
export type EvidenceEntry = z.infer<typeof EvidenceEntry>;

export const TraceEvent = z.object({
  id: z.string(),
  opportunity_id: z.string(),
  agent: z.string(),
  action: z.string(),
  target: z.string().optional(),
  ts: z.string(),
  detail: z.string().optional(),
  evidence_ids: z.array(z.string()).default([]),
});
export type TraceEvent = z.infer<typeof TraceEvent>;

export const Trend = z.enum(["improving", "stable", "declining"]);
export type Trend = z.infer<typeof Trend>;

export const AxisName = z.enum(["Founder", "Market", "IdeaVsMarket"]);
export type AxisName = z.infer<typeof AxisName>;

export const AxisScore = z.object({
  axis: AxisName,
  score_0_100: z.number().min(0).max(100),
  trend: Trend,
  evidence_ids: z.array(z.string()).default([]),
  rationale: z.string(),
});
export type AxisScore = z.infer<typeof AxisScore>;

export const Verification = z.enum(["internal", "external", "unverified"]);

export const Claim = z.object({
  text: z.string(),
  evidence_ids: z.array(z.string()).default([]),
  confidence_0_1: z.number().min(0).max(1),
  verification: Verification,
  contradictions: z.array(z.string()).default([]),
});
export type Claim = z.infer<typeof Claim>;

export const FounderScorePoint = z.object({
  ts: z.string(),
  score_0_100: z.number().min(0).max(100),
  delta: z.number(),
  reason: z.string(),
});
export type FounderScorePoint = z.infer<typeof FounderScorePoint>;

export const FounderMemory = z.object({
  founder_id: z.string(),
  name: z.string(),
  company: z.string().optional(),
  evidence: z.array(EvidenceEntry).default([]),
  founderScoreHistory: z.array(FounderScorePoint).default([]),
});
export type FounderMemory = z.infer<typeof FounderMemory>;

export const Thesis = z.object({
  sectors: z.array(z.string()),
  geographies: z.array(z.string()),
  stages: z.array(z.string()),
  checkSizeUsd: z.number(),
  ownershipTargetPct: z.number(),
  riskAppetite: z.enum(["low", "medium", "high"]),
  highSignalInvestors: z.array(z.string()),
});
export type Thesis = z.infer<typeof Thesis>;

export const MemoSection = z.object({
  title: z.string(),
  claims: z.array(Claim).default([]),
  prose: z.string().default(""),
});
export type MemoSection = z.infer<typeof MemoSection>;

export const Memo = z.object({
  company: z.string(),
  founder_id: z.string(),
  sections: z.array(MemoSection),
  redFlags: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  trustScore_0_1: z.number().min(0).max(1),
});
export type Memo = z.infer<typeof Memo>;

export const SubstitutionRung = z.enum([
  "funding_track_record","github_code_cadence","public_writing_papers",
  "community_footprint","application_quality","none",
]);
export type SubstitutionRung = z.infer<typeof SubstitutionRung>;

export const Screening = z.object({
  founder_id: z.string(),
  company: z.string(),
  axes: z.array(AxisScore).length(3),
  founderScoreDelta: z.number(),
  founderScoreReason: z.string(),
  coldStart: z.boolean(),
  substitutionRung: SubstitutionRung,
  thesisFit_0_1: z.number().min(0).max(1),
});
export type Screening = z.infer<typeof Screening>;

export const Decision = z.object({
  founder_id: z.string(),
  company: z.string(),
  recommendation: z.enum(["invest", "pass", "watch"]),
  thesisRationale: z.string(),
  whyThisCouldFail: z.string(),
});
export type Decision = z.infer<typeof Decision>;

export const Opportunity = z.object({
  id: z.string(),
  founder_id: z.string(),
  company: z.string(),
  track: z.enum(["inbound", "outbound"]),
  createdAt: z.string(),
  status: z.enum(["new", "analyzing", "screened", "error"]).default("new"),
  deckText: z.string().optional(),
  screening: Screening.optional(),
  memo: Memo.optional(),
  decision: Decision.optional(),
  traceSummary: z.string().optional(),
  outreachDraft: z.string().optional(),
});
export type Opportunity = z.infer<typeof Opportunity>;
```

### lib/store.ts
```ts
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const DATA_DIR = path.join(process.cwd(), "data");
export const MEMORY_DIR = path.join(DATA_DIR, "memory");
export const TRACE_DIR = path.join(DATA_DIR, "trace");
export const OPP_DIR = path.join(DATA_DIR, "opportunities");
export const THESIS_PATH = path.join(DATA_DIR, "thesis.json");

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; } catch { return fallback; }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function listJson(dir: string): Promise<string[]> {
  try { return (await fs.readdir(dir)).filter((f) => f.endsWith(".json")); } catch { return []; }
}

export function id(prefix = ""): string {
  return prefix + crypto.randomBytes(8).toString("hex");
}

export function contentHash(...parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

export function nowIso(): string { return new Date().toISOString(); }
```

### lib/memory.ts — append-only Memory (implement with exactly these exports)
```ts
getMemory(founderId, seed?: {name, company?}): Promise<FounderMemory>   // returns empty shell if new
listFounderIds(): Promise<string[]>
getAllMemories(): Promise<FounderMemory[]>
appendEvidence(founderId, entries: Array<Omit<EvidenceEntry,"id"|"founder_id"|"ts"|"hash">>, seed?): Promise<EvidenceEntry[]>
  // dedupe: hash = contentHash(source, content); if hash exists, return the PRIOR entry, don't append.
  // build a NEW object for the write (immutability), append only.
updateFounderScore(founderId, delta, reason, seed?): Promise<FounderScorePoint>
  // base = last point's score, else 50; clamp 0..100; APPEND a point, never rewrite history.
currentFounderScore(mem): number  // last point or 50
resolveEvidence(mem, ids): EvidenceEntry[]
```
Memory files: `data/memory/<founder_id>.json` (a FounderMemory).

### lib/trace.ts
```ts
getTrace(opportunityId): Promise<TraceEvent[]>          // data/trace/<oppId>.json
appendTrace(opportunityId, ev: Omit<TraceEvent,"id"|"opportunity_id"|"ts">): Promise<TraceEvent>
summarizeTrace(opportunityId): Promise<string>
  // MODELS.cheap consumes ONLY the trace log lines; 3-6 past-tense bullets naming concrete
  // agent actions. On LLM failure, fall back to the raw bullet list. Never throws.
```

## 2. lib/llm.ts — the ONLY LLM gateway
```ts
callLLM<T>(opts: {
  model: string; temperature: number;
  system: string; user: string;
  schema: z.ZodType<T>;                 // response validated against this
  trace?: { opportunityId: string; agent: string; action: string; target?: string };
}): Promise<T>
```
Implementation: OpenAI chat.completions with `response_format: { type: "json_object" }`. System prompt must instruct: respond ONLY with a JSON object matching the described shape (describe the shape in the system prompt from the caller's prompt file). On zod parse failure: retry ONCE appending the zod error to the prompt; then throw. If `trace` given, appendTrace before the call (`action`) and after (`action + ":done"`, detail = 1-line result gist). Also export `withTimeout<T>(p, ms, fallback)` helper.

## 3. lib/crunchbase.ts — one interface, two backends (`CB_MODE=dump|live`)
```ts
export interface CBCompany { name: string; permalink: string; category?: string; country?: string;
  city?: string; funding_total_usd?: number; status?: string; founded_at?: string; }
export interface CBRound { company: string; round_type: string; raised_usd?: number;
  announced_on?: string; investors: string[]; }
export interface CB {
  searchCompanies(q: { text?: string; category?: string; country?: string; maxResults?: number }): Promise<CBCompany[]>;
  getCompany(name: string): Promise<CBCompany | null>;
  getRounds(companyName: string): Promise<CBRound[]>;
  getCompetitorCandidates(category: string, exclude: string, max?: number): Promise<CBCompany[]>;
}
export function getCB(): CB  // reads CB_MODE; on live failure auto-fallback to dump + trace it
```
**Dump backend** (default, must work): parse `data/crunchbase-2015/*.csv` — `companies.csv` (permalink,name,homepage_url,category_list,funding_total_usd,status,country_code,state_code,region,city,funding_rounds,founded_at,first_funding_at,last_funding_at), `rounds.csv` (company_permalink,company_name,...,funding_round_type,funded_at,raised_amount_usd), `investments.csv` (adds investor_name per round). Simple CSV parser (handle quoted fields), lazy-load once into module-level indexed Maps (by lowercased name and permalink; category index). `getRounds` joins rounds + investments investor names. `getCompetitorCandidates(category, exclude)`: companies sharing a category token, ranked by funding_total_usd desc.
**Live backend**: stub that throws "live mode not configured" (auto-fallback covers it) — keep the seam clean.

## 4. Agents (`lib/agents/*.ts`) + orchestrator
Each agent: input = opportunity context (company, deckText, founder name(s)) + Memory snapshot + thesis; may call `getCB()`; MUST emit trace events via llm.ts trace opts (plus extra appendTrace for non-LLM steps like "queried crunchbase"); MUST append findings to Memory as EvidenceEntries (source = `agent:<name>`), and return `{ evidenceIds, summary, structured }`.

- `teamMember.ts` — one call per team member (extract members from deck text first — cheap model, max 4): background, prior outputs, school tier AND excellence-within-school, connections. Structured out: `{ member, strengths[], concerns[], schoolTier: "top"|"mid"|"unknown", priorOutputs[] }`.
- `competitorDiscovery.ts` — from deck + `getCompetitorCandidates` on the company's category: produce ≤5 competitors `{ name, why, source: "crunchbase"|"llm" }`. Query CB first; the LLM merges/filters.
- `competitorEval.ts` — one per competitor: team quality *as judged by their existing investors* (use `getRounds` investor names vs HIGH_SIGNAL_INVESTORS + thesis.highSignalInvestors), funding trajectory (round sizes/dates). Out: `{ competitor, investorSignal: "high"|"medium"|"low"|"unknown", trajectory: string, threat: "high"|"medium"|"low" }`.
- `contradiction.ts` — cross-check deck claims vs Crunchbase data vs ALL evidence in Memory. Out: `{ contradictions: [{ claim, conflictsWith, severity: "high"|"medium"|"low" }] }`. Seeded profiles contain real contradictions — this must catch e.g. deck-claimed MRR vs website "pre-revenue", claimed accelerator not in CB.
- `communitySignal.ts` — NO live web access: operate ONLY on evidence already in Memory tagged `community`/`hn`/`ph`/`reddit`/`github`; if none, return explicitly `{ signals: [], note: "no community evidence available" }` and say so in the trace.

`orchestrate.ts` — `runSwarm(opp: Opportunity): Promise<SwarmResult>`: fan-out [one teamMember per member (≤4), competitorDiscovery → then competitorEval per discovered (≤5), contradiction, communitySignal] with concurrency cap 5 (simple promise-pool), per-agent `withTimeout` 60s → on timeout append trace `action:"timeout"` and continue with partial results. Collect all structured results + evidenceIds. Then `summarizeTrace`.

## 5. Screening (`lib/screening.ts` + `prompts/screening.ts`) — CORE IP, follow rubric verbatim
`screenOpportunity(opp, swarmResult, thesis, memory)` → `Screening` via ONE MODELS.main call. The rubric prompt (`prompts/screening.ts`, exported template string builder) MUST encode:
1. **Funding-signal analysis**: investor identity vs high-signal allowlist (from thesis config); round size vs stage norms; **recency decay** — last round >18mo old with no follow-on = explicit negative signal to state in rationale.
2. **Team**: per-member agent findings; school tier AND demonstrated excellence within school; prior outputs; connection hints. Synthesize a **team harmony** judgment: skill complementarity, prior collaboration, build+sell coverage.
3. **Competitive team benchmark**: this team vs competitor teams *as judged by competitors' existing investors* (revealed-quality signal from competitorEval).
4. **Traction skepticism**: deck/website numbers are LOW-trust by default; distrust suspiciously round or AI-generated-looking figures; upgrade confidence only with corroborating community signals or Crunchbase confirmation.
5. **Signal Substitution Ladder (cold-start branch, mandatory, use this exact name)**: if no funding/track record, descend: github_code_cadence → public_writing_papers → community_footprint → application_quality. Output MUST state which rung was used (`substitutionRung`; `funding_track_record` when track record exists; `none` only if literally nothing).
6. Output: three independent AxisScores (Founder / Market / IdeaVsMarket) each with trend + evidence_ids (real ids from Memory/swarm) + rationale; `founderScoreDelta` (-15..+15) + reason; `coldStart`; `thesisFit_0_1` judged against the injected thesis config. NEVER any combined average.
The Founder axis takes the persistent FounderScore (current value + trend from history) as ONE input, not a substitute.
After screening: call `updateFounderScore(founder_id, delta, reason)`.

## 6. Memo + decision (`lib/memo.ts`, `prompts/memo.ts`)
`writeMemo(opp, swarmResult, screening, memory)` → `Memo` via MODELS.main. Exactly 5 sections titled: "Company snapshot", "Investment hypotheses", "SWOT", "Problem & product", "Traction & KPIs". Every claim = `{text, evidence_ids[], confidence_0_1, verification, contradictions[]}` — evidence_ids MUST be real Memory entry ids (pass id+content list in prompt). Missing data → `gaps` ("Cap table: not disclosed"). Contradiction-agent findings MUST appear in `redFlags` AND depress confidence (<0.4) of affected claims. `trustScore_0_1` = fraction of claims with verification != "unverified", weighted by confidence (compute in code, not LLM).
`decide(opp, screening, memo, thesis)` → `Decision` via MODELS.main: invest/pass/watch + thesis-fit rationale + adversarial "why this could fail" paragraph.

## 7. Pipeline assembly (`lib/pipeline.ts`)
`runInbound({company, founderName, deckText})`: create Opportunity (status analyzing) → append deck as evidence (source "deck") → runSwarm → screen → memo → decide → summarizeTrace → save Opportunity (status screened) to `data/opportunities/<id>.json`. Persist progressively so UI can poll.
`runOutboundSourcing(thesis)`: query dump for companies matching thesis sectors/geo/stage (searchCompanies + rounds recency), rank by heuristic thesis fit (code, no LLM), return top 10 `{company: CBCompany, rounds, fitReason}`.
`activateOutbound(companyName)`: fetch CB data → create Opportunity(track outbound, deckText = synthesized one-para brief from CB data labeled as such) → run same pipeline → plus `outreachDraft` via MODELS.cheap (respectful cold outreach citing the thesis; RENDER ONLY, never send).

## 8. API routes (app/api/**/route.ts) — exact surface (UI is built against this)
- `GET  /api/opportunities` → `Opportunity[]` (sorted by screening.thesisFit desc, unscreened last)
- `GET  /api/opportunities/:id` → `{ opportunity, trace: TraceEvent[], memory: FounderMemory }`
- `POST /api/inbound` body `{company, founderName, deckText}` → `{ id }` (fire pipeline async, don't block response; status polling via GET)
- `POST /api/outbound/source` → `{ candidates: [{company, rounds, fitReason}] }`
- `POST /api/outbound/activate` body `{companyName}` → `{ id }`
- `GET/PUT /api/thesis` → Thesis (PUT validates with zod)
- `POST /api/rescreen` body `{opportunityId}` → `{ id }` re-runs swarm+screen+memo on existing opp (appends new FounderScore point — history grows)
Default thesis (write to data/thesis.json if missing): sectors ["AI Infrastructure","Developer Tools","Fintech"], geographies ["EU","US"], stages ["pre-seed","seed"], checkSizeUsd 100000, ownershipTargetPct 7, riskAppetite "high", highSignalInvestors = HIGH_SIGNAL_INVESTORS.

## 9. Scripts
- `scripts/seed.ts` — load `data/seed/*.json` profiles into Memory (evidence entries incl. deck text, community snippets, github snippets per profile) + write thesis.json. Idempotent (dedupe handles re-runs).
- `scripts/e2e.ts` — with CB_MODE=dump and REAL LLM calls; run with `npx tsx scripts/e2e.ts`; asserts (exit 1 on failure, log each PASS/FAIL):
  1. seed ok; 2. inbound on seeded deck → 3 axes present, all different fields, no averaged field anywhere, evidence_ids resolve to Memory entries; 3. seeded-contradiction profile → ≥1 redFlag + ≥1 claim confidence <0.4; 4. cold-start profile → substitutionRung != funding_track_record and != none; 5. outbound source → ≥3 ranked candidates; activate → outreachDraft present; 6. rescreen founder → founderScoreHistory length increased AND old entries byte-identical; 7. traceSummary mentions ≥3 distinct agent names.
- package.json scripts: `"seed": "tsx scripts/seed.ts"`, `"e2e": "tsx scripts/e2e.ts"`.

## 10. Seed data (data/seed/*.json) — separate agent generates; schema for each file:
```json
{ "founder_id": "kebab-id", "name": "...", "company": "...",
  "deckMarkdown": "...", "profile": "cold_start_code" | "cold_start_minimal" | "contradiction" | "normal",
  "evidence": [ { "source": "github|hn|ph|website|accelerator|press", "content": "...", "tags": ["community"] } ] }
```

## 11. UI (app/) — dark, professional, Tailwind only (no component lib). Pages:
- `/` pipeline table: rank, company, founder, 3 axis chips (score + trend arrow ↑→↓, color by score), FounderScore sparkline (inline SVG from history), thesisFit %, status, track badge (inbound/outbound). Row click → detail. Poll every 3s while any status=analyzing.
- `/opportunity/[id]`: header (company, founder, recommendation badge invest/pass/watch); red-flag banner if redFlags; 3 axis cards (score, trend, rationale, evidence count) — NEVER a combined score; Signal Substitution Ladder indicator when coldStart (highlight used rung of the 4); memo sections with per-claim Trust badges (green ≥0.7 / yellow ≥0.4 / red <0.4; icon for verification type; click → shared evidence dialog with markdown-rendered resolved entries incl. source+timestamp+tags — also reachable from axis-card evidence counts, trace-event evidence counts, and `ev_…` ids inside red flags); gaps list ("not disclosed" chips); "Why this could fail" adversarial box; Agent Activity summary (from traceSummary) with expandable raw trace table (agent, action, target, ts); outreachDraft card for outbound.
- `/thesis`: form for all Thesis fields incl. editable high-signal investor list (tag input), PUT on save.
- `/inbound`: company + founder name + deck textarea (paste text; PDF out of scope) → POST → redirect to detail (polling).
- `/outbound`: "Run sourcing" button → candidate table (name, category, country, last round, fitReason) → per-row "Activate" → POST activate → link to detail.
Keep it clean: dark slate background, one accent color, monospace numbers. UX is 15% of judging — competent, not gold-plated.

Added post-spec (UI/UX pass): first-visit 5-step onboarding modal explaining the system (localStorage-gated, reopenable via a "How it works" nav button); ⓘ InfoTip popovers documenting each mechanism (axis columns/cards, FounderScore, thesis fit, ladder, trust chips, agent trace, red flags, page headers); a dependency-free React `Markdown` renderer used for memo prose, claim text, and evidence content. Components: `InfoTip.tsx`, `Onboarding.tsx`, `EvidenceDialog.tsx`, `Markdown.tsx`, `format.ts`.
