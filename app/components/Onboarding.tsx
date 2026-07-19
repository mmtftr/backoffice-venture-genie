"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vcbrain.onboarded.v1";
export const ONBOARDING_EVENT = "vcbrain:show-onboarding";

// Dispatch from anywhere (e.g. the nav "How it works" button) to reopen the tour.
export function showOnboarding() {
  window.dispatchEvent(new Event(ONBOARDING_EVENT));
}

type Step = { icon: string; title: string; body: React.ReactNode };

const steps: Step[] = [
  {
    icon: "◆",
    title: "Welcome to Venture Genie",
    body: (
      <>
        <p>An AI diligence brain for early-stage investing. Every opportunity moves through one pipeline:</p>
        <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-center font-mono text-[11px] tracking-wide text-indigo-200">Sourcing → Screening → Diligence → Decision</p>
        <p className="mt-3">Deals arrive two ways: <strong className="text-slate-200">Inbound</strong> (paste a deck, the system screens it) and <strong className="text-slate-200">Outbound</strong> (the system proactively finds companies matching your thesis).</p>
      </>
    ),
  },
  {
    icon: "▦",
    title: "Three axes, never averaged",
    body: (
      <>
        <p>Screening scores each deal on three <strong className="text-slate-200">independent axes</strong>:</p>
        <ul className="mt-3 space-y-2">
          <li><strong className="text-slate-200">Founder</strong> — execution ability and track record.</li>
          <li><strong className="text-slate-200">Market</strong> — size, timing, and dynamics.</li>
          <li><strong className="text-slate-200">Idea vs Market</strong> — does this idea actually fit this market?</li>
        </ul>
        <p className="mt-3">They are deliberately <em>never blended into one number</em> — a 90 founder with a 20 market is a very different conversation than three 55s, and a single average would hide that.</p>
      </>
    ),
  },
  {
    icon: "⚙",
    title: "A traced agent swarm does the research",
    body: (
      <>
        <p>Diligence is run by a swarm of specialized research agents: one per team member, competitor discovery and evaluation, community-signal scanning, and a dedicated <strong className="text-slate-200">contradiction detector</strong>.</p>
        <p className="mt-3">Every single agent action is recorded. Open any opportunity and expand <strong className="text-slate-200">Agent activity → raw trace</strong> to audit exactly what was done, by which agent, based on which evidence.</p>
      </>
    ),
  },
  {
    icon: "◈",
    title: "Evidence-backed claims with trust scores",
    body: (
      <>
        <p>The investment memo is built from individual claims. Each claim carries a <strong className="text-slate-200">trust score</strong> and links to entries in the founder&apos;s append-only memory.</p>
        <p className="mt-3">Click the percentage chip next to any claim — or the evidence count on an axis card — to open the underlying evidence: source, timestamp, and full content.</p>
        <p className="mt-3 text-slate-400">◆ externally verified · ◈ internally consistent · ? unverified</p>
      </>
    ),
  },
  {
    icon: "◇",
    title: "Your thesis drives everything",
    body: (
      <>
        <p>The <strong className="text-slate-200">Thesis</strong> page defines sectors, geographies, stages, check size, and risk appetite. Sourcing ranks candidates against it, and every decision states its thesis-fit rationale.</p>
        <p className="mt-3">Founders accumulate a persistent <strong className="text-slate-200">Founder Score</strong> over time in memory. When a founder has no track record, the <strong className="text-slate-200">Signal Substitution Ladder</strong> falls back to the strongest available proxy: code cadence, public writing, community footprint, or application quality.</p>
        <p className="mt-3">Look for the <span className="mx-0.5 inline-grid h-4 w-4 place-items-center rounded-full border border-slate-600 align-middle text-[9px] text-slate-400">i</span> icons throughout the app — each explains the mechanism behind what you&apos;re seeing.</p>
      </>
    ),
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try { if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true); } catch { /* storage unavailable → skip auto-open */ }
    function onShow() { setStep(0); setOpen(true); }
    window.addEventListener(ONBOARDING_EVENT, onShow);
    return () => window.removeEventListener(ONBOARDING_EVENT, onShow);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try { window.localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
      if (event.key === "ArrowRight") setStep((value) => Math.min(value + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setStep((value) => Math.max(value - 1, 0));
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;
  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Venture Genie works"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/70"
      >
        <div className="border-b border-slate-800 bg-gradient-to-br from-indigo-500/15 to-transparent px-6 pb-5 pt-6">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-lg text-indigo-300">{current.icon}</span>
            <button type="button" onClick={dismiss} className="text-xs font-medium text-slate-500 transition hover:text-slate-300">Skip tour</button>
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-400">How it works · {step + 1} / {steps.length}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{current.title}</h2>
        </div>
        <div className="min-h-52 px-6 py-5 text-sm leading-6 text-slate-300">{current.body}</div>
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-6 py-4">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to step ${index + 1}`}
                onClick={() => setStep(index)}
                className={`h-1.5 rounded-full transition-all ${index === step ? "w-6 bg-indigo-400" : "w-1.5 bg-slate-700 hover:bg-slate-600"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800">Back</button>
            )}
            <button
              type="button"
              onClick={() => (last ? dismiss() : setStep(step + 1))}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              {last ? "Start exploring" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
