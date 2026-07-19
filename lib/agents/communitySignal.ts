import { appendEvidence, getMemory } from "../memory";
import { appendTrace } from "../trace";
import { searchHN } from "../connectors/hn";
import type { AgentContext, AgentResult, CommunityFinding } from "./types";

const COMMUNITY_TAGS = new Set(["community", "hn", "ph", "reddit", "github"]);

export async function runCommunitySignal(ctx: AgentContext): Promise<AgentResult<CommunityFinding>> {
  const liveHits = await searchHN(ctx.opp.company);
  const liveEvidence = liveHits.length
    ? await appendEvidence(
      ctx.opp.founder_id,
      liveHits.map((hit) => ({
        source: "hn",
        content: `HN: ${hit.title} (${hit.points} points, ${hit.num_comments} comments, ${hit.created_at}) ${hit.url}`,
        tags: ["community", "live"],
      })),
      { name: ctx.memory.name, company: ctx.opp.company },
    )
    : [];
  await appendTrace(ctx.opp.id, {
    agent: "communitySignal",
    action: "query:hn-live",
    target: ctx.opp.company,
    detail: `${liveHits.length} hits`,
    evidence_ids: liveEvidence.map((entry) => entry.id),
  });

  const mem = await getMemory(ctx.opp.founder_id);
  const available = mem.evidence.filter((entry) => entry.tags.some((tag) => COMMUNITY_TAGS.has(tag.toLowerCase())));
  if (!available.length) {
    const structured: CommunityFinding = { signals: [], note: "no community evidence available" };
    await appendTrace(ctx.opp.id, {
      agent: "communitySignal",
      action: "no community evidence available",
      target: ctx.opp.company,
      evidence_ids: [],
    });
    return { evidenceIds: [], summary: structured.note, structured };
  }
  const signals = available.map((entry) => ({ source: entry.source, signal: entry.content, evidence_id: entry.id }));
  const summary = `Community evidence available: ${signals.map((signal) => `${signal.source}: ${signal.signal}`).join("; ")}`;
  const findingEvidence = await appendEvidence(ctx.opp.founder_id, [{ source: "agent:communitySignal", content: summary, tags: ["community", "agent"] }], { name: ctx.memory.name, company: ctx.opp.company });
  await appendTrace(ctx.opp.id, {
    agent: "communitySignal",
    action: "reviewed existing evidence",
    target: ctx.opp.company,
    detail: `${signals.length} community signals`,
    evidence_ids: signals.map((signal) => signal.evidence_id),
  });
  return { evidenceIds: [...signals.map((signal) => signal.evidence_id), ...findingEvidence.map((entry) => entry.id)], summary, structured: { signals, note: "community evidence reviewed" } };
}
