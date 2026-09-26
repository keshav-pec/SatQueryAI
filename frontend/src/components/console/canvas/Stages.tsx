"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, ScanSearch } from "lucide-react";
import { MapView, type MapFootprint, type MapImageLayer, type MapLine, type MapMarker } from "@/components/map/MapView";
import { haversineKm } from "@/lib/geo/proj";
import { CHART_REGISTRY, FootprintTimeSeries } from "@/components/charts/Charts";
import { useSize } from "@/components/charts/kit";
import { NMIA } from "@/lib/demo/data";
import { CLASS_META, HIGHLIGHT } from "@/lib/palette";
import type { EvidenceItem, LonLat } from "@/lib/types";
import { EvidenceLabels, EvidenceSvg } from "../viewer/EvidenceLayer";
import { ZoomPane, type ViewState } from "../viewer/ZoomPane";
import type { ActiveOverlay, Corners, StageModel } from "./model";

const imgStyle = (scale: number): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  imageRendering: scale > 2.2 ? "pixelated" : "auto",
  userSelect: "none",
  pointerEvents: "none",
});

export function ScanOverlay({ title }: { title: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div className="absolute inset-0 bg-cyan/[0.03]" />
      <div className="absolute inset-x-0 top-0 h-1/3 animate-scan" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(59,213,255,0.10) 70%, rgba(59,213,255,0.55) 100%)", borderBottom: "1px solid rgba(139,232,255,0.9)" }} />
      <div className="glass absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-1.5 shadow-xl">
        <span className="dot live-dot bg-cyan text-cyan" />
        <span className="text-[12.5px] font-medium text-ink">{title}</span>
      </div>
    </div>
  );
}

export function EmptyStage({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line-2 bg-panel text-ink-3">{icon ?? <ScanSearch size={20} />}</div>
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{body}</p>
      </div>
    </div>
  );
}

function Overlays({ overlays, frame, scale }: { overlays: ActiveOverlay[]; frame?: "A" | "B"; scale: number }) {
  return (
    <>
      {overlays
        .filter((o) => o.state.visible && (!frame || o.frame === frame))
        .map((o) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={o.id} src={o.src} alt="" draggable={false} style={{ ...imgStyle(scale), opacity: o.state.opacity }} />
        ))}
    </>
  );
}

// ─── Image ────────────────────────────────────────────────────────────────

export function ImageStage({ m }: { m: StageModel }) {
  if (!m.base) return <EmptyStage title="No image loaded" body="Pick a test scene on the left or drop a GeoTIFF to start." />;
  const base = m.base;
  return (
    <ZoomPane
      width={m.dims.width}
      height={m.dims.height}
      focus={m.focus}
      fitKey={m.fitKey}
      className="h-full w-full bg-[#04070d]"
      onHover={(p) => m.onHover(p ? { source: "image", x: p.x, y: p.y, frame: base.frame } : null)}
      overlay={(v) => (m.evidence.length ? <EvidenceLabels items={m.evidence} view={v} activeId={m.activeEvidence} onSelect={m.onSelectEvidence} /> : null)}
    >
      {(v) => (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={base.url} alt={base.label} draggable={false} style={imgStyle(v.scale)} />
          <Overlays overlays={m.overlays} scale={v.scale} />
          <EvidenceSvg items={m.evidence} width={m.dims.width} height={m.dims.height} scale={v.scale} activeId={m.activeEvidence} onSelect={m.onSelectEvidence} />
        </>
      )}
    </ZoomPane>
  );
}

// ─── Map ──────────────────────────────────────────────────────────────────

export function MapStage({ m }: { m: StageModel }) {
  const footprints: MapFootprint[] = useMemo(
    () =>
      m.images
        .filter((i) => i.meta.corners)
        .map((i) => ({ id: i.id, corners: i.meta.corners as Corners, label: `${i.slot} · ${i.meta.name}`, color: i.slot === "A" ? "#3bd5ff" : "#ff9933" })),
    [m.images],
  );
  const images: MapImageLayer[] = useMemo(() => {
    const out: MapImageLayer[] = [];
    const coRegistered = m.scenarioId !== "mismatch" && m.scenarioId !== "generic";
    if (coRegistered && m.base && m.corners) {
      out.push({ id: "base", url: m.base.url, corners: m.corners, opacity: m.mapImageOpacity, visible: m.mapImageOpacity > 0.01 });
      for (const o of m.overlays) out.push({ id: o.id, url: o.src, corners: m.corners, opacity: o.state.opacity, visible: o.state.visible });
    } else {
      for (const i of m.images) {
        if (i.meta.corners && i.previewUrl) out.push({ id: `file-${i.slot}`, url: i.previewUrl, corners: i.meta.corners as Corners, opacity: m.mapImageOpacity, visible: m.mapImageOpacity > 0.01 });
      }
    }
    return out;
  }, [m.base, m.corners, m.overlays, m.images, m.mapImageOpacity, m.scenarioId]);

  // For pairs that do not overlap, show where each image actually is and how far apart they are
  const apart = m.scenarioId === "mismatch" || m.scenarioId === "generic";
  const markers: MapMarker[] = useMemo(() => {
    const centers = m.images.filter((i) => i.meta.center);
    return apart && centers.length === 2 ? centers.map((i) => ({ id: i.id, lonlat: i.meta.center!, label: `${i.slot} · ${i.meta.sensor}`, sublabel: i.meta.name })) : [];
  }, [apart, m.images]);
  const lines: MapLine[] = useMemo(() => {
    const centers = m.images.filter((i) => i.meta.center);
    if (!apart || centers.length !== 2) return [];
    const km = haversineKm(centers[0].meta.center!, centers[1].meta.center!);
    if (km < 5) return [];
    return [{ id: "gap", coords: [centers[0].meta.center!, centers[1].meta.center!], label: `${Math.round(km)} km apart · no overlap` }];
  }, [apart, m.images]);

  return (
    <div className="relative h-full w-full">
      <MapView
        footprints={footprints}
        markers={markers}
        lines={lines}
        images={images}
        evidence={m.evidence}
        activeId={m.activeEvidence}
        onSelect={m.onSelectEvidence}
        fitTo={m.mapFit}
        basemap={m.basemap}
        onHover={(ll) => m.onHover(ll ? { source: "map", lonlat: ll } : null)}
      />
    </div>
  );
}

// ─── Split: input image | real map ────────────────────────────────────────

export function SplitStage({ m }: { m: StageModel }) {
  return (
    <div className="grid h-full w-full grid-cols-2 gap-px bg-line">
      <div className="relative min-w-0 bg-bg">
        <span className="glass pointer-events-none absolute left-3 top-3 z-10 rounded-md px-2 py-1 text-[11px] font-semibold text-ink-2">INPUT IMAGE · pixel space</span>
        <ImageStage m={m} />
      </div>
      <div className="relative min-w-0 bg-bg">
        <span className="glass pointer-events-none absolute left-3 top-3 z-10 rounded-md px-2 py-1 text-[11px] font-semibold text-ink-2">REAL MAP · georeferenced</span>
        <MapStage m={m} />
      </div>
    </div>
  );
}

// ─── Bi-temporal swipe compare ────────────────────────────────────────────

export function CompareStage({ m }: { m: StageModel }) {
  const [view, setView] = useState<ViewState | null>(null);
  const [split, setSplit] = useState(0.5);
  const { ref: box, w: W } = useSize<HTMLDivElement>();
  const dragging = useRef(false);
  const fc = m.base?.id.endsWith("_fc");
  const left = m.baseLayers.find((b) => b.frame === "A" && (fc ? b.id.endsWith("_fc") : !b.id.endsWith("_fc"))) ?? m.baseLayers.find((b) => b.frame === "A");
  const right = m.baseLayers.find((b) => b.frame === "B" && (fc ? b.id.endsWith("_fc") : !b.id.endsWith("_fc"))) ?? m.baseLayers.find((b) => b.frame === "B");
  const dateA = m.images.find((i) => i.slot === "A")?.meta.acquired?.slice(0, 10) ?? "T1";
  const dateB = m.images.find((i) => i.slot === "B")?.meta.acquired?.slice(0, 10) ?? "T2";

  useEffect(() => {
    const up = () => (dragging.current = false);
    const move = (e: PointerEvent) => {
      if (!dragging.current || !box.current) return;
      const r = box.current.getBoundingClientRect();
      setSplit(Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width)));
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", move);
    };
  }, [box]);

  if (!left || !right) return <EmptyStage title="Two dates needed" body="Load a bi-temporal pair to compare them." />;
  return (
    <div ref={box} className="relative h-full w-full">
      <ZoomPane
        width={m.dims.width}
        height={m.dims.height}
        view={view}
        onView={setView}
        focus={m.focus}
        fitKey={m.fitKey}
        className="h-full w-full bg-[#04070d]"
        onHover={(p) => m.onHover(p ? { source: "image", x: p.x, y: p.y, frame: view && p.x * view.scale + view.tx > split * W ? "B" : "A" } : null)}
        overlay={(v) => (m.evidence.length ? <EvidenceLabels items={m.evidence} view={v} activeId={m.activeEvidence} onSelect={m.onSelectEvidence} /> : null)}
      >
        {(v) => {
          const clipX = Math.max(0, (split * W - v.tx) / v.scale);
          return (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={left.url} alt={left.label} draggable={false} style={imgStyle(v.scale)} />
              <Overlays overlays={m.overlays} frame="A" scale={v.scale} />
              <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${clipX}px)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={right.url} alt={right.label} draggable={false} style={imgStyle(v.scale)} />
                <Overlays overlays={m.overlays} frame="B" scale={v.scale} />
              </div>
              <EvidenceSvg items={m.evidence} width={m.dims.width} height={m.dims.height} scale={v.scale} activeId={m.activeEvidence} onSelect={m.onSelectEvidence} />
            </>
          );
        }}
      </ZoomPane>
      <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${split * 100}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)]" />
        <button
          data-no-pan
          type="button"
          aria-label="Drag to compare"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragging.current = true;
          }}
          className="pointer-events-auto absolute top-1/2 -ml-5 flex h-10 w-10 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/70 bg-bg/90 text-ink shadow-xl"
        >
          <span className="text-[13px]">⟷</span>
        </button>
      </div>
      <span className="glass pointer-events-none absolute left-3 top-3 z-10 rounded-md px-2.5 py-1 text-[12px] font-semibold text-ink">T1 · {dateA}</span>
      <span className="glass pointer-events-none absolute right-3 top-3 z-10 rounded-md px-2.5 py-1 text-[12px] font-semibold text-ink">T2 · {dateB}</span>
    </div>
  );
}

// ─── Year-by-year timeline (bi-temporal scene) ────────────────────────────

export function TimelineStage({ m }: { m: StageModel }) {
  const ts = NMIA.timeseries;
  const [year, setYear] = useState(ts[ts.length - 1].year);
  const [playing, setPlaying] = useState(false);
  const fp = NMIA.footprint;
  const outline: EvidenceItem[] = useMemo(
    () =>
      fp
        ? [
            {
              id: "timeline-fp",
              kind: "polygon",
              label: "Airport platform",
              detail: "",
              confidence: 0.95,
              pixel: fp.pixel,
              bboxPx: fp.bbox_px as [number, number, number, number],
              lonlat: fp.lonlat as LonLat[],
              color: HIGHLIGHT,
            },
          ]
        : [],
    [fp],
  );
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setYear((y) => {
        const i = ts.findIndex((t) => t.year === y);
        return ts[(i + 1) % ts.length].year;
      });
    }, 1100);
    return () => clearInterval(id);
  }, [playing, ts]);
  const cur = ts.find((t) => t.year === year) ?? ts[0];
  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <ZoomPane width={m.dims.width} height={m.dims.height} fitKey={m.fitKey} className="h-full w-full bg-[#04070d]" onHover={(p) => m.onHover(p ? { source: "image", x: p.x, y: p.y, frame: "B" } : null)}>
          {(v) => (
            <>
              {ts.map((t) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={t.year} src={t.image} alt={`${t.year}`} draggable={false} style={{ ...imgStyle(v.scale), opacity: t.year === year ? 1 : 0, transition: "opacity 0.45s ease" }} />
              ))}
              <EvidenceSvg items={outline} width={m.dims.width} height={m.dims.height} scale={v.scale} />
            </>
          )}
        </ZoomPane>
        <div className="glass pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-2">
          <p className="display text-[26px] font-semibold leading-none text-ink">{cur.year}</p>
          <p className="mt-1 mono text-[10.5px] text-ink-3">Sentinel-2 L2A · {cur.date}</p>
        </div>
        <div className="glass pointer-events-none absolute right-3 top-3 space-y-1 rounded-lg px-3 py-2 text-[11.5px]">
          <p className="text-ink-3">Inside platform</p>
          <p className="text-ink">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px]" style={{ background: CLASS_META.vegetation.color }} />
            Vegetation <b className="tnum">{(cur.footprint_vegetation_pct ?? 0).toFixed(1)} %</b>
          </p>
          <p className="text-ink">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px]" style={{ background: CLASS_META.water.color }} />
            Water <b className="tnum">{(cur.footprint_water_pct ?? 0).toFixed(1)} %</b>
          </p>
          <p className="text-ink">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px]" style={{ background: CLASS_META.builtup.color }} />
            Developed <b className="tnum">{(cur.footprint_developed_pct ?? 0).toFixed(1)} %</b>
          </p>
        </div>
      </div>
      <div className="border-t border-line bg-panel px-4 pb-3 pt-2.5">
        <div className="mb-2 flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <div className="flex flex-1 items-center gap-1">
            {ts.map((t) => (
              <button
                key={t.year}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setYear(t.year);
                }}
                className={`flex-1 rounded-md py-1 text-[12px] font-semibold tnum transition-colors ${t.year === year ? "bg-saffron text-[#1b0f00]" : "bg-white/[0.04] text-ink-2 hover:bg-white/[0.08]"}`}
              >
                {t.year}
              </button>
            ))}
          </div>
        </div>
        <FootprintTimeSeries compact year={year} onYear={(y) => { setPlaying(false); setYear(y); }} />
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────

export function AnalyticsStage({ charts }: { charts: string[] }) {
  if (!charts.length) return <EmptyStage title="No analytics yet" body="Ask a question — the agent attaches the charts that support its answer here." />;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {charts.map((id) => {
          const c = CHART_REGISTRY[id];
          if (!c) return null;
          return (
            <div key={id} className={c.wide ? "xl:col-span-2" : ""}>
              {c.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
