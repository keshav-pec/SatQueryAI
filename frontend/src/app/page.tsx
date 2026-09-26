import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, CheckCircle2, FileDown, GitCompareArrows, Layers3, MessageSquareText, Radar, ScanSearch, ShieldCheck, Waypoints } from "lucide-react";
import { Footer } from "@/components/site/Footer";
import { HeroDemo } from "@/components/home/HeroDemo";
import { AgentPipeline } from "@/components/home/AgentPipeline";
import { CoverageMap } from "@/components/home/CoverageMap";
import { Reveal } from "@/components/home/Reveal";
import { HYD, MUM, NMIA } from "@/lib/demo/data";
import { TOOL_REGISTRY } from "@/lib/engine/registry";
import { TASK_LABEL } from "@/lib/engine/intent";
import { ACCENT, HIGHLIGHT } from "@/lib/palette";

const ring = (pts: number[][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("") + "Z";
const q = (s: string) => encodeURIComponent(s);

function SectionHead({ eyebrow, title, body, center }: { eyebrow: string; title: React.ReactNode; body?: string; center?: boolean }) {
  return (
    <div className={`mb-10 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="eyebrow eyebrow-accent mb-3">{eyebrow}</p>
      <h2 className="display text-[34px] font-semibold text-ink md:text-[42px]">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{body}</p>}
    </div>
  );
}

const CAPABILITIES = [
  {
    icon: <MessageSquareText size={18} />,
    title: "Single-image VQA",
    req: "Mandatory",
    body: "Presence, counting, proportion and attribute questions on one optical or SAR image — answered with the pixels that support them.",
    href: `/analysis?scene=hyd&q=${q("What percentage of the area is covered by vegetation?")}&run=1`,
    visual: "vqa",
  },
  {
    icon: <ScanSearch size={18} />,
    title: "Captioning & text-guided grounding",
    req: "Single-image task #2",
    body: "Scene descriptions that name the major objects, and referring expressions such as “the water body” resolved to a mask and box.",
    href: `/analysis?scene=hyd&q=${q("Highlight the water body referred to in the query.")}&run=1`,
    visual: "ground",
  },
  {
    icon: <GitCompareArrows size={18} />,
    title: "Multi-temporal change",
    req: "Mandatory",
    body: "Change maps, from→to transitions, change-VQA (“has built-up area increased?”) and year-by-year trends from bi-temporal pairs.",
    href: `/analysis?scene=nmia&q=${q("Has the built-up area increased, decreased, or remained unchanged?")}&run=1`,
    visual: "change",
  },
  {
    icon: <Radar size={18} />,
    title: "Optical–SAR joint analysis",
    req: "Mandatory",
    body: "Co-registered optical and SAR fused at evidence level, with a per-pixel inspector showing where each sensor is right — and why.",
    href: `/analysis?scene=mum-fusion&q=${q("Where do the optical and SAR images disagree, and why?")}&run=1`,
    visual: "fusion",
  },
  {
    icon: <Waypoints size={18} />,
    title: "Agentic orchestration",
    req: "Mandatory",
    body: "The controller routes each query, plans a tool DAG from a typed registry and sets only permitted parameters.",
    href: "/api-docs#registry",
    visual: "dag",
  },
  {
    icon: <FileDown size={18} />,
    title: "Evidence, confidence & reports",
    req: "Expected output",
    body: "Overlays on the image and a real map, calibrated confidence, an auditable execution trace, and PDF / GeoJSON / JSON exports.",
    href: `/analysis?scene=mum-sar&q=${q("Are there any ships or boats visible?")}&run=1`,
    visual: "report",
  },
];

function CapabilityVisual({ kind }: { kind: string }) {
  if (kind === "vqa") {
    return (
      <div className="relative h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HYD.images.falsecolor} alt="False-colour Sentinel-2 image of Hyderabad" className="h-full w-full object-cover" />
        <div className="absolute inset-x-3 bottom-3 space-y-1.5">
          <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-saffron/90 px-3 py-1.5 text-[12px] font-medium text-[#1b0f00]">What share is vegetation?</p>
          <p className="w-fit max-w-[85%] rounded-xl rounded-bl-sm border border-line-2 bg-bg/90 px-3 py-1.5 text-[12px] text-ink">
            <b>{HYD.classes.vegetation.pct.toFixed(1)} %</b> · NDVI &gt; 0.33 · 4 green patches
          </p>
        </div>
      </div>
    );
  }
  if (kind === "ground") {
    const g = HYD.grid;
    const lake = HYD.water_bodies.list[0];
    return (
      <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <image href={HYD.images.truecolor} width={g.width} height={g.height} />
        <path d={ring(lake.pixel)} fill={HIGHLIGHT} fillOpacity={0.22} stroke={HIGHLIGHT} strokeWidth={3} />
        <rect x={lake.bbox_px[0]} y={lake.bbox_px[1] - 40} width={250} height={30} rx={6} fill={HIGHLIGHT} />
        <text x={lake.bbox_px[0] + 12} y={lake.bbox_px[1] - 19} fontSize={17} fontWeight={700} fill="#06131a">
          Hussain Sagar · 96%
        </text>
      </svg>
    );
  }
  if (kind === "change") {
    const g = NMIA.grid;
    return (
      <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <clipPath id="cap-change">
            <polygon points={`${g.width * 0.52},0 ${g.width},0 ${g.width},${g.height} ${g.width * 0.36},${g.height}`} />
          </clipPath>
        </defs>
        <image href={NMIA.images.t1_truecolor} width={g.width} height={g.height} />
        <g clipPath="url(#cap-change)">
          <image href={NMIA.images.t2_truecolor} width={g.width} height={g.height} />
          <image href={NMIA.images.change} width={g.width} height={g.height} opacity={0.55} />
        </g>
        <line x1={g.width * 0.52} y1={0} x2={g.width * 0.36} y2={g.height} stroke="#fff" strokeWidth={3} />
        <path d={ring(NMIA.footprint!.pixel)} fill="none" stroke={HIGHLIGHT} strokeWidth={3} strokeDasharray="10 6" />
        <text x={20} y={40} fontSize={26} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.8}>2017</text>
        <text x={g.width - 88} y={40} fontSize={26} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.8}>2026</text>
      </svg>
    );
  }
  if (kind === "fusion") {
    const g = MUM.grid;
    return (
      <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <clipPath id="cap-sar">
            <rect x={g.width / 3} y={0} width={g.width / 3} height={g.height} />
          </clipPath>
          <clipPath id="cap-fused">
            <rect x={(2 * g.width) / 3} y={0} width={g.width / 3} height={g.height} />
          </clipPath>
        </defs>
        <image href={MUM.images.truecolor} width={g.width} height={g.height} />
        <image href={MUM.images.sar_vv} width={g.width} height={g.height} clipPath="url(#cap-sar)" />
        <g clipPath="url(#cap-fused)">
          <image href={MUM.images.truecolor} width={g.width} height={g.height} />
          <image href={MUM.images.cls_fused} width={g.width} height={g.height} opacity={0.75} />
        </g>
        <path d={ring(MUM.runways[0].pixel)} fill={ACCENT} fillOpacity={0.2} stroke={ACCENT} strokeWidth={3} />
        {[g.width / 3, (2 * g.width) / 3].map((x) => (
          <line key={x} x1={x} x2={x} y1={0} y2={g.height} stroke="#060a12" strokeWidth={5} />
        ))}
        {["Optical", "SAR", "Fused"].map((t, i) => (
          <text key={t} x={(i * g.width) / 3 + 16} y={g.height - 20} fontSize={24} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.8}>
            {t}
          </text>
        ))}
      </svg>
    );
  }
  if (kind === "dag") {
    const rows = [
      ["geo-validator", "agent-controller"],
      ["rs-grounder", "sar-segmenter", "change-detector"],
      ["optsar-fusion", "cd-vqa", "satquery-vlm"],
      ["report-builder"],
    ];
    return (
      <div className="flex h-full flex-col justify-center gap-2.5 bg-grid p-5">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center justify-center gap-2">
            {r.map((t) => (
              <span key={t} className={`rounded-md border px-2 py-1 mono text-[11px] ${i === 0 ? "border-saffron/40 bg-saffron/10 text-saffron-2" : "border-cyan/30 bg-cyan/[0.07] text-cyan-2"}`}>
                {t}
              </span>
            ))}
          </div>
        ))}
        <p className="mt-1 text-center mono text-[10.5px] text-ink-3">{TOOL_REGISTRY.length} registered tools · permitted-parameter ranges enforced</p>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center gap-4 bg-grid p-5">
      <svg width="86" height="86" viewBox="0 0 86 86" className="shrink-0 -rotate-90">
        <circle cx="43" cy="43" r="36" fill="none" stroke="#1c2533" strokeWidth="7" />
        <circle cx="43" cy="43" r="36" fill="none" stroke="#3ecf5b" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 36 * 0.93} 999`} />
      </svg>
      <div className="min-w-0 space-y-1.5">
        <p className="display text-[26px] font-semibold leading-none text-ink">0.93</p>
        <p className="text-[11.5px] text-ink-3">model · agreement · input quality</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["report.pdf", "evidence.geojson", "trace.json"].map((f) => (
            <span key={f} className="rounded border border-line-2 px-1.5 py-0.5 mono text-[10.5px] text-ink-2">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const COVERAGE = [
  ["Input upload & compatibility checking", "geo-validator reads every GeoTIFF: format, CRS, bands, grid, acquisition time; pairs are checked for footprint overlap, co-registration and time gap", "Console → inputs", "/analysis?scene=mismatch"],
  ["Remote-sensing adaptation", "SatQuery-VLM = Qwen2-VL-2B-Instruct + LoRA (r 16, α 32) trained on BigEarthNet.txt Sentinel-1/2 image–text pairs", "Adaptation ↓", "#adaptation"],
  ["Single-image VQA", "Presence, counting, proportion and attribute answers grounded in spectral evidence", "Hyderabad scene", `/analysis?scene=hyd&q=${q("How many water bodies are visible?")}&run=1`],
  ["Captioning / text-guided grounding", "Scene captions naming major objects; referring expressions resolved to mask + box on image and map", "“Highlight the water body”", `/analysis?scene=hyd&q=${q("Highlight the water body referred to in the query.")}&run=1`],
  ["Change description / change-VQA", "Post-classification + change-vector analysis, transition matrix, change-VQA and a 10-epoch trend", "Navi Mumbai 2017→2026", `/analysis?scene=nmia&q=${q("What changed between these two dates, and where did the change occur?")}&run=1`],
  ["Optical–SAR paired analysis", "SAR segmentation + evidence-level fusion with disagreement map and per-pixel inspector", "Mumbai optical + SAR", `/analysis?scene=mum-fusion&q=${q("Use the optical and SAR images together to identify built-up and water-covered regions.")}&run=1`],
  ["Agentic orchestration & auditable trace", "Validate → route → plan → execute → aggregate → answer; every step logs tool, version, permitted params, output and time", "Tool registry", "/api-docs#registry"],
  ["Visual evidence, confidence, reports", "Overlays on image and real map, calibrated confidence with its components, PDF / GeoJSON / JSON exports", "Any answer card", "/analysis?scene=hyd"],
  ["Formats", "GeoTIFF / TIFF for geospatial data; PNG / JPEG accepted and flagged for public benchmark samples only", "Validator rules", "/api-docs#errors"],
];

export default function Home() {
  const tasks = Object.keys(TASK_LABEL).filter((t) => t !== "rejected").length;
  return (
    <>
      <main className="overflow-hidden">
        {/* ─── Hero ─── */}
        <section className="relative bg-glow" style={{ paddingTop: "var(--nav-h)" }}>
          <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 pb-16 pt-14 md:px-8 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-20">
            <div>
              <h1 className="display text-[44px] font-semibold text-ink sm:text-[56px] xl:text-[64px]">
                Ask satellite imagery anything. <span className="text-gradient">Get answers you can check.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
                SatQuery AI is an agentic vision-language assistant for remote sensing. It validates your optical, SAR or multi-temporal GeoTIFFs, routes the question to specialist models, and answers with masks on the image and the real map, charts, calibrated confidence and an auditable trace.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/analysis" className="btn btn-primary btn-lg">
                  Launch analysis console <ArrowRight size={17} />
                </Link>
                <Link href="/api-docs" className="btn btn-ghost btn-lg">
                  API reference
                </Link>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["3", "input configurations"],
                  [String(TOOL_REGISTRY.length), "registered tools"],
                  [String(tasks), "routed task types"],
                  ["5", "real Sentinel test scenes"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-line bg-panel/60 px-3 py-3">
                    <p className="display text-[26px] font-semibold leading-none text-ink">{v}</p>
                    <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-saffron/10 via-transparent to-cyan/10 blur-2xl" />
              <HeroDemo />
            </div>
          </div>
        </section>

        {/* ─── Problem → approach ─── */}
        <section className="hairline-top bg-bg-2 py-20">
          <div className="mx-auto max-w-[1320px] px-5 md:px-8">
            <Reveal>
              <SectionHead
                eyebrow="Why an agent"
                title={<>One question box instead of a dozen single-task tools</>}
                body="Operational questions rarely fit one model. Water under monsoon cloud needs SAR; “what changed?” needs two dates; “where is it?” needs grounding. SatQuery hides the GIS workflow and model selection behind plain language — without hiding the evidence."
              />
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2">
              <Reveal>
                <div className="panel h-full p-6">
                  <p className="eyebrow mb-4">Today</p>
                  <ul className="space-y-3 text-[14.5px] text-ink-2">
                    {[
                      "A separate model for classification, detection, VQA and change detection",
                      "Users must know sensor characteristics, band maths and GIS workflows",
                      "Optical fails under cloud and at night; SAR alone confuses tarmac and water",
                      "Black-box answers with no evidence, confidence or audit trail",
                    ].map((t) => (
                      <li key={t} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-crit" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="panel h-full border-cyan/25 p-6">
                  <p className="eyebrow mb-4 !text-cyan-2">With SatQuery AI</p>
                  <ul className="space-y-3 text-[14.5px] text-ink-2">
                    {[
                      "One natural-language interface over single, optical–SAR and bi-temporal inputs",
                      "Inputs validated automatically: format, CRS, co-registration, time gap",
                      "The controller picks, sequences and parameterises remote-sensing specialists",
                      "Every answer ships masks, maps, charts, calibrated confidence and a trace",
                    ].map((t) => (
                      <li key={t} className="flex gap-3">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── Capabilities ─── */}
        <section id="capabilities" className="py-20">
          <div className="mx-auto max-w-[1320px] px-5 md:px-8">
            <Reveal>
              <SectionHead eyebrow="Capabilities" title="Every mandatory task, on real imagery" body="Each card opens the console with a real Sentinel scene loaded and the question already asked." />
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {CAPABILITIES.map((c, i) => (
                <Reveal key={c.title} delay={(i % 3) * 0.06}>
                  <Link href={c.href} className="panel group flex h-full flex-col overflow-hidden transition-colors hover:border-cyan/35">
                    <div className="relative h-[210px] overflow-hidden border-b border-line bg-[#04070d]">
                      <CapabilityVisual kind={c.visual} />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-cyan">{c.icon}</span>
                        <p className="text-[16px] font-semibold text-ink">{c.title}</p>
                      </div>
                      <p className="flex-1 text-[13.5px] leading-relaxed text-ink-2">{c.body}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="badge">{c.req}</span>
                        <span className="flex items-center gap-1 text-[13px] font-medium text-cyan-2 group-hover:underline">
                          Try it <ArrowUpRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Agent pipeline ─── */}
        <section className="hairline-top bg-bg-2 py-20">
          <div className="mx-auto max-w-[1320px] px-5 md:px-8">
            <Reveal>
              <SectionHead eyebrow="How the agent works" title="Validate, route, plan, execute, aggregate, answer" body="The controller is a LangGraph state machine over a typed tool registry. Only the observable trace — task, tools, versions, permitted parameters, outputs and timings — is exposed, exactly what an evaluator needs to audit." />
            </Reveal>
            <Reveal>
              <AgentPipeline />
            </Reveal>
          </div>
        </section>

        {/* ─── Coverage map ─── */}
        <section className="py-20">
          <div className="mx-auto max-w-[1320px] px-5 md:px-8">
            <Reveal>
              <SectionHead eyebrow="Real data, real places" title="Tested on Sentinel-1 and Sentinel-2 scenes over India" body="Three sites, five GeoTIFFs and ten yearly epochs, read from the Copernicus archive. Click a site to fly to its footprint on a real basemap." />
            </Reveal>
            <Reveal>
              <CoverageMap />
            </Reveal>
          </div>
        </section>

        {/* ─── Adaptation & evaluation ─── */}
        <section id="adaptation" className="hairline-top bg-bg-2 py-20">
          <div className="mx-auto max-w-[1320px] px-5 md:px-8">
            <Reveal>
              <SectionHead eyebrow="Remote-sensing adaptation" title="Adapted to satellite data — not a generic VLM" body="The vision-language core is fine-tuned on BigEarthNet.txt's co-registered Sentinel-1 / Sentinel-2 image–text pairs, and every specialist is evaluated on the prescribed public benchmarks." />
            </Reveal>
            <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
              <Reveal>
                <div className="panel h-full p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Layers3 size={17} className="text-saffron" />
                    <p className="text-[16px] font-semibold text-ink">SatQuery-VLM</p>
                  </div>
                  <dl className="space-y-3 text-[13.5px]">
                    {[
                      ["Base model", "Qwen2-VL-2B-Instruct"],
                      ["Adapter", "LoRA · r 16 · α 32 · dropout 0.05"],
                      ["Target modules", "q_proj · k_proj · v_proj · o_proj"],
                      ["Adaptation data", "BigEarthNet.txt — Sentinel-1 SAR + Sentinel-2 MSI + text"],
                      ["Training", "AMP · cosine LR · gradient accumulation (scripts/train_lora.py)"],
                      ["Data prep", "scripts/setup_bigearthnet_data.py → VQA / caption pairs"],
                    ].map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[130px_1fr] gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                        <dt className="text-ink-3">{k}</dt>
                        <dd className="mono text-[12.5px] text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="panel h-full overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-line px-6 py-4">
                    <Boxes size={17} className="text-cyan" />
                    <p className="text-[16px] font-semibold text-ink">Evaluation protocol</p>
                    <span className="ml-auto mono text-[11.5px] text-ink-3">scripts/evaluate.py</span>
                  </div>
                  <div className="overflow-x-auto px-3 pb-2">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Benchmark</th>
                          <th>Tasks</th>
                          <th>Metrics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["VRSBench", "Captioning · grounding · VQA", "BLEU-4, METEOR, CIDEr · Acc@0.5 IoU · accuracy"],
                          ["RSVQA (LR / HR)", "Single-image VQA", "Overall and per-question-type accuracy"],
                          ["CDVQA", "Change-based VQA", "Overall accuracy by question type"],
                          ["ISRO / SAC set", "Cartosat-2S + RISAT pairs, all tasks", "Task scores, normalised then combined"],
                        ].map((r) => (
                          <tr key={r[0]}>
                            <td className="font-medium text-ink">{r[0]}</td>
                            <td>{r[1]}</td>
                            <td>{r[2]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-line px-6 py-3 text-[12px] text-ink-3">Benchmark loaders for VRSBench, RSVQA and CDVQA ship in scripts/benchmark_loaders; scores are reported on the prescribed test splits.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── Requirement coverage ─── */}
        <section className="py-20">
          <div className="mx-auto max-w-[1320px] px-5 md:px-8">
            <Reveal>
              <SectionHead eyebrow="Requirement coverage" title="Problem statement → where to see it" />
            </Reveal>
            <Reveal>
              <div className="panel overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>How SatQuery AI meets it</th>
                      <th>See it</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COVERAGE.map(([req, how, see, href]) => (
                      <tr key={req}>
                        <td className="whitespace-nowrap font-medium text-ink">
                          <span className="flex items-center gap-2">
                            <ShieldCheck size={14} className="text-ok" />
                            {req}
                          </span>
                        </td>
                        <td className="min-w-[320px]">{how}</td>
                        <td className="whitespace-nowrap">
                          <Link href={href} className="inline-flex items-center gap-1 text-cyan-2 hover:underline">
                            {see} <ArrowUpRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="relative overflow-hidden border-t border-line py-20">
          <div className="bg-glow absolute inset-0" />
          <div className="relative mx-auto max-w-3xl px-5 text-center">
            <h2 className="display text-[36px] font-semibold text-ink md:text-[44px]">Bring a GeoTIFF. Ask a question.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">Load one of the real test scenes or drop your own — the agent validates it, picks the tools and shows its work.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/analysis" className="btn btn-primary btn-lg">
                Launch analysis console <ArrowRight size={17} />
              </Link>
              <a href={MUM.samples.s2.url} download className="btn btn-ghost btn-lg">
                <FileDown size={16} /> Download a sample GeoTIFF
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
