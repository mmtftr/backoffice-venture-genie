"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

// Small "ⓘ" affordance that opens an explainer popover. Used across the app to
// document what each part of the system does without cluttering the layout.
export function InfoTip({ label, children, align = "left", className = "" }: { label: string; children: ReactNode; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return (
    <span ref={root} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`About: ${label}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`grid h-4 w-4 place-items-center rounded-full border text-[9px] font-semibold leading-none transition ${open ? "border-indigo-400 bg-indigo-500/20 text-indigo-200" : "border-slate-600 text-slate-500 hover:border-indigo-400 hover:text-indigo-300"}`}
      >
        i
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          className={`absolute top-6 z-40 w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 text-left shadow-2xl shadow-black/60 ${align === "right" ? "right-0" : "left-0"}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-indigo-300">{label}</p>
          <div className="mt-2 text-xs font-normal normal-case leading-5 tracking-normal text-slate-300">{children}</div>
        </div>
      )}
    </span>
  );
}
