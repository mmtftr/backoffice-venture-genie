import { loadEnvConfig } from "@next/env";
import { promises as fs } from "fs";
import path from "path";
import { seed, SeedProfile, type SeedProfile as SeedProfileType } from "./seed";
import { DATA_DIR, listJson, readJson } from "../lib/store";

loadEnvConfig(process.cwd());
process.env.CB_MODE = "dump";

let failures = 0;
function check(condition: unknown, label: string): asserts condition {
  if (condition) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

function hasForbiddenAverage(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenAverage);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => /average|averaged|overallscore|combinedscore/i.test(key) || hasForbiddenAverage(child));
}

async function profiles(): Promise<SeedProfileType[]> {
  const dir = path.join(DATA_DIR, "seed");
  const output: SeedProfileType[] = [];
  for (const file of await listJson(dir)) {
    const parsed = SeedProfile.safeParse(await readJson<unknown>(path.join(dir, file), null));
    if (parsed.success) output.push(parsed.data);
  }
  return output;
}

async function main() {
  const seeded = await seed();
  check(seeded.profiles > 0, "1. seed ok");
  const allProfiles = await profiles();
  const normal = allProfiles.find((profile) => profile.profile === "normal") ?? allProfiles[0];
  const contradiction = allProfiles.find((profile) => profile.profile === "contradiction");
  const cold = allProfiles.find((profile) => profile.profile === "cold_start_code" || profile.profile === "cold_start_minimal");
  check(normal, "normal inbound seed profile exists");
  check(contradiction, "contradiction seed profile exists");
  check(cold, "cold-start seed profile exists");
  if (!normal || !contradiction || !cold) throw new Error("Required seed profiles missing");

  const { activateOutbound, getThesis, rescreenOpportunity, runInbound, runOutboundSourcing } = await import("../lib/pipeline");
  const { getMemory } = await import("../lib/memory");

  const inbound = await runInbound({ company: normal.company, founderName: normal.name, deckText: normal.deckMarkdown });
  check(inbound.status === "screened" && inbound.screening, "2. inbound screening completed");
  const axes = inbound.screening?.axes ?? [];
  check(axes.length === 3 && new Set(axes.map((axis) => axis.axis)).size === 3, "2. three independent axis fields present");
  check(!hasForbiddenAverage(inbound), "2. no averaged field anywhere");
  const inboundMemory = await getMemory(inbound.founder_id);
  const evidenceIds = new Set(inboundMemory.evidence.map((entry) => entry.id));
  check(axes.every((axis) => axis.evidence_ids.every((evidenceId) => evidenceIds.has(evidenceId))), "2. screening evidence IDs resolve to Memory");

  const contradicted = await runInbound({ company: contradiction.company, founderName: contradiction.name, deckText: contradiction.deckMarkdown });
  const contradictedClaims = contradicted.memo?.sections.flatMap((section) => section.claims) ?? [];
  check((contradicted.memo?.redFlags.length ?? 0) >= 1, "3. contradiction produced a red flag");
  check(contradictedClaims.some((claim) => claim.confidence_0_1 < 0.4), "3. contradiction depressed claim confidence below 0.4");

  const coldResult = await runInbound({ company: cold.company, founderName: cold.name, deckText: cold.deckMarkdown });
  check(Boolean(coldResult.screening?.coldStart), "4. cold-start branch selected");
  check(coldResult.screening?.substitutionRung !== "funding_track_record" && coldResult.screening?.substitutionRung !== "none", "4. Signal Substitution Ladder used a fallback rung");

  const candidates = await runOutboundSourcing(await getThesis());
  check(candidates.length >= 3, "5. outbound sourcing returned at least three ranked candidates");
  const activated = candidates[0] ? await activateOutbound(candidates[0].company.name) : null;
  check(Boolean(activated?.outreachDraft), "5. activated outbound opportunity has outreachDraft");

  const beforeMemory = await getMemory(inbound.founder_id);
  const beforeHistory = beforeMemory.founderScoreHistory.map((point) => JSON.stringify(point));
  await rescreenOpportunity(inbound.id);
  const afterMemory = await getMemory(inbound.founder_id);
  check(afterMemory.founderScoreHistory.length > beforeHistory.length, "6. rescreen grew FounderScore history");
  check(beforeHistory.every((point, index) => JSON.stringify(afterMemory.founderScoreHistory[index]) === point), "6. old FounderScore entries remained byte-identical");

  const rescanned = await (await import("../lib/pipeline")).getOpportunity(inbound.id);
  const summary = rescanned?.traceSummary ?? "";
  const agentNames = ["teamMember", "competitorDiscovery", "competitorEval", "contradiction", "communitySignal", "screening", "memo", "decision"];
  check(agentNames.filter((name) => summary.toLowerCase().includes(name.toLowerCase())).length >= 3, "7. traceSummary mentions at least three distinct agent names");

  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
