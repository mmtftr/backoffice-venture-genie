# Venture Genie 🧠

**An agentic operating system for early-stage venture capital — deploying $100K-check conviction in 24 hours, with every claim traced to evidence.**

Built for the [Hack-Nation](https://hack-nation.ai) 6th Global AI Hackathon · Challenge 02 (Maschmeyer Group).

> Capital flows through networks, not merit. Venture Genie makes a founder's potential something a system can see and reason about directly — including founders with zero track record and zero connections.

## What it does

**Sourcing → Screening → Diligence → Decision**, end to end:

- 🗄️ **Append-only Memory** — every evidence entry timestamped, source-tagged, deduplicated, never overwritten. Houses a persistent **Founder Score** that compounds across applications: ship once, and your next application starts stronger.
- 🎯 **Thesis Engine** — sectors, stage, geography, check size, ownership, risk appetite; every score filtered through the fund's lens. Change the thesis, watch the pipeline re-rank.
- 🤖 **Research agent swarm** — per opportunity: one agent per team member, competitor discovery, per-competitor evaluation (teams judged by who backed them), contradiction detection, community signals. **Every agent action emits a trace event**, summarized into a plain-language activity feed.
- 📊 **Multi-axis screening** — Founder / Market / Idea-vs-Market scored independently with trends. **Never averaged.**
- 🔎 **Natural-language queries** — "technical founder, Berlin, AI infra, no prior VC backing" → LLM-compiled, Zod-validated filter spec over the evidence store, with matched-evidence chips.
- 📡 **Live community signals** — a Hacker News (Algolia) connector streams real signals into Memory as traced, source-tagged evidence.
- 📝 **Evidence-backed memos with Trust Scores** — every claim carries evidence IDs, confidence, and verification status. Missing data is flagged ("Cap table: not disclosed"), never invented. Contradictions become red flags *before* the recommendation.
- 🪜 **Signal Substitution Ladder** — the cold-start answer: no funding history → public code cadence → public writing → community footprint → application quality. Output states which rung was used.
- 📥📤 **Inbound + outbound → one funnel** — founders apply with a deck; the system also sources proactively against the thesis, activates the strongest matches, and drafts (never sends) outreach — both tracks feed the same screening step.

## Quick start

```bash
git clone https://github.com/mmtftr/backoffice-venture-genie && cd backoffice-venture-genie
npm install
cp .env.example .env.local   # add your OpenAI API key
npm run seed                 # loads 9 synthetic founder profiles — including a seeded-contradiction
                             # founder and two cold-start founders, so the money shots reproduce
npm run dev                  # → http://localhost:3000
```

| Env var | Purpose |
|---|---|
| `OPENAI_API_KEY` | LLM calls (all traced through one wrapper) — required |
| `MODEL_MAIN` / `MODEL_AGENT` / `MODEL_CHEAP` | optional three-tier routing overrides (defaults in `config/models.ts`) |
| `CB_MODE` | `dump` (bundled 2015 Crunchbase data, default) or `live` |
| `DATA_DIR` | optional data-dir override (used for serverless deploys) |

Model names/temperatures live in `config/models.ts` — single source of truth.

## Architecture

```
Experience   pipeline table · founder detail (memo + trust badges + trace) · thesis config · inbound/outbound
Intelligence Thesis Engine → agent swarm (fan-out/fan-in, capped, traced) → 3-axis screening → memo + trust scores → decision
Memory       append-only JSON evidence store · Founder Score history · trace log · Crunchbase (live | 2015 dump)
```

Key invariants enforced in code:
- Memory is **append-only** — mutation of past entries is a bug.
- **No untraced LLM calls** — everything goes through `lib/llm.ts` (Zod-validated structured outputs, retry-once-on-parse-failure, trace emission).
- **No axis averaging** — anywhere.
- **No fabricated data** — gaps produce explicit "not disclosed / unavailable" flags.

## Testing

```bash
npm run e2e   # real LLM calls (~3-4 min, a few cents); needs OPENAI_API_KEY in .env.local; exits non-zero on failure
```

17 assertions covering: 3 independent axis scores (never averaged), evidence IDs resolving to append-only Memory, seeded-contradiction detection (red flag + claim confidence <0.4), cold-start Signal Substitution Ladder rung selection, outbound sourcing + outreach draft, FounderScore history append-only across rescreens (old entries byte-identical), and trace summaries naming 3+ agents. Seeds itself idempotently and forces `CB_MODE=dump`.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · OpenAI API · Zod · local JSON datastore (no DB server).

## Team

Human (product judgment + real VC heuristics) orchestrating an AI agent team: an implementation agent building the app and a submission agent producing docs/videos/deploy — in parallel. The team structure mirrors the product.

---
*Hack-Nation 6th Global AI Hackathon — Challenge 02: "The VC Brain: Deploying $100K Checks in 24 Hours", powered by Maschmeyer Group.*
