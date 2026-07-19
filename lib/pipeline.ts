import path from "path";
import { z } from "zod";
import { HIGH_SIGNAL_INVESTORS, MODELS, TEMPS } from "@/config/models";
import { getCB, type CBCompany, type CBRound } from "./crunchbase";
import { runSwarm, type SwarmResult } from "./agents/orchestrate";
import { callLLM } from "./llm";
import { appendEvidence, getAllMemories, getMemory } from "./memory";
import { decide, writeMemo } from "./memo";
import { screenOpportunity } from "./screening";
import { Opportunity, Thesis, type FounderMemory } from "./schemas";
import { appendTrace, summarizeTrace } from "./trace";
import { id, listJson, nowIso, OPP_DIR, readJson, THESIS_PATH, writeJson } from "./store";

export const DEFAULT_THESIS: Thesis = {
  sectors: ["AI Infrastructure", "Developer Tools", "Fintech"],
  geographies: ["EU", "US"],
  stages: ["pre-seed", "seed"],
  checkSizeUsd: 100000,
  ownershipTargetPct: 7,
  riskAppetite: "high",
  highSignalInvestors: HIGH_SIGNAL_INVESTORS,
};

export interface OutboundCandidate {
  company: CBCompany;
  rounds: CBRound[];
  fitReason: string;
}

function opportunityPath(opportunityId: string): string {
  return path.join(OPP_DIR, `${opportunityId}.json`);
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || id("founder-");
}

export async function getThesis(): Promise<Thesis> {
  const stored = await readJson<unknown>(THESIS_PATH, null);
  const parsed = Thesis.safeParse(stored);
  if (parsed.success) return parsed.data;
  await writeJson(THESIS_PATH, DEFAULT_THESIS);
  return DEFAULT_THESIS;
}

export async function saveThesis(thesis: Thesis): Promise<void> {
  await writeJson(THESIS_PATH, Thesis.parse(thesis));
}

export async function getOpportunity(opportunityId: string): Promise<Opportunity | null> {
  const raw = await readJson<unknown>(opportunityPath(opportunityId), null);
  const parsed = Opportunity.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const files = await listJson(OPP_DIR);
  const opportunities = await Promise.all(files.map((file) => getOpportunity(file.slice(0, -5))));
  return opportunities.filter((opp): opp is Opportunity => Boolean(opp));
}

async function persist(opp: Opportunity): Promise<void> {
  await writeJson(opportunityPath(opp.id), opp);
}

async function resolveFounder(founderName: string, company: string): Promise<{ founderId: string; memory: FounderMemory }> {
  const memories = await getAllMemories();
  const normalizedName = founderName.trim().toLowerCase();
  const normalizedCompany = company.trim().toLowerCase();
  const existing = memories.find((memory) => memory.name.trim().toLowerCase() === normalizedName)
    ?? memories.find((memory) => memory.company?.trim().toLowerCase() === normalizedCompany);
  const founderId = existing?.founder_id ?? slug(founderName || `${company}-founder`);
  return { founderId, memory: existing ?? await getMemory(founderId, { name: founderName, company }) };
}

async function analyze(opp: Opportunity, seed: { name: string; company: string }, appendDeck = true, includeDecision = true): Promise<Opportunity> {
  let current: Opportunity = { ...opp, status: "analyzing" };
  await persist(current);
  try {
    if (appendDeck && current.deckText) {
      await appendEvidence(current.founder_id, [{ source: "deck", content: current.deckText, tags: ["deck", current.track] }], seed);
    }
    const thesis = await getThesis();
    let memory = await getMemory(current.founder_id, seed);
    const swarm = await runSwarm(current, memory, thesis);
    current = { ...current, traceSummary: swarm.traceSummary };
    await persist(current);

    memory = await getMemory(current.founder_id, seed);
    const screening = await screenOpportunity(current, swarm, thesis, memory);
    current = { ...current, screening };
    await persist(current);

    memory = await getMemory(current.founder_id, seed);
    const memo = await writeMemo(current, swarm, screening, memory);
    current = { ...current, memo };
    await persist(current);

    const decision = includeDecision ? await decide(current, screening, memo, thesis) : current.decision;
    const traceSummary = await summarizeTrace(current.id);
    current = { ...current, ...(decision ? { decision } : {}), traceSummary, status: "screened" };
    await persist(current);
    return current;
  } catch (error) {
    await appendTrace(current.id, {
      agent: "pipeline",
      action: "error",
      target: current.company,
      detail: error instanceof Error ? error.message.slice(0, 1000) : String(error),
      evidence_ids: [],
    }).catch(() => undefined);
    current = { ...current, status: "error", traceSummary: await summarizeTrace(current.id) };
    await persist(current);
    return current;
  }
}

export async function runInbound(
  input: { company: string; founderName: string; deckText: string },
  opportunityId = id("opp_"),
): Promise<Opportunity> {
  const { founderId } = await resolveFounder(input.founderName, input.company);
  const opp: Opportunity = {
    id: opportunityId,
    founder_id: founderId,
    company: input.company,
    track: "inbound",
    createdAt: nowIso(),
    status: "analyzing",
    deckText: input.deckText,
  };
  return analyze(opp, { name: input.founderName, company: input.company });
}

const EU_COUNTRIES = new Set(["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE", "GBR", "CHE", "NOR"]);

function geographyFits(country: string | undefined, geographies: string[]): boolean {
  if (!country || !geographies.length) return true;
  return geographies.some((geo) => {
    const value = geo.toUpperCase();
    return value === country || (value === "US" && country === "USA") || (value === "EU" && EU_COUNTRIES.has(country));
  });
}

function sectorQueries(sector: string): string[] {
  const normalized = sector.toLowerCase();
  if (normalized.includes("ai")) return ["Artificial Intelligence", "Machine Learning", "Cloud Computing"];
  if (normalized.includes("developer")) return ["Developer Tools", "Developer APIs", "Software"];
  if (normalized.includes("fintech")) return ["FinTech", "Finance", "Payments"];
  return [sector];
}

function stageFit(rounds: CBRound[], stages: string[]): boolean {
  const desired = stages.map((stage) => stage.toLowerCase());
  return rounds.some((round) => desired.some((stage) =>
    (stage === "pre-seed" && ["angel", "seed"].includes(round.round_type.toLowerCase()))
      || round.round_type.toLowerCase().includes(stage.replace("pre-", "")),
  ));
}

export async function runOutboundSourcing(thesis: Thesis): Promise<OutboundCandidate[]> {
  const cb = getCB();
  const found = new Map<string, CBCompany>();
  for (const sector of thesis.sectors) {
    for (const category of sectorQueries(sector)) {
      const companies = await cb.searchCompanies({ category, maxResults: 40 });
      for (const company of companies) {
        if (geographyFits(company.country, thesis.geographies)) found.set(company.permalink, company);
      }
    }
  }
  const enriched = await Promise.all([...found.values()].map(async (company) => {
    const rounds = await cb.getRounds(company.name);
    const lastRound = rounds.at(-1);
    const stageMatches = stageFit(rounds, thesis.stages);
    const lastRoundTime = lastRound?.announced_on ? Date.parse(lastRound.announced_on) : 0;
    const score = (stageMatches ? 1e15 : 0) + lastRoundTime * 10 + Math.log10((company.funding_total_usd ?? 0) + 1) * 1e9;
    const matchingSector = thesis.sectors.find((sector) => sectorQueries(sector).some((query) => company.category?.toLowerCase().includes(query.toLowerCase()))) ?? thesis.sectors[0];
    const fitReason = `${matchingSector} category; ${company.country ?? "unknown geography"}; ${stageMatches ? "stage-aligned funding" : "stage requires verification"}; last round ${lastRound?.announced_on ?? "not disclosed"}.`;
    return { company, rounds, fitReason, score };
  }));
  return enriched.sort((a, b) => b.score - a.score).slice(0, 10).map(({ score: _score, ...candidate }) => candidate);
}

export async function activateOutbound(companyName: string, opportunityId = id("opp_")): Promise<Opportunity> {
  const cb = getCB();
  const company = await cb.getCompany(companyName);
  if (!company) throw new Error(`Crunchbase company not found: ${companyName}`);
  const rounds = await cb.getRounds(company.name);
  const founderName = `${company.name} team`;
  const { founderId } = await resolveFounder(founderName, company.name);
  const brief = `[SYNTHESIZED FROM CRUNCHBASE DUMP — NOT A COMPANY-SUPPLIED DECK] ${company.name} is a ${company.category ?? "category-not-disclosed"} company based in ${company.city ?? "an undisclosed city"}, ${company.country ?? "country not disclosed"}. Crunchbase records total funding of ${company.funding_total_usd ?? "not disclosed"} USD across ${rounds.length} retrieved rounds; the latest retrieved round was ${rounds.at(-1)?.announced_on ?? "not disclosed"}.`;
  await appendEvidence(founderId, [
    { source: "crunchbase", content: `Company record: ${JSON.stringify(company)}`, tags: ["crunchbase", "external"] },
    { source: "crunchbase", content: `Funding rounds: ${JSON.stringify(rounds)}`, tags: ["crunchbase", "funding", "external"] },
  ], { name: founderName, company: company.name });
  const opp: Opportunity = {
    id: opportunityId,
    founder_id: founderId,
    company: company.name,
    track: "outbound",
    createdAt: nowIso(),
    status: "analyzing",
    deckText: brief,
  };
  let analyzed = await analyze(opp, { name: founderName, company: company.name });
  if (analyzed.status === "screened") {
    try {
      const thesis = await getThesis();
      const outreach = await callLLM({
        model: MODELS.cheap,
        temperature: TEMPS.summary,
        system: "Draft respectful, concise cold outreach grounded in the supplied thesis and company facts. Never imply it has been sent. Return {draft:string}.",
        user: `Company: ${JSON.stringify(company)}\nThesis: ${JSON.stringify(thesis)}\nDecision context: ${JSON.stringify(analyzed.decision)}`,
        schema: z.object({ draft: z.string().min(1) }),
        trace: { opportunityId: analyzed.id, agent: "outreach", action: "draft", target: analyzed.company },
      });
      analyzed = { ...analyzed, outreachDraft: outreach.draft, traceSummary: await summarizeTrace(analyzed.id) };
      await persist(analyzed);
    } catch (error) {
      await appendTrace(analyzed.id, { agent: "outreach", action: "error", target: analyzed.company, detail: error instanceof Error ? error.message : String(error), evidence_ids: [] });
    }
  }
  return analyzed;
}

export async function rescreenOpportunity(opportunityId: string): Promise<Opportunity> {
  const existing = await getOpportunity(opportunityId);
  if (!existing) throw new Error(`Opportunity not found: ${opportunityId}`);
  const memory = await getMemory(existing.founder_id);
  return analyze({ ...existing, status: "analyzing" }, { name: memory.name, company: existing.company }, false, false);
}

export type { SwarmResult };
