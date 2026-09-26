"use client";

import type { EvidenceItem } from "@/lib/types";
import type { ViewState } from "./ZoomPane";

function ringPath(ring: number[][]): string {
  return ring.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z";
}

interface Props {
  items: EvidenceItem[];
  width: number;
  height: number;
  scale: number;
  activeId?: string | null;
  onSelect?: (id: string) => void;
}

/** Vector evidence drawn in image-pixel space (inside the ZoomPane transform). */
export function EvidenceSvg({ items, width, height, scale, activeId, onSelect }: Props) {
  const r = 5 / scale;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 overflow-visible">
      <defs>
        <filter id="ev-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={3 / scale} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {items.map((ev) => {
        const active = ev.id === activeId;
        const color = ev.color ?? "#3bd5ff";
        const common = {
          stroke: color,
          vectorEffect: "non-scaling-stroke" as const,
          strokeWidth: active ? 3 : 2,
          style: { pointerEvents: "visiblePainted" as const, cursor: "pointer" },
          onClick: () => onSelect?.(ev.id),
        };
        if (ev.kind === "polygon" && Array.isArray(ev.pixel) && Array.isArray(ev.pixel[0])) {
          const d = ringPath(ev.pixel as number[][]) + (ev.holes ?? []).map(ringPath).join("");
          return (
            <g key={ev.id} filter={active ? "url(#ev-glow)" : undefined}>
              <path d={d} fill={color} fillOpacity={active ? 0.2 : 0.1} fillRule="evenodd" {...common} />
              {active && (
                <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeDasharray="6 6" style={{ animation: "dash 1.2s linear infinite" }} />
              )}
            </g>
          );
        }
        if (ev.kind === "box" && ev.bboxPx) {
          const [x0, y0, x1, y1] = ev.bboxPx;
          return (
            <g key={ev.id} filter={active ? "url(#ev-glow)" : undefined}>
              <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={color} fillOpacity={active ? 0.16 : 0.06} strokeDasharray="7 4" {...common} />
              {[
                [x0, y0],
                [x1, y0],
                [x0, y1],
                [x1, y1],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={2.4 / scale} fill={color} />
              ))}
            </g>
          );
        }
        if (ev.kind === "points" && ev.points) {
          return (
            <g key={ev.id}>
              {ev.points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.px[0]} cy={p.px[1]} r={r * 2.2} fill="none" stroke={color} strokeOpacity={0.35} vectorEffect="non-scaling-stroke" strokeWidth={1} />
                  <circle cx={p.px[0]} cy={p.px[1]} r={r} fill={color} stroke="#0d131d" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

/** Crisp HTML labels positioned in screen space from the current view. */
export function EvidenceLabels({ items, view, activeId, onSelect, max = 8 }: { items: EvidenceItem[]; view: ViewState; activeId?: string | null; onSelect?: (id: string) => void; max?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {items.slice(0, max).map((ev) => {
        const b = ev.bboxPx;
        if (!b) return null;
        const x = b[0] * view.scale + view.tx;
        const y = b[1] * view.scale + view.ty;
        const active = ev.id === activeId;
        return (
          <button
            key={ev.id}
            data-no-pan
            onClick={() => onSelect?.(ev.id)}
            className="pointer-events-auto absolute flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-[3px] text-[11.5px] font-semibold shadow-lg transition-transform"
            style={{
              left: Math.max(4, x),
              top: Math.max(4, y - 26),
              background: active ? ev.color ?? "#3bd5ff" : "rgba(6,10,18,0.86)",
              color: active ? "#06131a" : ev.color ?? "#3bd5ff",
              border: `1px solid ${ev.color ?? "#3bd5ff"}`,
              transform: active ? "scale(1.04)" : undefined,
              zIndex: active ? 5 : 1,
            }}
          >
            {ev.label}
            <span className="tnum font-medium opacity-80">{Math.round(ev.confidence * 100)}%</span>
          </button>
        );
      })}
    </div>
  );
}
