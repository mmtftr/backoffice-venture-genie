import { z } from "zod";

export const EvidenceEntry = z.object({
  id: z.string(),
  founder_id: z.string(),
  source: z.string(),
  ts: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  hash: z.string().optional(),
});
export type EvidenceEntry = z.infer<typeof EvidenceEntry>;

export const TraceEvent = z.object({
  id: z.string(),
  opportunity_id: z.string(),
  agent: z.string(),
  action: z.string(),
  target: z.string().optional(),
  ts: z.string(),
  detail: z.string().optional(),
  evidence_ids: z.array(z.string()).default([]),
});
export type TraceEvent = z.infer<typeof TraceEvent>;

export const Trend = z.enum(["improving", "stable", "declining"]);
export type Trend = z.infer<typeof Trend>;

export const AxisName = z.enum(["Founder", "Market", "IdeaVsMarket"]);
export type AxisName = z.infer<typeof AxisName>;

export const AxisScore = z.object({
  axis: AxisName,
  score_0_100: z.number().min(0).max(100),
  trend: Trend,
  evidence_ids: z.array(z.string()).default([]),
  rationale: z.string(),
});
export type AxisScore = z.infer<typeof AxisScore>;

export const Verification = z.enum(["internal", "external", "unverified"]);

export const Claim = z.object({
  text: z.string(),
  evidence_ids: z.array(z.string()).default([]),
  confidence_0_1: z.number().min(0).max(1),
  verification: Verification,
  contradictions: z.array(z.string()).default([]),
});
export type Claim = z.infer<typeof Claim>;

export const FounderScorePoint = z.object({
  ts: z.string(),
  score_0_100: z.number().min(0).max(100),
  delta: z.number(),
  reason: z.string(),
});
export type FounderScorePoint = z.infer<typeof FounderScorePoint>;

export const FounderMemory = z.object({
  founder_id: z.string(),
  name: z.string(),
  company: z.string().optional(),
  evidence: z.array(EvidenceEntry).default([]),
  founderScoreHistory: z.array(FounderScorePoint).default([]),
});
export type FounderMemory = z.infer<typeof FounderMemory>;

export const Thesis = z.object({
  sectors: z.array(z.string()),
  geographies: z.array(z.string()),
  stages: z.array(z.string()),
  checkSizeUsd: z.number(),
  ownershipTargetPct: z.number(),
  riskAppetite: z.enum(["low", "medium", "high"]),
  highSignalInvestors: z.array(z.string()),
});
export type Thesis = z.infer<typeof Thesis>;

export const MemoSection = z.object({
  title: z.string(),
  claims: z.array(Claim).default([]),
  prose: z.string().default(""),
});
export type MemoSection = z.infer<typeof MemoSection>;

export const Memo = z.object({
  company: z.string(),
  founder_id: z.string(),
  sections: z.array(MemoSection),
  redFlags: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  trustScore_0_1: z.number().min(0).max(1),
});
export type Memo = z.infer<typeof Memo>;

export const SubstitutionRung = z.enum([
  "funding_track_record","github_code_cadence","public_writing_papers",
  "community_footprint","application_quality","none",
]);
export type SubstitutionRung = z.infer<typeof SubstitutionRung>;

export const Screening = z.object({
  founder_id: z.string(),
  company: z.string(),
  axes: z.array(AxisScore).length(3),
  founderScoreDelta: z.number(),
  founderScoreReason: z.string(),
  coldStart: z.boolean(),
  substitutionRung: SubstitutionRung,
  thesisFit_0_1: z.number().min(0).max(1),
});
export type Screening = z.infer<typeof Screening>;

export const Decision = z.object({
  founder_id: z.string(),
  company: z.string(),
  recommendation: z.enum(["invest", "pass", "watch"]),
  thesisRationale: z.string(),
  whyThisCouldFail: z.string(),
});
export type Decision = z.infer<typeof Decision>;

export const Opportunity = z.object({
  id: z.string(),
  founder_id: z.string(),
  company: z.string(),
  track: z.enum(["inbound", "outbound"]),
  createdAt: z.string(),
  status: z.enum(["new", "analyzing", "screened", "error"]).default("new"),
  deckText: z.string().optional(),
  screening: Screening.optional(),
  memo: Memo.optional(),
  decision: Decision.optional(),
  traceSummary: z.string().optional(),
  outreachDraft: z.string().optional(),
});
export type Opportunity = z.infer<typeof Opportunity>;
