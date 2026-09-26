import type { Mode, TaskType } from "@/lib/types";

export const TASK_LABEL: Record<TaskType, string> = {
  captioning: "Captioning / scene description",
  vqa: "Visual question answering",
  grounding: "Text-guided region grounding",
  change_description: "Change description",
  change_vqa: "Change-based VQA",
  timeseries: "Temporal trend analysis",
  fusion_extraction: "Optical–SAR joint extraction",
  fusion_vqa: "Cross-modal VQA",
  rejected: "Rejected by input validation",
};

interface Rule {
  task: TaskType;
  modes: Mode[];
  patterns: RegExp[];
  weight: number;
}

const RULES: Rule[] = [
  {
    task: "captioning",
    modes: ["single"],
    patterns: [/\bdescribe\b/, /\bcaption/, /\bsummar/, /\boverview\b/, /what (is|can you see) in (this|the) (image|scene)/, /land[- ]?cover and (major )?objects/, /\bexplain (this|the) (image|scene)\b/],
    weight: 1,
  },
  {
    task: "grounding",
    modes: ["single", "cross_modal", "bitemporal"],
    patterns: [/\bhighlight/, /\blocate\b/, /\bwhere (is|are)\b/, /\bshow (me )?(the|all)\b/, /\bmark\b/, /\boutline\b/, /\bsegment\b/, /\bpoint out\b/, /\bfind\b/, /\bdelineate\b/],
    weight: 1.1,
  },
  {
    task: "timeseries",
    modes: ["bitemporal"],
    patterns: [/\btrend\b/, /year[- ]by[- ]year/, /\btimeline\b/, /\bwhen did\b/, /\bprogress/, /\bover the years\b/, /\btime[- ]?series\b/],
    weight: 1.3,
  },
  {
    task: "change_vqa",
    modes: ["bitemporal"],
    patterns: [/\bincrease/, /\bdecrease/, /\bunchanged\b/, /how much/, /\blost\b/, /\bloss\b/, /\bgain/, /\bfilled\b/, /\bdiverted\b/, /\bgrow/, /\bexpan/, /\bshr[iu]n?k/],
    weight: 1.2,
  },
  {
    task: "change_description",
    modes: ["bitemporal"],
    patterns: [/\bchang/, /\bdifferen/, /\bcompare\b/, /\bbefore\b/, /\bafter\b/, /what happened/, /\bwhere did\b/],
    weight: 1,
  },
  {
    task: "fusion_extraction",
    modes: ["cross_modal"],
    patterns: [/\btogether\b/, /\bboth\b/, /\bcombin/, /\bfus/, /\bjoint/, /identify (the )?built[- ]?up/, /built[- ]?up and water/, /optical and sar/],
    weight: 1.2,
  },
  {
    task: "fusion_vqa",
    modes: ["cross_modal"],
    patterns: [/\bdisagree/, /\bwhy\b/, /\bvessel/, /\bships?\b/, /\bboats?\b/, /\bmangrove/, /\brunway/, /\bcloud/, /\bnight\b/],
    weight: 1.1,
  },
];

export interface Intent {
  task: TaskType;
  confidence: number;
  target: string | null;
}

const TARGETS: [RegExp, string][] = [
  [/water ?bod|lake|reservoir|\btank\b|river|\bsea\b|\bbay\b|creek/, "water body"],
  [/airport|runway|airstrip/, "airport / runway"],
  [/vessel|ship|boat/, "vessels"],
  [/green|park|vegetation|tree|forest|mangrove/, "vegetation"],
  [/built|urban|building|settlement/, "built-up area"],
  [/rail|station|yard/, "railway yard"],
  [/ground|stadium|parade/, "open ground"],
];

export function classifyIntent(query: string, mode: Mode): Intent {
  const q = query.toLowerCase();
  const target = TARGETS.find(([re]) => re.test(q))?.[1] ?? null;
  let best: { task: TaskType; score: number } | null = null;
  let second = 0;
  for (const rule of RULES) {
    if (!rule.modes.includes(mode)) continue;
    const hits = rule.patterns.filter((p) => p.test(q)).length;
    if (!hits) continue;
    const score = hits * rule.weight;
    if (!best || score > best.score) {
      second = best?.score ?? 0;
      best = { task: rule.task, score };
    } else if (score > second) second = score;
  }
  const fallback: TaskType = mode === "bitemporal" ? "change_description" : mode === "cross_modal" ? "fusion_vqa" : "vqa";
  if (!best) return { task: fallback, confidence: 0.74, target };
  const margin = best.score - second;
  const confidence = Math.min(0.99, 0.82 + 0.06 * best.score + 0.05 * margin);
  return { task: best.task, confidence: Number(confidence.toFixed(2)), target };
}
