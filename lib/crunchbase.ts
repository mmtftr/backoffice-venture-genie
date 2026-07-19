import { promises as fs } from "fs";
import path from "path";
import { appendTrace } from "./trace";
import { LiveCrunchbase } from "./crunchbase-live";

export interface CBCompany {
  name: string;
  permalink: string;
  category?: string;
  country?: string;
  city?: string;
  funding_total_usd?: number;
  status?: string;
  founded_at?: string;
}

export interface CBRound {
  company: string;
  round_type: string;
  raised_usd?: number;
  announced_on?: string;
  investors: string[];
}

export interface CB {
  searchCompanies(q: { text?: string; category?: string; country?: string; maxResults?: number }): Promise<CBCompany[]>;
  getCompany(name: string): Promise<CBCompany | null>;
  getRounds(companyName: string): Promise<CBRound[]>;
  getCompetitorCandidates(category: string, exclude: string, max?: number): Promise<CBCompany[]>;
}

type Row = Record<string, string>;
type IndexedRound = CBRound & { permalink: string; roundPermalink: string };

const REPO_DATA_DIR = path.join(process.cwd(), "data");
const DUMP_DIR = path.join(REPO_DATA_DIR, "crunchbase-2015");

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

async function csvRows(file: string): Promise<Row[]> {
  const rows = parseCsv(await fs.readFile(path.join(DUMP_DIR, file), "utf8"));
  const headers = rows.shift() ?? [];
  return rows.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function number(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function categoryTokens(value?: string): string[] {
  return (value ?? "").split("|").map(normalized).filter(Boolean);
}

class DumpCB implements CB {
  private loaded?: Promise<void>;
  private companies: CBCompany[] = [];
  private byName = new Map<string, CBCompany>();
  private byPermalink = new Map<string, CBCompany>();
  private byCategory = new Map<string, CBCompany[]>();
  private roundsByName = new Map<string, IndexedRound[]>();
  private investorsByRound = new Map<string, Set<string>>();

  private async load(): Promise<void> {
    this.loaded ??= this.buildIndexes();
    await this.loaded;
  }

  private async buildIndexes(): Promise<void> {
    const [companyRows, roundRows, investmentRows] = await Promise.all([
      csvRows("companies.csv"),
      csvRows("rounds.csv"),
      csvRows("investments.csv"),
    ]);

    for (const row of investmentRows) {
      if (!row.funding_round_permalink || !row.investor_name) continue;
      const set = this.investorsByRound.get(row.funding_round_permalink) ?? new Set<string>();
      set.add(row.investor_name);
      this.investorsByRound.set(row.funding_round_permalink, set);
    }

    for (const row of companyRows) {
      if (!row.name || !row.permalink) continue;
      const company: CBCompany = {
        name: row.name,
        permalink: row.permalink,
        ...(row.category_list ? { category: row.category_list } : {}),
        ...(row.country_code ? { country: row.country_code } : {}),
        ...(row.city ? { city: row.city } : {}),
        ...(number(row.funding_total_usd) !== undefined ? { funding_total_usd: number(row.funding_total_usd) } : {}),
        ...(row.status ? { status: row.status } : {}),
        ...(row.founded_at ? { founded_at: row.founded_at } : {}),
      };
      this.companies.push(company);
      this.byName.set(normalized(company.name), company);
      this.byPermalink.set(company.permalink, company);
      for (const category of categoryTokens(company.category)) {
        const bucket = this.byCategory.get(category) ?? [];
        bucket.push(company);
        this.byCategory.set(category, bucket);
      }
    }

    for (const row of roundRows) {
      if (!row.company_name) continue;
      const round: IndexedRound = {
        company: row.company_name,
        permalink: row.company_permalink,
        roundPermalink: row.funding_round_permalink,
        round_type: row.funding_round_type || row.funding_round_code || "unknown",
        ...(number(row.raised_amount_usd) !== undefined ? { raised_usd: number(row.raised_amount_usd) } : {}),
        ...(row.funded_at ? { announced_on: row.funded_at } : {}),
        investors: [...(this.investorsByRound.get(row.funding_round_permalink) ?? [])],
      };
      const key = normalized(row.company_name);
      const bucket = this.roundsByName.get(key) ?? [];
      bucket.push(round);
      this.roundsByName.set(key, bucket);
    }

    for (const bucket of this.byCategory.values()) {
      bucket.sort((a, b) => (b.funding_total_usd ?? 0) - (a.funding_total_usd ?? 0));
    }
  }

  async searchCompanies(q: { text?: string; category?: string; country?: string; maxResults?: number }): Promise<CBCompany[]> {
    await this.load();
    const text = normalized(q.text ?? "");
    const category = normalized(q.category ?? "");
    const country = normalized(q.country ?? "");
    return this.companies
      .filter((company) => !text || normalized(`${company.name} ${company.category ?? ""}`).includes(text))
      .filter((company) => !category || categoryTokens(company.category).some((token) => token.includes(category) || category.includes(token)))
      .filter((company) => !country || normalized(company.country ?? "") === country)
      .sort((a, b) => (b.funding_total_usd ?? 0) - (a.funding_total_usd ?? 0))
      .slice(0, q.maxResults ?? 20);
  }

  async getCompany(name: string): Promise<CBCompany | null> {
    await this.load();
    const key = normalized(name);
    return this.byName.get(key)
      ?? this.byPermalink.get(name)
      ?? this.companies.find((company) => normalized(company.name).includes(key))
      ?? null;
  }

  async getRounds(companyName: string): Promise<CBRound[]> {
    await this.load();
    const company = await this.getCompany(companyName);
    const rounds = this.roundsByName.get(normalized(company?.name ?? companyName)) ?? [];
    return rounds
      .map(({ permalink: _permalink, roundPermalink: _roundPermalink, ...round }) => ({ ...round, investors: [...round.investors] }))
      .sort((a, b) => (a.announced_on ?? "").localeCompare(b.announced_on ?? ""));
  }

  async getCompetitorCandidates(category: string, exclude: string, max = 5): Promise<CBCompany[]> {
    await this.load();
    const excluded = normalized(exclude);
    const candidates = new Map<string, CBCompany>();
    for (const token of categoryTokens(category)) {
      for (const company of this.byCategory.get(token) ?? []) {
        if (normalized(company.name) !== excluded) candidates.set(company.permalink, company);
      }
    }
    return [...candidates.values()]
      .sort((a, b) => (b.funding_total_usd ?? 0) - (a.funding_total_usd ?? 0))
      .slice(0, max);
  }
}

const dump = new DumpCB();
const live = new LiveCrunchbase();
let fallbackTraced = false;

function liveWithFallback(): CB {
  const fallback = async <T>(method: keyof CB, args: unknown[]): Promise<T> => {
    try {
      const fn = live[method] as (...values: unknown[]) => Promise<T>;
      return await fn.apply(live, args);
    } catch (error) {
      console.warn(`[crunchbase] live ${method} failed; using dump for this call:`, error instanceof Error ? error.message : String(error));
      if (!fallbackTraced) {
        fallbackTraced = true;
        void appendTrace("system", {
          agent: "crunchbase",
          action: "fallback",
          target: "dump",
          detail: error instanceof Error ? error.message : String(error),
          evidence_ids: [],
        });
      }
      const fn = dump[method] as (...values: unknown[]) => Promise<T>;
      return fn.apply(dump, args);
    }
  };
  return {
    searchCompanies: (q) => fallback("searchCompanies", [q]),
    getCompany: (name) => fallback("getCompany", [name]),
    getRounds: (name) => fallback("getRounds", [name]),
    getCompetitorCandidates: (category, exclude, max) => fallback("getCompetitorCandidates", [category, exclude, max]),
  };
}

export function getCB(): CB {
  return process.env.CB_MODE === "live" ? liveWithFallback() : dump;
}
