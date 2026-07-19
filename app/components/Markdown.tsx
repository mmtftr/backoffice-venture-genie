import type { ReactNode } from "react";

// Minimal markdown renderer producing React elements (no raw HTML, so no XSS
// surface). Supports headings, lists, blockquotes, code fences, bold/italic,
// inline code, [text](url) links, and bare-URL autolinking — the subset that
// appears in evidence entries and memo prose.

type InlineRule = { re: RegExp; render: (match: RegExpExecArray, key: string) => ReactNode };

const linkClass = "text-indigo-300 underline decoration-indigo-500/50 underline-offset-2 hover:text-indigo-200";

const inlineRules: InlineRule[] = [
  { re: /`([^`]+)`/, render: (m, k) => <code key={k} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[.85em] text-slate-200">{m[1]}</code> },
  { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m, k) => <a key={k} href={m[2]} target="_blank" rel="noreferrer noopener" className={linkClass}>{m[1]}</a> },
  { re: /\*\*([^*]+)\*\*/, render: (m, k) => <strong key={k} className="font-semibold text-slate-100">{renderInline(m[1], k)}</strong> },
  { re: /\*([^*\s][^*]*)\*/, render: (m, k) => <em key={k}>{renderInline(m[1], k)}</em> },
  { re: /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/, render: (m, k) => <a key={k} href={m[0]} target="_blank" rel="noreferrer noopener" className={`${linkClass} break-all`}>{m[0]}</a> },
];

function renderInline(text: string, keyPrefix = ""): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let index = 0;
  while (rest.length > 0) {
    let earliest: { rule: InlineRule; match: RegExpExecArray } | null = null;
    for (const rule of inlineRules) {
      const match = rule.re.exec(rest);
      if (match && (!earliest || match.index < earliest.match.index)) earliest = { rule, match };
    }
    if (!earliest) { nodes.push(rest); break; }
    if (earliest.match.index > 0) nodes.push(rest.slice(0, earliest.match.index));
    nodes.push(earliest.rule.render(earliest.match, `${keyPrefix}i${index}`));
    rest = rest.slice(earliest.match.index + earliest.match[0].length);
    index += 1;
  }
  return nodes;
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "paragraph"; lines: string[] };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) { cursor += 1; continue; }
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !lines[cursor].trimStart().startsWith("```")) { code.push(lines[cursor]); cursor += 1; }
      cursor += 1;
      blocks.push({ kind: "code", lines: code });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] }); cursor += 1; continue; }
    const bullet = /^\s*[-*]\s+(.*)$/;
    const ordered = /^\s*\d+[.)]\s+(.*)$/;
    const listRule = bullet.test(line) ? bullet : ordered.test(line) ? ordered : null;
    if (listRule) {
      const items: string[] = [];
      while (cursor < lines.length) {
        const item = listRule.exec(lines[cursor]);
        if (!item) break;
        items.push(item[1]);
        cursor += 1;
      }
      blocks.push({ kind: "list", ordered: listRule === ordered, items });
      continue;
    }
    if (line.trimStart().startsWith(">")) {
      const quote: string[] = [];
      while (cursor < lines.length && lines[cursor].trimStart().startsWith(">")) { quote.push(lines[cursor].replace(/^\s*>\s?/, "")); cursor += 1; }
      blocks.push({ kind: "quote", lines: quote });
      continue;
    }
    const paragraph: string[] = [];
    while (cursor < lines.length && lines[cursor].trim() && !/^\s*([-*]|\d+[.)]|#{1,4}|>|```)\s/.test(lines[cursor]) && !lines[cursor].trimStart().startsWith("```")) {
      paragraph.push(lines[cursor].trim());
      cursor += 1;
    }
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    else cursor += 1;
  }
  return blocks;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.kind === "heading") {
          const size = block.level <= 2 ? "text-sm font-semibold text-slate-100" : "text-xs font-semibold uppercase tracking-wider text-slate-300";
          return <p key={key} className={size}>{renderInline(block.text, key)}</p>;
        }
        if (block.kind === "code") return <pre key={key} className="overflow-x-auto rounded-lg bg-slate-950/80 p-3 font-mono text-[11px] leading-5 text-slate-300">{block.lines.join("\n")}</pre>;
        if (block.kind === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return <Tag key={key} className={`space-y-1 pl-4 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-slate-600`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>)}</Tag>;
        }
        if (block.kind === "quote") return <blockquote key={key} className="border-l-2 border-indigo-500/40 pl-3 text-slate-400">{renderInline(block.lines.join(" "), key)}</blockquote>;
        return <p key={key}>{renderInline(block.lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
