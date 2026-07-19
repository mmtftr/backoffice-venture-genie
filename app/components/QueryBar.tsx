"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import type { QueryResult } from "@/lib/query";

export function QueryBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = q.trim();
    if (!query || loading) return;

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setResults(null);
    setError("");
    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not run the query";
        throw new Error(message);
      }
      if (!Array.isArray(payload)) throw new Error("The query returned an invalid response");
      setResults(payload as QueryResult[]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not run the query");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  function clear() {
    request.current?.abort();
    request.current = null;
    setQ("");
    setResults(null);
    setLoading(false);
    setError("");
    input.current?.focus();
  }

  const active = loading || results !== null || Boolean(error);

  return (
    <div className="mb-5">
      <form onSubmit={submit} className={`flex items-center rounded-xl border bg-slate-950/70 shadow-sm shadow-black/20 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/15 ${active ? "border-indigo-500/40" : "border-slate-800"}`}>
        <span aria-hidden className="pl-4 text-indigo-400">⌕</span>
        <label htmlFor="pipeline-query" className="sr-only">Query the investment pipeline</label>
        <input
          ref={input}
          id="pipeline-query"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Ask: technical founder, Berlin, AI infra, no prior VC backing…"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
        />
        <span className="hidden pr-3 font-mono text-[10px] uppercase tracking-wider text-slate-600 sm:inline">Enter</span>
        {(q || active) && (
          <button type="button" onClick={clear} aria-label="Clear query results" className="mr-2 grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-200">×</button>
        )}
      </form>

      {loading && <QueryLoading />}
      {error && <p role="alert" className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-rose-300">{error}</p>}
      {results && <QueryResults results={results} />}
    </div>
  );
}

function QueryLoading() {
  return (
    <div aria-label="Ranking opportunities" className="mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-slate-800/70 px-4 py-3 last:border-b-0">
          <div className="h-3 w-5 animate-vc-shimmer rounded" />
          <div className="h-4 w-36 animate-vc-shimmer rounded" />
          <div className="ml-auto h-5 w-16 animate-vc-shimmer rounded" />
        </div>
      ))}
    </div>
  );
}

function QueryResults({ results }: { results: QueryResult[] }) {
  return (
    <div aria-live="polite" className="mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
      {results.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">No opportunities to rank.</p>
      ) : results.map((result, index) => (
        <Link
          key={result.opportunityId}
          href={`/opportunity/${encodeURIComponent(result.opportunityId)}`}
          className="group flex flex-col gap-2 border-b border-slate-800/70 px-4 py-3 transition last:border-b-0 hover:bg-slate-800/40 sm:flex-row sm:items-center"
        >
          <span className="w-7 shrink-0 font-mono text-xs text-slate-600">{String(index + 1).padStart(2, "0")}</span>
          <span className="min-w-32 font-medium text-slate-100 group-hover:text-indigo-300">{result.company}</span>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {result.matches.map((match) => (
              <span
                key={`${match.term}-${match.source}`}
                title={`${match.source}: ${match.evidenceSnippet}`}
                className="max-w-48 truncate rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-200"
              >
                {match.term}
              </span>
            ))}
            {result.matches.length === 0 && <span className="text-xs text-slate-600">No matched evidence</span>}
          </span>
          <span className="shrink-0 font-mono text-xs font-semibold text-slate-300">{Math.round(result.score_0_1 * 100)}%</span>
          <span aria-hidden className="text-slate-600 group-hover:text-indigo-300">→</span>
        </Link>
      ))}
    </div>
  );
}
