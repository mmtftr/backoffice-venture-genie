export const MODELS = {
  main: process.env.MODEL_MAIN ?? "gpt-5.6-sol",     // smartest: screening, memo, decision, contradiction
  agent: process.env.MODEL_AGENT ?? "gpt-5.6-luna",  // fastest: research swarm agents
  cheap: process.env.MODEL_CHEAP ?? "gpt-5.6-terra", // mini: trace summary, extraction, outreach
} as const;

export const TEMPS = { screening: 0.2, memo: 0.3, agent: 0.4, summary: 0.2 } as const;

export const LIMITS = {
  maxConcurrency: 5,
  maxTeamMembers: 4,
  maxCompetitors: 5,
  perAgentTimeoutMs: 60_000,
  opportunityBudgetMs: 90_000,
} as const;

export const HIGH_SIGNAL_INVESTORS = [
  "Sequoia Capital","Andreessen Horowitz","a16z","Y Combinator","Benchmark","Accel",
  "Founders Fund","Greylock","Index Ventures","Lightspeed Venture Partners","General Catalyst",
  "Khosla Ventures","First Round Capital","Kleiner Perkins","Insight Partners","Tiger Global",
  "Bessemer Venture Partners","New Enterprise Associates","Thrive Capital","SV Angel",
];
