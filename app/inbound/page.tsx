"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, PageHeader, buttonClass, cardClass, inputClass } from "../components/ui";

export default function InboundPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [founderName, setFounderName] = useState("");
  const [deckText, setDeckText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setSubmitting(true); setError(""); try { const response = await fetch("/api/inbound", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, founderName, deckText }) }); if (!response.ok) { const payload = await response.json().catch(() => null) as { error?: string } | null; throw new Error(payload?.error || "Could not submit opportunity"); } const { id } = await response.json() as { id: string }; router.push(`/opportunity/${encodeURIComponent(id)}`); } catch (err) { setError(err instanceof Error ? err.message : "Could not submit opportunity"); setSubmitting(false); } }
  return <><PageHeader eyebrow="Application review" title="New inbound" description="Paste the deck text below. PDF upload and parsing are outside this workflow." />{error && <div className="mb-5"><ErrorState message={error} /></div>}<form onSubmit={submit} className={`${cardClass} max-w-4xl p-5 sm:p-7`}><div className="grid gap-5 sm:grid-cols-2"><Field label="Company"><input required className={inputClass} value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Acme AI" /></Field><Field label="Founder name"><input required className={inputClass} value={founderName} onChange={(event) => setFounderName(event.target.value)} placeholder="Ada Founder" /></Field></div><label className="mt-5 block"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-slate-400">Deck text</span><span className="font-mono text-[10px] text-slate-600">{deckText.length.toLocaleString()} chars</span></div><textarea required rows={18} className={`${inputClass} resize-y font-mono text-xs leading-6`} value={deckText} onChange={(event) => setDeckText(event.target.value)} placeholder="Paste pitch deck, application, or founder notes…" /></label><div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-5"><p className="text-xs text-slate-600">Analysis runs asynchronously and usually completes within 90 seconds.</p><button disabled={submitting} className={buttonClass}>{submitting ? "Starting analysis…" : "Submit for analysis"}</button></div></form></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-xs font-medium text-slate-400">{label}</span>{children}</label>; }
