import { HIGH_SIGNAL_INVESTORS, LIMITS } from "@/config/models";
import { getMemory } from "../memory";
import { Thesis, type FounderMemory, type Opportunity } from "../schemas";
import { readJson, THESIS_PATH } from "../store";
import { withTimeout } from "../llm";
import { appendTrace, summarizeTrace } from "../trace";
import { runCommunitySignal } from "./communitySignal";
import { runCompetitorDiscovery } from "./competitorDiscovery";
import { runCompetitorEval } from "./competitorEval";
import { runContradiction } from "./contradiction";
import { extractTeamMembers, runTeamMember } from "./teamMember";
import type {
  AgentContext,
  AgentResult,
  CommunityFinding,
  CompetitorEvalFinding,
  CompetitorFinding,
  ContradictionFinding,
  TeamMemberFinding,
} from "./types";

export interface SwarmResult {
  teamMembers: TeamMemberFinding[];
  competitors: CompetitorFinding[];
  competitorEvals: CompetitorEvalFinding[];
  contradictions: ContradictionFinding["contradictions"];
  community: CommunityFinding;
  evidenceIds: string[];
  summaries: string[];
  traceSummary: string;
}

type AnyResult = AgentResult<unknown>;
type Job = { agent: string; target?: string; run: () => Promise<AnyResult> };
const TIMED_OUT = Symbol("timed-out");

async function runPool(jobs: Job[], ctx: AgentContext, startedAt: number): Promise<Array<{ job: Job; result: AnyResult }>> {
  const output: Array<{ job: Job; result: AnyResult }> = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      const budgetRemaining = Math.max(1, LIMITS.opportunityBudgetMs - (Date.now() - startedAt));
      const timeoutMs = Math.min(LIMITS.perAgentTimeoutMs, budgetRemaining);
      try {
        const result = await withTimeout<AnyResult | typeof TIMED_OUT>(job.run(), timeoutMs, TIMED_OUT);
        if (result === TIMED_OUT) {
          await appendTrace(ctx.opp.id, {
            agent: job.agent,
            action: "timeout",
            ...(job.target ? { target: job.target } : {}),
            detail: `Exceeded ${timeoutMs}ms`,
            evidence_ids: [],
          });
        } else {
          output.push({ job, result });
        }
      } catch (error) {
        await appendTrace(ctx.opp.id, {
          agent: job.agent,
          action: "error",
          ...(job.target ? { target: job.target } : {}),
          detail: error instanceof Error ? error.message.slice(0, 500) : String(error),
          evidence_ids: [],
        }).catch(() => undefined);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIMITS.maxConcurrency, jobs.length) }, () => worker()));
  return output;
}

export async function runSwarm(opp: Opportunity, memory?: FounderMemory, thesis?: Thesis): Promise<SwarmResult> {
  const startedAt = Date.now();
  const resolvedMemory = memory ?? await getMemory(opp.founder_id, { name: opp.founder_id, company: opp.company });
  const storedThesis = thesis ?? Thesis.safeParse(await readJson<unknown>(THESIS_PATH, null)).data;
  const resolvedThesis: Thesis = storedThesis ?? {
    sectors: ["AI Infrastructure", "Developer Tools", "Fintech"],
    geographies: ["EU", "US"],
    stages: ["pre-seed", "seed"],
    checkSizeUsd: 100000,
    ownershipTargetPct: 7,
    riskAppetite: "high",
    highSignalInvestors: HIGH_SIGNAL_INVESTORS,
  };
  const ctx: AgentContext = { opp, memory: resolvedMemory, thesis: resolvedThesis };
  let members = [resolvedMemory.name];
  try {
    const extracted = await withTimeout<string[] | typeof TIMED_OUT>(
      extractTeamMembers(ctx),
      Math.min(LIMITS.perAgentTimeoutMs, LIMITS.opportunityBudgetMs),
      TIMED_OUT,
    );
    if (extracted === TIMED_OUT) {
      await appendTrace(opp.id, { agent: "teamMember", action: "timeout", target: "team extraction", evidence_ids: [] });
    } else if (extracted.length) {
      members = extracted.slice(0, LIMITS.maxTeamMembers);
    }
  } catch (error) {
    await appendTrace(opp.id, {
      agent: "teamMember",
      action: "error",
      target: "team extraction",
      detail: error instanceof Error ? error.message.slice(0, 500) : String(error),
      evidence_ids: [],
    }).catch(() => undefined);
  }

  const firstJobs: Job[] = [
    ...members.map((member) => ({ agent: "teamMember", target: member, run: () => runTeamMember(ctx, member) as Promise<AnyResult> })),
    { agent: "competitorDiscovery", target: opp.company, run: () => runCompetitorDiscovery(ctx) as Promise<AnyResult> },
    { agent: "contradiction", target: opp.company, run: () => runContradiction(ctx) as Promise<AnyResult> },
    { agent: "communitySignal", target: opp.company, run: () => runCommunitySignal(ctx) as Promise<AnyResult> },
  ];
  const first = await runPool(firstJobs, ctx, startedAt);

  const discovery = first.find(({ job }) => job.agent === "competitorDiscovery")?.result as AgentResult<CompetitorFinding[]> | undefined;
  const competitors = discovery?.structured ?? [];
  const evalJobs: Job[] = competitors.slice(0, LIMITS.maxCompetitors).map((competitor) => ({
    agent: "competitorEval",
    target: competitor.name,
    run: () => runCompetitorEval(ctx, competitor.name) as Promise<AnyResult>,
  }));
  const evaluated = await runPool(evalJobs, ctx, startedAt);
  const all = [...first, ...evaluated];

  const teamMembers = all
    .filter(({ job }) => job.agent === "teamMember")
    .map(({ result }) => result.structured as TeamMemberFinding);
  const competitorEvals = all
    .filter(({ job }) => job.agent === "competitorEval")
    .map(({ result }) => result.structured as CompetitorEvalFinding);
  const contradiction = all.find(({ job }) => job.agent === "contradiction")?.result as AgentResult<ContradictionFinding> | undefined;
  const communityResult = all.find(({ job }) => job.agent === "communitySignal")?.result as AgentResult<CommunityFinding> | undefined;
  const traceSummary = await summarizeTrace(opp.id);

  return {
    teamMembers,
    competitors,
    competitorEvals,
    contradictions: contradiction?.structured.contradictions ?? [],
    community: communityResult?.structured ?? { signals: [], note: "no community evidence available" },
    evidenceIds: [...new Set(all.flatMap(({ result }) => result.evidenceIds))],
    summaries: all.map(({ result }) => result.summary),
    traceSummary,
  };
}
