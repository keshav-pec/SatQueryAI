"use client";

import { useMemo, useState } from "react";
import { CHART, CLASS_META, CLASS_ORDER, EMPHASIS, SEQ_BLUE_DARK, type ClassKey } from "@/lib/palette";
import { HYD, MUM, NMIA } from "@/lib/demo/data";
import { nf0, nf1 } from "@/lib/format";
import { ChartCard, Tooltip, axisText, hBarPath, niceTicks, useSize } from "./kit";

const GAP = 2;
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

// ─── 1. Part-to-whole: land-cover composition ─────────────────────────────

export function CompositionBar({ title, subtitle, parts, unit = "ha" }: { title: string; subtitle?: string; parts: { key: ClassKey; value: number; pct: number }[]; unit?: string }) {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const H = 30;
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((s, p) => s + p.pct, 0));
  const segs = parts.map((p, i) => ({ ...p, x: (starts[i] / 100) * w, width: (p.pct / 100) * w }));
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={parts.map((p) => ({ label: `${CLASS_META[p.key].label} ${p.pct.toFixed(1)} %`, color: CLASS_META[p.key].color }))}
      table={{ columns: ["Class", "Area (ha)", "Share (%)"], rows: parts.map((p) => [CLASS_META[p.key].label, nf1.format(p.value), p.pct.toFixed(2)]) }}
    >
      <div ref={ref} className="relative" style={{ height: H + 4 }} onPointerLeave={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={H} className="block">
            <defs>
              <clipPath id={`clip-${title.length}`}>
                <rect width={w} height={H} rx={4} />
              </clipPath>
            </defs>
            <g clipPath={`url(#clip-${title.length})`}>
              {segs.map((s, i) => (
                <rect
                  key={s.key}
                  x={s.x}
                  y={0}
                  width={Math.max(0, s.width - (i < segs.length - 1 ? GAP : 0))}
                  height={H}
                  fill={CLASS_META[s.key].color}
                  opacity={hover && hover.i !== i ? 0.55 : 1}
                  onPointerMove={(e) => setHover({ i, x: e.nativeEvent.offsetX })}
                />
              ))}
            </g>
            {segs.map((s) => {
              const label = `${s.pct.toFixed(1)}%`;
              if (s.width < label.length * 7 + 14) return null;
              return (
                <text key={s.key} x={s.x + 8} y={H / 2 + 4} fontSize={12} fontWeight={600} fill={lum(CLASS_META[s.key].color) > 0.35 ? "#0b0b0b" : "#ffffff"} pointerEvents="none">
                  {label}
                </text>
              );
            })}
          </svg>
        )}
        {hover && (
          <Tooltip
            x={hover.x}
            y={H}
            containerW={w}
            rows={[{ label: CLASS_META[segs[hover.i].key].label, value: `${segs[hover.i].pct.toFixed(1)} % · ${nf0.format(segs[hover.i].value)} ${unit}`, color: CLASS_META[segs[hover.i].key].color, kind: "rect" }]}
          />
        )}
      </div>
    </ChartCard>
  );
}

export function HydComposition() {
  const c = HYD.classes;
  return <CompositionBar title="Land-cover composition" subtitle={`Share of ${HYD.grid.area_km2.toFixed(1)} km² · spectral classification`} parts={CLASS_ORDER.map((k) => ({ key: k, value: c[k].ha, pct: c[k].pct }))} />;
}

// ─── 2. Spectral signatures (lines) ───────────────────────────────────────

export function SpectralProfile() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const bands = HYD.spectral.bands;
  const wl = HYD.spectral.wavelengths_nm;
  const P = HYD.spectral.profiles;
  const series = [
    { key: "water" as ClassKey, label: "Water (Hussain Sagar)", values: P.lake },
    { key: "vegetation" as ClassKey, label: "Vegetation", values: P.vegetation },
    { key: "builtup" as ClassKey, label: "Built-up", values: P.builtup },
    { key: "bare" as ClassKey, label: "Bare / open land", values: P.bare },
  ];
  const H = 210;
  const m = { l: 40, r: 12, t: 10, b: 36 };
  const iw = Math.max(10, w - m.l - m.r);
  const ih = H - m.t - m.b;
  const ymax = 0.4;
  const x = (i: number) => m.l + (i / (bands.length - 1)) * iw;
  const y = (v: number) => m.t + ih - (v / ymax) * ih;
  return (
    <ChartCard
      title="Spectral signatures"
      subtitle="Mean surface reflectance per class, Sentinel-2 L2A bands"
      legend={series.map((s) => ({ label: s.label, color: CLASS_META[s.key].color, kind: "line" as const }))}
      table={{ columns: ["Class", ...bands.map((b, i) => `${b} ${wl[i]}nm`)], rows: series.map((s) => [s.label, ...s.values.map((v) => v.toFixed(3))]) }}
      footnote="Water: reflectance collapses in SWIR (B11/B12). The lake's elevated green/NIR suggests high algal content."
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            onPointerMove={(e) => {
              const px = e.nativeEvent.offsetX;
              const i = Math.round(((px - m.l) / iw) * (bands.length - 1));
              setHi(Math.max(0, Math.min(bands.length - 1, i)));
            }}
          >
            {niceTicks(ymax, 4).map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" {...axisText}>
                  {t.toFixed(1)}
                </text>
              </g>
            ))}
            {bands.map((b, i) => (
              <text key={b} x={x(i)} y={H - 16} textAnchor="middle" {...axisText}>
                <tspan x={x(i)}>{b}</tspan>
                <tspan x={x(i)} dy={13} fontSize={10}>
                  {wl[i]} nm
                </tspan>
              </text>
            ))}
            {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={m.t} y2={m.t + ih} stroke={CHART.ink3} strokeOpacity={0.6} />}
            {series.map((s) => (
              <g key={s.key}>
                <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={CLASS_META[s.key].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={CLASS_META[s.key].color} stroke={CHART.surface} strokeWidth={2} />
                ))}
              </g>
            ))}
          </svg>
        )}
        {hi !== null && (
          <Tooltip
            x={x(hi)}
            y={20}
            containerW={w}
            title={`${bands[hi]} · ${wl[hi]} nm`}
            rows={series.map((s) => ({ label: s.label, value: s.values[hi].toFixed(3), color: CLASS_META[s.key].color }))}
          />
        )}
      </div>
    </ChartCard>
  );
}

// ─── 3. Optical vs SAR vs fused area (emphasis on fused) ──────────────────

export function ClassCompare() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ row: number; x: number; y: number } | null>(null);
  const C = MUM.classes;
  const rows = CLASS_ORDER.map((k) => ({
    key: k,
    optical: C.optical[k].ha,
    sar: k === "water" ? C.sar.water.ha : k === "builtup" ? C.sar.builtup.ha : null,
    fused: C.fused[k].ha,
  }));
  const max = Math.max(...rows.flatMap((r) => [r.optical, r.sar ?? 0, r.fused]));
  const ticks = niceTicks(max, 4);
  const m = { l: 88, r: 56, t: 6, b: 24 };
  const bar = 8;
  const rowH = bar * 3 + GAP * 2 + 16;
  const H = m.t + rows.length * rowH + m.b;
  const iw = Math.max(10, w - m.l - m.r);
  const x = (v: number) => m.l + (v / ticks[ticks.length - 1]) * iw;
  const OPT = "#8d98ab";
  const SAR = "#4b5870";
  return (
    <ChartCard
      title="Area by class — optical vs SAR vs fused"
      subtitle="Hectares; SAR alone only separates water-like and double-bounce surfaces"
      legend={[
        { label: "Optical only", color: OPT },
        { label: "SAR only", color: SAR },
        { label: "Fused (class colour)", color: CLASS_META.builtup.color },
      ]}
      table={{ columns: ["Class", "Optical (ha)", "SAR (ha)", "Fused (ha)"], rows: rows.map((r) => [CLASS_META[r.key].label, nf1.format(r.optical), r.sar === null ? "—" : nf1.format(r.sar), nf1.format(r.fused)]) }}
      footnote={`SAR-only water is inflated by ${nf0.format(MUM.corrections.sar_false_water_ha)} ha of runways, beaches and intertidal flats; fusion removes them.`}
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={H}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} stroke={CHART.grid} />
                <text x={x(t)} y={H - 6} textAnchor="middle" {...axisText}>
                  {nf0.format(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const y0 = m.t + i * rowH + 4;
              const vals: [string, number | null, string][] = [
                ["Optical", r.optical, OPT],
                ["SAR", r.sar, SAR],
                ["Fused", r.fused, CLASS_META[r.key].color],
              ];
              return (
                <g key={r.key} onPointerMove={(e) => setHover({ row: i, x: e.nativeEvent.offsetX, y: y0 })} opacity={hover && hover.row !== i ? 0.5 : 1}>
                  <rect x={0} y={y0 - 4} width={w} height={rowH - 4} fill="transparent" />
                  <text x={m.l - 10} y={y0 + bar * 1.5 + 6} textAnchor="end" fill={CHART.ink2} fontSize={12}>
                    {CLASS_META[r.key].label.split(" /")[0]}
                  </text>
                  {vals.map(([name, v, color], j) => {
                    const yy = y0 + j * (bar + GAP);
                    if (v === null)
                      return (
                        <text key={name} x={m.l + 4} y={yy + bar - 1} fontSize={10} fill={CHART.ink3}>
                          n/a
                        </text>
                      );
                    return (
                      <g key={name}>
                        <path d={hBarPath(m.l, yy, Math.max(1, x(v) - m.l), bar)} fill={color} />
                        {j === 2 && (
                          <text x={x(v) + 6} y={yy + bar - 0.5} fontSize={11} fontWeight={600} fill={CHART.ink}>
                            {nf0.format(v)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke={CHART.axis} />
          </svg>
        )}
        {hover && (
          <Tooltip
            x={hover.x}
            y={hover.y}
            containerW={w}
            title={CLASS_META[rows[hover.row].key].label}
            rows={[
              { label: "Fused", value: `${nf1.format(rows[hover.row].fused)} ha`, color: CLASS_META[rows[hover.row].key].color, kind: "rect" as const },
              { label: "Optical only", value: `${nf1.format(rows[hover.row].optical)} ha`, color: OPT, kind: "rect" as const },
              { label: "SAR only", value: rows[hover.row].sar === null ? "n/a" : `${nf1.format(rows[hover.row].sar!)} ha`, color: SAR, kind: "rect" as const },
            ]}
          />
        )}
      </div>
    </ChartCard>
  );
}

// ─── 4. VV backscatter histogram, stacked by fused class ─────────────────

export function BackscatterHistogram() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const edges = MUM.histogram.edges_db;
  const by = MUM.histogram.by_class as Record<ClassKey, number[]>;
  const nb = edges.length - 1;
  const totals = Array.from({ length: nb }, (_, i) => CLASS_ORDER.reduce((s, k) => s + by[k][i], 0));
  const max = Math.max(...totals);
  const ticks = niceTicks(max / 1000, 4).map((t) => t * 1000);
  const H = 220;
  const m = { l: 40, r: 10, t: 16, b: 26 };
  const iw = Math.max(10, w - m.l - m.r);
  const ih = H - m.t - m.b;
  const x = (db: number) => m.l + ((db - edges[0]) / (edges[nb] - edges[0])) * iw;
  const y = (v: number) => m.t + ih - (v / ticks[ticks.length - 1]) * ih;
  const bw = iw / nb;
  const thr = MUM.sar_water_threshold_db;
  return (
    <ChartCard
      title="SAR backscatter (VV) by fused class"
      subtitle="Pixel count per 0.5 dB bin · dashed line = Otsu water threshold"
      legend={CLASS_ORDER.map((k) => ({ label: CLASS_META[k].label, color: CLASS_META[k].color }))}
      table={{
        columns: ["Class", "Mean VV (dB)", "Mean VH (dB)", "Agreement (%)"],
        rows: CLASS_ORDER.filter((k) => k in MUM.per_class).map((k) => {
          const pc = (MUM.per_class as Record<string, { vv_db: number; vh_db: number; agreement_pct: number }>)[k];
          return [CLASS_META[k].label, pc.vv_db.toFixed(1), pc.vh_db.toFixed(1), pc.agreement_pct.toFixed(1)];
        }),
      }}
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            onPointerMove={(e) => {
              const i = Math.floor((e.nativeEvent.offsetX - m.l) / bw);
              setHi(i >= 0 && i < nb ? i : null);
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" {...axisText}>
                  {t >= 1000 ? `${t / 1000}k` : t}
                </text>
              </g>
            ))}
            {Array.from({ length: nb }, (_, i) => {
              let acc = 0;
              return (
                <g key={i} opacity={hi !== null && hi !== i ? 0.55 : 1}>
                  {CLASS_ORDER.map((k) => {
                    const v = by[k][i];
                    if (!v) return null;
                    const y1 = y(acc + v);
                    const h = y(acc) - y1;
                    acc += v;
                    return <rect key={k} x={m.l + i * bw + 0.5} y={y1} width={Math.max(0.5, bw - 1)} height={Math.max(0, h - 0.5)} fill={CLASS_META[k].color} />;
                  })}
                </g>
              );
            })}
            <line x1={x(thr)} x2={x(thr)} y1={m.t - 6} y2={m.t + ih} stroke={CHART.ink} strokeDasharray="4 3" strokeWidth={1.2} />
            <text x={x(thr) + 5} y={m.t + 4} fontSize={11} fill={CHART.ink} fontWeight={600}>
              Otsu {thr} dB
            </text>
            {[-30, -20, -10, 0, 10].map((t) => (
              <text key={t} x={x(t)} y={H - 8} textAnchor="middle" {...axisText}>
                {t > 0 ? `+${t}` : t} dB
              </text>
            ))}
            <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke={CHART.axis} />
          </svg>
        )}
        {hi !== null && (
          <Tooltip
            x={m.l + hi * bw}
            y={30}
            containerW={w}
            title={`${edges[hi]} to ${edges[hi + 1]} dB`}
            rows={CLASS_ORDER.map((k) => ({ label: CLASS_META[k].label, value: nf0.format(by[k][hi]), color: CLASS_META[k].color, kind: "rect" as const }))}
          />
        )}
      </div>
    </ChartCard>
  );
}

// ─── 5. Scatter VV vs MNDWI ───────────────────────────────────────────────

export function FusionScatter() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const pts = MUM.scatter as [number, number, number, number, boolean][];
  const H = 260;
  const m = { l: 42, r: 12, t: 12, b: 30 };
  const iw = Math.max(10, w - m.l - m.r);
  const ih = H - m.t - m.b;
  const X0 = -30,
    X1 = 15,
    Y0 = -0.8,
    Y1 = 0.9;
  const x = (v: number) => m.l + ((Math.max(X0, Math.min(X1, v)) - X0) / (X1 - X0)) * iw;
  const y = (v: number) => m.t + ih - ((Math.max(Y0, Math.min(Y1, v)) - Y0) / (Y1 - Y0)) * ih;
  const thr = MUM.sar_water_threshold_db;
  const classKey = (id: number) => CLASS_ORDER[id - 1];
  const flagged = pts.filter((p) => p[4]).length;
  return (
    <ChartCard
      title="Where the sensors agree — SAR VV vs optical MNDWI"
      subtitle={`${pts.length.toLocaleString("en-IN")} random pixels coloured by fused class · orange ring = SAR-dark but optically dry`}
      legend={[...CLASS_ORDER.map((k) => ({ label: CLASS_META[k].label, color: CLASS_META[k].color, kind: "dot" as const })), { label: "Corrected by optical", color: EMPHASIS.orange, kind: "ring" as const }]}
      table={{
        columns: ["Quadrant", "Pixels"],
        rows: [
          ["Water — both sensors agree (VV low, MNDWI > 0)", pts.filter((p) => p[0] < thr && p[1] > 0).length],
          ["SAR-dark but optically dry (runways, sand)", pts.filter((p) => p[0] < thr && p[1] <= 0).length],
          ["Bright SAR, dry optical (built-up, vegetation)", pts.filter((p) => p[0] >= thr && p[1] <= 0).length],
          ["Flagged as corrected by optical", flagged],
        ],
      }}
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            onPointerMove={(e) => {
              const mx = e.nativeEvent.offsetX;
              const my = e.nativeEvent.offsetY;
              let best = -1;
              let bd = 24 * 24;
              pts.forEach((p, i) => {
                const d = (x(p[0]) - mx) ** 2 + (y(p[1]) - my) ** 2;
                if (d < bd) {
                  bd = d;
                  best = i;
                }
              });
              setHi(best >= 0 ? best : null);
            }}
          >
            <rect x={m.l} y={m.t} width={x(thr) - m.l} height={y(0) - m.t} fill={CLASS_META.water.color} opacity={0.06} />
            <rect x={m.l} y={y(0)} width={x(thr) - m.l} height={m.t + ih - y(0)} fill={EMPHASIS.orange} opacity={0.07} />
            {[-30, -20, -10, 0, 10].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={m.t} y2={m.t + ih} stroke={CHART.grid} />
                <text x={x(t)} y={H - 10} textAnchor="middle" {...axisText}>
                  {t > 0 ? `+${t}` : t}
                </text>
              </g>
            ))}
            {[-0.5, 0, 0.5].map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" {...axisText}>
                  {t.toFixed(1)}
                </text>
              </g>
            ))}
            <line x1={x(thr)} x2={x(thr)} y1={m.t} y2={m.t + ih} stroke={CHART.ink2} strokeDasharray="4 3" />
            <line x1={m.l} x2={m.l + iw} y1={y(0)} y2={y(0)} stroke={CHART.ink2} strokeDasharray="4 3" />
            <text x={m.l + 6} y={m.t + 14} fontSize={11} fill={CHART.ink2}>
              water: both agree
            </text>
            <text x={m.l + 6} y={m.t + ih - 8} fontSize={11} fill={CHART.ink2}>
              radar-dark, optically dry
            </text>
            {pts.map((p, i) => (
              <circle key={i} cx={x(p[0])} cy={y(p[1])} r={p[4] ? 3.2 : 2.3} fill={CLASS_META[classKey(p[3])].color} fillOpacity={0.85} stroke={p[4] ? EMPHASIS.orange : "none"} strokeWidth={p[4] ? 1.6 : 0} />
            ))}
            {hi !== null && <circle cx={x(pts[hi][0])} cy={y(pts[hi][1])} r={6} fill="none" stroke={CHART.ink} strokeWidth={2} />}
            <text x={m.l + iw} y={H - 10} textAnchor="end" {...axisText}>
              VV (dB)
            </text>
            <text x={12} y={m.t + ih / 2} transform={`rotate(-90 12 ${m.t + ih / 2})`} textAnchor="middle" {...axisText}>
              MNDWI
            </text>
          </svg>
        )}
        {hi !== null && (
          <Tooltip
            x={x(pts[hi][0])}
            y={y(pts[hi][1])}
            containerW={w}
            title={CLASS_META[classKey(pts[hi][3])].label + (pts[hi][4] ? " · corrected" : "")}
            rows={[
              { label: "VV", value: `${pts[hi][0].toFixed(1)} dB` },
              { label: "MNDWI", value: pts[hi][1].toFixed(2) },
              { label: "NDVI", value: pts[hi][2].toFixed(2) },
            ]}
          />
        )}
      </div>
    </ChartCard>
  );
}

// ─── 6. Before → after per class (dumbbell) ───────────────────────────────

export function ClassDumbbell() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const t1 = NMIA.classes.t1;
  const t2 = NMIA.classes.t2;
  const rows = CLASS_ORDER.map((k) => ({ key: k, a: t1[k].ha, b: t2[k].ha }));
  const ticks = niceTicks(Math.max(...rows.flatMap((r) => [r.a, r.b])), 4);
  const m = { l: 96, r: 110, t: 8, b: 26 };
  const rowH = 38;
  const H = m.t + rows.length * rowH + m.b;
  const iw = Math.max(10, w - m.l - m.r);
  const x = (v: number) => m.l + (v / ticks[ticks.length - 1]) * iw;
  return (
    <ChartCard
      title="Land cover 2017 → 2026"
      subtitle="Hectares per class across the 57.3 km² scene"
      legend={[
        { label: "Jan 2017", color: CHART.ink2, kind: "ring" },
        { label: "Jan 2026 (filled, class colour)", color: CHART.ink, kind: "dot" },
      ]}
      table={{ columns: ["Class", "2017 (ha)", "2026 (ha)", "Change (ha)"], rows: rows.map((r) => [CLASS_META[r.key].label, nf1.format(r.a), nf1.format(r.b), `${r.b - r.a > 0 ? "+" : ""}${nf1.format(r.b - r.a)}`]) }}
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg width={w} height={H}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} stroke={CHART.grid} />
                <text x={x(t)} y={H - 7} textAnchor="middle" {...axisText}>
                  {nf0.format(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const cy = m.t + i * rowH + rowH / 2;
              const d = r.b - r.a;
              return (
                <g key={r.key} onPointerEnter={() => setHi(i)} opacity={hi !== null && hi !== i ? 0.5 : 1}>
                  <rect x={0} y={cy - rowH / 2} width={w} height={rowH} fill="transparent" />
                  <text x={m.l - 12} y={cy + 4} textAnchor="end" fontSize={12} fill={CHART.ink2}>
                    {CLASS_META[r.key].label.split(" /")[0]}
                  </text>
                  <line x1={x(r.a)} x2={x(r.b)} y1={cy} y2={cy} stroke={CHART.deemph} strokeWidth={3} strokeLinecap="round" />
                  <circle cx={x(r.a)} cy={cy} r={5} fill={CHART.surface} stroke={CHART.ink2} strokeWidth={2} />
                  <circle cx={x(r.b)} cy={cy} r={6} fill={CLASS_META[r.key].color} stroke={CHART.surface} strokeWidth={2} />
                  <text x={m.l + iw + 12} y={cy + 4} fontSize={12} fill={CHART.ink} fontWeight={600} className="tnum">
                    {d > 0 ? "+" : "−"}
                    {nf0.format(Math.abs(d))} ha
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {hi !== null && (
          <Tooltip
            x={x(rows[hi].b)}
            y={m.t + hi * rowH}
            containerW={w}
            title={CLASS_META[rows[hi].key].label}
            rows={[
              { label: "Jan 2026", value: `${nf1.format(rows[hi].b)} ha`, color: CLASS_META[rows[hi].key].color },
              { label: "Jan 2017", value: `${nf1.format(rows[hi].a)} ha`, color: CHART.ink2 },
            ]}
          />
        )}
      </div>
    </ChartCard>
  );
}

// ─── 7. Transition matrix (sequential heatmap) ────────────────────────────

export function TransitionMatrix() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<[number, number] | null>(null);
  const M = NMIA.transitions.matrix_ha;
  const names = NMIA.transitions.classes as ClassKey[];
  const max = Math.max(...M.flat());
  const rowTotals = M.map((r) => r.reduce((a, b) => a + b, 0));
  const lab = 104;
  const top = 26;
  const cw = Math.max(40, (w - lab) / 4);
  const ch = 40;
  const H = top + ch * 4 + 4;
  const color = (v: number) => SEQ_BLUE_DARK[Math.min(SEQ_BLUE_DARK.length - 1, Math.round(Math.sqrt(v / max) * (SEQ_BLUE_DARK.length - 1)))];
  return (
    <ChartCard
      title="From → to transitions (ha)"
      subtitle="Rows: class in Jan 2017 · columns: class in Jan 2026 · diagonal = unchanged"
      table={{ columns: ["2017 \\ 2026", ...names.map((n) => CLASS_META[n].label)], rows: M.map((r, i) => [CLASS_META[names[i]].label, ...r.map((v) => nf1.format(v))]) }}
      footnote="Colour = area (square-root scale, darker = less). Largest conversion: open land → built-up."
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg width={w} height={H}>
            {names.map((n, j) => (
              <g key={n}>
                <rect x={lab + j * cw + cw / 2 - 30} y={6} width={8} height={8} rx={2} fill={CLASS_META[n].color} />
                <text x={lab + j * cw + cw / 2 - 18} y={14} fontSize={11} fill={CHART.ink2}>
                  {CLASS_META[n].label.split(" /")[0]}
                </text>
              </g>
            ))}
            {M.map((row, i) => (
              <g key={i}>
                <rect x={4} y={top + i * ch + ch / 2 - 4} width={8} height={8} rx={2} fill={CLASS_META[names[i]].color} />
                <text x={18} y={top + i * ch + ch / 2 + 4} fontSize={11.5} fill={CHART.ink2}>
                  {CLASS_META[names[i]].label.split(" /")[0]}
                </text>
                {row.map((v, j) => {
                  const fill = color(v);
                  const active = hi && hi[0] === i && hi[1] === j;
                  return (
                    <g key={j} onPointerEnter={() => setHi([i, j])}>
                      <rect x={lab + j * cw + 1} y={top + i * ch + 1} width={cw - 2} height={ch - 2} rx={4} fill={fill} stroke={active ? CHART.ink : i === j ? "rgba(255,255,255,0.35)" : "none"} strokeWidth={active ? 2 : 1} />
                      <text x={lab + j * cw + cw / 2} y={top + i * ch + ch / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill={lum(fill) > 0.35 ? "#0b0b0b" : "#ffffff"} className="tnum" pointerEvents="none">
                        {nf0.format(v)}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        )}
        {hi && (
          <Tooltip
            x={lab + hi[1] * cw + cw / 2}
            y={top + hi[0] * ch + ch}
            containerW={w}
            title={`${CLASS_META[names[hi[0]]].label} → ${CLASS_META[names[hi[1]]].label}`}
            rows={[
              { label: "area", value: `${nf1.format(M[hi[0]][hi[1]])} ha` },
              { label: `of 2017 ${CLASS_META[names[hi[0]]].label.toLowerCase()}`, value: `${((100 * M[hi[0]][hi[1]]) / rowTotals[hi[0]]).toFixed(1)} %` },
            ]}
          />
        )}
      </div>
    </ChartCard>
  );
}

// ─── 8. Change by type (single-series bars) ───────────────────────────────

export function ChangeByType() {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const rows = [...NMIA.change.by_type].sort((a, b) => b.ha - a.ha);
  const ticks = niceTicks(rows[0].ha, 4);
  const m = { l: 196, r: 56, t: 4, b: 22 };
  const bar = 14;
  const rowH = bar + 12;
  const H = m.t + rows.length * rowH + m.b;
  const iw = Math.max(10, w - m.l - m.r);
  const x = (v: number) => m.l + (v / ticks[ticks.length - 1]) * iw;
  return (
    <ChartCard
      title="Changed area by transition type"
      subtitle={`${nf0.format(NMIA.change.changed_ha)} ha changed in total (CVA > ${NMIA.change.cva_threshold})`}
      table={{ columns: ["Transition", "Area (ha)"], rows: rows.map((r) => [r.label, nf1.format(r.ha)]) }}
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg width={w} height={H}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} stroke={CHART.grid} />
                <text x={x(t)} y={H - 5} textAnchor="middle" {...axisText}>
                  {nf0.format(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const y0 = m.t + i * rowH + 6;
              return (
                <g key={r.key} onPointerEnter={() => setHi(i)} opacity={hi !== null && hi !== i ? 0.55 : 1}>
                  <rect x={0} y={y0 - 6} width={w} height={rowH} fill="transparent" />
                  <text x={m.l - 10} y={y0 + bar - 3} textAnchor="end" fontSize={12} fill={CHART.ink2}>
                    {r.label.replace(" / developed", "")}
                  </text>
                  <path d={hBarPath(m.l, y0, Math.max(1, x(r.ha) - m.l), bar)} fill={CLASS_META.water.color} />
                  <text x={x(r.ha) + 6} y={y0 + bar - 3} fontSize={11.5} fontWeight={600} fill={CHART.ink} className="tnum">
                    {nf0.format(r.ha)}
                  </text>
                </g>
              );
            })}
            <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke={CHART.axis} />
          </svg>
        )}
      </div>
    </ChartCard>
  );
}

// ─── 9. Time series inside the airport footprint (stacked area) ──────────

export function FootprintTimeSeries({ year, onYear, compact = false }: { year?: number; onYear?: (y: number) => void; compact?: boolean }) {
  const { ref, w } = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const ts = NMIA.timeseries;
  const series = useMemo(
    () => [
      { key: "developed", label: "Developed / cleared", color: CLASS_META.builtup.color, values: ts.map((t) => t.footprint_developed_pct ?? 0) },
      { key: "water", label: "Water", color: CLASS_META.water.color, values: ts.map((t) => t.footprint_water_pct ?? 0) },
      { key: "vegetation", label: "Vegetation", color: CLASS_META.vegetation.color, values: ts.map((t) => t.footprint_vegetation_pct ?? 0) },
    ],
    [ts],
  );
  const H = compact ? 150 : 220;
  const m = { l: 36, r: 14, t: 10, b: 24 };
  const iw = Math.max(10, w - m.l - m.r);
  const ih = H - m.t - m.b;
  const x = (i: number) => m.l + (i / (ts.length - 1)) * iw;
  const y = (v: number) => m.t + ih - (v / 100) * ih;
  // stack order bottom → top: developed, water, vegetation
  const stacks = series.map((_, si) => ts.map((__, i) => series.slice(0, si + 1).reduce((s, se) => s + se.values[i], 0)));
  const current = year !== undefined ? ts.findIndex((t) => t.year === year) : -1;
  const shown = hi ?? (current >= 0 ? current : null);
  return (
    <ChartCard
      title="Inside the airport footprint, year by year"
      subtitle={`Share of the ${nf0.format(NMIA.footprint!.area_ha)} ha platform · one Jan–Feb Sentinel-2 scene per year`}
      legend={[...series].reverse().map((s) => ({ label: s.label, color: s.color }))}
      table={{ columns: ["Year", "Scene date", "Vegetation %", "Water %", "Developed %", "Impervious %"], rows: ts.map((t) => [t.year, t.date, (t.footprint_vegetation_pct ?? 0).toFixed(1), (t.footprint_water_pct ?? 0).toFixed(1), (t.footprint_developed_pct ?? 0).toFixed(1), (t.footprint_builtup_pct ?? 0).toFixed(1)]) }}
      footnote={compact ? undefined : "Site clearing and creek filling happened between early 2018 and early 2019; the platform has stayed > 93 % developed since."}
    >
      <div ref={ref} className="relative" style={{ height: H }} onPointerLeave={() => setHi(null)}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            onPointerMove={(e) => {
              const i = Math.round(((e.nativeEvent.offsetX - m.l) / iw) * (ts.length - 1));
              setHi(Math.max(0, Math.min(ts.length - 1, i)));
            }}
            onClick={() => hi !== null && onYear?.(ts[hi].year)}
            style={{ cursor: onYear ? "pointer" : "default" }}
          >
            {[0, 25, 50, 75, 100].map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                <text x={m.l - 7} y={y(t) + 4} textAnchor="end" {...axisText}>
                  {t}%
                </text>
              </g>
            ))}
            {series.map((s, si) => {
              const upper = stacks[si];
              const lower = si ? stacks[si - 1] : ts.map(() => 0);
              const d =
                upper.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("") +
                lower
                  .map((v, i) => [i, v] as const)
                  .reverse()
                  .map(([i, v]) => `L${x(i)},${y(v)}`)
                  .join("") +
                "Z";
              return <path key={s.key} d={d} fill={s.color} fillOpacity={0.85} stroke={CHART.surface} strokeWidth={GAP} />;
            })}
            {ts.map((t, i) => (
              <text key={t.year} x={x(i)} y={H - 7} textAnchor="middle" {...axisText} fontWeight={i === current ? 700 : 400} fill={i === current ? CHART.ink : CHART.ink3}>
                {compact ? `’${String(t.year).slice(2)}` : t.year}
              </text>
            ))}
            {shown !== null && <line x1={x(shown)} x2={x(shown)} y1={m.t} y2={m.t + ih} stroke={CHART.ink} strokeWidth={1.5} />}
          </svg>
        )}
        {hi !== null && (
          <Tooltip
            x={x(hi)}
            y={m.t}
            containerW={w}
            title={`${ts[hi].year} · ${ts[hi].date}`}
            rows={[...series].reverse().map((s) => ({ label: s.label, value: `${s.values[hi].toFixed(1)} %`, color: s.color, kind: "rect" as const }))}
          />
        )}
      </div>
    </ChartCard>
  );
}

export const CHART_REGISTRY: Record<string, { title: string; render: () => React.ReactNode; wide?: boolean }> = {
  "hyd-composition": { title: "Land-cover composition", render: () => <HydComposition />, wide: true },
  "hyd-spectral": { title: "Spectral signatures", render: () => <SpectralProfile /> },
  "mum-class-compare": { title: "Optical vs SAR vs fused", render: () => <ClassCompare /> },
  "mum-hist": { title: "Backscatter histogram", render: () => <BackscatterHistogram /> },
  "mum-scatter": { title: "Sensor agreement scatter", render: () => <FusionScatter /> },
  "nmia-dumbbell": { title: "Land cover 2017 → 2026", render: () => <ClassDumbbell /> },
  "nmia-transitions": { title: "Transition matrix", render: () => <TransitionMatrix /> },
  "nmia-bytype": { title: "Change by type", render: () => <ChangeByType /> },
  "nmia-timeseries": { title: "Footprint time series", render: () => <FootprintTimeSeries />, wide: true },
};
