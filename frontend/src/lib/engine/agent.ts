import { respond } from "@/lib/demo/responses";
import type { AgentEvent, AgentResult, CompatibilityReport, LoadedImage, Mode, ScenarioId, ToolCall, TraceStep } from "@/lib/types";
import { classifyIntent, TASK_LABEL } from "./intent";
import { analyzeLocally } from "./local";
import { TOOL_BY_ID } from "./registry";

export interface RunInput {
  query: string;
  mode: Mode;
  scenarioId: ScenarioId;
  images: LoadedImage[];
  compat: CompatibilityReport | null;
  /** 1 = normal demo pacing; higher is faster. */
  speed?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = () => Math.random().toString(36).slice(2, 10);

function call(tool: string, title: string, stage: ToolCall["stage"], params: ToolCall["params"], output: string, ms: number): ToolCall {
  return { tool, version: TOOL_BY_ID[tool]?.version ?? "1.0.0", title, stage, params, output, ms };
}

function validationCall(images: LoadedImage[], compat: CompatibilityReport | null): { call: ToolCall; ok: boolean } {
  const fileFails = images.flatMap((i) => i.checks.filter((c) => c.status === "fail"));
  const warns = images.flatMap((i) => i.checks.filter((c) => c.status === "warn")).length + (compat?.checks.filter((c) => c.status === "warn").length ?? 0);
  const ok = fileFails.length === 0 && (!compat || compat.status !== "fail");
  const first = images[0]?.meta;
  const desc = images
    .map((i) => `${i.meta.format === "TIFF" && i.meta.georeferenced ? "GeoTIFF" : i.meta.format}${i.meta.epsg ? ` EPSG:${i.meta.epsg}` : ""} ${i.meta.bands}×${i.meta.dtype} (${i.meta.modality})`)
    .join(" + ");
  let output = `${images.length}/${images.length} file${images.length > 1 ? "s" : ""} valid · ${desc}`;
  if (compat && compat.status !== "fail") output += ` · ${compat.summary.replace(/\.$/, "")}${compat.iou !== null ? ` (IoU ${compat.iou.toFixed(3)})` : ""}`;
  if (!ok) output = fileFails.length ? `Rejected: ${fileFails[0].detail}` : `Rejected: ${compat?.checks.find((c) => c.status === "fail")?.detail ?? compat?.summary}`;
  else if (warns) output += ` · ${warns} warning${warns > 1 ? "s" : ""}`;
  return {
    ok,
    call: call(
      "geo-validator",
      images.length > 1 ? "Validate inputs & pair compatibility" : "Validate input",
      "validate",
      {
        files: images.length,
        formats: images.map((i) => (i.meta.format === "TIFF" && i.meta.georeferenced ? "GeoTIFF" : i.meta.format)).join(", "),
        crs: images.map((i) => (i.meta.epsg ? `EPSG:${i.meta.epsg}` : "none")).join(", "),
        ...(images.length > 1 ? { min_overlap_iou: 0.95, max_crossmodal_gap_h: 72 } : {}),
        ...(first?.acquired ? { acquired: images.map((i) => i.meta.acquired?.slice(0, 10) ?? "?").join(" / ") } : {}),
      },
      output,
      images.length > 1 ? 420 : 280,
    ),
  };
}

function words(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Runs the agentic pipeline against the cached specialist outputs of the bundled
 * test scenes, streaming each trace step as it starts and completes.
 */
export async function* runAgent(input: RunInput): AsyncGenerator<AgentEvent> {
  const started = Date.now();
  const speed = input.speed ?? 1;
  const trace: TraceStep[] = [];
  const pace = (ms: number) => Math.max(160, Math.min(1500, (ms * 0.6) / speed));

  async function* exec(c: ToolCall, status: TraceStep["status"] = "done"): AsyncGenerator<AgentEvent> {
    const step: TraceStep = { ...c, id: newId(), status: "running", startedAt: Date.now() - started };
    trace.push(step);
    yield { type: "step", step: { ...step } };
    await sleep(pace(c.ms));
    step.status = status;
    yield { type: "step", step: { ...step } };
  }

  const v = validationCall(input.images, input.compat);
  yield* exec(v.call, v.ok ? "done" : "failed");

  const intent = classifyIntent(input.query, input.mode);
  const modalities = input.images.map((i) => i.meta.modality).join(" + ");

  if (!v.ok) {
    yield* exec(call("agent-controller", "Route request", "route", { mode: input.mode, modalities }, "task = rejected · no specialist tools executed (input guardrail)", 120));
    yield* exec(call("report-builder", "Build audit report", "report", { formats: ["json", "pdf"] }, "rejection report ready", 90));
    const failed = input.compat?.checks.filter((c) => c.status === "fail") ?? [];
    const fileFail = input.images.flatMap((i) => i.checks.filter((c) => c.status === "fail"));
    const a = input.images[0]?.meta;
    const b = input.images[1]?.meta;
    const reasons = [...fileFail, ...failed].map((c) => `• **${c.label}:** ${c.detail}`).join("\n");
    const answer =
      `**Request rejected before any model was run.** The inputs cannot be analysed together:\n\n${reasons}\n\n` +
      (a && b
        ? `Image A is ${a.sensor} (${a.crsName}${a.center ? `, centred ${a.center[1].toFixed(2)}° N ${a.center[0].toFixed(2)}° E` : ""}); image B is ${b.sensor} (${b.crsName}${b.center ? `, centred ${b.center[1].toFixed(2)}° N ${b.center[0].toFixed(2)}° E` : ""}). ` +
          `Cross-modal fusion and change analysis need co-registered images of the same area.\n\n`
        : "") +
      `**What you can do:** upload a co-registered pair (e.g. MUM_S2L2A_20250106 + MUM_S1RTC_20250107), or analyse each image on its own.`;
    const result: AgentResult = {
      id: newId(),
      query: input.query,
      scenarioId: input.scenarioId,
      task: "rejected",
      taskLabel: TASK_LABEL.rejected,
      intentConfidence: intent.confidence,
      confidence: 0,
      confidenceParts: [],
      answer,
      highlights: ["Guardrail triggered", input.compat?.distanceKm ? `${Math.round(input.compat.distanceKm)} km apart` : "Invalid input"],
      evidence: [],
      overlays: [],
      charts: [],
      view: "map",
      trace,
      totalMs: Date.now() - started,
      createdAt: new Date().toISOString(),
      models: ["geo-validator@1.2.0", "agent-controller@1.1.0"],
      error: { code: input.compat?.status === "fail" ? "INCOMPATIBLE_PAIR" : "INVALID_INPUT", message: failed[0]?.detail ?? fileFail[0]?.detail ?? "Input rejected" },
    };
    yield { type: "result", result };
    return;
  }

  const frame = input.images[0]?.sampleKey === "nmia-t2" ? "B" : "A";
  const canned = respond(input.scenarioId, intent, input.query, frame);
  const task = canned?.task ?? intent.task;

  yield* exec(
    call(
      "agent-controller",
      "Classify query & route",
      "route",
      { mode: input.mode, modalities, min_intent_confidence: 0.55 },
      `task = ${task} (${intent.confidence.toFixed(2)})${intent.target ? ` · target = “${intent.target}”` : ""}`,
      360,
    ),
  );

  if (!canned && input.images.length === 1) {
    const img = input.images[0];
    const local = await analyzeLocally(img);
    if (local) {
      const m = img.meta;
      yield* exec(call("agent-controller", "Plan tool DAG", "plan", { registry_tools: Object.keys(TOOL_BY_ID).length }, `${local.tool} → satquery-vlm → report-builder`, 140));
      yield* exec(call(local.tool, local.tool === "sar-segmenter" ? "Segment SAR backscatter (in browser)" : "Land-cover evidence (in browser)", "execute", local.params, local.output, Math.max(60, Math.round(local.ms))));
      yield* exec(call("satquery-vlm", "Run SatQuery-VLM", "execute", { endpoint: "offline" }, "skipped — model not available offline; answer composed from measured evidence", 120), "skipped");
      yield* exec(call("report-builder", "Build report & exports", "report", { formats: ["pdf", "json"] }, "PDF · JSON trace", 110));
      const overlayId = `local:${img.id}`;
      const answer =
        `**Measured composition of ${m.name}** (${m.width} × ${m.height} px${m.resolution && m.georeferenced && m.epsg !== 4326 ? ` at ${m.resolution[0]} m` : ""}), computed in your browser by ${local.tool}:\n\n` +
        local.shares.map((s) => `• **${s.label}** — ${s.pct.toFixed(1)} %${s.ha !== null ? ` (${Math.round(s.ha).toLocaleString("en-IN")} ha)` : ""}`).join("\n") +
        `\n\nThe vision-language model is not available offline, so this answer reports measured land cover only${m.georeferenced ? "" : " (the file has no usable georeference, so map placement is disabled)"}. Connect the live backend for captioning, VQA and grounding on new scenes.`;
      const result: AgentResult = {
        id: newId(),
        query: input.query,
        scenarioId: input.scenarioId,
        task: intent.task,
        taskLabel: TASK_LABEL[intent.task],
        intentConfidence: intent.confidence,
        confidence: 0,
        confidenceParts: [],
        answer,
        highlights: ["Measured in browser", local.tool],
        evidence: [],
        overlays: [overlayId],
        extraOverlays: [{ id: overlayId, label: local.tool === "sar-segmenter" ? "SAR classes (in-browser)" : "Land cover (in-browser)", url: local.overlayUrl, frame: "A", opacity: 0.55, classCoded: local.classCoded, legend: local.legend }],
        charts: [],
        view: "image",
        trace,
        totalMs: trace.reduce((s, t) => s + t.ms, 0),
        createdAt: new Date().toISOString(),
        models: [...new Set(trace.map((s) => `${s.tool}@${s.version}`))],
      };
      yield { type: "result", result };
      return;
    }
  }

  if (!canned) {
    yield* exec(call("agent-controller", "Plan tool DAG", "plan", { registry_tools: Object.keys(TOOL_BY_ID).length }, "satquery-vlm → report-builder", 140));
    yield* exec(call("satquery-vlm", "Run SatQuery-VLM", "execute", { endpoint: "local-cache" }, "skipped — no cached inference for this scene in offline demo mode", 200), "skipped");
    yield* exec(call("report-builder", "Build audit report", "report", { formats: ["json"] }, "metadata report ready", 90));
    const m = input.images[0]?.meta;
    const result: AgentResult = {
      id: newId(),
      query: input.query,
      scenarioId: input.scenarioId,
      task,
      taskLabel: TASK_LABEL[task],
      intentConfidence: intent.confidence,
      confidence: 0,
      confidenceParts: [],
      answer:
        `**Inputs validated, but this scene has no cached model output in offline demo mode.**\n\n` +
        (m
          ? `• ${m.name}: ${m.width} × ${m.height} px, ${m.bands} × ${m.dtype}, ${m.crsName}${m.acquired ? `, acquired ${m.acquired.replace("T", " ").replace("Z", " UTC")}` : ""}.\n`
          : "") +
        `• Routed task: **${TASK_LABEL[task]}** (${intent.confidence.toFixed(2)}).\n\n` +
        `Connect the live FastAPI backend (set NEXT_PUBLIC_API_URL and switch the engine to “Live API”) to run the specialist models on new scenes, or pick one of the bundled test scenes.`,
      highlights: ["Validated", "No cached inference"],
      evidence: [],
      overlays: [],
      charts: [],
      view: input.images.some((i) => i.meta.georeferenced) ? "map" : "image",
      trace,
      totalMs: Date.now() - started,
      createdAt: new Date().toISOString(),
      models: ["geo-validator@1.2.0", "agent-controller@1.1.0"],
    };
    yield { type: "result", result };
    return;
  }

  const dag = [...new Set(canned.tools.map((t) => t.tool)), "satquery-vlm", "report-builder"];
  yield* exec(call("agent-controller", "Plan tool DAG", "plan", { nodes: dag.length, parallel: canned.tools.filter((t) => t.stage === "execute").length > 2 }, dag.join(" → "), 160));

  for (const t of canned.tools) yield* exec(t);

  yield* exec(
    call(
      "agent-controller",
      "Aggregate evidence & calibrate confidence",
      "fuse",
      { evidence_items: canned.evidence.length, abstain_below: 0.6 },
      `confidence ${canned.confidence.toFixed(2)} = f(${canned.confidenceParts.map((p) => p.value.toFixed(2)).join(", ")})${canned.confidence < 0.7 ? " · flagged low" : ""}`,
      180,
    ),
  );
  yield* exec(
    call(
      "satquery-vlm",
      "Compose grounded answer",
      "synthesize",
      { temperature: 0.2, max_new_tokens: 384, cite_evidence: true },
      `${words(canned.answer)} words · ${canned.evidence.length} evidence reference${canned.evidence.length === 1 ? "" : "s"}`,
      Math.min(1600, 500 + words(canned.answer) * 4),
    ),
  );
  yield* exec(
    call("report-builder", "Build report & exports", "report", { formats: ["pdf", "geojson", "json"] }, `PDF · GeoJSON (${canned.evidence.filter((e) => e.lonlat || e.points).length} features) · JSON trace`, 140),
  );

  const models = [...new Set(trace.map((s) => `${s.tool}@${s.version}`))];
  const result: AgentResult = {
    id: newId(),
    query: input.query,
    scenarioId: input.scenarioId,
    task,
    taskLabel: TASK_LABEL[task],
    intentConfidence: intent.confidence,
    confidence: canned.confidence,
    confidenceParts: canned.confidenceParts,
    answer: canned.answer,
    highlights: canned.highlights,
    evidence: canned.evidence,
    overlays: canned.overlays,
    charts: canned.charts,
    view: canned.view,
    trace,
    totalMs: trace.reduce((s, t) => s + t.ms, 0),
    createdAt: new Date().toISOString(),
    models,
    base: canned.base,
    focus: canned.focus,
  };
  yield { type: "result", result };
}
