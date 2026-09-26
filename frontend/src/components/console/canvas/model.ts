import type { BaseLayer, RasterOverlay } from "@/lib/demo/layers";
import type { Basemap } from "@/components/map/MapView";
import type { EvidenceItem, LoadedImage, LonLat, Mode, ScenarioId } from "@/lib/types";
import type { FocusRequest } from "../viewer/ZoomPane";

export interface OverlayState {
  visible: boolean;
  opacity: number;
  hidden: number[];
}

export interface ActiveOverlay extends RasterOverlay {
  state: OverlayState;
  src: string;
}

export interface HoverInfo {
  source: "image" | "map";
  x?: number;
  y?: number;
  lonlat?: LonLat;
  frame?: "A" | "B";
}

export type Corners = [LonLat, LonLat, LonLat, LonLat];

export interface StageModel {
  scenarioId: ScenarioId;
  mode: Mode;
  images: LoadedImage[];
  dims: { width: number; height: number };
  corners: Corners | null;
  base: BaseLayer | null;
  baseLayers: BaseLayer[];
  overlays: ActiveOverlay[];
  evidence: EvidenceItem[];
  activeEvidence: string | null;
  onSelectEvidence: (id: string) => void;
  focus: FocusRequest | null;
  mapFit: { bbox: [number, number, number, number]; nonce: number; maxZoom?: number; duration?: number } | null;
  running: { title: string } | null;
  onHover: (h: HoverInfo | null) => void;
  basemap: Basemap;
  mapImageOpacity: number;
  fitKey: string;
}
