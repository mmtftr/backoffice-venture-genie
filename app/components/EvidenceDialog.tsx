import { useEffect, useRef } from "react";
import type { EvidenceEntry } from "@/lib/schemas";
import { Markdown } from "./Markdown";
import { formatDate } from "./format";

// Shared evidence viewer: every place that cites evidence ids (memo claims,
// screening axes, trace events) opens this dialog so evidence is inspectable
// with full markdown rendering, source, timestamp, and integrity hash.
export function EvidenceDialog({ title, subtitle, evidenceIds, evidence, onClose }: {
  title: string;
  subtitle?: string;
  evidenceIds: string[];
  evidence: EvidenceEntry[];
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const resolved = evidenceIds
    .map((id) => evidence.find((entry) => entry.id === id))
    .filter((entry): entry is EvidenceEntry => Boolean(entry));
  const missing = evidenceIds.length - resolved.length;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/70 outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-indigo-300">Evidence · {resolved.length} of {evidenceIds.length} resolved</p>
            <h2 className="mt-1 truncate text-sm font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close evidence" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {resolved.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">None of the referenced evidence ids could be resolved in founder memory.</p>
          ) : (
            <ol className="space-y-4">
              {resolved.map((entry, index) => (
                <li key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span className="font-mono text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                    <span className="rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-indigo-300">{entry.source}</span>
                    <time>{formatDate(entry.ts)}</time>
                    <span className="ml-auto font-mono text-slate-700" title="Evidence id in founder memory">{entry.id}</span>
                  </div>
                  <Markdown text={entry.content} className="mt-3 text-xs leading-5 text-slate-300" />
                  {entry.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => <span key={tag} className="rounded border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-400">{tag}</span>)}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {missing > 0 && resolved.length > 0 && (
            <p className="mt-4 text-xs text-amber-300/80">{missing} referenced evidence id{missing === 1 ? "" : "s"} could not be resolved in founder memory.</p>
          )}
        </div>
        <div className="border-t border-slate-800 bg-slate-950/40 px-5 py-3 text-[11px] leading-4 text-slate-500">
          Evidence lives in the founder&apos;s append-only memory. Every claim, score, and agent action links back to entries here — nothing is asserted without a citation.
        </div>
      </div>
    </div>
  );
}
