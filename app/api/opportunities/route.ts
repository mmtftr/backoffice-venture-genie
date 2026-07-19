import { NextResponse } from "next/server";
import { getThesis, listOpportunities } from "@/lib/pipeline";
import type { Opportunity, Thesis } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const SECTOR_STOP_WORDS = new Set(["and", "for", "of", "the", "tech", "technology", "technologies"]);
const STAGE_ALIASES: Record<string, string[]> = {
  "pre seed": ["pre seed", "preseed", "angel"],
  seed: ["seed", "seed stage"],
  "series a": ["series a"],
  "series b": ["series b"],
  "series c": ["series c"],
  growth: ["growth stage", "growth equity"],
  late: ["late stage"],
};
const GEOGRAPHY_ALIASES: Record<string, string[]> = {
  eu: [
    "eu", "europe", "european", "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia",
    "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "ireland", "italy",
    "latvia", "lithuania", "luxembourg", "malta", "netherlands", "poland", "portugal", "romania",
    "slovakia", "slovenia", "spain", "sweden", "switzerland", "norway", "che", "deu", "fra",
  ],
  us: ["usa", "u s", "united states", "united states of america", "american"],
  uk: ["uk", "u k", "united kingdom", "britain", "british", "england", "scotland", "wales", "gbr"],
};

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  return Boolean(normalizedPhrase) && ` ${text} `.includes(` ${normalizedPhrase} `);
}

function opportunityText(opportunity: Opportunity): string {
  const memo = opportunity.memo;
  return [
    opportunity.company,
    opportunity.deckText,
    memo?.company,
    ...(memo?.sections.flatMap((section) => [
      section.title,
      section.prose,
      ...section.claims.flatMap((claim) => [claim.text, ...claim.contradictions]),
    ]) ?? []),
    ...(memo?.redFlags ?? []),
    ...(memo?.gaps ?? []),
  ].filter((value): value is string => Boolean(value)).join(" ");
}

function sectorFit(sectors: string[], normalizedText: string): number {
  if (!sectors.length) return 1;
  const textTokens = new Set(normalizedText.split(" ").filter(Boolean));
  return Math.max(0, ...sectors.map((sector) => {
    if (containsPhrase(normalizedText, sector)) return 1;
    const tokens = normalize(sector).split(" ").filter((token) => token && !SECTOR_STOP_WORDS.has(token));
    if (!tokens.length) return 0;
    return tokens.filter((token) => textTokens.has(token)).length / tokens.length;
  }));
}

function aliasesFor(value: string, aliases: Record<string, string[]>): string[] {
  const normalizedValue = normalize(value);
  return [normalizedValue, ...(aliases[normalizedValue] ?? [])];
}

function hintFit(values: string[], normalizedText: string, aliases: Record<string, string[]>): number {
  if (!values.length) return 1;
  if (values.some((value) => aliasesFor(value, aliases).some((hint) => containsPhrase(normalizedText, hint)))) return 1;
  const hasKnownHint = Object.values(aliases).flat().some((hint) => containsPhrase(normalizedText, hint));
  return hasKnownHint ? 0 : 0.5;
}

function liveThesisFit(opportunity: Opportunity, thesis: Thesis): number {
  const text = normalize(opportunityText(opportunity));
  const sector = sectorFit(thesis.sectors, text);
  const stage = hintFit(thesis.stages, text, STAGE_ALIASES);
  const geography = hintFit(thesis.geographies, text, GEOGRAPHY_ALIASES);
  return 0.6 * sector + 0.2 * stage + 0.2 * geography;
}

export async function GET() {
  const [opportunities, thesis] = await Promise.all([listOpportunities(), getThesis()]);
  const ranked = opportunities.map((opportunity) => {
    const liveHeuristic = liveThesisFit(opportunity, thesis);
    const storedFit = opportunity.screening?.thesisFit_0_1 ?? 0;
    const thesisFitLive = 0.5 * storedFit + 0.5 * liveHeuristic;
    return { opportunity, thesisFitLive };
  });
  ranked.sort((a, b) => b.thesisFitLive - a.thesisFitLive || b.opportunity.createdAt.localeCompare(a.opportunity.createdAt));
  return NextResponse.json(ranked.map(({ opportunity, thesisFitLive }) => ({ ...opportunity, thesisFitLive })));
}
