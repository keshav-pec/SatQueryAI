"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Braces, Check, ChevronDown, ChevronUp, Copy, CornerDownLeft, FileDown, Loader2, Map as MapIcon, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import type { AgentResult, TraceStep } from "@/lib/types";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";
import { ms } from "@/lib/format";
import { TypewriterText } from "./AnswerText";
import { ToolChain, TraceList } from "./TraceTimeline";

export interface ThreadItem {
  id: string;
  query: string;
  status: "running" | "done";
  steps: TraceStep[];
  result?: AgentResult;
  fresh: boolean;
  note?: string;
}

interface Props {
  thread: ThreadItem[];
  activeId: string | null;
  onActivate: (id: string) => void;
  activeEvidence: string | null;
  onSelectEvidence: (itemId: string, evidenceId: string) => void;
  onExport: (itemId: string, kind: "pdf" | "geojson" | "json") => void;
  onTyped: (itemId: string) => void;
  query: string;
  setQuery: (q: string) => void;
  onSubmit: () => void;
  canRun: boolean;
  running: boolean;
  suggestions: string[];
  hasImages: boolean;
  engine: "demo" | "live";
  liveAvailable: boolean;
  onEngine: (e: "demo" | "live") => void;
  exporting: string | null;
}

function ResultCard({ item, active, onActivate, activeEvidence, onSelectEvidence, onExport, onTyped, exporting }: { item: ThreadItem; active: boolean } & Pick<Props, "onActivate" | "activeEvidence" | "onSelectEvidence" | "onExport" | "onTyped" | "exporting">) {
  const [traceOpen, setTraceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const r = item.result!;
  const rejected = r.task === "rejected";
  return (
    <div
      className={`animate-fade-up rounded-xl border p-3.5 transition-colors ${active ? "border-cyan/35 bg-panel" : "border-line bg-panel/60 hover:border-line-2"} ${rejected ? "!border-crit/40" : ""}`}
      onClick={() => !active && onActivate(item.id)}
    >
      <div className="mb-2.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className={`badge ${rejected ? "badge-crit" : "badge-cyan"}`}>
            {rejected ? <ShieldAlert size={11} /> : <Sparkles size={11} />}
            {r.taskLabel}
          </span>
          <p className="mt-1.5 text-[11.5px] text-ink-3">
            {r.trace.length} steps · {new Set(r.trace.map((s) => s.tool)).size} tools · {ms(r.totalMs)} pipeline time
          </p>
        </div>
        {!rejected && r.confidence > 0 && (
          <div className="flex flex-col items-center">
            <ConfidenceRing value={r.confidence} />
            <span className="mt-0.5 text-[10px] text-ink-3">confidence</span>
          </div>
        )}
      </div>

      {r.confidence > 0 && r.confidence < 0.7 && (
        <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] px-2.5 py-1.5 text-[11.5px] text-warn">
          <TriangleAlert size={13} /> Low confidence — answer is hedged and flagged for review.
        </div>
      )}

      <TypewriterText text={r.answer} animate={item.fresh} onDone={() => onTyped(item.id)} />

      {r.highlights.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.highlights.map((h) => (
            <span key={h} className="rounded-md border border-line-2 bg-white/[0.03] px-2 py-0.5 text-[11.5px] font-medium text-ink">
              {h}
            </span>
          ))}
        </div>
      )}

      {r.confidenceParts.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {r.confidenceParts.map((c) => (
            <div key={c.label} className="rounded-lg bg-bg-2 px-2 py-1.5">
              <p className="truncate text-[10.5px] text-ink-3">{c.label}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-cyan" style={{ width: `${c.value * 100}%` }} />
                </div>
                <span className="tnum text-[11px] font-semibold text-ink">{Math.round(c.value * 100)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {r.evidence.length > 0 && (
        <div className="mt-3">
          <p className="eyebrow mb-1.5 !text-[10.5px]">Evidence · click to locate</p>
          <div className="space-y-1">
            {r.evidence.map((e) => {
              const on = active && activeEvidence === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEvidence(item.id, e.id);
                  }}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${on ? "border-cyan/50 bg-cyan/[0.07]" : "border-line hover:border-line-2 hover:bg-white/[0.02]"}`}
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: e.color ?? "#3bd5ff" }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-medium text-ink">{e.label}</span>
                      <span className="ml-auto shrink-0 tnum text-[11px] text-ink-3">{Math.round(e.confidence * 100)}%</span>
                    </span>
                    {e.stats && e.stats.length > 0 && (
                      <span className="mt-0.5 block truncate text-[11px] text-ink-3">{e.stats.slice(0, 2).map((s) => `${s.label} ${s.value}`).join(" · ")}</span>
                    )}
                  </span>
                  <MapIcon size={12} className="mt-1 shrink-0 text-ink-3" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-line bg-bg-2/60 p-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={(ev) => {
            ev.stopPropagation();
            setTraceOpen((v) => !v);
          }}
        >
          <span className="eyebrow !text-[10.5px]">Execution trace</span>
          <span className="ml-auto text-ink-3">{traceOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </button>
        <div className="mt-1.5">
          <ToolChain steps={r.trace} />
        </div>
        {traceOpen && (
          <div className="mt-2 border-t border-line pt-1.5">
            <TraceList steps={r.trace} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className="btn btn-ghost btn-sm" disabled={exporting === `${item.id}:pdf`} onClick={(ev) => { ev.stopPropagation(); onExport(item.id, "pdf"); }}>
          {exporting === `${item.id}:pdf` ? <Loader2 size={13} className="animate-spin-slow" /> : <FileDown size={13} />} Report PDF
        </button>
        {!rejected && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); onExport(item.id, "geojson"); }}>
            <MapIcon size={13} /> GeoJSON
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); onExport(item.id, "json"); }}>
          <Braces size={13} /> Trace JSON
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={(ev) => {
            ev.stopPropagation();
            navigator.clipboard?.writeText(r.answer.replace(/\*\*/g, ""));
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function AgentPanel(p: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const lastLen = useRef(0);
  const last = p.thread[p.thread.length - 1];
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (p.thread.length !== lastLen.current || last?.status === "running") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    lastLen.current = p.thread.length;
  }, [p.thread, last?.status, last?.steps.length]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-bg-2/60">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-saffron/30 to-cyan/20 text-ink">
          <Bot size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">SatQuery agent</p>
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <span className={`dot ${p.engine === "live" ? "bg-ok" : "bg-cyan"}`} />
            {p.engine === "live" ? "Live API · FastAPI backend" : "Offline engine · cached specialist outputs"}
          </p>
        </div>
        {p.liveAvailable && (
          <div className="segmented">
            <button type="button" data-active={p.engine === "demo"} onClick={() => p.onEngine("demo")}>
              Offline
            </button>
            <button type="button" data-active={p.engine === "live"} onClick={() => p.onEngine("live")}>
              Live
            </button>
          </div>
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {p.thread.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-2 p-4">
            <p className="text-[13.5px] font-semibold text-ink">{p.hasImages ? "Ask anything about the scene" : "Load a scene, then ask"}</p>
            <ol className="mt-2 space-y-1.5 text-[12.5px] text-ink-3">
              <li>1 · Pick a test scene or drop GeoTIFFs on the left</li>
              <li>2 · The validator checks format, CRS and pairing</li>
              <li>3 · Ask in plain language — the agent picks the tools</li>
              <li>4 · Inspect evidence on the image and real map, export the report</li>
            </ol>
          </div>
        )}
        {p.thread.map((item) => (
          <div key={item.id} className="space-y-2.5">
            <div className="flex justify-end">
              <p className="max-w-[88%] rounded-2xl rounded-br-md bg-saffron/[0.13] px-3.5 py-2 text-[13px] leading-snug text-ink">{item.query}</p>
            </div>
            {item.note && <p className="text-[11.5px] text-warn">{item.note}</p>}
            {item.status === "running" ? (
              <div className="rounded-xl border border-cyan/25 bg-panel p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin-slow text-cyan" />
                  <p className="text-[12.5px] font-semibold text-ink">{item.steps[item.steps.length - 1]?.title ?? "Starting agent"}…</p>
                </div>
                <TraceList steps={item.steps} />
              </div>
            ) : (
              <ResultCard
                item={item}
                active={p.activeId === item.id}
                onActivate={p.onActivate}
                activeEvidence={p.activeEvidence}
                onSelectEvidence={p.onSelectEvidence}
                onExport={p.onExport}
                onTyped={p.onTyped}
                exporting={p.exporting}
              />
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        {p.suggestions.length > 0 && (
          <div className="mb-2 flex max-h-[76px] flex-wrap gap-1.5 overflow-y-auto">
            {p.suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => p.setQuery(s)} disabled={p.running}>
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onSubmit();
          }}
          className="relative"
        >
          <textarea
            className="field pr-24"
            rows={3}
            placeholder={p.hasImages ? "Ask about the scene — e.g. “Highlight the water body”" : "Load a scene first…"}
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                p.onSubmit();
              }
            }}
          />
          <button type="submit" className="btn btn-primary btn-sm absolute bottom-2.5 right-2.5" disabled={!p.canRun}>
            {p.running ? <Loader2 size={14} className="animate-spin-slow" /> : <CornerDownLeft size={14} />}
            Run
          </button>
        </form>
        <p className="mt-1.5 text-[11px] text-ink-3">Enter to run · Shift + Enter for a new line</p>
      </div>
    </aside>
  );
}
