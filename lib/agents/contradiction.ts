import { z } from "zod";
import { MODELS, TEMPS } from "@/config/models";
import { getCB } from "../crunchbase";
import { callLLM } from "../llm";
import { appendEvidence, getMemory } from "../memory";
import { appendTrace } from "../trace";
import type { AgentContext, AgentResult, ContradictionFinding } from "./types";

const Contradictions = z.object({ contradictions: z.array(z.object({
  claim: z.string(),
  conflictsWith: z.string(),
  severity: z.enum(["high", "medium", "low"]),
})) });

export async function runContradiction(ctx: AgentContext): Promise<AgentResult<ContradictionFinding>> {
  const cb = getCB();
  const [company, rounds, currentMemory] = await Promise.all([
    cb.getCompany(ctx.opp.company),
    cb.getRounds(ctx.opp.company),
    getMemory(ctx.opp.founder_id),
  ]);
  await appendTrace(ctx.opp.id, {
    agent: "contradiction",
    action: "queried crunchbase",
    target: ctx.opp.company,
    detail: company ? `${rounds.length} rounds found` : "company not found",
    evidence_ids: [],
  });
  const finding = await callLLM({
    model: MODELS.main,
    temperature: TEMPS.agent,
    system: "Cross-check every concrete deck claim against Crunchbase and all memory evidence. Report direct conflicts, including revenue-vs-pre-revenue and claimed accelerator/funding absent from records, but distinguish absence from a proven conflict. Return {contradictions:[{claim,conflictsWith,severity:'high'|'medium'|'low'}]}.",
    user: `Company: ${ctx.opp.company}\nDeck claims:\n${ctx.opp.deckText ?? "No deck"}\nCrunchbase company:\n${JSON.stringify(company)}\nCrunchbase rounds:\n${JSON.stringify(rounds)}\nALL memory evidence:\n${currentMemory.evidence.map((entry) => `[${entry.id}] ${entry.source} tags=${entry.tags.join(",")}: ${entry.content}`).join("\n")}`,
    schema: Contradictions,
    trace: { opportunityId: ctx.opp.id, agent: "contradiction", action: "cross_check", target: ctx.opp.company },
  });
  const summary = finding.contradictions.length
    ? finding.contradictions.map((item) => `${item.severity}: ${item.claim} conflicts with ${item.conflictsWith}`).join("; ")
    : "No direct contradictions were established from available evidence.";
  const evidence = await appendEvidence(ctx.opp.founder_id, [{ source: "agent:contradiction", content: summary, tags: ["contradiction", "agent"] }], { name: ctx.memory.name, company: ctx.opp.company });
  return { evidenceIds: evidence.map((entry) => entry.id), summary, structured: finding };
}
