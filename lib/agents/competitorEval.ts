import { z } from "zod";
import { HIGH_SIGNAL_INVESTORS, MODELS, TEMPS } from "@/config/models";
import { getCB } from "../crunchbase";
import { callLLM } from "../llm";
import { appendEvidence } from "../memory";
import { appendTrace } from "../trace";
import type { AgentContext, AgentResult, CompetitorEvalFinding } from "./types";

const CompetitorEval = z.object({
  competitor: z.string(),
  investorSignal: z.enum(["high", "medium", "low", "unknown"]),
  trajectory: z.string(),
  threat: z.enum(["high", "medium", "low"]),
});

export async function runCompetitorEval(ctx: AgentContext, competitor: string): Promise<AgentResult<CompetitorEvalFinding>> {
  const rounds = await getCB().getRounds(competitor);
  await appendTrace(ctx.opp.id, {
    agent: "competitorEval",
    action: "queried crunchbase",
    target: competitor,
    detail: `${rounds.length} funding rounds`,
    evidence_ids: [],
  });
  const allowlist = [...new Set([...HIGH_SIGNAL_INVESTORS, ...ctx.thesis.highSignalInvestors])];
  const finding = await callLLM({
    model: MODELS.agent,
    temperature: TEMPS.agent,
    system: "Evaluate the competitor's revealed team-quality signal from its existing investors and its funding trajectory from round dates/sizes. Do not invent team facts. Return {competitor, investorSignal:'high'|'medium'|'low'|'unknown', trajectory:string, threat:'high'|'medium'|'low'}.",
    user: `Competitor: ${competitor}\nTarget: ${ctx.opp.company}\nHigh-signal investor allowlist: ${allowlist.join(", ")}\nRounds and investors:\n${JSON.stringify(rounds)}`,
    schema: CompetitorEval,
    trace: { opportunityId: ctx.opp.id, agent: "competitorEval", action: "evaluate", target: competitor },
  });
  const summary = `${finding.competitor}: investor signal=${finding.investorSignal}; trajectory=${finding.trajectory}; threat=${finding.threat}.`;
  const evidence = await appendEvidence(ctx.opp.founder_id, [{ source: "agent:competitorEval", content: summary, tags: ["competition", "funding", "agent"] }], { name: ctx.memory.name, company: ctx.opp.company });
  return { evidenceIds: evidence.map((entry) => entry.id), summary, structured: finding };
}
