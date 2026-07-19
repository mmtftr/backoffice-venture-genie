"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { FounderMemory, Opportunity, TraceEvent } from "@/lib/schemas";
import { AgentActivity, AxisCards, DecisionBanner, MemoView, RecommendationBadge, RedFlags, RescreenButton, SubstitutionLadder, formatDate } from "../../components/OpportunityDetail";
import { InfoTip } from "../../components/InfoTip";
import { ErrorState, LoadingState, StatusBadge, cardClass } from "../../components/ui";

type DetailResponse = { opportunity: Opportunity; trace: TraceEvent[]; memory: FounderMemory };

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { const response = await fetch(`/api/opportunities/${encodeURIComponent(id)}`, { cache: "no-store" }); if (!response.ok) throw new Error(response.status === 404 ? "Opportunity not found" : "Could not load opportunity"); setData(await response.json() as DetailResponse); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not load opportunity"); } finally { setLoading(false); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (data?.opportunity.status !== "analyzing") return; const timer = window.setInterval(() => void load(), 3000); return () => window.clearInterval(timer); }, [data?.opportunity.status, load]);
  if (loading) return <LoadingState label="Loading opportunity" />;
  if (error || !data) return <ErrorState message={error || "Opportunity not found"} retry={() => void load()} />;
  const { opportunity, trace, memory } = data;
  return <div className="space-y-6">
    <header><Link href="/" className="text-xs text-slate-500 hover:text-indigo-300">← Pipeline</Link><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={opportunity.status} /><span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] capitalize text-slate-400">{opportunity.track}</span><RecommendationBadge value={opportunity.decision?.recommendation} /></div><h1 className="text-3xl font-semibold tracking-tight text-white">{opportunity.company}</h1><p className="mt-2 text-sm text-slate-400">Founder: <span className="text-slate-200">{memory.name || opportunity.founder_id}</span> · Added {formatDate(opportunity.createdAt)}</p></div><RescreenButton opportunityId={opportunity.id} onStarted={() => { setData({ ...data, opportunity: { ...opportunity, status: "analyzing" } }); void load(); }} /></div></header>
    {opportunity.status === "analyzing" && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4 text-sm text-indigo-200"><span className="mr-2 inline-block h-2 w-2 animate-vc-pulse rounded-full bg-indigo-400" />Analysis in progress. This page refreshes every 3 seconds.</div>}
    {opportunity.status === "error" && <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-4 text-sm text-rose-300">Analysis ended with an error. The recorded trace may contain partial results.</div>}
    {!!opportunity.memo?.redFlags.length && <RedFlags flags={opportunity.memo.redFlags} evidence={memory.evidence} />}
    <DecisionBanner decision={opportunity.decision} />
    <AxisCards opportunity={opportunity} evidence={memory.evidence} />
    {opportunity.screening?.coldStart && <SubstitutionLadder used={opportunity.screening.substitutionRung} />}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><MemoView opportunity={opportunity} memory={memory} /><aside className="space-y-4">
      {opportunity.memo && <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-200">Memo trust</h2><InfoTip label="Memo trust score" align="right">An aggregate of the per-claim trust scores, weighted by how well each claim is verified against evidence in founder memory. A low memo trust means the story rests on unverified assertions — read the individual claim chips to see where.</InfoTip></div><p className="mt-2 font-mono text-3xl text-white">{Math.round(opportunity.memo.trustScore_0_1 * 100)}%</p><p className="mt-1 text-xs text-slate-500">Evidence-weighted claim verification</p></section>}
      {!!opportunity.memo?.gaps.length && <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-200">Information gaps</h2><InfoTip label="Information gaps" align="right">Questions the research agents could not answer from available evidence. Treat these as the diligence checklist for a founder call — the system flags what it does not know instead of papering over it.</InfoTip></div><div className="mt-3 flex flex-wrap gap-2">{opportunity.memo.gaps.map((gap) => <span key={gap} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-xs text-amber-200">{gap}</span>)}</div></section>}
      {opportunity.decision && <section className="rounded-xl border border-rose-500/20 bg-slate-900/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-rose-400">Adversarial view</p><div className="mt-1 flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-200">Why this could fail</h2><InfoTip label="Adversarial view" align="right">Every decision — including invest — is required to argue against itself. This is the strongest failure case the system could construct, so conviction is tested rather than assumed.</InfoTip></div><p className="mt-3 text-sm leading-6 text-slate-400">{opportunity.decision.whyThisCouldFail}</p></section>}
      {opportunity.outreachDraft && <section className={`${cardClass} p-5`}><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-400">Draft only · not sent</p><div className="mt-1 flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-200">Outbound outreach</h2><InfoTip label="Outreach draft" align="right">For outbound-sourced deals the system drafts a personalized first-contact email grounded in the memo&apos;s evidence. Nothing is ever sent automatically — a human reviews and sends.</InfoTip></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-400">{opportunity.outreachDraft}</p></section>}
    </aside></div>
    <AgentActivity summary={opportunity.traceSummary} trace={trace} evidence={memory.evidence} />
  </div>;
}
