import path from "path";
import { z } from "zod";
import { MODELS, TEMPS } from "@/config/models";
import type { TraceEvent } from "./schemas";
import { id, nowIso, readJson, TRACE_DIR, writeJson } from "./store";

const locks = new Map<string, Promise<unknown>>();

function tracePath(opportunityId: string): string {
  return path.join(TRACE_DIR, `${opportunityId}.json`);
}

export async function getTrace(opportunityId: string): Promise<TraceEvent[]> {
  return readJson<TraceEvent[]>(tracePath(opportunityId), []);
}

export async function appendTrace(
  opportunityId: string,
  ev: Omit<TraceEvent, "id" | "opportunity_id" | "ts">,
): Promise<TraceEvent> {
  const work = async () => {
    const events = await getTrace(opportunityId);
    const event: TraceEvent = {
      ...ev,
      evidence_ids: [...ev.evidence_ids],
      id: id("tr_"),
      opportunity_id: opportunityId,
      ts: nowIso(),
    };
    await writeJson(tracePath(opportunityId), [...events, event]);
    return event;
  };
  const prior = locks.get(opportunityId) ?? Promise.resolve();
  const result = prior.then(work, work);
  const tail = result.then(() => undefined, () => undefined);
  locks.set(opportunityId, tail);
  try { return await result; } finally {
    if (locks.get(opportunityId) === tail) locks.delete(opportunityId);
  }
}

export async function summarizeTrace(opportunityId: string): Promise<string> {
  const events = await getTrace(opportunityId);
  const raw = events.map((event) => {
    const target = event.target ? ` target=${event.target}` : "";
    const detail = event.detail ? ` detail=${event.detail.replace(/\s+/g, " ")}` : "";
    return `${event.ts} agent=${event.agent} action=${event.action}${target}${detail}`;
  });
  const fallback = raw.slice(-6).map((line) => `- ${line}`).join("\n") || "- No agent actions were recorded.";
  try {
    const { callLLM } = await import("./llm");
    const result = await callLLM({
      model: MODELS.cheap,
      temperature: TEMPS.summary,
      system: "Summarize trace log lines as 3-6 past-tense bullets naming concrete agents and actions. Return JSON shape: {\"bullets\": [\"string\"]}.",
      user: raw.join("\n"),
      schema: z.object({ bullets: z.array(z.string()).min(1).max(6) }),
    });
    return result.bullets.map((bullet) => `- ${bullet.replace(/^[-*]\s*/, "")}`).join("\n");
  } catch {
    return fallback;
  }
}
