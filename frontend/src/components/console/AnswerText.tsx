"use client";

import { Fragment, useEffect, useState } from "react";

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

/** Minimal markdown: paragraphs, **bold**, and "• " bullet lines. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-[13.5px] leading-[1.62] text-ink-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.filter((l) => l.startsWith("• "));
        if (bullets.length && bullets.length === lines.filter((l) => l.trim()).length) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-cyan" />
                  <span>{inline(l.slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div key={i} className="space-y-1.5">
            {lines.map((l, j) =>
              l.startsWith("• ") ? (
                <div key={j} className="flex gap-2">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-cyan" />
                  <span>{inline(l.slice(2))}</span>
                </div>
              ) : (
                <p key={j}>{inline(l)}</p>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Reveals the answer progressively (only the first time it is shown). */
export function TypewriterText({ text, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let i = 0;
    const step = Math.max(3, Math.round(text.length / 110));
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);
  const count = animate ? n : text.length;
  const shown = count >= text.length ? text : text.slice(0, count);
  // Avoid rendering a dangling "**" while typing
  const safe = (shown.match(/\*\*/g)?.length ?? 0) % 2 ? shown + "**" : shown;
  return (
    <div className={count < text.length ? "caret" : undefined}>
      <RichText text={safe} />
    </div>
  );
}
