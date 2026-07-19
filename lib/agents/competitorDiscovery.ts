import { z } from "zod";
import { LIMITS, MODELS, TEMPS } from "@/config/models";
import { getCB } from "../crunchbase";
import { callLLM } from "../llm";
import { appendEvidence } from "../memory";
import { appendTrace } from "../trace";
import type { AgentContext, AgentResult, CompetitorFinding } from "./types";

const Competitors = z.object({ competitors: z.array(z.object({
  name: z.string(),
  why: z.string(),
  source: z.enum(["crunchbase", "llm"]),
})).max(LIMITS.maxCompetitors) });

export async function runCompetitorDiscovery(ctx: AgentContext): Promise<AgentResult<CompetitorFinding[]>> {
  const cb = getCB();
  const company = await cb.getCompany(ctx.opp.company);
  const category = company?.category ?? "";
  const candidates = category ? await cb.getCompetitorCandidates(category, ctx.opp.company, 12) : [];
  await appendTrace(ctx.opp.id, {
    agent: "competitorDiscovery",
    action: "queried crunchbase",
    target: category || ctx.opp.company,
    detail: `${candidates.length} candidates`,
    evidence_ids: [],
  });
  const result = await callLLM({
    model: MODELS.agent,
    temperature: TEMPS.agent,
    system: `Select and merge no more than ${LIMITS.maxCompetitors} genuine competitors. Prefer supplied Crunchbase candidates; label any inferred only from deck as llm. Return {"competitors":[{"name":"string","why":"string","source":"crunchbase|llm"}]}.`,
    user: `Target: ${ctx.opp.company}\nCategory: ${category || "unknown"}\nDeck:\n${ctx.opp.deckText ?? "No deck"}\nCrunchbase candidates:\n${JSON.stringify(candidates)}`,
    schema: Competitors,
    trace: { opportunityId: ctx.opp.id, agent: "competitorDiscovery", action: "merge_candidates", target: ctx.opp.company },
  });
  const structured = result.competitors.slice(0, LIMITS.maxCompetitors);
  const summary = structured.length
    ? `Competitors: ${structured.map((item) => `${item.name} (${item.why})`).join("; ")}`
    : "No credible competitors were identified from the supplied data.";
  const evidence = await appendEvidence(ctx.opp.founder_id, [{ source: "agent:competitorDiscovery", content: summary, tags: ["competition", "agent"] }], { name: ctx.memory.name, company: ctx.opp.company });
  return { evidenceIds: evidence.map((entry) => entry.id), summary, structured };
}
