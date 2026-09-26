export interface ToolSpec {
  id: string;
  version: string;
  name: string;
  role: "guardrail" | "controller" | "vlm" | "specialist" | "fusion" | "output";
  method: string;
  tasks: string[];
  inputs: string;
  /** The only parameters the controller is allowed to set, with their permitted range. */
  params: { name: string; range: string; default: string }[];
}

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    id: "geo-validator",
    version: "1.2.0",
    name: "Input validator",
    role: "guardrail",
    method: "GDAL/rasterio metadata checks: format, CRS, bands, grid, acquisition time, footprint IoU, co-registration",
    tasks: ["all"],
    inputs: "GeoTIFF / TIFF · PNG / JPEG (benchmarks only)",
    params: [
      { name: "min_overlap_iou", range: "0.50 – 1.00", default: "0.95" },
      { name: "max_crossmodal_gap_h", range: "1 – 288", default: "72" },
    ],
  },
  {
    id: "agent-controller",
    version: "1.1.0",
    name: "Agent controller",
    role: "controller",
    method: "LangGraph state machine: intent classification (keyword prior + LLM, JSON schema) → tool DAG planning → evidence aggregation and confidence calibration",
    tasks: ["all"],
    inputs: "Natural-language query + validated input manifest",
    params: [
      { name: "min_intent_confidence", range: "0.30 – 0.90", default: "0.55" },
      { name: "abstain_below", range: "0.40 – 0.80", default: "0.60" },
    ],
  },
  {
    id: "satquery-vlm",
    version: "1.2.0",
    name: "SatQuery-VLM",
    role: "vlm",
    method: "Qwen2-VL-2B-Instruct + remote-sensing LoRA (r = 16, α = 32, q/k/v/o) adapted on BigEarthNet.txt",
    tasks: ["captioning", "vqa", "answer synthesis"],
    inputs: "RGB / false-colour render + evidence JSON",
    params: [
      { name: "temperature", range: "0.0 – 0.7", default: "0.2" },
      { name: "max_new_tokens", range: "64 – 512", default: "320" },
      { name: "image_size", range: "448 | 672", default: "672" },
    ],
  },
  {
    id: "rs-grounder",
    version: "0.9.0",
    name: "Text-guided grounder",
    role: "specialist",
    method: "Open-vocabulary detector + mask refinement, adapted on VRSBench grounding",
    tasks: ["grounding"],
    inputs: "Optical or SAR render + referring expression",
    params: [
      { name: "box_threshold", range: "0.20 – 0.60", default: "0.35" },
      { name: "top_k", range: "1 – 10", default: "3" },
      { name: "refine", range: "spectral | sar | none", default: "spectral" },
    ],
  },
  {
    id: "spectral-indices",
    version: "1.0.0",
    name: "Spectral index engine",
    role: "specialist",
    method: "NDVI · NDWI · MNDWI · NDBI + rule-based land cover, connected-component sieve",
    tasks: ["land cover", "evidence"],
    inputs: "Multispectral reflectance (B02–B12)",
    params: [
      { name: "veg_ndvi", range: "0.20 – 0.50", default: "0.33" },
      { name: "water_mndwi", range: "−0.10 – 0.30", default: "0.00" },
      { name: "sieve_px", range: "0 – 64", default: "12" },
    ],
  },
  {
    id: "sar-segmenter",
    version: "1.1.0",
    name: "SAR segmenter",
    role: "specialist",
    method: "γ⁰ VV/VH (dB) thresholding with Otsu water split + double-bounce built-up test",
    tasks: ["SAR water", "SAR built-up"],
    inputs: "Sentinel-1 / RISAT C-band GRD or RTC",
    params: [
      { name: "water_threshold_db", range: "otsu | −25 – −10", default: "otsu" },
      { name: "builtup_threshold_db", range: "−8 – 0", default: "−4" },
    ],
  },
  {
    id: "sar-point-detector",
    version: "0.7.0",
    name: "SAR point-target detector",
    role: "specialist",
    method: "CFAR-style bright-target test inside the water mask (vessels, buoys)",
    tasks: ["vessel detection"],
    inputs: "VV backscatter + water mask",
    params: [
      { name: "min_vv_db", range: "−5 – +10", default: "−2" },
      { name: "max_target_px", range: "10 – 100", default: "60" },
    ],
  },
  {
    id: "optsar-fusion",
    version: "1.0.0",
    name: "Optical–SAR fusion",
    role: "fusion",
    method: "Evidence-level late fusion of optical indices and SAR backscatter + disagreement analysis",
    tasks: ["cross-modal extraction", "cross-modal VQA"],
    inputs: "Co-registered optical + SAR pair",
    params: [
      { name: "ruleset", range: "rs-fusion-v1", default: "rs-fusion-v1" },
      { name: "min_agreement", range: "0.0 – 1.0", default: "0.5" },
    ],
  },
  {
    id: "change-detector",
    version: "1.0.0",
    name: "Change detector",
    role: "specialist",
    method: "Post-classification comparison + change-vector analysis (NDVI, MNDWI, NDBI, brightness)",
    tasks: ["change map", "change description"],
    inputs: "Co-registered bi-temporal pair",
    params: [
      { name: "cva_threshold", range: "0.05 – 0.30", default: "0.12" },
      { name: "min_region_px", range: "10 – 500", default: "25" },
    ],
  },
  {
    id: "cd-vqa",
    version: "0.8.0",
    name: "Change-VQA head",
    role: "vlm",
    method: "SatQuery-VLM prompted with the change map + transition statistics (CDVQA-style)",
    tasks: ["change VQA"],
    inputs: "Change map + class statistics",
    params: [
      { name: "temperature", range: "0.0 – 0.5", default: "0.1" },
      { name: "max_new_tokens", range: "64 – 384", default: "256" },
    ],
  },
  {
    id: "timeseries-profiler",
    version: "0.9.0",
    name: "Time-series profiler",
    role: "specialist",
    method: "Per-epoch land-cover shares inside a footprint (same season, same MGRS tile)",
    tasks: ["trend"],
    inputs: "Up to 12 epochs of the same tile",
    params: [
      { name: "season", range: "any month window", default: "Jan–Feb" },
      { name: "max_epochs", range: "2 – 12", default: "10" },
    ],
  },
  {
    id: "report-builder",
    version: "1.0.0",
    name: "Report builder",
    role: "output",
    method: "PDF report · GeoJSON evidence · JSON execution trace",
    tasks: ["export"],
    inputs: "Agent result",
    params: [{ name: "formats", range: "pdf, geojson, json", default: "pdf, geojson, json" }],
  },
];

export const TOOL_BY_ID = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.id, t]));
