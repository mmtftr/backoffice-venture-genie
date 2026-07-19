import type { FounderMemory, Opportunity, Thesis } from "@/lib/schemas";
import type { SwarmResult } from "@/lib/agents/orchestrate";
import { HIGH_SIGNAL_INVESTORS } from "@/config/models";
import { currentFounderScore } from "@/lib/memory";

export function screeningPrompt(opp: Opportunity, swarm: SwarmResult, thesis: Thesis, memory: FounderMemory): { system: string; user: string } {
  const highSignal = [...new Set([...HIGH_SIGNAL_INVESTORS, ...thesis.highSignalInvestors])];
  return {
    system: `You are a disciplined VC screening system. Return exactly this JSON shape:
{"founder_id":"string","company":"string","axes":[{"axis":"Founder|Market|IdeaVsMarket","score_0_100":0,"trend":"improving|stable|declining","evidence_ids":["real-id"],"rationale":"string"}],"founderScoreDelta":0,"founderScoreReason":"string","coldStart":true,"substitutionRung":"funding_track_record|github_code_cadence|public_writing_papers|community_footprint|application_quality|none","thesisFit_0_1":0.0}
Return exactly three independent axes, once each: Founder, Market, IdeaVsMarket. Never average or combine them. founderScoreDelta must be between -15 and +15.

Apply this rubric verbatim in substance:
1. Funding-signal analysis: compare investor identity against the injected high-signal allowlist; assess round size against stage norms; apply recency decay. A last round more than 18 months old with no follow-on is an explicit negative signal and must be stated in a rationale.
2. Team: use per-member findings; assess school tier AND demonstrated excellence within school, prior outputs, and connection hints. Synthesize team harmony: skill complementarity, prior collaboration, and build+sell coverage.
3. Competitive team benchmark: compare this team with competitor teams as judged by competitors' existing investors, using competitorEval as a revealed-quality signal.
4. Traction skepticism: deck/website numbers are LOW-trust by default. Distrust suspiciously round or AI-generated-looking figures. Upgrade confidence only with corroborating community signals or Crunchbase confirmation.
5. Signal Substitution Ladder (cold-start branch, mandatory): when funding/track record is absent, descend in this exact order: github_code_cadence → public_writing_papers → community_footprint → application_quality. Set substitutionRung to the rung actually used; use funding_track_record when track record exists and none only when literally nothing exists.
6. Judge thesisFit_0_1 against the injected thesis. Each axis must cite only real evidence IDs from the supplied list.
The persistent FounderScore and its trend are one input to the Founder axis, never a substitute for the independent axis judgment.`,
    user: `Opportunity: ${JSON.stringify({ id: opp.id, founder_id: opp.founder_id, company: opp.company, track: opp.track, deckText: opp.deckText })}
Thesis: ${JSON.stringify(thesis)}
High-signal investor allowlist: ${JSON.stringify(highSignal)}
Persistent FounderScore: ${currentFounderScore(memory)}
FounderScore history: ${JSON.stringify(memory.founderScoreHistory)}
Swarm structured findings: ${JSON.stringify(swarm)}
Allowed evidence (cite IDs only from here):\n${memory.evidence.map((entry) => `[${entry.id}] source=${entry.source} tags=${entry.tags.join(",")}: ${entry.content}`).join("\n")}`,
  };
}
