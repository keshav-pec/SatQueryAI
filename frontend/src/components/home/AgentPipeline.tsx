"use client";

import { useEffect, useState } from "react";
import { Boxes, FileCheck2, GitBranch, MessageSquareText, ShieldCheck, Sigma } from "lucide-react";

const STAGES = [
  {
    icon: <ShieldCheck size={18} />,
    name: "Validate",
    tool: "geo-validator",
    text: "Checks format, CRS, bands, grid and acquisition time for every file; for pairs, footprint overlap, co-registration and the time gap. Incompatible inputs are rejected before any model runs.",
    trace: "geo-validator@1.2.0 → 2/2 files valid · GeoTIFF EPSG:32643 · co-registered (IoU 1.000)",
  },
  {
    icon: <MessageSquareText size={18} />,
    name: "Understand",
    tool: "agent-controller",
    text: "Classifies the question into a task — VQA, captioning, grounding, change description, change-VQA, trend or cross-modal extraction — and extracts the target entity.",
    trace: "agent-controller@1.1.0 → task = grounding (0.97) · target = “water body”",
  },
  {
    icon: <GitBranch size={18} />,
    name: "Plan",
    tool: "agent-controller",
    text: "Builds a tool DAG from the registry for this task and input configuration, setting only permitted parameters inside their allowed ranges.",
    trace: "plan → rs-grounder → spectral-indices → satquery-vlm → report-builder",
  },
  {
    icon: <Boxes size={18} />,
    name: "Execute",
    tool: "specialists",
    text: "Runs the specialists: SatQuery-VLM (Qwen2-VL + remote-sensing LoRA), the text-guided grounder, SAR segmenter, optical–SAR fusion, change detector and change-VQA head.",
    trace: "rs-grounder@0.9.0 {box_threshold: 0.35, top_k: 3} → 2 candidate regions",
  },
  {
    icon: <Sigma size={18} />,
    name: "Aggregate",
    tool: "agent-controller",
    text: "Merges tool outputs into evidence — masks, boxes, points, statistics — checks cross-tool agreement and calibrates confidence. Low-confidence answers are hedged and flagged.",
    trace: "confidence 0.95 = f(model 0.94, agreement 0.97, input quality 0.99)",
  },
  {
    icon: <FileCheck2 size={18} />,
    name: "Answer",
    tool: "satquery-vlm · report-builder",
    text: "Writes an answer that cites its evidence, returns overlays for the image and the real map, and exports a PDF report, GeoJSON and the JSON execution trace.",
    trace: "report-builder@1.0.0 → PDF · GeoJSON (2 features) · JSON trace",
  },
];

export function AgentPipeline() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2600);
    return () => clearInterval(id);
  }, [auto]);
  const s = STAGES[active];
  return (
    <div className="panel p-5 md:p-7">
      <div className="relative grid grid-cols-3 gap-y-6 md:grid-cols-6">
        <div className="absolute left-[8%] right-[8%] top-[26px] hidden h-px bg-line-2 md:block" />
        <div
          className="absolute top-[25px] hidden h-[3px] rounded-full md:block"
          style={{ left: "8%", width: `${(active / (STAGES.length - 1)) * 84}%`, background: "linear-gradient(90deg, rgba(255,153,51,.2), #ff9933 60%, #3bd5ff)", transition: "width .8s cubic-bezier(.16,1,.3,1)" }}
        />
        {STAGES.map((st, i) => {
          const on = i === active;
          const done = i < active;
          return (
            <button
              key={st.name}
              type="button"
              onMouseEnter={() => {
                setAuto(false);
                setActive(i);
              }}
              onClick={() => {
                setAuto(false);
                setActive(i);
              }}
              className="group relative flex flex-col items-center text-center"
            >
              <span
                className={`relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border transition-all duration-300 ${
                  on ? "scale-110 border-saffron bg-saffron/15 text-saffron shadow-[0_0_28px_-4px_rgba(255,153,51,.6)]" : done ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-line-2 bg-panel-2 text-ink-3 group-hover:text-ink"
                }`}
              >
                {st.icon}
              </span>
              <span className="mt-2.5 mono text-[10.5px] text-ink-3">0{i + 1}</span>
              <span className={`text-[14px] font-semibold ${on ? "text-ink" : "text-ink-2"}`}>{st.name}</span>
              <span className="mt-0.5 mono text-[10.5px] text-ink-3">{st.tool}</span>
            </button>
          );
        })}
      </div>
      <div key={active} className="animate-fade-up mt-7 grid gap-4 rounded-xl border border-line bg-bg-2 p-4 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[15px] font-semibold text-ink">
            {String(active + 1).padStart(2, "0")} · {s.name}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{s.text}</p>
        </div>
        <div className="flex items-center">
          <p className="w-full rounded-lg border border-line bg-[#070c15] px-3 py-2.5 mono text-[11.5px] leading-relaxed text-cyan-2">{s.trace}</p>
        </div>
      </div>
    </div>
  );
}
