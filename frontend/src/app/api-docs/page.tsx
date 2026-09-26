import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, KeyRound, Server } from "lucide-react";
import { Footer } from "@/components/site/Footer";
import { CodeBlock, CodeTabs } from "@/components/api/CodeBlock";
import { JsonView } from "@/components/api/JsonView";
import { Playground } from "@/components/api/Playground";
import { TOOL_REGISTRY } from "@/lib/engine/registry";
import { TASK_LABEL } from "@/lib/engine/intent";
import { HYD } from "@/lib/demo/data";

export const metadata: Metadata = {
  title: "API reference",
  description: "REST API for SatQuery AI: analyse satellite imagery with natural-language queries, validate inputs, list registered tools and fetch reports.",
};

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8050";

const NAV = [
  ["overview", "Overview"],
  ["quickstart", "Quickstart"],
  ["playground", "Playground"],
  ["analyze", "POST /v1/analyze"],
  ["validate", "POST /v1/validate"],
  ["tools", "GET /v1/tools"],
  ["jobs", "Jobs & reports"],
  ["legacy", "Legacy /analyze"],
  ["schemas", "Response schema"],
  ["registry", "Tool registry"],
  ["routing", "Task routing"],
  ["errors", "Errors"],
];

function Method({ m }: { m: "GET" | "POST" }) {
  return <span className={`rounded px-2 py-0.5 mono text-[12px] font-bold ${m === "GET" ? "bg-cyan/15 text-cyan-2" : "bg-ok/15 text-ok"}`}>{m}</span>;
}

function H2({ id, children, sub }: { id: string; children: React.ReactNode; sub?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className="display text-[26px] font-semibold text-ink">{children}</h2>
      {sub && <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-2">{sub}</p>}
    </div>
  );
}

function ParamTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([f, t, r, d]) => (
            <tr key={f}>
              <td className="whitespace-nowrap mono text-[12.5px] text-ink">{f}</td>
              <td className="whitespace-nowrap mono text-[12px] text-cyan-2">{t}</td>
              <td>{r === "yes" ? <span className="badge badge-saffron">required</span> : <span className="text-ink-3">optional</span>}</td>
              <td className="min-w-[280px]">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const lake = HYD.water_bodies.list[0];
const EXAMPLE = {
  id: "req_7f3k2q9d",
  object: "analysis",
  created: "2026-09-26T10:41:07Z",
  query: "Highlight the water body referred to in the query.",
  input: {
    mode: "single",
    images: [{ slot: "A", name: HYD.sample.name, format: "GeoTIFF", sensor: "Sentinel-2 MSI", modality: "optical", crs: "EPSG:32644", size_px: [HYD.grid.width, HYD.grid.height], resolution_m: 10, acquired: "2025-01-07T05:11:19Z" }],
    compatibility: null,
  },
  task: "grounding",
  task_label: TASK_LABEL.grounding,
  status: "completed",
  answer: `**Grounded: Hussain Sagar Lake** — the single large water body in the scene. Area ${lake.area_ha} ha …`,
  confidence: 0.95,
  confidence_parts: { model_likelihood: 0.94, cross_tool_agreement: 0.97, input_quality: 0.99 },
  evidence: [
    {
      id: "hyd-lake",
      type: "polygon",
      label: "Hussain Sagar Lake",
      confidence: 0.96,
      geometry: { type: "Polygon", coordinates: [[...lake.lonlat.slice(0, 40), lake.lonlat[0]]] },
      pixel_bbox: lake.bbox_px,
      stats: { area: `${lake.area_ha} ha (${lake.area_km2.toFixed(2)} km²)`, perimeter: `${(lake.perimeter_m / 1000).toFixed(1)} km` },
    },
  ],
  overlays: [],
  charts: ["hyd-spectral", "hyd-composition"],
  execution_trace: [
    { step: 1, stage: "validate", tool: "geo-validator", version: "1.2.0", params: { files: 1, formats: "TIFF", crs: "EPSG:32644" }, output: "1/1 file valid · GeoTIFF EPSG:32644 6×uint16 (optical)", duration_ms: 280, status: "done" },
    { step: 2, stage: "route", tool: "agent-controller", version: "1.1.0", params: { mode: "single", modalities: "optical", min_intent_confidence: 0.55 }, output: "task = grounding (0.97) · target = “water body”", duration_ms: 360, status: "done" },
    { step: 4, stage: "execute", tool: "rs-grounder", version: "0.9.0", params: { text: "the water body", box_threshold: 0.35, top_k: 3, refine: "spectral" }, output: "2 candidate regions · top score 0.93", duration_ms: 820, status: "done" },
  ],
  models: ["geo-validator@1.2.0", "agent-controller@1.1.0", "rs-grounder@0.9.0", "spectral-indices@1.0.0", "satquery-vlm@1.2.0", "report-builder@1.0.0"],
  reports: { pdf: "/v1/reports/7f3k2q9d.pdf", geojson: "/v1/reports/7f3k2q9d.geojson", json: "/v1/reports/7f3k2q9d.json" },
};

const ROUTING: [string, string, string][] = [
  ["captioning", "spectral-indices → rs-grounder → satquery-vlm", "Describe the land-cover and major objects visible in this image."],
  ["vqa", "spectral-indices → satquery-vlm (+ rs-grounder for “where”)", "Is there an airport in this image? Where is the runway?"],
  ["grounding", "rs-grounder → spectral-indices / sar-segmenter (mask refine) → satquery-vlm", "Highlight the water body referred to in the query."],
  ["fusion_extraction", "spectral-indices + sar-segmenter → optsar-fusion → satquery-vlm", "Use the optical and SAR images together to identify built-up and water-covered regions."],
  ["fusion_vqa", "spectral-indices + sar-segmenter (+ sar-point-detector) → optsar-fusion", "Where do the optical and SAR images disagree, and why?"],
  ["change_description", "spectral-indices ×2 → change-detector → cd-vqa", "What changed between these two dates, and where did the change occur?"],
  ["change_vqa", "spectral-indices ×2 → change-detector → cd-vqa", "Has the built-up area increased, decreased, or remained unchanged?"],
  ["timeseries", "timeseries-profiler → cd-vqa", "Show the year-by-year trend of the construction."],
];

const ERRORS: [string, string, string][] = [
  ["400", "INVALID_FORMAT", "Unsupported file type, or PNG/JPEG outside a declared benchmark sample"],
  ["409", "INCOMPATIBLE_PAIR", "Footprints do not overlap, co-registration failed, or the cross-modal time gap is too long"],
  ["413", "PAYLOAD_TOO_LARGE", "More than 2 images or a file above the configured size limit — use async jobs"],
  ["422", "UNSUPPORTED_QUERY", "Intent confidence below min_intent_confidence, or the task needs a different input configuration"],
  ["422", "PARAM_OUT_OF_RANGE", "An options value is outside the tool's permitted range (see the registry)"],
  ["429", "RATE_LIMITED", "Too many requests for this key"],
  ["500", "MODEL_ERROR", "A specialist failed; the partial trace is returned in error.trace"],
];

export default function ApiDocs() {
  return (
    <>
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 pb-20 md:px-8 lg:grid-cols-[210px_minmax(0,1fr)]" style={{ paddingTop: "calc(var(--nav-h) + 40px)" }}>
        <aside className="hidden lg:block">
          <nav className="sticky top-[calc(var(--nav-h)+32px)] space-y-0.5">
            <p className="eyebrow mb-3">API reference</p>
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-white/[0.04] hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-16">
          <section id="overview" className="scroll-mt-24">
            <p className="eyebrow eyebrow-accent mb-3">REST API · v1</p>
            <h1 className="display text-[40px] font-semibold text-ink md:text-[48px]">SatQuery AI API</h1>
            <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink-2">
              One endpoint takes GeoTIFFs and a natural-language question and returns a grounded answer: task, evidence geometries, overlays, calibrated confidence and the full execution trace. The same contract powers the analysis console.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="panel p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <Server size={15} className="text-cyan" /> Base URL
                </p>
                <p className="mt-2 mono text-[12.5px] text-ink-2">{BASE}</p>
              </div>
              <div className="panel p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <KeyRound size={15} className="text-saffron" /> Auth
                </p>
                <p className="mt-2 text-[12.5px] text-ink-2">
                  <span className="mono">Authorization: Bearer &lt;key&gt;</span> — optional on local deployments
                </p>
              </div>
              <div className="panel p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <BookOpen size={15} className="text-ok" /> OpenAPI
                </p>
                <a href={`${BASE}/docs`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 mono text-[12.5px] text-cyan-2 hover:underline">
                  {BASE}/docs <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <H2 id="quickstart" sub="Send one or two images as multipart form data. Two images are paired automatically — optical + SAR becomes cross-modal fusion, two dates become change analysis.">
              Quickstart
            </H2>
            <CodeTabs
              tabs={[
                {
                  label: "cURL",
                  code: `curl -X POST "${BASE}/v1/analyze" \\
  -H "Authorization: Bearer $SATQUERY_KEY" \\
  -F "query=Use the optical and SAR images together to identify built-up and water-covered regions." \\
  -F "images=@MUM_S2L2A_20250106_T43QBB.tif" \\
  -F "images=@MUM_S1RTC_20250107_VVVH.tif" \\
  -F 'options={"return_overlays": true, "return_geojson": true}'`,
                },
                {
                  label: "Python",
                  code: `import requests

BASE = "${BASE}"
files = [
    ("images", open("NMIA_S2L2A_20170103_T43QBB.tif", "rb")),
    ("images", open("NMIA_S2L2A_20260116_T43QBB.tif", "rb")),
]
r = requests.post(f"{BASE}/v1/analyze",
                  data={"query": "What changed between these two dates, and where did the change occur?"},
                  files=files, timeout=180)
res = r.json()
print(res["task"], res["confidence"])
print(res["answer"])
for step in res["execution_trace"]:
    print(step["stage"], step["tool"], step["output"])`,
                },
                {
                  label: "JavaScript",
                  code: `const form = new FormData();
form.append("query", "Highlight the water body referred to in the query.");
form.append("images", fileInput.files[0]); // a GeoTIFF

const res = await fetch("${BASE}/v1/analyze", { method: "POST", body: form });
const { task, answer, evidence, execution_trace } = await res.json();
// evidence[i].geometry is GeoJSON (EPSG:4326) — drop it straight onto a map`,
                },
              ]}
            />
          </section>

          <section className="space-y-5">
            <H2 id="playground" sub="Try the contract against the bundled Sentinel test scenes. Files are fetched and validated in your browser exactly as the server would.">
              Playground
            </H2>
            <Playground />
          </section>

          <section className="space-y-5">
            <H2 id="analyze">
              <span className="flex flex-wrap items-center gap-3">
                <Method m="POST" /> <span className="mono">/v1/analyze</span>
              </span>
            </H2>
            <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-2">Validates the inputs, classifies the query, plans and runs the specialist tools, and returns the grounded answer. Content type: multipart/form-data.</p>
            <ParamTable
              rows={[
                ["query", "string", "yes", "Natural-language question, 3–500 characters."],
                ["images", "file[1..2]", "yes", "GeoTIFF / TIFF. PNG / JPEG only for public benchmark samples (flagged in the response)."],
                ["mode", "enum", "no", "auto (default) · single · cross_modal · bitemporal. auto infers the mode from sensors and dates."],
                ["options.return_overlays", "boolean", "no", "Include raster overlay URLs (class maps, change maps). Default true."],
                ["options.return_geojson", "boolean", "no", "Include evidence geometries as GeoJSON in EPSG:4326. Default true."],
                ["options.min_confidence", "number", "no", "0–1. Answers below this are returned with status “abstained”. Default 0.6."],
                ["options.language", "enum", "no", "en (default) · hi"],
              ]}
            />
            <p className="text-[13px] text-ink-3">Tool parameters cannot be passed freely — the controller sets them within the permitted ranges published in the tool registry.</p>
          </section>

          <section className="space-y-5">
            <H2 id="validate">
              <span className="flex flex-wrap items-center gap-3">
                <Method m="POST" /> <span className="mono">/v1/validate</span>
              </span>
            </H2>
            <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-2">Runs only the geo-validator: per-file checks (format, CRS, bands, grid, acquisition time, no-data) and, for two files, pair checks (footprint IoU, co-registration offset, modality pairing, time gap). Returns the inferred mode.</p>
            <CodeBlock
              code={`curl -X POST "${BASE}/v1/validate" -F "images=@HYD_S2L2A_20250107_T44QKE.tif" -F "images=@MUM_S1RTC_20250107_VVVH.tif"
# → { "valid": false, "pair": { "status": "fail", "summary": "Pair rejected — the images do not describe the same area.", ... } }`}
            />
          </section>

          <section className="space-y-5">
            <H2 id="tools">
              <span className="flex flex-wrap items-center gap-3">
                <Method m="GET" /> <span className="mono">/v1/tools</span>
              </span>
            </H2>
            <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-2">Lists every registered tool with its version, role, supported tasks and permitted parameter ranges. The same registry drives planning, so the trace can always be matched back to it.</p>
          </section>

          <section className="space-y-4">
            <H2 id="jobs" sub="Large scenes run asynchronously. Every completed analysis also exposes its reports.">
              Jobs & reports
            </H2>
            <div className="panel overflow-x-auto">
              <table className="table">
                <tbody>
                  {[
                    ["POST", "/v1/jobs", "Same body as /v1/analyze; returns { job_id, status: \"queued\" } immediately."],
                    ["GET", "/v1/jobs/{job_id}", "queued · running (with the live trace so far) · done (full analysis) · failed."],
                    ["GET", "/v1/reports/{id}.pdf", "PDF report: query, answer, confidence, evidence image, inputs and the execution trace."],
                    ["GET", "/v1/reports/{id}.geojson", "Evidence geometries as a FeatureCollection (EPSG:4326)."],
                    ["GET", "/v1/reports/{id}.json", "Machine-readable audit record: inputs, compatibility, trace, models."],
                    ["GET", "/health", "{ status, models_loaded, device } — liveness and readiness."],
                  ].map(([m, p, d]) => (
                    <tr key={p}>
                      <td className="w-16">
                        <Method m={m as "GET" | "POST"} />
                      </td>
                      <td className="whitespace-nowrap mono text-[12.5px] text-ink">{p}</td>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <H2 id="legacy" sub="The FastAPI server in src/api/main.py serves this endpoint today. It returns the answer and trace; the v1 fields above extend it with evidence, overlays and reports.">
              Legacy <span className="mono">/analyze</span>
            </H2>
            <CodeBlock
              code={`curl -X POST "${BASE}/analyze" \\
  -F "query=Describe the land-cover and major objects visible in this image." \\
  -F "file1=@HYD_S2L2A_20250107_T44QKE.tif"
# optional second image: -F "file2=@…"
# → { "query": "…", "result": "…", "execution_trace": [ { "step": "Routing", "action": "…" }, … ] }`}
            />
          </section>

          <section className="space-y-5">
            <H2 id="schemas" sub="Abridged example for a grounding query on the Hyderabad scene (coordinates elided).">
              Response schema
            </H2>
            <JsonView value={EXAMPLE} className="!max-h-[620px]" />
          </section>

          <section className="space-y-5">
            <H2 id="registry" sub="Each tool declares the only parameters the controller may set, with their permitted range and default.">
              Tool registry
            </H2>
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Role</th>
                    <th>Method</th>
                    <th>Permitted parameters</th>
                  </tr>
                </thead>
                <tbody>
                  {TOOL_REGISTRY.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">
                        <p className="mono text-[12.5px] text-ink">{t.id}</p>
                        <p className="mono text-[11px] text-ink-3">v{t.version}</p>
                      </td>
                      <td>
                        <span className="badge">{t.role}</span>
                      </td>
                      <td className="min-w-[260px] text-[12.5px]">
                        <p className="font-medium text-ink">{t.name}</p>
                        <p className="mt-0.5">{t.method}</p>
                      </td>
                      <td className="min-w-[240px]">
                        {t.params.map((p) => (
                          <p key={p.name} className="mono text-[11.5px]">
                            <span className="text-cyan-2">{p.name}</span> <span className="text-ink-3">∈</span> {p.range} <span className="text-ink-3">(default {p.default})</span>
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-5">
            <H2 id="routing" sub="How the controller maps a classified task onto a tool DAG. Try any example in the console.">
              Task routing
            </H2>
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Tool DAG</th>
                    <th>Example query</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING.map(([task, dag, ex]) => (
                    <tr key={task}>
                      <td className="whitespace-nowrap">
                        <p className="mono text-[12.5px] text-ink">{task}</p>
                        <p className="text-[11.5px] text-ink-3">{TASK_LABEL[task as keyof typeof TASK_LABEL]}</p>
                      </td>
                      <td className="mono text-[11.5px] text-cyan-2">{dag}</td>
                      <td className="text-[12.5px]">“{ex}”</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-5">
            <H2 id="errors" sub="Errors use a stable code. Validation failures stop the pipeline before any model runs and still return the partial trace.">
              Errors
            </H2>
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>HTTP</th>
                    <th>Code</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map(([h, c, w]) => (
                    <tr key={c}>
                      <td>
                        <span className={`badge ${h.startsWith("4") ? "badge-warn" : "badge-crit"}`}>{h}</span>
                      </td>
                      <td className="mono text-[12.5px] text-ink">{c}</td>
                      <td>{w}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CodeBlock
              code={`{
  "status": "rejected",
  "error": { "code": "INCOMPATIBLE_PAIR", "message": "No overlap — footprints are 620 km apart (IoU 0.00)" },
  "execution_trace": [
    { "step": 1, "stage": "validate", "tool": "geo-validator", "status": "failed" },
    { "step": 2, "stage": "route", "tool": "agent-controller", "output": "task = rejected · no specialist tools executed" }
  ]
}`}
            />
            <p className="text-[13px] text-ink-3">
              See the guardrail live in the{" "}
              <Link href="/analysis?scene=mismatch&q=Use%20the%20optical%20and%20SAR%20images%20together%20to%20identify%20built-up%20and%20water-covered%20regions.&run=1" className="text-cyan-2 hover:underline">
                mismatched-pair scene
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}
