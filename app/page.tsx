"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FounderMemory, Opportunity } from "@/lib/schemas";
import { QueryBar } from "./components/QueryBar";
import { Sparkline } from "./components/Sparkline";
import { AxisChip, DecisionChip, EmptyState, ErrorState, FitBar, PageHeader, Skeleton, StatusBadge, buttonClass, cardClass, secondaryButtonClass } from "./components/ui";
import { InfoTip } from "./components/InfoTip";

type OpportunityDetail = { opportunity: Opportunity; memory: FounderMemory };
type FounderInfo = { history: FounderMemory["founderScoreHistory"]; name: string };

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [founders, setFounders] = useState<Record<string, FounderInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/opportunities", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the pipeline");
      const next = await response.json() as Opportunity[];
      setOpportunities(next);
      setError("");
      const details = await Promise.allSettled(next.map(async ({ id }) => {
        const detailResponse = await fetch(`/api/opportunities/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!detailResponse.ok) throw new Error("detail unavailable");
        return detailResponse.json() as Promise<OpportunityDetail>;
      }));
      const nextFounders: Record<string, FounderInfo> = {};
      details.forEach((result) => {
        if (result.status === "fulfilled") nextFounders[result.value.opportunity.id] = { history: result.value.memory.founderScoreHistory, name: result.value.memory.name };
      });
      setFounders(nextFounders);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load the pipeline"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const analyzing = opportunities.filter((item) => item.status === "analyzing").length;
  useEffect(() => {
    if (analyzing === 0) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [analyzing, load]);

  const screened = opportunities.filter((item) => item.status === "screened").length;
  const investRecs = opportunities.filter((item) => item.decision?.recommendation === "invest").length;
  const redFlagged = opportunities.filter((item) => (item.memo?.redFlags.length ?? 0) > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Deal flow"
        title="Investment pipeline"
        titleInfo={<InfoTip label="Investment pipeline">Every opportunity — inbound applications and outbound-sourced companies alike — lands here after the agent swarm screens it. Scores on the three axes are kept separate on purpose: no blended score ever ranks this table. Click a row to open the full diligence view with the evidence-backed memo.</InfoTip>}
        description="Independent founder, market, and idea-versus-market assessments. No blended score."
        action={<Link href="/inbound" className={buttonClass}>+ New inbound</Link>}
      />
      <QueryBar />
      {opportunities.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Opportunities" value={opportunities.length} />
          <Stat label="Screened" value={screened} />
          <Stat label="Invest recommendations" value={investRecs} tone={investRecs > 0 ? "text-emerald-300" : undefined} />
          <Stat label={analyzing > 0 ? "Analyzing now" : "Red-flagged"} value={analyzing > 0 ? analyzing : redFlagged} tone={analyzing > 0 ? "text-indigo-300" : redFlagged > 0 ? "text-rose-300" : undefined} live={analyzing > 0} />
        </div>
      )}
      {error && <ErrorState message={error} retry={() => void load()} />}
      {loading ? <PipelineSkeleton /> : opportunities.length === 0 ? (
        <EmptyState title="No opportunities yet" detail="Submit an inbound application or run outbound sourcing to begin.">
          <Link href="/inbound" className={buttonClass}>Submit inbound deck</Link>
          <Link href="/outbound" className={secondaryButtonClass}>Run outbound sourcing</Link>
        </EmptyState>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead><tr className="border-b border-slate-800 bg-slate-900 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">
                <th className="px-5 py-3">Rank</th>
                <th className="px-3 py-3">Company / founder</th>
                <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5">Founder<InfoTip label="Founder axis">Execution ability and track record, scored 0–100 from evidence in founder memory. Independent of the other two axes — never averaged with them.</InfoTip></span></th>
                <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5">Market<InfoTip label="Market axis">Size, growth, timing, and competitive dynamics of the target market, scored 0–100 independently of the founder.</InfoTip></span></th>
                <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5">Idea vs market<InfoTip label="Idea vs market axis">Whether this specific idea fits this specific market — a great founder in a great market can still have the wrong wedge. Kept separate so an average can never hide it.</InfoTip></span></th>
                <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5">FounderScore<InfoTip label="Founder Score">A persistent score attached to the founder — not the deal — built on append-only memory. It survives across applications and rescreens; the sparkline shows its history, with each change recorded alongside its reason.</InfoTip></span></th>
                <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5">Thesis fit<InfoTip label="Thesis fit">How well the opportunity matches your configured thesis — sectors, geographies, stages, check size, risk appetite. Edit it on the Thesis page; rescreening recomputes fit.</InfoTip></span></th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5">Track<InfoTip label="Track" align="right">How the deal entered: inbound (a submitted application) or outbound (proactively sourced against the thesis).</InfoTip></span></th>
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-800/80">
                {opportunities.map((opportunity, index) => {
                  const axes = opportunity.screening?.axes;
                  const founder = founders[opportunity.id];
                  return <tr key={opportunity.id} className="group transition hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-3 py-4"><Link href={`/opportunity/${encodeURIComponent(opportunity.id)}`} className="block"><span className="flex items-center gap-2"><span className="font-medium text-slate-100 group-hover:text-indigo-300">{opportunity.company}</span><DecisionChip value={opportunity.decision?.recommendation} /></span><span className="mt-1 block text-xs text-slate-500">{founder?.name || opportunity.founder_id}</span></Link></td>
                    {(["Founder", "Market", "IdeaVsMarket"] as const).map((name) => <td key={name} className="px-3 py-4"><AxisChip axis={axes?.find((axis) => axis.axis === name)} /></td>)}
                    <td className="px-3 py-4"><div className="flex items-center gap-2"><Sparkline points={founder?.history} />{founder?.history?.length ? <span className="font-mono text-xs text-slate-400">{founder.history.at(-1)?.score_0_100}</span> : null}</div></td>
                    <td className="px-3 py-4"><FitBar value={opportunity.screening?.thesisFit_0_1} /></td>
                    <td className="px-3 py-4"><StatusBadge status={opportunity.status} /></td>
                    <td className="px-3 py-4"><span className={`rounded-md px-2 py-1 text-[11px] capitalize ${opportunity.track === "inbound" ? "bg-indigo-500/10 text-indigo-300" : "bg-emerald-500/10 text-emerald-300"}`}>{opportunity.track}</span></td>
                    <td className="px-4 py-4"><Link aria-label={`Open ${opportunity.company}`} href={`/opportunity/${encodeURIComponent(opportunity.id)}`} className="text-slate-600 group-hover:text-indigo-300">→</Link></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone, live }: { label: string; value: number; tone?: string; live?: boolean }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{live && <span className="h-1.5 w-1.5 animate-vc-pulse rounded-full bg-indigo-400" />}{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${tone ?? "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="border-b border-slate-800 bg-slate-900 px-5 py-3"><Skeleton className="h-3 w-64" /></div>
      <div className="divide-y divide-slate-800/80">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="h-3 w-6" /><Skeleton className="h-4 w-44" /><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-16" /><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
