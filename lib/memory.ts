import path from "path";
import type { EvidenceEntry, FounderMemory, FounderScorePoint } from "./schemas";
import { contentHash, id, listJson, MEMORY_DIR, nowIso, readJson, writeJson } from "./store";

type Seed = { name: string; company?: string };
type NewEvidence = Omit<EvidenceEntry, "id" | "founder_id" | "ts" | "hash">;

const locks = new Map<string, Promise<void>>();

async function serialized<T>(founderId: string, work: () => Promise<T>): Promise<T> {
  const prior = locks.get(founderId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  const tail = prior.then(() => next);
  locks.set(founderId, tail);
  await prior;
  try { return await work(); } finally {
    release();
    if (locks.get(founderId) === tail) locks.delete(founderId);
  }
}

function memoryPath(founderId: string): string {
  return path.join(MEMORY_DIR, `${founderId}.json`);
}

export async function getMemory(founderId: string, seed?: Seed): Promise<FounderMemory> {
  return readJson<FounderMemory>(memoryPath(founderId), {
    founder_id: founderId,
    name: seed?.name ?? founderId,
    ...(seed?.company ? { company: seed.company } : {}),
    evidence: [],
    founderScoreHistory: [],
  });
}

export async function listFounderIds(): Promise<string[]> {
  return (await listJson(MEMORY_DIR)).map((file) => file.slice(0, -5));
}

export async function getAllMemories(): Promise<FounderMemory[]> {
  return Promise.all((await listFounderIds()).map((founderId) => getMemory(founderId)));
}

export async function appendEvidence(
  founderId: string,
  entries: NewEvidence[],
  seed?: Seed,
): Promise<EvidenceEntry[]> {
  return serialized(founderId, async () => {
    const mem = await getMemory(founderId, seed);
    const existing = new Map(mem.evidence.filter((entry) => entry.hash).map((entry) => [entry.hash!, entry]));
    const returned: EvidenceEntry[] = [];
    const additions: EvidenceEntry[] = [];
    for (const entry of entries) {
      const hash = contentHash(entry.source, entry.content);
      const prior = existing.get(hash);
      if (prior) {
        returned.push(prior);
        continue;
      }
      const created: EvidenceEntry = {
        ...entry,
        tags: [...entry.tags],
        id: id("ev_"),
        founder_id: founderId,
        ts: nowIso(),
        hash,
      };
      existing.set(hash, created);
      additions.push(created);
      returned.push(created);
    }
    if (additions.length) {
      const next: FounderMemory = {
        ...mem,
        name: mem.name || seed?.name || founderId,
        company: mem.company ?? seed?.company,
        evidence: [...mem.evidence, ...additions],
        founderScoreHistory: [...mem.founderScoreHistory],
      };
      await writeJson(memoryPath(founderId), next);
    }
    return returned;
  });
}

export async function updateFounderScore(
  founderId: string,
  delta: number,
  reason: string,
  seed?: Seed,
): Promise<FounderScorePoint> {
  return serialized(founderId, async () => {
    const mem = await getMemory(founderId, seed);
    const base = currentFounderScore(mem);
    const point: FounderScorePoint = {
      ts: nowIso(),
      score_0_100: Math.max(0, Math.min(100, base + delta)),
      delta,
      reason,
    };
    await writeJson(memoryPath(founderId), {
      ...mem,
      name: mem.name || seed?.name || founderId,
      company: mem.company ?? seed?.company,
      evidence: [...mem.evidence],
      founderScoreHistory: [...mem.founderScoreHistory, point],
    });
    return point;
  });
}

export function currentFounderScore(mem: FounderMemory): number {
  return mem.founderScoreHistory.at(-1)?.score_0_100 ?? 50;
}

export function resolveEvidence(mem: FounderMemory, ids: string[]): EvidenceEntry[] {
  const wanted = new Set(ids);
  return mem.evidence.filter((entry) => wanted.has(entry.id));
}
