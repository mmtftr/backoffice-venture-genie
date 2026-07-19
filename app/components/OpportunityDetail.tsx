"use client";

import { useState } from "react";
import type { Claim, Decision, EvidenceEntry, FounderMemory, Opportunity, TraceEvent } from "@/lib/schemas";
import { cardClass, scoreColor, secondaryButtonClass, trendArrow } from "./ui";

export function RecommendationBadge({ value }: { value?: string }) {
  if (!value) return null;
  const style = value === "invest" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : value === "pass" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${style}`}>{value}</span>;
}

// Full-width verdict banner: recommendation + the thesis rationale behind it.
export function DecisionBanner({ decision }: { decision?: Decision }) {
  if (!decision) return null;
  const tone = decision.recommendation === "invest"
    ? { border: "border-emerald-500/30", bg: "bg-emerald-500/5", accent: "text-emerald-300", label: "Invest" }
    : decision.recommendation === "pass"
      ? { border: "border-rose-500/30", bg: "bg-rose-500/5", accent: "text-rose-300", label: "Pass" }
      : { border: "border-amber-500/30", bg: "bg-amber-500/5", accent: "text-amber-300", label: "Watch" };
  return (
    <section className={`rounded-xl border ${tone.border} ${tone.bg} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-lg border ${tone.border} px-3 py-1 text-sm font-bold uppercase tracking-widest ${tone.accent}`}>{tone.label}</span>
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Thesis-fit rationale</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{decision.thesisRationale}</p>
    </section>
  );
}

export function AxisCards({ opportunity }: { opportunity: Opportunity }) {
  return <div className="grid gap-4 md:grid-cols-3">{opportunity.screening?.axes.map((axis) => {
    const score = Math.round(axis.score_0_100);
    const barTone = score >= 70 ? "bg-emerald-400" : score >= 40 ? "bg-amber-400" : "bg-rose-400";
    return <article key={axis.axis} className={`${cardClass} p-5`}>
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-slate-500">{axis.axis === "IdeaVsMarket" ? "Idea vs market" : axis.axis}</p><p className="mt-2 font-mono text-4xl font-semibold text-white">{score}</p></div>
        <span className={`rounded-lg border px-2.5 py-1 font-mono text-sm ${scoreColor(axis.score_0_100)}`}>{trendArrow(axis.trend)} {axis.trend}</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${barTone}`} style={{ width: `${score}%` }} /></div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{axis.rationale}</p>
      <p className="mt-4 text-[11px] text-slate-600">{axis.evidence_ids.length} evidence reference{axis.evidence_ids.length === 1 ? "" : "s"}</p>
    </article>;
  })}</div>;
}

const ladder = [
  ["github_code_cadence", "Code cadence"], ["public_writing_papers", "Public writing"],
  ["community_footprint", "Community footprint"], ["application_quality", "Application quality"],
] as const;

export function SubstitutionLadder({ used }: { used: string }) {
  const usedIndex = ladder.findIndex(([id]) => id === used);
  return <section className={`${cardClass} p-5`}><div className="mb-5"><h2 className="font-semibold text-slate-100">Signal Substitution Ladder</h2><p className="mt-1 text-xs text-slate-500">Cold-start evidence path · strongest available rung highlighted</p></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{ladder.map(([id, label], index) => { const active = id === used; const passed = usedIndex >= 0 && index < usedIndex; return <div key={id} className={`relative rounded-lg border px-3 py-3 ${active ? "border-indigo-400 bg-indigo-500/15 text-indigo-200 shadow-[0_0_24px_rgba(99,102,241,.12)]" : "border-slate-800 bg-slate-950/40 text-slate-500"}`}><p className="font-mono text-[10px]">0{index + 1}</p><p className="mt-1 text-xs font-medium">{label}</p>{active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-400" />}{passed && <span className="absolute right-2 top-2 text-[10px] text-slate-600">×</span>}</div>; })}</div>{used === "none" && <p className="mt-3 text-xs text-rose-300">No substitution signal was available.</p>}</section>;
}

function verificationIcon(value: Claim["verification"]) { return value === "external" ? "◆" : value === "internal" ? "◈" : "?"; }

export function TrustClaim({ claim, evidence }: { claim: Claim; evidence: EvidenceEntry[] }) {
  const [open, setOpen] = useState(false);
  const trust = claim.confidence_0_1;
  const style = trust >= .7 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : trust >= .4 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300";
  const resolved = claim.evidence_ids.map((id) => evidence.find((entry) => entry.id === id)).filter((entry): entry is EvidenceEntry => Boolean(entry));
  return <div className="relative rounded-lg border border-slate-800 bg-slate-950/35 p-4"><div className="flex items-start gap-3"><p className="flex-1 text-sm leading-6 text-slate-300">{claim.text}</p><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold transition hover:brightness-125 ${style}`} title={`${claim.verification} verification · click for evidence`}>{verificationIcon(claim.verification)} {Math.round(trust * 100)}%</button></div>{claim.contradictions.length > 0 && <div className="mt-3 rounded-md bg-rose-500/5 px-3 py-2 text-xs text-rose-300">Contradiction: {claim.contradictions.join(" · ")}</div>}{open && <div className="absolute right-3 top-12 z-20 w-[min(30rem,calc(100vw-4rem))] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-slate-200">Evidence · {claim.verification}</p><button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">×</button></div>{resolved.length ? <div className="max-h-72 space-y-3 overflow-y-auto">{resolved.map((entry) => <div key={entry.id} className="border-l-2 border-indigo-500/40 pl-3"><div className="flex gap-2 text-[10px] text-slate-500"><span className="font-semibold uppercase text-indigo-300">{entry.source}</span><time>{formatDate(entry.ts)}</time></div><p className="mt-1 text-xs leading-5 text-slate-300">{entry.content}</p></div>)}</div> : <p className="text-xs text-slate-500">No referenced evidence could be resolved in founder memory.</p>}</div>}</div>;
}

export function MemoView({ opportunity, memory }: { opportunity: Opportunity; memory: FounderMemory }) {
  if (!opportunity.memo) return <div className={`${cardClass} p-6 text-sm text-slate-500`}>The investment memo is not available yet.</div>;
  return <div className="space-y-4">{opportunity.memo.sections.map((section) => <section key={section.title} className={`${cardClass} p-5 sm:p-6`}><h2 className="font-semibold text-slate-100">{section.title}</h2>{section.prose && <p className="mt-3 text-sm leading-6 text-slate-400">{section.prose}</p>}<div className="mt-4 space-y-2">{section.claims.map((claim, index) => <TrustClaim key={`${section.title}-${index}`} claim={claim} evidence={memory.evidence} />)}</div></section>)}</div>;
}

export function AgentActivity({ summary, trace }: { summary?: string; trace: TraceEvent[] }) {
  const [open, setOpen] = useState(false);
  const agents = new Set(trace.map((event) => event.agent)).size;
  return <section className={`${cardClass} overflow-hidden`}><div className="p-5 sm:p-6"><div className="flex items-center justify-between"><div className="flex items-baseline gap-3"><h2 className="font-semibold text-slate-100">Agent activity</h2>{trace.length > 0 && <span className="font-mono text-[11px] text-slate-600">{trace.length} events · {agents} agents</span>}</div><button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">{open ? "Hide" : "View"} raw trace</button></div><div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-400">{summary || "No activity summary yet."}</div></div>{open && <div className="overflow-x-auto border-t border-slate-800"><table className="w-full min-w-[840px] text-left text-xs"><thead className="bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-3">Agent</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Detail</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Time</th></tr></thead><tbody className="divide-y divide-slate-800">{trace.map((event) => <tr key={event.id} className="align-top hover:bg-slate-900/40"><td className="px-5 py-3 font-medium text-slate-300">{event.agent}</td><td className="px-3 py-3 font-mono text-slate-400">{event.action}</td><td className="px-3 py-3 text-slate-500">{event.target || "—"}</td><td className="max-w-md px-3 py-3 leading-5 text-slate-500">{event.detail || "—"}</td><td className="px-3 py-3 font-mono text-slate-600">{event.evidence_ids.length || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{formatTime(event.ts)}</td></tr>)}</tbody></table>{trace.length === 0 && <p className="px-5 py-5 text-xs text-slate-600">No trace events recorded.</p>}</div>}</section>;
}

export function RescreenButton({ opportunityId, onStarted }: { opportunityId: string; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function rescreen() { setBusy(true); setError(""); try { const response = await fetch("/api/rescreen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId }) }); if (!response.ok) throw new Error("Rescreen failed"); onStarted(); } catch (err) { setError(err instanceof Error ? err.message : "Rescreen failed"); } finally { setBusy(false); } }
  return <div className="flex items-center gap-2"><button type="button" onClick={rescreen} disabled={busy} className={secondaryButtonClass}>{busy ? "Starting…" : "Rescreen"}</button>{error && <span className="text-xs text-rose-300">{error}</span>}</div>;
}

export function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
export function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
