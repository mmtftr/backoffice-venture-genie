import type { AxisScore, Trend } from "@/lib/schemas";

export const inputClass = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";
export const buttonClass = "inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass = "inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-50";
export const cardClass = "rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm shadow-black/20";

export function PageHeader({ eyebrow, title, titleInfo, description, action }: { eyebrow?: string; title: string; titleInfo?: React.ReactNode; description?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.2em] text-indigo-400">{eyebrow}</p>}<h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}{titleInfo}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}</div>{action}</div>;
}

export function trendArrow(trend: Trend) { return trend === "improving" ? "↑" : trend === "declining" ? "↓" : "→"; }
export function scoreColor(score: number) { return score >= 70 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : score >= 40 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"; }

export function AxisChip({ axis }: { axis?: AxisScore }) {
  if (!axis) return <span className="text-slate-600">—</span>;
  return <span title={`${axis.axis}: ${axis.trend}`} className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-md border px-2 py-1 font-mono text-xs font-semibold ${scoreColor(axis.score_0_100)}`}><span>{Math.round(axis.score_0_100)}</span><span>{trendArrow(axis.trend)}</span></span>;
}

// Thesis-fit rendered as value + bar so ranking is scannable at a glance.
export function FitBar({ value }: { value?: number }) {
  if (value === undefined) return <span className="text-slate-600">—</span>;
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="w-24">
      <div className="flex items-baseline justify-between"><span className="font-mono text-sm text-slate-200">{pct}%</span></div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function DecisionChip({ value }: { value?: "invest" | "pass" | "watch" }) {
  if (!value) return null;
  const style = value === "invest" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : value === "pass" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>{value}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const style = status === "screened" ? "bg-emerald-500/10 text-emerald-300" : status === "analyzing" ? "bg-indigo-500/10 text-indigo-300" : status === "error" ? "bg-rose-500/10 text-rose-300" : "bg-slate-700/50 text-slate-300";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${style}`}>{status === "analyzing" && <span className="h-1.5 w-1.5 animate-vc-pulse rounded-full bg-indigo-400" />}{status}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-vc-shimmer rounded-md ${className}`} />;
}

export function EmptyState({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) { return <div className={`${cardClass} px-6 py-16 text-center`}><div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-slate-700 bg-slate-800 text-slate-400">◇</div><h2 className="font-medium text-slate-200">{title}</h2><p className="mt-1 text-sm text-slate-500">{detail}</p>{children && <div className="mt-6 flex items-center justify-center gap-3">{children}</div>}</div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-4 text-sm text-rose-300"><span>{message}</span>{retry && <button onClick={retry} className="ml-3 font-semibold underline underline-offset-4">Try again</button>}</div>; }
export function LoadingState({ label = "Loading" }: { label?: string }) { return <div className="flex items-center gap-3 py-16 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />{label}…</div>; }
