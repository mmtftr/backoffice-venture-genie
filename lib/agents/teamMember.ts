import { z } from "zod";
import { LIMITS, MODELS, TEMPS } from "@/config/models";
import { callLLM } from "../llm";
import { appendEvidence } from "../memory";
import type { AgentContext, AgentResult, TeamMemberFinding } from "./types";

const TeamMembers = z.object({ members: z.array(z.string()).max(LIMITS.maxTeamMembers) });
const TeamFinding = z.object({
  member: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  schoolTier: z.enum(["top", "mid", "unknown"]),
  priorOutputs: z.array(z.string()),
});

export async function extractTeamMembers(ctx: AgentContext): Promise<string[]> {
  const result = await callLLM({
    model: MODELS.agent,
    temperature: TEMPS.summary,
    system: `Extract explicitly named founders and team members. Include at most ${LIMITS.maxTeamMembers}. Return {"members":["Full Name"]}.`,
    user: `Founder on record: ${ctx.memory.name}\nCompany: ${ctx.opp.company}\nDeck:\n${ctx.opp.deckText ?? "No deck provided"}`,
    schema: TeamMembers,
    trace: { opportunityId: ctx.opp.id, agent: "teamMember", action: "extract_team", target: ctx.opp.company },
  });
  return [...new Set([ctx.memory.name, ...result.members].filter(Boolean))].slice(0, LIMITS.maxTeamMembers);
}

export async function runTeamMember(ctx: AgentContext, member: string): Promise<AgentResult<TeamMemberFinding>> {
  const finding = await callLLM({
    model: MODELS.agent,
    temperature: TEMPS.agent,
    system: "Assess one team member using only supplied material. Separate school prestige from demonstrated excellence within that school. Connections must be treated as hints, not facts. Return {member, strengths:string[], concerns:string[], schoolTier:'top'|'mid'|'unknown', priorOutputs:string[]}.",
    user: `Member: ${member}\nCompany: ${ctx.opp.company}\nDeck:\n${ctx.opp.deckText ?? "No deck"}\nExisting evidence:\n${ctx.memory.evidence.map((entry) => `[${entry.id}] ${entry.source}: ${entry.content}`).join("\n")}`,
    schema: TeamFinding,
    trace: { opportunityId: ctx.opp.id, agent: "teamMember", action: "evaluate", target: member },
  });
  const summary = `${finding.member}: strengths=${finding.strengths.join("; ") || "none stated"}; concerns=${finding.concerns.join("; ") || "none"}; school tier=${finding.schoolTier}; prior outputs=${finding.priorOutputs.join("; ") || "none found"}.`;
  const evidence = await appendEvidence(ctx.opp.founder_id, [{ source: "agent:teamMember", content: summary, tags: ["team", "agent"] }], { name: ctx.memory.name, company: ctx.opp.company });
  return { evidenceIds: evidence.map((entry) => entry.id), summary, structured: finding };
}
