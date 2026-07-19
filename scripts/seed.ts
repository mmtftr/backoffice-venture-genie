import path from "path";
import { z } from "zod";
import { appendEvidence } from "../lib/memory";
import { DEFAULT_THESIS, saveThesis } from "../lib/pipeline";
import { DATA_DIR, listJson, readJson } from "../lib/store";

export const SeedProfile = z.object({
  founder_id: z.string(),
  name: z.string(),
  company: z.string(),
  deckMarkdown: z.string(),
  profile: z.enum(["cold_start_code", "cold_start_minimal", "contradiction", "normal"]),
  evidence: z.array(z.object({
    source: z.enum(["github", "hn", "ph", "website", "accelerator", "press"]),
    content: z.string(),
    tags: z.array(z.string()),
  })),
});
export type SeedProfile = z.infer<typeof SeedProfile>;

export async function seed(): Promise<{ profiles: number; evidence: number }> {
  const seedDir = path.join(DATA_DIR, "seed");
  const files = await listJson(seedDir);
  let profiles = 0;
  let evidence = 0;
  for (const file of files) {
    const raw = await readJson<unknown>(path.join(seedDir, file), null);
    const parsed = SeedProfile.safeParse(raw);
    if (!parsed.success) {
      console.warn(`Skipping invalid seed profile ${file}: ${parsed.error.message}`);
      continue;
    }
    const profile = parsed.data;
    const entries = [
      { source: "deck", content: profile.deckMarkdown, tags: ["deck", "seed", profile.profile] },
      ...profile.evidence.map((entry) => ({ source: entry.source, content: entry.content, tags: [...entry.tags] })),
    ];
    await appendEvidence(profile.founder_id, entries, { name: profile.name, company: profile.company });
    profiles += 1;
    evidence += entries.length;
  }
  await saveThesis(DEFAULT_THESIS);
  return { profiles, evidence };
}

if (process.argv[1] && /scripts[\\/]seed\.(?:ts|js)$/.test(process.argv[1])) {
  seed().then(({ profiles, evidence }) => {
    console.log(`Seeded ${profiles} profiles (${evidence} input evidence entries); thesis written.`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
