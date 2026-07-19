"use client";

import { useState } from "react";
import type { Claim, Decision, EvidenceEntry, FounderMemory, Opportunity, TraceEvent } from "@/lib/schemas";
import { EvidenceDialog } from "./EvidenceDialog";
import { InfoTip } from "./InfoTip";
import { Markdown } from "./Markdown";
import { formatTime } from "./format";
import { cardClass, scoreColor, secondaryButtonClass, trendArrow } from "./ui";

export { formatDate, formatTime } from "./format";

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
        <InfoTip label="Decision">
          The final recommendation weighs the three screening axes against your active thesis (sectors, stage, check size, risk appetite). It is a judgment call grounded in the memo&apos;s evidence — the rationale below explains the thesis fit, and the &ldquo;Why this could fail&rdquo; panel gives the adversarial counter-case.
        </InfoTip>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{decision.thesisRationale}</p>
    </section>
  );
}

const axisExplainers: Record<string, string> = {
  Founder: "Execution ability: track record, shipping cadence, domain depth. Scored on evidence in founder memory, independent of the other axes.",
  Market: "Size, growth, timing, and competitive dynamics of the target market — scored independently of who the founder is.",
  IdeaVsMarket: "Does this specific idea fit this specific market? A great founder in a great market can still have the wrong wedge. Kept separate so a blended average can never mask it.",
};

export function AxisCards({ opportunity, evidence }: { opportunity: Opportunity; evidence: EvidenceEntry[] }) {
  const [openAxis, setOpenAxis] = useState<string | null>(null);
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Screening axes</h2>
        <InfoTip label="Multi-axis screening">
          Each deal is scored on <strong className="text-slate-100">Founder</strong>, <strong className="text-slate-100">Market</strong>, and <strong className="text-slate-100">Idea vs Market</strong> as three independent assessments that are <em>never averaged</em> — a single blended number would hide exactly the asymmetries an investor needs to see. Click an axis&apos;s evidence count to inspect the memory entries behind its score.
        </InfoTip>
      </div>
      <div className="grid gap-4 md:grid-cols-3">{opportunity.screening?.axes.map((axis) => {
        const score = Math.round(axis.score_0_100);
        const barTone = score >= 70 ? "bg-emerald-400" : score >= 40 ? "bg-amber-400" : "bg-rose-400";
        return <article key={axis.axis} className={`${cardClass} p-5`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">{axis.axis === "IdeaVsMarket" ? "Idea vs market" : axis.axis}<InfoTip label={axis.axis === "IdeaVsMarket" ? "Idea vs market axis" : `${axis.axis} axis`}>{axisExplainers[axis.axis]}</InfoTip></p>
              <p className="mt-2 font-mono text-4xl font-semibold text-white">{score}</p>
            </div>
            <span className={`rounded-lg border px-2.5 py-1 font-mono text-sm ${scoreColor(axis.score_0_100)}`} title={`Trend across rescreens: ${axis.trend}`}>{trendArrow(axis.trend)} {axis.trend}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${barTone}`} style={{ width: `${score}%` }} /></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">{axis.rationale}</p>
          {axis.evidence_ids.length > 0 ? (
            <button type="button" onClick={() => setOpenAxis(axis.axis)} className="mt-4 text-[11px] font-medium text-indigo-400 underline decoration-indigo-500/40 underline-offset-4 transition hover:text-indigo-300">
              {axis.evidence_ids.length} evidence reference{axis.evidence_ids.length === 1 ? "" : "s"} →
            </button>
          ) : (
            <p className="mt-4 text-[11px] text-slate-600">No evidence references</p>
          )}
          {openAxis === axis.axis && (
            <EvidenceDialog
              title={`${axis.axis === "IdeaVsMarket" ? "Idea vs market" : axis.axis} axis · score ${score}`}
              subtitle={axis.rationale}
              evidenceIds={axis.evidence_ids}
              evidence={evidence}
              onClose={() => setOpenAxis(null)}
            />
          )}
        </article>;
      })}</div>
    </section>
  );
}

const ladder = [
  ["github_code_cadence", "Code cadence"], ["public_writing_papers", "Public writing"],
  ["community_footprint", "Community footprint"], ["application_quality", "Application quality"],
] as const;

export function SubstitutionLadder({ used }: { used: string }) {
  const usedIndex = ladder.findIndex(([id]) => id === used);
  return <section className={`${cardClass} p-5`}>
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-slate-100">Signal Substitution Ladder</h2>
        <InfoTip label="Cold-start scoring">
          First-time founders have no track record to score. Instead of guessing, the system walks this ladder from strongest to weakest proxy signal — GitHub code cadence, public writing and papers, community footprint, then raw application quality — and scores the founder on the <strong className="text-slate-100">highest rung where real evidence exists</strong>. The highlighted rung is the one actually used; crossed-out rungs had no usable signal.
        </InfoTip>
      </div>
      <p className="mt-1 text-xs text-slate-500">Cold-start evidence path · strongest available rung highlighted</p>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{ladder.map(([id, label], index) => { const active = id === used; const passed = usedIndex >= 0 && index < usedIndex; return <div key={id} className={`relative rounded-lg border px-3 py-3 ${active ? "border-indigo-400 bg-indigo-500/15 text-indigo-200 shadow-[0_0_24px_rgba(99,102,241,.12)]" : "border-slate-800 bg-slate-950/40 text-slate-500"}`}><p className="font-mono text-[10px]">0{index + 1}</p><p className="mt-1 text-xs font-medium">{label}</p>{active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-400" />}{passed && <span className="absolute right-2 top-2 text-[10px] text-slate-600" title="No usable signal at this rung">×</span>}</div>; })}</div>
    {used === "none" && <p className="mt-3 text-xs text-rose-300">No substitution signal was available.</p>}
  </section>;
}

function verificationIcon(value: Claim["verification"]) { return value === "external" ? "◆" : value === "internal" ? "◈" : "?"; }
function verificationLabel(value: Claim["verification"]) { return value === "external" ? "Externally verified — confirmed against sources outside the application (GitHub, funding data, community posts)." : value === "internal" ? "Internally consistent — supported by the founder's own materials, not independently confirmed." : "Unverified — no supporting evidence was found; treat with caution."; }

export function TrustClaim({ claim, evidence }: { claim: Claim; evidence: EvidenceEntry[] }) {
  const [open, setOpen] = useState(false);
  const trust = claim.confidence_0_1;
  const style = trust >= .7 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : trust >= .4 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-4">
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 text-sm leading-6 text-slate-300"><Markdown text={claim.text} /></div>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold transition hover:brightness-125 ${style}`} title={`Trust ${Math.round(trust * 100)}% · ${claim.verification} verification · click to inspect evidence`}>{verificationIcon(claim.verification)} {Math.round(trust * 100)}%</button>
    </div>
    {claim.contradictions.length > 0 && <div className="mt-3 rounded-md bg-rose-500/5 px-3 py-2 text-xs text-rose-300" title="Flagged by the contradiction-detection agent">Contradiction: {claim.contradictions.join(" · ")}</div>}
    {open && (
      <EvidenceDialog
        title={claim.text.length > 90 ? `${claim.text.slice(0, 90)}…` : claim.text}
        subtitle={`Trust ${Math.round(trust * 100)}% · ${verificationLabel(claim.verification)}`}
        evidenceIds={claim.evidence_ids}
        evidence={evidence}
        onClose={() => setOpen(false)}
      />
    )}
  </div>;
}

export function MemoView({ opportunity, memory }: { opportunity: Opportunity; memory: FounderMemory }) {
  if (!opportunity.memo) return <div className={`${cardClass} p-6 text-sm text-slate-500`}>The investment memo is not available yet.</div>;
  return <div className="space-y-4">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold text-slate-200">Investment memo</h2>
      <InfoTip label="Evidence-backed memo">
        The memo is assembled claim by claim. Each claim carries a <strong className="text-slate-100">trust chip</strong>: the percentage is its confidence, and the symbol shows verification (◆ external, ◈ internal, ? unverified). Click any chip to open the evidence from founder memory that backs it. Claims the contradiction agent disputes are flagged in red.
      </InfoTip>
    </div>
    {opportunity.memo.sections.map((section) => <section key={section.title} className={`${cardClass} p-5 sm:p-6`}><h2 className="font-semibold text-slate-100">{section.title}</h2>{section.prose && <Markdown text={section.prose} className="mt-3 text-sm leading-6 text-slate-400" />}<div className="mt-4 space-y-2">{section.claims.map((claim, index) => <TrustClaim key={`${section.title}-${index}`} claim={claim} evidence={memory.evidence} />)}</div></section>)}
  </div>;
}

export function AgentActivity({ summary, trace, evidence }: { summary?: string; trace: TraceEvent[]; evidence: EvidenceEntry[] }) {
  const [open, setOpen] = useState(false);
  const [openEvent, setOpenEvent] = useState<TraceEvent | null>(null);
  const agents = new Set(trace.map((event) => event.agent)).size;
  return <section className={`${cardClass} overflow-hidden`}>
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold text-slate-100">Agent activity</h2>
          <InfoTip label="Research agent swarm">
            Diligence is executed by specialized agents — one per team member, competitor discovery and evaluation, community-signal scanning, and contradiction detection. Every action any agent takes is appended to this trace with its target, detail, and the evidence it produced or consumed, so the whole analysis is auditable. Click an event&apos;s evidence count to inspect the entries.
          </InfoTip>
          {trace.length > 0 && <span className="font-mono text-[11px] text-slate-600">{trace.length} events · {agents} agents</span>}
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">{open ? "Hide" : "View"} raw trace</button>
      </div>
      <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-400">{summary || "No activity summary yet."}</div>
    </div>
    {open && <div className="overflow-x-auto border-t border-slate-800"><table className="w-full min-w-[840px] text-left text-xs"><thead className="bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-3">Agent</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Detail</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Time</th></tr></thead><tbody className="divide-y divide-slate-800">{trace.map((event) => <tr key={event.id} className="align-top hover:bg-slate-900/40"><td className="px-5 py-3 font-medium text-slate-300">{event.agent}</td><td className="px-3 py-3 font-mono text-slate-400">{event.action}</td><td className="px-3 py-3 text-slate-500">{event.target || "—"}</td><td className="max-w-md px-3 py-3 leading-5 text-slate-500">{event.detail || "—"}</td><td className="px-3 py-3 font-mono">{event.evidence_ids.length ? <button type="button" onClick={() => setOpenEvent(event)} className="text-indigo-400 underline decoration-indigo-500/40 underline-offset-2 transition hover:text-indigo-300" title="Inspect the evidence this action touched">{event.evidence_ids.length}</button> : <span className="text-slate-600">—</span>}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{formatTime(event.ts)}</td></tr>)}</tbody></table>{trace.length === 0 && <p className="px-5 py-5 text-xs text-slate-600">No trace events recorded.</p>}</div>}
    {openEvent && (
      <EvidenceDialog
        title={`${openEvent.agent} · ${openEvent.action}`}
        subtitle={openEvent.detail || openEvent.target}
        evidenceIds={openEvent.evidence_ids}
        evidence={evidence}
        onClose={() => setOpenEvent(null)}
      />
    )}
  </section>;
}

// Red flags reference memory evidence inline by id — render those ids as
// clickable chips that open the evidence viewer instead of raw text.
export function RedFlags({ flags, evidence }: { flags: string[]; evidence: EvidenceEntry[] }) {
  const [openIds, setOpenIds] = useState<string[] | null>(null);
  const idPattern = /ev_[a-z0-9]+/gi;
  return <section className="rounded-xl border border-rose-500/30 bg-rose-500/8 p-5">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold text-rose-300">⚑ Red flags</h2>
      <InfoTip label="Red flags">
        Issues the agent swarm considers disqualifying or requiring explanation — mostly contradictions between the founder&apos;s claims and external evidence, or missing corroboration for key metrics. Click an <span className="font-mono text-rose-300">ev_…</span> chip to open the exact evidence entry the flag is based on.
      </InfoTip>
    </div>
    <ul className="mt-2 space-y-1.5 text-sm text-rose-200/80">
      {flags.map((flag) => {
        const ids = flag.match(idPattern) ?? [];
        const parts = flag.split(idPattern);
        return <li key={flag} className="leading-6">
          •{" "}
          {parts.map((part, index) => <span key={index}>
            {part}
            {index < ids.length && (
              <button type="button" onClick={() => setOpenIds([ids[index]])} className="rounded border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] text-rose-200 transition hover:border-rose-300/60 hover:bg-rose-500/20" title="Open this evidence entry">{ids[index]}</button>
            )}
          </span>)}
        </li>;
      })}
    </ul>
    {openIds && <EvidenceDialog title="Red flag evidence" evidenceIds={openIds} evidence={evidence} onClose={() => setOpenIds(null)} />}
  </section>;
}

export function RescreenButton({ opportunityId, onStarted }: { opportunityId: string; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function rescreen() { setBusy(true); setError(""); try { const response = await fetch("/api/rescreen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId }) }); if (!response.ok) throw new Error("Rescreen failed"); onStarted(); } catch (err) { setError(err instanceof Error ? err.message : "Rescreen failed"); } finally { setBusy(false); } }
  return <div className="flex items-center gap-2"><button type="button" onClick={rescreen} disabled={busy} className={secondaryButtonClass} title="Re-run the full agent analysis; founder memory is append-only, so history and score trends are preserved">{busy ? "Starting…" : "Rescreen"}</button>{error && <span className="text-xs text-rose-300">{error}</span>}</div>;
}
