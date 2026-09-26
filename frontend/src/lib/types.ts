export type Mode = "single" | "cross_modal" | "bitemporal";
export type Modality = "optical" | "sar" | "unknown";
export type FileFormat = "GeoTIFF" | "TIFF" | "PNG" | "JPEG" | "Unsupported";
export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type LonLat = [number, number];

export interface RasterMeta {
  name: string;
  bytes: number;
  format: FileFormat;
  width: number;
  height: number;
  bands: number;
  dtype: string;
  compression: string;
  georeferenced: boolean;
  epsg: number | null;
  crsName: string;
  resolution: [number, number] | null;
  /** Projected bounds [minx, miny, maxx, maxy] in the file CRS. */
  bounds: [number, number, number, number] | null;
  /** TL, TR, BR, BL corners in lon/lat. */
  corners: [LonLat, LonLat, LonLat, LonLat] | null;
  center: LonLat | null;
  modality: Modality;
  sensor: string;
  platform: string;
  productType: string;
  acquired: string | null;
  bandNames: string[];
  nodata: number | null;
  nodataPct: number | null;
  cloudCover: number | null;
  tags: Record<string, string>;
  /** Set when a CRS is declared but the geotransform is not plausible for it. */
  geoIssue: string | null;
}

export interface DecodedRaster {
  width: number;
  height: number;
  bands: (Float32Array | Uint16Array | Uint8Array | Int16Array | Float64Array | Int32Array | Uint32Array | Int8Array)[];
}

export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface LoadedImage {
  id: string;
  slot: "A" | "B";
  file: File;
  meta: RasterMeta;
  checks: ValidationCheck[];
  previewUrl: string;
  /** Matches a bundled test sample, if any. */
  sampleKey: SampleKey | null;
  raster: DecodedRaster | null;
}

export interface CompatibilityReport {
  status: "ok" | "warn" | "fail";
  inferredMode: Mode | null;
  checks: ValidationCheck[];
  iou: number | null;
  distanceKm: number | null;
  temporalGapHours: number | null;
  summary: string;
}

export type SampleKey = "hyd-s2" | "mum-s2" | "mum-s1" | "nmia-t1" | "nmia-t2";

export type ScenarioId = "hyd" | "mum-opt" | "mum-sar" | "mum-fusion" | "nmia" | "nmia-single" | "mismatch" | "generic";

export type TaskType =
  | "captioning"
  | "vqa"
  | "grounding"
  | "change_description"
  | "change_vqa"
  | "timeseries"
  | "fusion_extraction"
  | "fusion_vqa"
  | "rejected";

export type ViewId = "image" | "map" | "split" | "compare" | "fusion" | "timeline" | "analytics";

export interface ToolCall {
  tool: string;
  version: string;
  title: string;
  stage: TraceStage;
  params: Record<string, string | number | boolean | string[]>;
  output: string;
  ms: number;
}

export type TraceStage = "validate" | "route" | "plan" | "execute" | "fuse" | "synthesize" | "report";

export interface TraceStep extends ToolCall {
  id: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  startedAt?: number;
}

export interface EvidenceItem {
  id: string;
  kind: "polygon" | "box" | "points" | "raster";
  label: string;
  detail: string;
  confidence: number;
  /** Image-pixel geometry (for the image viewer). Polygon ring or [x0,y0,x1,y1]. */
  pixel?: number[][] | [number, number, number, number];
  holes?: number[][][];
  points?: { px: [number, number]; lonlat: LonLat; label?: string }[];
  /** Lon/lat ring for the map. */
  lonlat?: LonLat[];
  bboxPx?: [number, number, number, number];
  color?: string;
  stats?: { label: string; value: string }[];
  /** Which image (A = first/T1, B = second/T2) the pixel geometry refers to. */
  frame?: "A" | "B";
}

export interface OverlayLayer {
  id: string;
  label: string;
  url: string;
  opacity: number;
  visible: boolean;
  blend?: "normal" | "screen";
  legend?: { label: string; color: string }[];
}

export interface ChartRef {
  id: string;
}

export interface AgentResult {
  id: string;
  query: string;
  scenarioId: ScenarioId;
  task: TaskType;
  taskLabel: string;
  intentConfidence: number;
  confidence: number;
  confidenceParts: { label: string; value: number }[];
  answer: string;
  highlights: string[];
  evidence: EvidenceItem[];
  overlays: string[];
  charts: string[];
  view: ViewId;
  trace: TraceStep[];
  totalMs: number;
  createdAt: string;
  models: string[];
  /** Overlays produced at run time (e.g. in-browser analysis of an uploaded scene). */
  extraOverlays?: { id: string; label: string; url: string; frame: "A" | "B"; opacity: number; classCoded?: boolean; legend: { label: string; color: string; classId?: number }[] }[];
  /** Base layer to switch the viewer to, and evidence item to focus. */
  base?: string;
  focus?: string;
  error?: { code: string; message: string };
}

export interface AgentEvent {
  type: "step" | "result";
  step?: TraceStep;
  result?: AgentResult;
}
