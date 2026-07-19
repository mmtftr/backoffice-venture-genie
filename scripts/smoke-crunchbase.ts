import { getCB } from "../lib/crunchbase";

process.env.CB_MODE = "dump";

async function main() {
  const cb = getCB();
  const company = await cb.getCompany("Uber");
  const rounds = await cb.getRounds("Uber");
  if (!company) throw new Error("Crunchbase dump smoke failed: Uber not found");
  if (!rounds.length) throw new Error("Crunchbase dump smoke failed: Uber rounds not found");
  if (!rounds.some((round) => round.investors.length > 0)) throw new Error("Crunchbase dump smoke failed: Uber investors not joined");
  console.log(`PASS Crunchbase dump: ${company.name}, ${rounds.length} rounds, ${new Set(rounds.flatMap((round) => round.investors)).size} investors`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
