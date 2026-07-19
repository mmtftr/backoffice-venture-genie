import type { FounderMemory, Opportunity, Screening } from "@/lib/schemas";
import type { SwarmResult } from "@/lib/agents/orchestrate";

export const MEMO_SECTION_TITLES = [
  "Company snapshot",
  "Investment hypotheses",
  "SWOT",
  "Problem & product",
  "Traction & KPIs",
] as const;

export function memoPrompt(opp: Opportunity, swarm: SwarmResult, screening: Screening, memory: FounderMemory): { system: string; user: string } {
  return {
    system: `Write an evidence-grounded investment memo. Return exactly:
{"company":"string","founder_id":"string","sections":[{"title":"string","claims":[{"text":"string","evidence_ids":["real-id"],"confidence_0_1":0.0,"verification":"internal|external|unverified","contradictions":["string"]}],"prose":"string"}],"redFlags":["string"],"gaps":["Field: not disclosed"],"trustScore_0_1":0}
Use exactly five sections in this exact order and with exact titles: ${MEMO_SECTION_TITLES.map((title) => `"${title}"`).join(", ")}.
Every factual claim must cite only real IDs from the supplied evidence list. Use verification=internal for deck/application-only evidence, external for Crunchbase/community/independent evidence, and unverified when unsupported. Never fabricate missing data: add explicit gaps such as "Cap table: not disclosed". Every contradiction-agent finding must appear in redFlags and on affected claims in contradictions; affected claim confidence must be below 0.4. Ignore trustScore_0_1 calculation—the application computes it deterministically.`,
    user: `Opportunity: ${JSON.stringify({ company: opp.company, founder_id: opp.founder_id, track: opp.track, deckText: opp.deckText })}
Screening: ${JSON.stringify(screening)}
Swarm findings: ${JSON.stringify(swarm)}
Allowed evidence (id + content):\n${memory.evidence.map((entry) => `[${entry.id}] ${entry.source}: ${entry.content}`).join("\n")}`,
  };
}
