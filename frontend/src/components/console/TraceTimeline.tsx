"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleSlash, Loader2, X } from "lucide-react";
import type { TraceStep } from "@/lib/types";
import { ms } from "@/lib/format";

const STAGE_LABEL: Record<TraceStep["stage"], string> = {
  validate: "validate",
  route: "route",
  plan: "plan",
  execute: "execute",
  fuse: "aggregate",
  synthesize: "synthesize",
  report: "report",
};

function StatusIcon({ s }: { s: TraceStep["status"] }) {
  if (s === "running") return <Loader2 size={13} className="animate-spin-slow text-cyan" />;
  if (s === "done") return <Check size={13} className="text-ok" strokeWidth={3} />;
  if (s === "failed") return <X size={13} className="text-crit" strokeWidth={3} />;
  if (s === "skipped") return <CircleSlash size={13} className="text-ink-3" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />;
}

function fmtParam(v: TraceStep["params"][string]) {
  return Array.isArray(v) ? v.join(", ") : String(v);
}

export function TraceList({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="relative space-y-0.5">
      {steps.map((s, i) => {
        const expanded = open === s.id;
        return (
          <li key={s.id} className="animate-fade-up">
            <button type="button" onClick={() => setOpen(expanded ? null : s.id)} className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.03]">
              <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-2 bg-bg-2">
                <StatusIcon s={s.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="mono text-[10.5px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate text-[12.5px] font-medium text-ink">{s.title}</span>
                  <span className="ml-auto shrink-0 mono text-[10.5px] text-ink-3">{s.status === "running" ? "…" : ms(s.ms)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded bg-white/[0.05] px-1.5 py-px mono text-[10px] uppercase tracking-wide text-ink-3">{STAGE_LABEL[s.stage]}</span>
                  <span className="truncate mono text-[11px] text-cyan-2">
                    {s.tool}
                    <span className="text-ink-3">@{s.version}</span>
                  </span>
                  {expanded ? <ChevronDown size={12} className="shrink-0 text-ink-3" /> : <ChevronRight size={12} className="shrink-0 text-ink-3 opacity-0 group-hover:opacity-100" />}
                </span>
                {s.status !== "running" && <span className={`mt-1 block mono text-[11px] leading-snug ${s.status === "failed" ? "text-crit" : "text-ink-2"}`}>→ {s.output}</span>}
              </span>
            </button>
            {expanded && (
              <div className="mb-1 ml-9 mr-2 rounded-md border border-line bg-bg-2 px-2.5 py-2">
                <p className="eyebrow mb-1 !text-[10px]">Permitted parameters</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mono text-[11px]">
                  {Object.entries(s.params).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="break-words text-ink-2">{fmtParam(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Compact DAG of the tools that ran, used as the collapsed trace summary. */
export function ToolChain({ steps }: { steps: TraceStep[] }) {
  const tools: { tool: string; status: TraceStep["status"] }[] = [];
  for (const s of steps) {
    const last = tools[tools.length - 1];
    if (last && last.tool === s.tool) {
      if (s.status === "failed") last.status = "failed";
      continue;
    }
    tools.push({ tool: s.tool, status: s.status });
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tools.map((t, i) => (
        <span key={i} className="flex items-center gap-1">
          <span
            className={`rounded-md border px-1.5 py-0.5 mono text-[10.5px] ${
              t.status === "failed" ? "border-crit/40 text-crit" : t.status === "skipped" ? "border-line-2 text-ink-3" : "border-cyan/25 bg-cyan/[0.06] text-cyan-2"
            }`}
          >
            {t.tool}
          </span>
          {i < tools.length - 1 && <ChevronRight size={11} className="text-ink-3" />}
        </span>
      ))}
    </div>
  );
}
