import { z } from "zod";
import { MODELS, TEMPS } from "@/config/models";
import { memoPrompt, MEMO_SECTION_TITLES } from "@/prompts/memo";
import type { SwarmResult } from "./agents/orchestrate";
import { callLLM } from "./llm";
import { Memo, Decision, type FounderMemory, type Opportunity, type Screening, type Thesis } from "./schemas";

function overlap(a: string, b: string): number {
  const left = new Set(a.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  return (b.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((word) => left.has(word)).length;
}

export async function writeMemo(
  opp: Opportunity,
  swarmResult: SwarmResult,
  screening: Screening,
  memory: FounderMemory,
): Promise<Memo> {
  const validIds = new Set(memory.evidence.map((entry) => entry.id));
  const schema = Memo.superRefine((value, ctx) => {
    if (value.sections.length !== MEMO_SECTION_TITLES.length || !MEMO_SECTION_TITLES.every((title, index) => value.sections[index]?.title === title)) {
      ctx.addIssue({ code: "custom", message: "memo must have the five exact section titles in order", path: ["sections"] });
    }
    value.sections.forEach((section, sectionIndex) => section.claims.forEach((claim, claimIndex) => claim.evidence_ids.forEach((evidenceId, idIndex) => {
      if (!validIds.has(evidenceId)) ctx.addIssue({ code: "custom", message: `unknown evidence id ${evidenceId}`, path: ["sections", sectionIndex, "claims", claimIndex, "evidence_ids", idIndex] });
    })));
  });
  const generated = await callLLM({
    model: MODELS.main,
    temperature: TEMPS.memo,
    ...memoPrompt(opp, swarmResult, screening, memory),
    schema,
    trace: { opportunityId: opp.id, agent: "memo", action: "write", target: opp.company },
  });

  const sections = generated.sections.map((section) => ({
    ...section,
    claims: section.claims.map((claim) => ({ ...claim, evidence_ids: claim.evidence_ids.filter((evidenceId) => validIds.has(evidenceId)), contradictions: [...claim.contradictions] })),
  }));
  const redFlags = [...generated.redFlags];
  const contradictionEvidence = memory.evidence.filter((entry) => entry.source === "agent:contradiction").map((entry) => entry.id);
  for (const contradiction of swarmResult.contradictions) {
    const flag = `${contradiction.severity}: ${contradiction.claim} conflicts with ${contradiction.conflictsWith}`;
    if (!redFlags.includes(flag)) redFlags.push(flag);
    const claims = sections.flatMap((section) => section.claims);
    const affected = claims.sort((a, b) => overlap(contradiction.claim, b.text) - overlap(contradiction.claim, a.text))[0];
    if (affected && overlap(contradiction.claim, affected.text) > 0) {
      affected.confidence_0_1 = Math.min(affected.confidence_0_1, 0.39);
      if (!affected.contradictions.includes(flag)) affected.contradictions.push(flag);
    } else {
      sections[0].claims.push({
        text: `Deck claim under dispute: ${contradiction.claim}`,
        evidence_ids: contradictionEvidence,
        confidence_0_1: 0.3,
        verification: "unverified",
        contradictions: [flag],
      });
    }
  }
  const claims = sections.flatMap((section) => section.claims);
  const totalWeight = claims.reduce((sum, claim) => sum + claim.confidence_0_1, 0);
  const verifiedWeight = claims.reduce((sum, claim) => sum + (claim.verification === "unverified" ? 0 : claim.confidence_0_1), 0);
  const trustScore_0_1 = totalWeight ? verifiedWeight / totalWeight : 0;
  const gaps = [...generated.gaps];
  if (!memory.evidence.some((entry) => /cap table|ownership breakdown|shareholding/i.test(entry.content)) && !gaps.some((gap) => /cap table/i.test(gap))) {
    gaps.push("Cap table: not disclosed");
  }
  return Memo.parse({ ...generated, sections, redFlags, gaps, trustScore_0_1 });
}

export async function decide(opp: Opportunity, screening: Screening, memo: Memo, thesis: Thesis): Promise<Decision> {
  return callLLM({
    model: MODELS.main,
    temperature: TEMPS.memo,
    system: "Make a thesis-aware VC recommendation. Give an adversarial paragraph explaining why the opportunity could fail. Do not compute or mention any combined/average axis score. Return {founder_id:string,company:string,recommendation:'invest'|'pass'|'watch',thesisRationale:string,whyThisCouldFail:string}.",
    user: `Opportunity: ${JSON.stringify({ founder_id: opp.founder_id, company: opp.company, track: opp.track })}\nThesis: ${JSON.stringify(thesis)}\nIndependent screening axes: ${JSON.stringify(screening)}\nMemo: ${JSON.stringify(memo)}`,
    schema: Decision,
    trace: { opportunityId: opp.id, agent: "decision", action: "recommend", target: opp.company },
  });
}
