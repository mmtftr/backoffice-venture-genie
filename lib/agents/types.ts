import type { FounderMemory, Opportunity, Thesis } from "../schemas";

export interface AgentContext {
  opp: Opportunity;
  memory: FounderMemory;
  thesis: Thesis;
}

export interface AgentResult<T> {
  evidenceIds: string[];
  summary: string;
  structured: T;
}

export interface TeamMemberFinding {
  member: string;
  strengths: string[];
  concerns: string[];
  schoolTier: "top" | "mid" | "unknown";
  priorOutputs: string[];
}

export interface CompetitorFinding {
  name: string;
  why: string;
  source: "crunchbase" | "llm";
}

export interface CompetitorEvalFinding {
  competitor: string;
  investorSignal: "high" | "medium" | "low" | "unknown";
  trajectory: string;
  threat: "high" | "medium" | "low";
}

export interface ContradictionFinding {
  contradictions: Array<{
    claim: string;
    conflictsWith: string;
    severity: "high" | "medium" | "low";
  }>;
}

export interface CommunityFinding {
  signals: Array<{ source: string; signal: string; evidence_id: string }>;
  note: string;
}
