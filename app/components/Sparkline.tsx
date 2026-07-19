import type { FounderScorePoint } from "@/lib/schemas";

export function Sparkline({ points }: { points?: FounderScorePoint[] }) {
  if (!points?.length) return <span className="text-xs text-slate-600">No history</span>;
  const values = points.map((point) => point.score_0_100);
  const width = 92, height = 30, pad = 2;
  const min = Math.max(0, Math.min(...values) - 8), max = Math.min(100, Math.max(...values) + 8);
  const range = Math.max(1, max - min);
  const path = values.map((value, index) => `${index ? "L" : "M"} ${pad + (index * (width - pad * 2)) / Math.max(1, values.length - 1)} ${height - pad - ((value - min) / range) * (height - pad * 2)}`).join(" ");
  const improving = values.at(-1)! >= values[0];
  return <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`Founder score history, latest ${values.at(-1)}`}><path d={path} fill="none" stroke={improving ? "#34d399" : "#fb7185"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx={pad + ((values.length - 1) * (width - pad * 2)) / Math.max(1, values.length - 1)} cy={height - pad - ((values.at(-1)! - min) / range) * (height - pad * 2)} r="2.5" fill={improving ? "#34d399" : "#fb7185"} /></svg>;
}
