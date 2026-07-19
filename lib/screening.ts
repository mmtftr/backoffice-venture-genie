import { z } from "zod";
import { MODELS, TEMPS } from "@/config/models";
import { screeningPrompt } from "@/prompts/screening";
import type { SwarmResult } from "./agents/orchestrate";
import { callLLM } from "./llm";
import { updateFounderScore } from "./memory";
import { Screening, type FounderMemory, type Opportunity, type Thesis } from "./schemas";

export async function screenOpportunity(
  opp: Opportunity,
  swarmResult: SwarmResult,
  thesis: Thesis,
  memory: FounderMemory,
): Promise<Screening> {
  const validIds = new Set(memory.evidence.map((entry) => entry.id));
  const schema = Screening.extend({ founderScoreDelta: z.number().min(-15).max(15) }).superRefine((value, ctx) => {
    const axes = value.axes.map((axis) => axis.axis);
    if (new Set(axes).size !== 3 || !["Founder", "Market", "IdeaVsMarket"].every((axis) => axes.includes(axis as typeof axes[number]))) {
      ctx.addIssue({ code: "custom", message: "axes must contain Founder, Market, and IdeaVsMarket exactly once", path: ["axes"] });
    }
    for (const [axisIndex, axis] of value.axes.entries()) {
      for (const [idIndex, evidenceId] of axis.evidence_ids.entries()) {
        if (!validIds.has(evidenceId)) ctx.addIssue({ code: "custom", message: `unknown evidence id ${evidenceId}`, path: ["axes", axisIndex, "evidence_ids", idIndex] });
      }
    }
  });
  const prompt = screeningPrompt(opp, swarmResult, thesis, memory);
  const screening = await callLLM({
    model: MODELS.main,
    temperature: TEMPS.screening,
    ...prompt,
    schema,
    trace: { opportunityId: opp.id, agent: "screening", action: "score", target: opp.company },
  });
  await updateFounderScore(opp.founder_id, screening.founderScoreDelta, screening.founderScoreReason, { name: memory.name, company: opp.company });
  return screening;
}
