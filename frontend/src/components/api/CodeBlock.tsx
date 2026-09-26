"use client";

import { Fragment, useState } from "react";
import { Check, Copy } from "lucide-react";

const KEYWORDS = new Set(["import", "from", "const", "let", "await", "async", "for", "in", "print", "return", "new", "def", "with", "as", "open", "if", "else", "curl", "true", "false", "null", "None", "True", "False"]);

/** Tiny tokenizer: strings, comments, numbers, keywords, flags. Enough for docs snippets. */
function highlight(code: string) {
  const out: React.ReactNode[] = [];
  const re = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\s-{1,2}[A-Za-z][\w-]*)|([A-Za-z_][\w]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(<Fragment key={i++}>{code.slice(last, m.index)}</Fragment>);
    const [tok, comment, str, num, flag, word] = m;
    if (comment) out.push(<span key={i++} className="tok-c">{tok}</span>);
    else if (str) out.push(<span key={i++} className="tok-s">{tok}</span>);
    else if (num) out.push(<span key={i++} className="tok-n">{tok}</span>);
    else if (flag) out.push(<span key={i++} className="tok-k">{tok}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={i++} className="tok-k">{tok}</span>);
    else out.push(<Fragment key={i++}>{tok}</Fragment>);
    last = m.index + tok.length;
  }
  if (last < code.length) out.push(<Fragment key={i++}>{code.slice(last)}</Fragment>);
  return out;
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`icon-btn ${className ?? ""}`}
      aria-label="Copy to clipboard"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
    </button>
  );
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <pre className="code">{highlight(code)}</pre>
      <CopyButton text={code} className="absolute right-2 top-2" />
    </div>
  );
}

export function CodeTabs({ tabs }: { tabs: { label: string; code: string }[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#070c15]">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {tabs.map((t, j) => (
          <button key={t.label} type="button" onClick={() => setI(j)} className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium ${i === j ? "bg-white/[0.08] text-ink" : "text-ink-3 hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="code !rounded-none !border-0">{highlight(tabs[i].code)}</pre>
        <CopyButton text={tabs[i].code} className="absolute right-2 top-2" />
      </div>
    </div>
  );
}
