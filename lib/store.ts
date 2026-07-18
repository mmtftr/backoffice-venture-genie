import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const REPO_DATA_DIR = path.join(process.cwd(), "data");
const configuredDataDir = process.env.DATA_DIR?.trim();
const BOOTSTRAP_ENTRIES = ["seed", "thesis.json", "crunchbase-live"] as const;

export const DATA_DIR = configuredDataDir ? path.resolve(configuredDataDir) : REPO_DATA_DIR;
export const MEMORY_DIR = path.join(DATA_DIR, "memory");
export const TRACE_DIR = path.join(DATA_DIR, "trace");
export const OPP_DIR = path.join(DATA_DIR, "opportunities");
export const THESIS_PATH = path.join(DATA_DIR, "thesis.json");

let bootstrapPromise: Promise<void> | undefined;

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

async function copyBundledEntry(entry: typeof BOOTSTRAP_ENTRIES[number]): Promise<void> {
  const source = path.join(REPO_DATA_DIR, entry);
  try {
    await fs.access(source);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  await fs.cp(source, path.join(DATA_DIR, entry), { recursive: true, force: true });
}

async function bootstrapDataDir(): Promise<void> {
  if (!configuredDataDir || DATA_DIR === REPO_DATA_DIR) return;

  let isEmpty: boolean;
  try {
    isEmpty = (await fs.readdir(DATA_DIR)).length === 0;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    isEmpty = true;
  }
  if (!isEmpty) return;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await Promise.all(BOOTSTRAP_ENTRIES.map(copyBundledEntry));
}

function ensureDataDir(): Promise<void> {
  bootstrapPromise ??= bootstrapDataDir();
  return bootstrapPromise;
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; } catch { return fallback; }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await ensureDataDir();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function listJson(dir: string): Promise<string[]> {
  await ensureDataDir();
  try { return (await fs.readdir(dir)).filter((f) => f.endsWith(".json")); } catch { return []; }
}

export function id(prefix = ""): string {
  return prefix + crypto.randomBytes(8).toString("hex");
}

export function contentHash(...parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

export function nowIso(): string { return new Date().toISOString(); }
