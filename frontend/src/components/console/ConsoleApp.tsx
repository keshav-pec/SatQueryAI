"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentResult, CompatibilityReport, EvidenceItem, LoadedImage, Mode, ScenarioId, TraceStep, ViewId } from "@/lib/types";
import { checkPair } from "@/lib/geo/compat";
import { bboxOf } from "@/lib/geo/proj";
import { SAMPLES, SCENARIOS, SUGGESTIONS, resolveScenario } from "@/lib/demo/data";
import { buildLoaded, loadSamples } from "@/lib/demo/load";
import { BASE_LAYERS, OVERLAYS, type BaseLayer, type RasterOverlay } from "@/lib/demo/layers";
import { runAgent } from "@/lib/engine/agent";
import { exportGeoJson, exportJson, exportPdf } from "@/lib/report/exports";
import { composeEvidenceImage } from "@/lib/report/snapshot";
import type { Basemap } from "@/components/map/MapView";
import { InputRail } from "./InputRail";
import { AgentPanel, type ThreadItem } from "./AgentPanel";
import { Canvas } from "./canvas/Canvas";
import type { ActiveOverlay, Corners, HoverInfo, OverlayState, StageModel } from "./canvas/model";
import type { FocusRequest } from "./viewer/ZoomPane";
import { useFilteredUrls } from "./viewer/imageHooks";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const newId = () => Math.random().toString(36).slice(2, 10);

function baseLayersFor(sid: ScenarioId | null, images: LoadedImage[]): BaseLayer[] {
  switch (sid) {
    case "hyd":
      return BASE_LAYERS.hyd;
    case "mum-sar":
      return BASE_LAYERS.mum.filter((b) => b.id.startsWith("mum:sar"));
    case "mum-opt":
      return BASE_LAYERS.mum.filter((b) => b.id === "mum:truecolor" || b.id === "mum:falsecolor");
    case "mum-fusion":
      return BASE_LAYERS.mum;
    case "nmia":
      return BASE_LAYERS.nmia;
    case "nmia-single":
      return BASE_LAYERS.nmia.filter((b) => (images[0]?.sampleKey === "nmia-t1" ? b.frame === "A" : b.frame === "B"));
    default:
      return images.filter((i) => i.previewUrl).map((i) => ({ id: `file:${i.slot}`, label: `${i.slot} · ${i.meta.name}`, url: i.previewUrl, frame: i.slot }));
  }
}

function viewsFor(sid: ScenarioId | null, mode: Mode): ViewId[] {
  if (sid === "mismatch") return ["map", "image", "split"];
  if (mode === "bitemporal") return sid === "nmia" ? ["compare", "timeline", "split", "image", "map", "analytics"] : ["compare", "split", "image", "map", "analytics"];
  if (mode === "cross_modal") return sid === "mum-fusion" ? ["fusion", "split", "image", "map", "analytics"] : ["split", "image", "map", "analytics"];
  return ["image", "split", "map", "analytics"];
}

function lonlatBBox(e: EvidenceItem): [number, number, number, number] | null {
  const pts = e.points ? e.points.map((p) => p.lonlat) : e.lonlat;
  if (!pts?.length) return null;
  const b = bboxOf(pts);
  const pad = Math.max(0.002, (b[2] - b[0]) * 0.15);
  return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
}

export default function ConsoleApp() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState<Partial<Record<"A" | "B", string>>>({});
  const [modePref, setModePref] = useState<Mode>("single");
  const [pickedScene, setPickedScene] = useState<ScenarioId | null>(null);

  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<"demo" | "live">("demo");
  const [exporting, setExporting] = useState<string | null>(null);

  const [view, setView] = useState<ViewId>("image");
  const [baseId, setBaseId] = useState<string | null>(null);
  const [produced, setProduced] = useState<string[]>([]);
  const [overlayState, setOverlayState] = useState<Record<string, OverlayState>>({});
  const [extra, setExtra] = useState<Record<string, RasterOverlay>>({});
  const def = useCallback((id: string): RasterOverlay | undefined => OVERLAYS[id] ?? extra[id], [extra]);
  const [evidenceOn, setEvidenceOn] = useState(true);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [mapFit, setMapFit] = useState<StageModel["mapFit"]>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [mapImageOpacity, setMapImageOpacity] = useState(0.8);
  const [layersOpen, setLayersOpen] = useState(false);
  const pending = useRef<string | null>(null);
  const nonce = useRef(1);

  // ─── derived ───
  const imgA = images.find((i) => i.slot === "A");
  const imgB = images.find((i) => i.slot === "B");
  const compat: CompatibilityReport | null = useMemo(() => (imgA && imgB ? checkPair(imgA, imgB) : null), [imgA, imgB]);
  const analysisMode: Mode = images.length === 2 ? compat?.inferredMode ?? "cross_modal" : "single";
  const railMode: Mode = images.length === 2 ? compat?.inferredMode ?? modePref : modePref;
  const scenarioId: ScenarioId | null = images.length
    ? resolveScenario(
        [imgA, imgB].filter(Boolean).map((i) => i!.sampleKey),
        compat?.status === "fail",
      )
    : null;
  const baseLayers = useMemo(() => baseLayersFor(scenarioId, images), [scenarioId, images]);
  const base = baseLayers.find((b) => b.id === baseId) ?? baseLayers[0] ?? null;
  const views = viewsFor(scenarioId, analysisMode);
  const running = thread.some((t) => t.status === "running");
  const activeResult = thread.find((t) => t.id === activeItem)?.result ?? null;

  const family = scenarioId && ["hyd", "mum-opt", "mum-sar", "mum-fusion", "nmia", "nmia-single"].includes(scenarioId);
  const sample = images.find((i) => i.sampleKey)?.sampleKey;
  const grid = family && sample ? SAMPLES[sample].grid : null;
  const baseImg = base ? images.find((i) => i.slot === base.frame) ?? images[0] : images[0];
  const dims = grid ? { width: grid.width, height: grid.height } : { width: baseImg?.meta.width ?? 1, height: baseImg?.meta.height ?? 1 };
  const corners = (grid ? (grid.corners_lonlat as Corners) : ((baseImg?.meta.corners as Corners | null) ?? null)) as Corners | null;

  const filtered = useFilteredUrls(produced.filter((id) => def(id)).map((id) => ({ id, url: def(id)!.url, hidden: overlayState[id]?.hidden ?? [] })));
  const overlays: ActiveOverlay[] = useMemo(
    () =>
      produced
        .filter((id) => def(id))
        .map((id) => {
          const o = def(id)!;
          return { ...o, state: overlayState[id] ?? { visible: false, opacity: o.opacity, hidden: [] }, src: filtered[id] ?? o.url };
        }),
    [produced, overlayState, filtered, def],
  );

  const evidence = evidenceOn && activeResult ? activeResult.evidence : [];
  const charts = useMemo(() => {
    const out: string[] = [];
    const ordered = activeResult ? [activeResult, ...thread.map((t) => t.result).filter((r): r is AgentResult => !!r && r !== activeResult)] : thread.map((t) => t.result).filter((r): r is AgentResult => !!r);
    for (const r of ordered) for (const c of r.charts) if (!out.includes(c)) out.push(c);
    return out;
  }, [activeResult, thread]);

  const runningItem = thread.find((t) => t.status === "running");
  const model: StageModel = {
    scenarioId: scenarioId ?? "generic",
    mode: analysisMode,
    images,
    dims,
    corners,
    base,
    baseLayers,
    overlays,
    evidence,
    activeEvidence,
    onSelectEvidence: (id) => selectEvidence(id),
    focus,
    mapFit,
    running: runningItem ? { title: runningItem.steps[runningItem.steps.length - 1]?.title ?? "Starting agent" } : null,
    onHover: setHover,
    basemap,
    mapImageOpacity,
    fitKey: `${scenarioId}-${images.map((i) => i.id).join("-")}`,
  };

  // ─── session management ───
  const resetSession = useCallback(() => {
    setThread([]);
    setActiveItem(null);
    setProduced([]);
    setOverlayState({});
    setExtra({});
    setActiveEvidence(null);
    setBaseId(null);
    setFocus(null);
  }, []);

  // Fit map + pick default view when the inputs change
  const imageKey = images.map((i) => i.id).join("|");
  useEffect(() => {
    if (!images.length) return;
    const pts = images.flatMap((i) => (i.meta.corners ? i.meta.corners : []));
    if (pts.length) {
      const b = bboxOf(pts);
      const pad = 0.01;
      setMapFit({ bbox: [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], nonce: nonce.current++, maxZoom: 13.2, duration: 2800 });
    }
    setView(viewsFor(scenarioId, analysisMode)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  const loadScenario = useCallback(
    async (id: ScenarioId) => {
      const card = SCENARIOS.find((s) => s.id === id);
      if (!card) return;
      resetSession();
      setPickedScene(id);
      setModePref(card.mode);
      setImages([]);
      const slots: ("A" | "B")[] = ["A", "B"];
      setLoading(Object.fromEntries(card.files.map((k, i) => [slots[i], SAMPLES[k].name])));
      const loaded = await loadSamples(card.files);
      setImages(loaded);
      setLoading({});
    },
    [resetSession],
  );

  const onFile = useCallback(
    async (slot: "A" | "B", f: File) => {
      resetSession();
      setPickedScene(null);
      setLoading((l) => ({ ...l, [slot]: f.name }));
      try {
        const li = await buildLoaded(f, slot);
        setImages((prev) => [...prev.filter((i) => i.slot !== slot), li].sort((a, b) => a.slot.localeCompare(b.slot)));
      } finally {
        setLoading((l) => ({ ...l, [slot]: undefined }));
      }
    },
    [resetSession],
  );

  const onClear = useCallback(
    (slot: "A" | "B") => {
      resetSession();
      setPickedScene(null);
      setImages((prev) => prev.filter((i) => i.slot !== slot).map((i) => (slot === "A" ? { ...i, slot: "A" as const } : i)));
    },
    [resetSession],
  );

  // ─── evidence focus ───
  const selectEvidence = useCallback(
    (id: string, result?: AgentResult | null) => {
      const r = result ?? activeResult;
      const e = r?.evidence.find((x) => x.id === id);
      if (!e) return;
      setActiveEvidence(id);
      if (e.bboxPx) setFocus({ bbox: e.bboxPx, nonce: nonce.current++ });
      const bb = lonlatBBox(e);
      if (bb) setMapFit({ bbox: bb, nonce: nonce.current++, maxZoom: 15.2, duration: 1800 });
      setView((v) => (v === "analytics" || v === "timeline" ? "split" : v));
    },
    [activeResult],
  );

  const applyResult = useCallback(
    (r: AgentResult) => {
      if (r.extraOverlays?.length) setExtra((e) => ({ ...e, ...Object.fromEntries(r.extraOverlays!.map((o) => [o.id, o])) }));
      if (r.overlays.length) {
        const opacityOf = (o: string) => OVERLAYS[o]?.opacity ?? r.extraOverlays?.find((x) => x.id === o)?.opacity ?? 0.55;
        setProduced((p) => [...p, ...r.overlays.filter((o) => !p.includes(o))]);
        setOverlayState((s) => {
          const next: Record<string, OverlayState> = {};
          for (const [k, v] of Object.entries(s)) next[k] = { ...v, visible: false };
          for (const o of r.overlays) next[o] = { visible: true, opacity: s[o]?.opacity ?? opacityOf(o), hidden: s[o]?.hidden ?? [] };
          return next;
        });
      } else {
        setOverlayState((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, visible: false }])));
      }
      if (r.base) setBaseId(r.base);
      setView((cur) => {
        const allowed = viewsFor(scenarioId, analysisMode);
        return allowed.includes(r.view) ? r.view : allowed.includes(cur) ? cur : allowed[0];
      });
      if (r.focus) setTimeout(() => selectEvidence(r.focus!, r), 450);
      else setActiveEvidence(null);
      if (r.task === "rejected" && images.length) {
        const pts = images.flatMap((i) => (i.meta.corners ? i.meta.corners : []));
        if (pts.length) {
          const b = bboxOf(pts);
          setMapFit({ bbox: [b[0] - 0.6, b[1] - 0.6, b[2] + 0.6, b[3] + 0.6], nonce: nonce.current++, maxZoom: 7, duration: 2400 });
        }
      }
    },
    [scenarioId, analysisMode, selectEvidence, images],
  );

  const upsertStep = (steps: TraceStep[], s: TraceStep) => {
    const i = steps.findIndex((x) => x.id === s.id);
    if (i < 0) return [...steps, s];
    const copy = steps.slice();
    copy[i] = s;
    return copy;
  };

  const runDemo = useCallback(
    async (id: string, text: string, speed = 1) => {
      let final: AgentResult | null = null;
      for await (const ev of runAgent({ query: text, mode: analysisMode, scenarioId: scenarioId ?? "generic", images, compat, speed })) {
        if (ev.type === "step" && ev.step) {
          const step = ev.step;
          if (speed < 20) setThread((t) => t.map((it) => (it.id === id ? { ...it, steps: upsertStep(it.steps, step) } : it)));
        } else if (ev.result) final = ev.result;
      }
      return final;
    },
    [analysisMode, scenarioId, images, compat],
  );

  const submit = useCallback(
    async (q?: string) => {
      const text = (q ?? query).trim();
      if (!text || !images.length || running) return;
      setQuery("");
      const id = newId();
      setThread((t) => [...t, { id, query: text, status: "running", steps: [], fresh: true }]);
      setActiveItem(id);
      setActiveEvidence(null);
      setLayersOpen(false);

      let result: AgentResult | null = null;
      let note: string | undefined;
      if (engine === "live" && API) {
        try {
          const fd = new FormData();
          fd.append("query", text);
          fd.append("file1", images[0].file);
          if (images[1]) fd.append("file2", images[1].file);
          const t0 = performance.now();
          const res = await fetch(`${API}/analyze`, { method: "POST", body: fd });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: { result: string; execution_trace: Record<string, unknown>[] } = await res.json();
          const visuals = await runDemo(id, text, 50);
          if (!visuals) throw new Error("no local visuals");
          const trace: TraceStep[] = data.execution_trace.map((s, i) => ({
            id: `${id}-${i}`,
            tool: String(s.tool_used ?? "satquery-backend"),
            version: "live",
            title: String(s.step ?? `Step ${i + 1}`),
            stage: /rout/i.test(String(s.step)) ? "route" : /init/i.test(String(s.step)) ? "validate" : "execute",
            params: {},
            output: String(s.message ?? s.action ?? s.status ?? s.error ?? ""),
            ms: Math.round((performance.now() - t0) / data.execution_trace.length),
            status: s.error ? "failed" : "done",
          }));
          result = {
            ...visuals,
            id,
            query: text,
            answer: data.result,
            trace,
            totalMs: Math.round(performance.now() - t0),
            models: ["satquery-backend@live"],
          };
        } catch (err) {
          note = `Live API unreachable (${err instanceof Error ? err.message : "error"}) — answered with the offline engine.`;
        }
      }
      if (!result) result = await runDemo(id, text);
      if (!result) return;
      const r = result;
      setThread((t) => t.map((it) => (it.id === id ? { ...it, status: "done", result: r, steps: r.trace, note } : it)));
      applyResult(r);
    },
    [query, images, running, engine, runDemo, applyResult],
  );

  // ─── deep links: /analysis?scene=nmia&q=...&run=1 ───
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const scene = p.get("scene") as ScenarioId | null;
    const q = p.get("q");
    if (q) queueMicrotask(() => setQuery(q));
    if (scene && SCENARIOS.some((s) => s.id === scene)) {
      if (q && p.get("run") === "1") pending.current = q;
      queueMicrotask(() => loadScenario(scene));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (pending.current && images.length && !Object.values(loading).some(Boolean)) {
      const q = pending.current;
      pending.current = null;
      setTimeout(() => submit(q), 1200);
    }
  }, [images, loading, submit]);

  // ─── exports ───
  const onExport = useCallback(
    async (itemId: string, kind: "pdf" | "geojson" | "json") => {
      const r = thread.find((t) => t.id === itemId)?.result;
      if (!r) return;
      if (kind === "json") return exportJson(r, images, compat);
      if (kind === "geojson") return exportGeoJson(r);
      setExporting(`${itemId}:pdf`);
      try {
        const snapBase = (r.base && baseLayers.find((b) => b.id === r.base)) || baseLayers.find((b) => b.frame === "B" && r.task.startsWith("change")) || base;
        const snap = snapBase
          ? await composeEvidenceImage({
              baseUrl: snapBase.url,
              overlays: r.overlays.filter((o) => def(o)).map((o) => ({ url: filtered[o] ?? def(o)!.url, opacity: overlayState[o]?.opacity ?? def(o)!.opacity })),
              evidence: r.evidence,
            })
          : null;
        await exportPdf(r, images, snap);
      } finally {
        setExporting(null);
      }
    },
    [thread, images, compat, baseLayers, base, filtered, overlayState, def],
  );

  const suggestions = scenarioId ? SUGGESTIONS[scenarioId] : [];
  const sceneLabel = pickedScene ? SCENARIOS.find((s) => s.id === pickedScene)?.title ?? null : images.map((i) => i.meta.name).join(" + ") || null;

  return (
    <>
    <div className="flex min-h-screen items-center justify-center px-6 text-center lg:hidden" style={{ paddingTop: "var(--nav-h)" }}>
      <div className="max-w-sm">
        <p className="text-[16px] font-semibold text-ink">The analysis console needs a wider screen</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">It shows inputs, the image or map, and the agent side by side. Open it on a screen at least 1024 px wide.</p>
      </div>
    </div>
    <div className="hidden h-[calc(100vh-var(--nav-h))] grid-cols-[clamp(268px,19vw,320px)_minmax(0,1fr)_clamp(340px,25vw,420px)] overflow-hidden lg:grid" style={{ marginTop: "var(--nav-h)" }}>
      <InputRail
        mode={railMode}
        modeLocked={images.length === 2 && !!compat?.inferredMode}
        onMode={setModePref}
        images={images}
        loading={loading}
        compat={compat}
        activeScenario={pickedScene}
        onScenario={loadScenario}
        onFile={onFile}
        onClear={onClear}
      />
      <Canvas
        views={views}
        view={view}
        onView={setView}
        model={model}
        charts={charts}
        hover={hover}
        layersOpen={layersOpen}
        onLayers={setLayersOpen}
        sceneLabel={sceneLabel}
        layerProps={{
          baseLayers,
          baseId: base?.id ?? null,
          onBase: setBaseId,
          overlays,
          onToggle: (id) => setOverlayState((s) => ({ ...s, [id]: { ...(s[id] ?? { opacity: def(id)?.opacity ?? 0.55, hidden: [] }), visible: !(s[id]?.visible ?? false) } })),
          onOpacity: (id, v) => setOverlayState((s) => ({ ...s, [id]: { ...(s[id] ?? { visible: true, hidden: [] }), opacity: v } })),
          onClassToggle: (id, cls) =>
            setOverlayState((s) => {
              const cur = s[id] ?? { visible: true, opacity: def(id)?.opacity ?? 0.55, hidden: [] };
              const hidden = cur.hidden.includes(cls) ? cur.hidden.filter((c) => c !== cls) : [...cur.hidden, cls];
              return { ...s, [id]: { ...cur, hidden } };
            }),
          evidenceOn,
          evidenceCount: activeResult?.evidence.length ?? 0,
          onEvidence: () => setEvidenceOn((v) => !v),
          mapControls: view === "map" || view === "split",
          basemap,
          onBasemap: setBasemap,
          mapImageOpacity,
          onMapImageOpacity: setMapImageOpacity,
        }}
      />
      <AgentPanel
        thread={thread}
        activeId={activeItem}
        onActivate={(id) => {
          setActiveItem(id);
          const r = thread.find((t) => t.id === id)?.result;
          if (r) applyResult(r);
        }}
        activeEvidence={activeEvidence}
        onSelectEvidence={(itemId, evId) => {
          const r = thread.find((t) => t.id === itemId)?.result ?? null;
          if (itemId !== activeItem && r) {
            setActiveItem(itemId);
            applyResult({ ...r, focus: undefined });
          }
          selectEvidence(evId, r);
        }}
        onExport={onExport}
        onTyped={(id) => setThread((t) => t.map((it) => (it.id === id ? { ...it, fresh: false } : it)))}
        query={query}
        setQuery={setQuery}
        onSubmit={() => submit()}
        canRun={!!query.trim() && images.length > 0 && !running && !Object.values(loading).some(Boolean)}
        running={running}
        suggestions={suggestions}
        hasImages={images.length > 0}
        engine={engine}
        liveAvailable={!!API}
        onEngine={setEngine}
        exporting={exporting}
      />
    </div>
    </>
  );
}
