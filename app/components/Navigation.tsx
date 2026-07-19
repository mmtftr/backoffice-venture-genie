"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Thesis } from "@/lib/schemas";
import { showOnboarding } from "./Onboarding";

const links = [
  { href: "/", label: "Pipeline", icon: "▦" },
  { href: "/inbound", label: "Inbound", icon: "↘" },
  { href: "/outbound", label: "Outbound", icon: "↗" },
  { href: "/thesis", label: "Thesis", icon: "◇" },
];

export function Navigation() {
  const pathname = usePathname();
  const [thesis, setThesis] = useState<Thesis | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/thesis", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled && data) setThesis(data as Thesis); })
      .catch(() => { /* nav hint is optional */ });
    return () => { cancelled = true; };
  }, [pathname]);
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-3 font-semibold text-white">
          <Logo /> Venture Genie
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return <Link key={link.href} href={link.href} title={link.label} className={`rounded-lg px-2.5 py-2 text-sm ${active ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400"}`}>{link.icon}</Link>;
          })}
          <button type="button" onClick={showOnboarding} title="How it works" aria-label="How it works" className="rounded-lg px-2.5 py-2 text-sm text-slate-400">?</button>
        </nav>
      </header>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800 bg-slate-950/90 p-5 backdrop-blur lg:block">
        <Link href="/" className="mb-10 flex items-center gap-3 px-2 text-lg font-semibold tracking-tight text-white">
          <Logo /> <span>Venture Genie</span>
        </Link>
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-600">Workspace</div>
        <nav className="space-y-1">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/20" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}>
                <span className="w-5 text-center font-mono text-base">{link.icon}</span>{link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={showOnboarding}
          className="mt-6 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-900 hover:text-slate-200"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-700 text-[10px]">?</span>
          How it works
        </button>
        <div className="absolute bottom-6 left-5 right-5 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Active thesis</div>
          {thesis ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {thesis.sectors.slice(0, 3).map((sector) => <span key={sector} className="rounded border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-400">{sector}</span>)}
              <span className="px-0.5 py-0.5 text-[10px] text-slate-600">{thesis.stages.join("/")} · {thesis.geographies.join("+")}</span>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] leading-4 text-slate-600">Evidence-backed investment intelligence</p>
          )}
        </div>
      </aside>
    </>
  );
}

function Logo() {
  return <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-950">VB</span>;
}
