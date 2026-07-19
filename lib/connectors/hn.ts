export interface HnHit {
  title: string;
  url: string;
  points: number;
  num_comments: number;
  created_at: string;
}

export async function searchHN(company: string): Promise<HnHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(company)}&tags=story&hitsPerPage=5`,
      { signal: controller.signal },
    );
    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("hits" in data) || !Array.isArray(data.hits)) return [];

    return data.hits.map((hit) => {
      if (!hit || typeof hit !== "object") throw new Error("Invalid HN hit");
      const { title, url, points, num_comments, created_at } = hit as Record<string, unknown>;
      if (
        typeof title !== "string"
        || typeof url !== "string"
        || typeof points !== "number"
        || typeof num_comments !== "number"
        || typeof created_at !== "string"
      ) {
        throw new Error("Invalid HN hit");
      }
      return { title, url, points, num_comments, created_at };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
