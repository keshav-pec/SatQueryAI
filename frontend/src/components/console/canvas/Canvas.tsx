"use client";

import { ChartColumn, Columns2, GitCompareArrows, Globe2, History, Image as ImageIcon, Layers, Radar } from "lucide-react";
import type { LoadedImage, ViewId } from "@/lib/types";
import { pixelToLonLat } from "@/lib/geo/proj";
import { probeImage } from "@/lib/geo/probe";
import { latlon } from "@/lib/format";
import { LayerPanel } from "./LayerPanel";
import type { HoverInfo, StageModel } from "./model";
import { AnalyticsStage, CompareStage, EmptyStage, ImageStage, MapStage, ScanOverlay, SplitStage, TimelineStage } from "./Stages";
import { FusionStage } from "./FusionStage";

export const VIEW_META: Record<ViewId, { label: string; icon: React.ReactNode }> = {
  image: { label: "Image", icon: <ImageIcon size={14} /> },
  split: { label: "Image + Map", icon: <Columns2 size={14} /> },
  map: { label: "Map", icon: <Globe2 size={14} /> },
  compare: { label: "Compare", icon: <GitCompareArrows size={14} /> },
  fusion: { label: "Fusion", icon: <Radar size={14} /> },
  timeline: { label: "Timeline", icon: <History size={14} /> },
  analytics: { label: "Analytics", icon: <ChartColumn size={14} /> },
};

type LayerProps = Omit<React.ComponentProps<typeof LayerPanel>, "onClose">;

interface Props {
  views: ViewId[];
  view: ViewId;
  onView: (v: ViewId) => void;
  model: StageModel;
  charts: string[];
  hover: HoverInfo | null;
  layersOpen: boolean;
  onLayers: (open: boolean) => void;
  layerProps: LayerProps;
  sceneLabel: string | null;
}

function StatusBar({ hover, model }: { hover: HoverInfo | null; model: StageModel }) {
  const base = model.base;
  const img: LoadedImage | undefined = hover?.frame ? model.images.find((i) => i.slot === hover.frame) ?? model.images[0] : model.images[0];
  let coords: string | null = null;
  let px: string | null = null;
  let probe: { label: string; value: string }[] | null = null;
  if (hover?.source === "image" && hover.x !== undefined && hover.y !== undefined) {
    px = `px ${Math.floor(hover.x)}, ${Math.floor(hover.y)}`;
    const corners = model.corners ?? (img?.meta.corners ?? null);
    if (corners) coords = latlon(pixelToLonLat(corners, model.dims.width, model.dims.height, hover.x, hover.y));
    const probeImg = model.scenarioId === "mum-fusion" ? model.images.find((i) => (hover.frame === "B" ? i.meta.modality === "sar" : i.meta.modality === "optical")) : img;
    probe = probeImage(probeImg, hover.x, hover.y);
  } else if (hover?.source === "map" && hover.lonlat) {
    coords = latlon(hover.lonlat, 5);
  }
  const meta = model.images[0]?.meta;
  return (
    <div className="flex h-8 shrink-0 items-center gap-4 border-t border-line bg-bg-2 px-3 mono text-[11px] text-ink-3">
      {px && <span>{px}</span>}
      {coords ? <span className="text-ink-2">{coords}</span> : <span>Hover the image or map for coordinates</span>}
      {probe && (
        <span className="flex items-center gap-3">
          {probe.map((p) => (
            <span key={p.label}>
              {p.label} <span className="text-ink">{p.value}</span>
            </span>
          ))}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3">
        {meta?.epsg && <span>EPSG:{meta.epsg}</span>}
        {meta?.resolution && <span>{meta.resolution[0]} m</span>}
        {base && <span className="max-w-[260px] truncate">{base.label}</span>}
      </span>
    </div>
  );
}

export function Canvas({ views, view, onView, model, charts, hover, layersOpen, onLayers, layerProps, sceneLabel }: Props) {
  const empty = model.images.length === 0;
  const imageLike = ["image", "split", "compare", "fusion", "timeline"].includes(view);
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
        <div className="segmented overflow-x-auto">
          {views.map((v) => (
            <button key={v} type="button" data-active={view === v} onClick={() => onView(v)} disabled={empty}>
              {VIEW_META[v].icon}
              {VIEW_META[v].label}
            </button>
          ))}
        </div>
        {sceneLabel && <span className="hidden truncate text-[12px] text-ink-3 xl:inline">{sceneLabel}</span>}
        <div className="ml-auto flex items-center gap-2">
          {model.running && (
            <span className="badge badge-cyan">
              <span className="dot live-dot bg-cyan text-cyan" /> agent running
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-sm" data-active={layersOpen} onClick={() => onLayers(!layersOpen)} disabled={empty || view === "analytics"}>
            <Layers size={14} /> Layers
            {layerProps.overlays.filter((o) => o.state.visible).length > 0 && <span className="badge badge-cyan !h-[18px] !px-1.5">{layerProps.overlays.filter((o) => o.state.visible).length}</span>}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {empty ? (
          <div className="bg-grid h-full">
            <EmptyStage title="Load a scene to begin" body="Choose one of the real Sentinel-1/2 test scenes on the left, or drop your own GeoTIFF. Every input is validated before any model runs." />
          </div>
        ) : (
          <>
            {view === "image" && <ImageStage m={model} />}
            {view === "map" && <MapStage m={model} />}
            {view === "split" && <SplitStage m={model} />}
            {view === "compare" && <CompareStage m={model} />}
            {view === "fusion" && <FusionStage m={model} />}
            {view === "timeline" && <TimelineStage m={model} />}
            {view === "analytics" && <AnalyticsStage charts={charts} />}
            {model.running && imageLike && <ScanOverlay title={model.running.title} />}
          </>
        )}
        {layersOpen && !empty && view !== "analytics" && <LayerPanel {...layerProps} onClose={() => onLayers(false)} />}
      </div>

      {!empty && view !== "analytics" && <StatusBar hover={hover} model={model} />}
    </section>
  );
}
