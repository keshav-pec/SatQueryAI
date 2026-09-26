"use client";

import { useEffect, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";
import { HYD, MUM, NMIA } from "@/lib/demo/data";
import { ACCENT, HIGHLIGHT } from "@/lib/palette";

const ring = (pts: number[][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("") + "Z";

const SCENES = [
  {
    key: "ground",
    tag: "Text-guided grounding",
    place: "Hyderabad · Sentinel-2 · 07 Jan 2025",
    query: "Highlight the water body referred to in the query.",
    tools: [
      ["geo-validator", "EPSG:32644 · 6 bands · 0 % no-data"],
      ["agent-controller", "task = grounding (0.97)"],
      ["rs-grounder", "box_threshold 0.35 · top_k 3"],
      ["spectral-indices", "MNDWI > 0 · sieve 12 px"],
      ["satquery-vlm", "compose grounded answer"],
    ],
    answer: `Hussain Sagar Lake · ${HYD.water_bodies.list[0].area_km2.toFixed(2)} km² · MNDWI 0.72`,
    conf: 95,
  },
  {
    key: "change",
    tag: "Bi-temporal change",
    place: "Navi Mumbai · 03 Jan 2017 → 16 Jan 2026",
    query: "What changed between these two dates, and where?",
    tools: [
      ["geo-validator", "co-registered · 9.0 years apart"],
      ["agent-controller", "task = change_description"],
      ["spectral-indices", "land cover 2017 + 2026"],
      ["change-detector", "CVA > 0.12 · min 25 px"],
      ["cd-vqa", "describe change"],
    ],
    answer: `${Math.round(NMIA.change.changed_ha).toLocaleString("en-IN")} ha changed · airport platform ${Math.round(NMIA.footprint!.area_ha).toLocaleString("en-IN")} ha · built-up ×3.0`,
    conf: 92,
  },
  {
    key: "fusion",
    tag: "Optical + SAR fusion",
    place: "Mumbai · S2 06 Jan + S1 07 Jan 2025",
    query: "Use optical and SAR together to find built-up and water.",
    tools: [
      ["geo-validator", "IoU 1.000 · gap 19 h 22 min"],
      ["agent-controller", "task = fusion_extraction"],
      ["sar-segmenter", `Otsu ${MUM.sar_water_threshold_db} dB`],
      ["optsar-fusion", "rs-fusion-v1"],
      ["satquery-vlm", "explain complementarity"],
    ],
    answer: `Built-up ${MUM.classes.fused.builtup.pct.toFixed(1)} % · water ${MUM.classes.fused.water.pct.toFixed(1)} % · ${Math.round(MUM.corrections.sar_false_water_ha)} ha radar-dark runways & sand corrected`,
    conf: 93,
  },
] as const;

const T_TYPE = 1500;
const T_RUN = 2300;
const T_TOTAL = 9200;

export function HeroDemo() {
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let offset = 0;
    const tick = (now: number) => {
      const el = now - start - offset;
      const cycles = Math.floor(el / T_TOTAL);
      if (cycles > 0) {
        offset += cycles * T_TOTAL;
        setIdx((i) => (i + cycles) % SCENES.length);
      }
      setT(Math.max(0, el - cycles * T_TOTAL));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = SCENES[idx];
  const typed = s.query.slice(0, Math.floor((s.query.length * Math.min(1, t / T_TYPE)) | 0));
  const runT = t - T_TYPE;
  const toolIdx = runT < 0 ? -1 : Math.min(s.tools.length, Math.floor(runT / (T_RUN / s.tools.length)));
  const ansT = Math.max(0, t - T_TYPE - T_RUN);
  const answering = ansT > 0;
  const k = Math.min(1, ansT / 1200);

  return (
    <div className="panel relative overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </span>
        <span className="ml-2 text-[12px] font-medium text-ink-2">SatQuery console</span>
        <span className="ml-auto badge badge-cyan">{s.tag}</span>
      </div>

      <div className="flex items-center gap-2 border-b border-line bg-bg-2 px-4 py-3">
        <Search size={14} className="shrink-0 text-ink-3" />
        <span className={`truncate text-[13.5px] text-ink ${t < T_TYPE ? "caret" : ""}`}>{typed}</span>
      </div>

      <div className="relative aspect-[16/11] bg-[#04070d]">
        <Stage k={s.key} t={t} ansT={ansT} />
        {!answering && runT > 0 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1/3 animate-scan" style={{ background: "linear-gradient(180deg, transparent, rgba(59,213,255,0.18) 70%, rgba(59,213,255,0.6))", borderBottom: "1px solid rgba(139,232,255,.9)" }} />
          </div>
        )}
        <span className="glass absolute left-3 top-3 rounded-md px-2 py-1 mono text-[10.5px] text-ink-2">{s.place}</span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            {s.tools.map(([name], i) => (
              <span
                key={name}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 mono text-[10.5px] transition-colors duration-300 ${
                  i < toolIdx ? "border-cyan/30 bg-cyan/[0.07] text-cyan-2" : i === toolIdx ? "border-saffron/50 bg-saffron/10 text-saffron-2" : "border-line text-ink-3"
                }`}
              >
                {i < toolIdx && <Check size={10} />}
                {name}
              </span>
            ))}
          </div>
          <p className="mt-2 h-4 truncate mono text-[11px] text-ink-3">{toolIdx >= 0 && toolIdx < s.tools.length ? `→ ${s.tools[toolIdx][0]} · ${s.tools[toolIdx][1]}` : answering ? "→ report-builder · PDF + GeoJSON + trace ready" : ""}</p>
          <p className="mt-1.5 flex items-start gap-1.5 text-[13.5px] font-medium text-ink" style={{ opacity: k, transform: `translateY(${(1 - k) * 6}px)` }}>
            <Sparkles size={14} className="mt-0.5 shrink-0 text-cyan" />
            <span>{s.answer}</span>
          </p>
        </div>
        <div className="flex flex-col items-center justify-center" style={{ opacity: k }}>
          <span className="display text-[26px] font-semibold leading-none text-ink">{Math.round(s.conf * k)}</span>
          <span className="mt-1 text-[10.5px] text-ink-3">confidence</span>
        </div>
      </div>
    </div>
  );
}

function Stage({ k, t, ansT }: { k: string; t: number; ansT: number }) {
  if (k === "ground") {
    const g = HYD.grid;
    const lake = HYD.water_bodies.list[0];
    const p = Math.min(1, ansT / 1400);
    const zoom = 1 + 0.35 * Math.min(1, ansT / 2600);
    return (
      <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g style={{ transformOrigin: `${lake.centroid_px[0]}px ${lake.centroid_px[1]}px`, transform: `scale(${zoom})`, transition: "transform .2s linear" }}>
          <image href={HYD.images.truecolor} width={g.width} height={g.height} />
          {ansT > 0 && (
            <>
              <path d={ring(lake.pixel)} fill={HIGHLIGHT} fillOpacity={0.22 * p} stroke={HIGHLIGHT} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} vectorEffect="non-scaling-stroke" />
              <g opacity={p}>
                <rect x={lake.bbox_px[0]} y={lake.bbox_px[1] - 34} width={236} height={26} rx={5} fill={HIGHLIGHT} />
                <text x={lake.bbox_px[0] + 10} y={lake.bbox_px[1] - 16} fontSize={15} fontWeight={700} fill="#06131a">
                  Hussain Sagar · 96%
                </text>
              </g>
            </>
          )}
        </g>
      </svg>
    );
  }
  if (k === "change") {
    const g = NMIA.grid;
    // sweep the divider right → left → centre
    const p = ansT <= 0 ? 1 : ansT < 1800 ? 1 - ansT / 1800 : ansT < 3000 ? (ansT - 1800) / 2400 : 0.5;
    const x = g.width * p;
    return (
      <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id="hero-clip">
            <rect x={x} y={0} width={g.width - x} height={g.height} />
          </clipPath>
        </defs>
        <image href={NMIA.images.t1_truecolor} width={g.width} height={g.height} />
        <g clipPath="url(#hero-clip)">
          <image href={NMIA.images.t2_truecolor} width={g.width} height={g.height} />
          <image href={NMIA.images.change} width={g.width} height={g.height} opacity={0.6} />
        </g>
        {ansT > 0 && <path d={ring(NMIA.footprint!.pixel)} fill="none" stroke={HIGHLIGHT} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeDasharray="8 5" />}
        <line x1={x} x2={x} y1={0} y2={g.height} stroke="#fff" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        <text x={16} y={g.height - 18} fontSize={20} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.6}>
          2017
        </text>
        <text x={g.width - 70} y={g.height - 18} fontSize={20} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.6}>
          2026
        </text>
      </svg>
    );
  }
  const g = MUM.grid;
  const sarO = t < T_TYPE ? 0 : Math.min(1, (t - T_TYPE) / 900) * (ansT > 0 ? Math.max(0, 1 - ansT / 700) : 1);
  const fusedO = Math.min(0.75, ansT / 1400);
  const rp = Math.min(1, Math.max(0, (ansT - 600) / 1200));
  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <image href={MUM.images.truecolor} width={g.width} height={g.height} />
      <image href={MUM.images.sar_vv} width={g.width} height={g.height} opacity={sarO} />
      <image href={MUM.images.cls_fused} width={g.width} height={g.height} opacity={fusedO} />
      {rp > 0 && <path d={ring(MUM.runways[0].pixel)} fill={ACCENT} fillOpacity={0.25 * rp} stroke={ACCENT} strokeWidth={2.5} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rp} />}
      {rp > 0.6 && (
        <g>
          <rect x={560} y={24} width={270} height={28} rx={5} fill={ACCENT} />
          <text x={572} y={44} fontSize={15} fontWeight={700} fill="#1b0f00">
            Runways ≠ water (optical check)
          </text>
        </g>
      )}
    </svg>
  );
}
