"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { CHART } from "@/lib/palette";

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

export interface LegendItem {
  label: string;
  color: string;
  kind?: "rect" | "line" | "dot" | "ring";
  hidden?: boolean;
  onClick?: () => void;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          className={`flex items-center gap-1.5 text-[12px] ${it.onClick ? "cursor-pointer" : "cursor-default"} ${it.hidden ? "text-ink-3 line-through" : "text-ink-2"}`}
        >
          {it.kind === "line" ? (
            <span className="inline-block h-[2px] w-3.5 rounded" style={{ background: it.color, opacity: it.hidden ? 0.3 : 1 }} />
          ) : it.kind === "ring" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: it.color, opacity: it.hidden ? 0.3 : 1 }} />
          ) : it.kind === "dot" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.color, opacity: it.hidden ? 0.3 : 1 }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color, opacity: it.hidden ? 0.3 : 1 }} />
          )}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  footnote,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  table?: TableSpec;
  children: React.ReactNode;
  footnote?: string;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`panel flex min-w-0 flex-col p-4 ${className ?? ""}`}>
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{title}</p>
          {subtitle && <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" className="icon-btn shrink-0" title={asTable ? "Show chart" : "Show table"} aria-label={asTable ? "Show chart" : "Show table"} onClick={() => setAsTable((v) => !v)}>
            {asTable ? <BarChart3 size={15} /> : <Table2 size={15} />}
          </button>
        )}
      </figcaption>
      {legend && legend.length > 1 && !asTable && (
        <div className="mb-3">
          <Legend items={legend} />
        </div>
      )}
      {asTable && table ? (
        <div className="max-h-[320px] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} className={i ? "num" : ""}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={j ? "num" : "text-ink"}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
      {footnote && <p className="mt-3 text-[11.5px] leading-snug text-ink-3">{footnote}</p>}
    </figure>
  );
}

export interface TipRow {
  label: string;
  value: string;
  color?: string;
  kind?: "line" | "rect";
}

export function Tooltip({ x, y, title, rows, containerW }: { x: number; y: number; title?: string; rows: TipRow[]; containerW: number }) {
  const left = x + 14 + 190 > containerW ? x - 14 - 190 : x + 14;
  return (
    <div
      className="pointer-events-none absolute z-10 w-[190px] rounded-lg border px-3 py-2 shadow-xl"
      style={{ left: Math.max(0, left), top: Math.max(0, y - 10), background: "rgba(10,16,26,0.96)", borderColor: "rgba(255,255,255,0.14)" }}
    >
      {title && <p className="mb-1.5 text-[11.5px] font-medium text-ink-3">{title}</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && <span className={r.kind === "rect" ? "h-2.5 w-2.5 rounded-[3px]" : "h-[2px] w-3 rounded"} style={{ background: r.color }} />}
            <span className="tnum text-[12.5px] font-semibold text-ink">{r.value}</span>
            <span className="truncate text-[11.5px] text-ink-3">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(6)));
  return ticks;
}

export const axisText = { fill: CHART.ink3, fontSize: 11, fontFamily: "var(--font-inter)" } as const;

/** Path for a bar with 4px rounded data-end and square baseline (horizontal bars grow to the right). */
export function hBarPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h / 2);
  if (w <= 0) return "";
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

/** Vertical column with rounded top. */
export function vBarPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h / 2);
  if (h <= 0) return "";
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
