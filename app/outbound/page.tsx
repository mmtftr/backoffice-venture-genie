"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState, ErrorState, PageHeader, buttonClass, cardClass, secondaryButtonClass } from "../components/ui";

type Candidate = {
  company: { name: string; permalink: string; category?: string; country?: string; city?: string; funding_total_usd?: number; status?: string; founded_at?: string };
  rounds: Array<{ company: string; round_type: string; raised_usd?: number; announced_on?: string; investors: string[] }>;
  fitReason: string;
};

export default function OutboundPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState("");
  const [error, setError] = useState("");
  async function source() { setLoading(true); setError(""); try { const response = await fetch("/api/outbound/source", { method: "POST" }); if (!response.ok) throw new Error("Could not run outbound sourcing"); const payload = await response.json() as { candidates: Candidate[] }; setCandidates(payload.candidates); } catch (err) { setError(err instanceof Error ? err.message : "Could not source candidates"); } finally { setLoading(false); } }
  async function activate(companyName: string) { setActivating(companyName); setError(""); try { const response = await fetch("/api/outbound/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName }) }); if (!response.ok) throw new Error(`Could not activate ${companyName}`); const { id } = await response.json() as { id: string }; router.push(`/opportunity/${encodeURIComponent(id)}`); } catch (err) { setError(err instanceof Error ? err.message : "Could not activate company"); setActivating(""); } }
  return <><PageHeader eyebrow="Proactive sourcing" title="Outbound" description="Find companies ranked against the current thesis, then activate full diligence on selected candidates." action={<button onClick={() => void source()} disabled={loading} className={buttonClass}>{loading ? "Sourcing…" : candidates ? "Run again" : "Run sourcing"}</button>} />{error && <div className="mb-5"><ErrorState message={error} /></div>}{candidates === null ? <EmptyState title="Ready to source" detail="Run sourcing to search and rank up to ten thesis-aligned companies." /> : candidates.length === 0 ? <EmptyState title="No candidates found" detail="Try broadening the sectors or geographies in your thesis." /> : <div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-slate-800 bg-slate-900 text-[10px] uppercase tracking-[.14em] text-slate-500"><th className="px-5 py-3">Rank</th><th className="px-3 py-3">Company</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Country</th><th className="px-3 py-3">Last round</th><th className="px-3 py-3">Fit reason</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-slate-800">{candidates.map((candidate, index) => { const latest = latestRound(candidate.rounds); return <tr key={candidate.company.permalink || candidate.company.name} className="hover:bg-slate-800/30"><td className="px-5 py-4 font-mono text-xs text-slate-600">{String(index + 1).padStart(2, "0")}</td><td className="px-3 py-4"><p className="font-medium text-slate-100">{candidate.company.name}</p>{candidate.company.city && <p className="mt-1 text-xs text-slate-600">{candidate.company.city}</p>}</td><td className="max-w-48 px-3 py-4 text-xs text-slate-400">{candidate.company.category || "—"}</td><td className="px-3 py-4 text-xs text-slate-400">{candidate.company.country || "—"}</td><td className="px-3 py-4"><p className="text-xs capitalize text-slate-300">{latest?.round_type?.replaceAll("_", " ") || "—"}</p><p className="mt-1 font-mono text-[10px] text-slate-600">{latest?.announced_on || "No date"}</p></td><td className="max-w-sm px-3 py-4 text-xs leading-5 text-slate-400">{candidate.fitReason}</td><td className="px-5 py-4 text-right"><button onClick={() => void activate(candidate.company.name)} disabled={Boolean(activating)} className={secondaryButtonClass}>{activating === candidate.company.name ? "Activating…" : "Activate"}</button></td></tr>; })}</tbody></table></div></div>}<p className="mt-4 text-xs text-slate-600">Activation creates an outbound opportunity, runs the full pipeline, and drafts outreach without sending it. <Link href="/thesis" className="text-indigo-400 hover:text-indigo-300">Edit thesis →</Link></p></>;
}

function latestRound(rounds: Candidate["rounds"]) { return [...rounds].sort((a, b) => (b.announced_on || "").localeCompare(a.announced_on || ""))[0]; }
