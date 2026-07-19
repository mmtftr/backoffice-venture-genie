"use client";

import { useState } from "react";
import { inputClass } from "./ui";

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  function add() { const next = draft.trim(); if (next && !value.includes(next)) onChange([...value, next]); setDraft(""); }
  return <div><div className="mb-2 flex flex-wrap gap-2">{value.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200">{tag}<button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} className="text-indigo-400 hover:text-white" aria-label={`Remove ${tag}`}>×</button></span>)}</div><input className={inputClass} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }} /></div>;
}
