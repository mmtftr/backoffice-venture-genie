import { promises as fs } from "fs";
import { spawn } from "child_process";
import { join as joinPath } from "path";
import type { CB, CBCompany, CBRound } from "./crunchbase";

const ENDPOINT = "https://www.crunchbase.com/v4/data/graph";
const DEFAULT_COOKIE_FILE = "/Users/mmtf/p/tmp/crunchbase/cookie.txt";
const MAX_COLLECTION_RESULTS = 15;

const COMPANY_PROPERTIES = `
  identifier { value permalink uuid }
  categories { value permalink uuid }
  location_identifiers { value permalink uuid location_type }
  status
  founded_on { value precision }
  funding_total { value value_usd currency }
`;

const COMPANY_QUERY = `
query LiveCompany($permalink: String!) {
  entities {
    organization(permalink: $permalink) {
      properties { ${COMPANY_PROPERTIES} }
    }
  }
}`;

const ROUND_QUERY = `
query LiveFundingRounds($uuid: UUID!) {
  collections {
    funding_rounds(query: {properties: {funded_organization_identifier: {uuid: {includes: [$uuid]}}}}) {
      entities(limit: 15, order: {field_id: rank_funding_round, sort: asc}) {
        properties {
          investment_type
          announced_on
          money_raised { value value_usd currency }
          funded_organization_identifier { value permalink uuid }
          investor_identifiers { value permalink uuid }
        }
      }
    }
  }
}`;

type GraphOperation = {
  operationName: string;
  variables: Record<string, unknown>;
  query: string;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(object).filter((item): item is JsonObject => Boolean(item)) : [];
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function path(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) current = object(current)?.[key];
  return current;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function slug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function companyPermalink(value: string): string {
  return value.startsWith("/organization/") ? value.slice("/organization/".length) : slug(value);
}

function identifierValues(value: unknown): string[] {
  return objects(value).map((item) => string(item.value)).filter((item): item is string => Boolean(item));
}

function moneyUsd(value: unknown): number | undefined {
  const money = object(value);
  return number(money?.value_usd) ?? number(money?.value);
}

function dateValue(value: unknown): string | undefined {
  return string(value) ?? string(object(value)?.value);
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value);
}

const CATEGORY_PERMALINK_ALIASES: Record<string, string> = {
  fintech: "fintech-e067",
};

const COUNTRY_PERMALINK_ALIASES: Record<string, string> = {
  us: "united-states",
  usa: "united-states",
  "united states of america": "united-states",
  uk: "united-kingdom",
  gbr: "united-kingdom",
};

export class LiveCrunchbase implements CB {
  private categoryUuids = new Map<string, string>();
  private locationUuids = new Map<string, string>();

  private async request(operations: GraphOperation[]): Promise<JsonObject[]> {
    const cookieFile = process.env.CB_COOKIE_FILE ?? DEFAULT_COOKIE_FILE;
    const cookie = (await fs.readFile(cookieFile, "utf8")).trim();
    if (!cookie) throw new Error(`Crunchbase cookie file is empty: ${cookieFile}`);

    const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        priority: "u=1, i",
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150"',
        "sec-ch-ua-arch": '"arm"',
        "sec-ch-ua-bitness": '"64"',
        "sec-ch-ua-full-version": '"150.0.7871.125"',
        "sec-ch-ua-full-version-list": '"Not;A=Brand";v="8.0.0.0", "Chromium";v="150.0.7871.125"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-model": '""',
        "sec-ch-ua-platform": '"macOS"',
        "sec-ch-ua-platform-version": '"26.5.2"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-cb-client-app-instance-id": "cf0ac7e5-d2d2-4dc6-928e-37b0a1703627",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.125 Safari/537.36",
        cookie,
        Referer: "https://www.crunchbase.com/organization/stripe",
    };

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      // Crunchbase's graph endpoint expects a batch array, including for one operation.
      body: JSON.stringify(operations),
    });

    let text = await response.text();
    let status = response.status;
    if (status === 403) {
      // Cloudflare rejects Node's TLS fingerprint even with valid cookies; retry
      // through the curl_cffi bridge, which impersonates Chrome's JA3.
      const bridged = await this.requestViaBridge(headers, JSON.stringify(operations));
      text = bridged.text;
      status = bridged.status;
    }
    if (status < 200 || status >= 300) throw new Error(`Crunchbase HTTP ${status}: ${text.slice(0, 160).replace(/\s+/g, " ")}`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`Crunchbase returned invalid JSON: ${errorMessage(error)}`);
    }

    const results = Array.isArray(parsed) ? parsed.map(object) : [object(parsed)];
    if (results.some((result) => !result)) throw new Error("Crunchbase returned an unexpected response shape");

    return results.map((result, index) => {
      const errors = objects(result?.errors);
      if (errors.length > 0) {
        const detail = errors.map((item) => string(item.message) ?? JSON.stringify(item)).join("; ");
        throw new Error(`Crunchbase GraphQL ${operations[index]?.operationName ?? "request"}: ${detail}`);
      }
      if (!object(result?.data)) throw new Error(`Crunchbase GraphQL ${operations[index]?.operationName ?? "request"} returned no data`);
      return result as JsonObject;
    });
  }

  private async requestViaBridge(
    headers: Record<string, string>,
    body: string
  ): Promise<{ status: number; text: string }> {
    const bridge = joinPath(process.cwd(), "scripts", "cb-bridge.py");
    const payload = JSON.stringify({ url: ENDPOINT, headers, body });
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn("uv", ["run", "--with", "curl_cffi", "python3", bridge], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30_000,
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => { out += chunk; });
      child.stderr.on("data", (chunk) => { err += chunk; });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(`cb-bridge exited ${code}: ${err.slice(0, 200)}`));
      });
      child.stdin.end(payload);
    });
    const parsed = JSON.parse(stdout) as { status: number; text: string };
    if (typeof parsed.status !== "number" || typeof parsed.text !== "string") {
      throw new Error("cb-bridge returned an unexpected shape");
    }
    return parsed;
  }

  private rememberIdentifiers(properties: JsonObject): void {
    for (const category of objects(properties.categories)) {
      const uuid = string(category.uuid);
      const value = string(category.value);
      const permalink = string(category.permalink);
      if (uuid && value) this.categoryUuids.set(normalized(value), uuid);
      if (uuid && permalink) this.categoryUuids.set(normalized(permalink), uuid);
    }
    for (const location of objects(properties.location_identifiers)) {
      const uuid = string(location.uuid);
      const value = string(location.value);
      const permalink = string(location.permalink);
      if (uuid && value) this.locationUuids.set(normalized(value), uuid);
      if (uuid && permalink) this.locationUuids.set(normalized(permalink), uuid);
    }
  }

  private mapCompany(propertiesValue: unknown): CBCompany | null {
    const properties = object(propertiesValue);
    const identifier = object(properties?.identifier);
    const name = string(identifier?.value);
    const permalink = string(identifier?.permalink);
    if (!properties || !name || !permalink) return null;

    this.rememberIdentifiers(properties);
    const categories = identifierValues(properties.categories);
    const locations = objects(properties.location_identifiers);
    const city = locations.find((item) => item.location_type === "city");
    const country = locations.find((item) => item.location_type === "country");
    const funding = moneyUsd(properties.funding_total);
    const founded = dateValue(properties.founded_on);
    const status = string(properties.status);

    return {
      name,
      permalink: `/organization/${permalink}`,
      ...(categories.length > 0 ? { category: categories.join("|") } : {}),
      ...(string(country?.value) ? { country: string(country?.value) } : {}),
      ...(string(city?.value) ? { city: string(city?.value) } : {}),
      ...(funding !== undefined ? { funding_total_usd: funding } : {}),
      ...(status ? { status } : {}),
      ...(founded ? { founded_at: founded } : {}),
    };
  }

  private async getCompanyRecord(name: string): Promise<{ company: CBCompany; properties: JsonObject } | null> {
    const [result] = await this.request([{
      operationName: "LiveCompany",
      variables: { permalink: companyPermalink(name) },
      query: COMPANY_QUERY,
    }]);
    const properties = object(path(result, "data", "entities", "organization", "properties"));
    if (!properties) return null;
    const company = this.mapCompany(properties);
    if (!company) throw new Error("Crunchbase company response is missing its identifier");
    return { company, properties };
  }

  private entityIdentifierOperation(kind: "category" | "location", value: string, index: number): GraphOperation {
    const key = normalized(value);
    const permalink = kind === "category"
      ? CATEGORY_PERMALINK_ALIASES[key] ?? slug(value)
      : COUNTRY_PERMALINK_ALIASES[key] ?? slug(value);
    const operationName = `Live${kind === "category" ? "Category" : "Location"}${index}`;
    return {
      operationName,
      variables: { permalink },
      query: `query ${operationName}($permalink: String!) {
        entities { ${kind}(permalink: $permalink) { properties { identifier { value permalink uuid } } } }
      }`,
    };
  }

  private async resolveUuids(kind: "category" | "location", values: string[]): Promise<string[]> {
    const cache = kind === "category" ? this.categoryUuids : this.locationUuids;
    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    const missing = unique.filter((value) => !cache.has(normalized(value)));
    if (missing.length > 0) {
      const results = await this.request(missing.map((value, index) => this.entityIdentifierOperation(kind, value, index)));
      results.forEach((result, index) => {
        const identifier = object(path(result, "data", "entities", kind, "properties", "identifier"));
        const uuid = string(identifier?.uuid);
        if (uuid) {
          cache.set(normalized(missing[index]), uuid);
          const identifierValue = string(identifier?.value);
          const permalink = string(identifier?.permalink);
          if (identifierValue) cache.set(normalized(identifierValue), uuid);
          if (permalink) cache.set(normalized(permalink), uuid);
        }
      });
    }
    const resolved = unique.map((value) => cache.get(normalized(value))).filter((uuid): uuid is string => Boolean(uuid));
    if (resolved.length === 0 && unique.length > 0) throw new Error(`Crunchbase could not resolve ${kind}: ${unique.join(", ")}`);
    return [...new Set(resolved)];
  }

  private async collectionCompanies(categoryValues: string[], countryValue: string | undefined, limit: number): Promise<CBCompany[]> {
    const categoryUuids = await this.resolveUuids("category", categoryValues);
    const countryUuids = countryValue ? await this.resolveUuids("location", [countryValue]) : [];
    const filters: string[] = [];
    const variables: Record<string, unknown> = { limit: Math.min(Math.max(limit, 1), MAX_COLLECTION_RESULTS) };
    const variableDefinitions = ["$limit: Int!"];
    if (categoryUuids.length > 0) {
      filters.push("categories: {include_nulls: false, uuid: {includes: $categoryUuids}}");
      variables.categoryUuids = categoryUuids;
      variableDefinitions.push("$categoryUuids: [UUID!]");
    }
    if (countryUuids.length > 0) {
      filters.push("location_identifiers: {include_nulls: false, uuid: {includes: $countryUuids}}");
      variables.countryUuids = countryUuids;
      variableDefinitions.push("$countryUuids: [UUID!]");
    }
    const query = `query LiveCompanySearch(${variableDefinitions.join(", ")}) {
      collections {
        organizations(query: {properties: {${filters.join(" ")}}}) {
          entities(limit: $limit, order: {field_id: rank_org_company, sort: asc}) {
            properties { ${COMPANY_PROPERTIES} }
          }
        }
      }
    }`;
    const [result] = await this.request([{ operationName: "LiveCompanySearch", variables, query }]);
    return objects(path(result, "data", "collections", "organizations", "entities"))
      .map((entity) => this.mapCompany(entity.properties))
      .filter((company): company is CBCompany => Boolean(company));
  }

  async searchCompanies(q: { text?: string; category?: string; country?: string; maxResults?: number }): Promise<CBCompany[]> {
    const maxResults = Math.max(q.maxResults ?? 20, 0);
    if (maxResults === 0) return [];
    if (q.text?.trim()) {
      const company = await this.getCompany(q.text);
      if (!company) return [];
      const category = normalized(q.category ?? "");
      const country = normalized(q.country ?? "");
      if (category && !normalized(company.category ?? "").includes(category)) return [];
      if (country && normalized(company.country ?? "") !== country) return [];
      return [company];
    }
    const categories = (q.category ?? "").split("|").filter(Boolean);
    return (await this.collectionCompanies(categories, q.country, maxResults)).slice(0, maxResults);
  }

  async getCompany(name: string): Promise<CBCompany | null> {
    return (await this.getCompanyRecord(name))?.company ?? null;
  }

  async getRounds(companyName: string): Promise<CBRound[]> {
    const record = await this.getCompanyRecord(companyName);
    if (!record) return [];
    const uuid = string(object(record.properties.identifier)?.uuid);
    if (!uuid) throw new Error("Crunchbase company response is missing its UUID");
    const [result] = await this.request([{ operationName: "LiveFundingRounds", variables: { uuid }, query: ROUND_QUERY }]);
    return objects(path(result, "data", "collections", "funding_rounds", "entities"))
      .map((entity): CBRound | null => {
        const properties = object(entity.properties);
        if (!properties) return null;
        const roundType = string(properties.investment_type) ?? "unknown";
        const raised = moneyUsd(properties.money_raised);
        const announced = dateValue(properties.announced_on);
        const company = string(object(properties.funded_organization_identifier)?.value) ?? record.company.name;
        const investors = [...new Set(identifierValues(properties.investor_identifiers))];
        return {
          company,
          round_type: roundType,
          ...(raised !== undefined ? { raised_usd: raised } : {}),
          ...(announced ? { announced_on: announced } : {}),
          investors,
        };
      })
      .filter((round): round is CBRound => Boolean(round))
      .sort((a, b) => (a.announced_on ?? "").localeCompare(b.announced_on ?? ""));
  }

  async getCompetitorCandidates(category: string, exclude: string, max = 5): Promise<CBCompany[]> {
    if (max <= 0) return [];
    const candidates = await this.collectionCompanies(category.split("|").filter(Boolean), undefined, Math.min(max + 1, MAX_COLLECTION_RESULTS));
    const excluded = normalized(exclude);
    return candidates.filter((company) => normalized(company.name) !== excluded).slice(0, max);
  }
}
