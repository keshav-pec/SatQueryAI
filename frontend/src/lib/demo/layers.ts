import { CLASS_META, EMPHASIS } from "@/lib/palette";
import { HYD, MUM, NMIA } from "./data";

export interface BaseLayer {
  id: string;
  label: string;
  url: string;
  frame: "A" | "B";
}

export interface RasterOverlay {
  id: string;
  label: string;
  url: string;
  frame: "A" | "B";
  opacity: number;
  /** Class-coded PNG whose classes can be toggled from the legend. */
  classCoded?: boolean;
  legend: { label: string; color: string; classId?: number }[];
}

const CLASS_LEGEND = (Object.values(CLASS_META) as { id: number; label: string; color: string }[]).map((c) => ({
  label: c.label,
  color: c.color,
  classId: c.id,
}));

export const BASE_LAYERS: Record<string, BaseLayer[]> = {
  hyd: [
    { id: "hyd:truecolor", label: "True colour (B4-B3-B2)", url: HYD.images.truecolor, frame: "A" },
    { id: "hyd:falsecolor", label: "False colour NIR (B8-B4-B3)", url: HYD.images.falsecolor, frame: "A" },
    { id: "hyd:ndvi", label: "NDVI", url: HYD.images.ndvi, frame: "A" },
  ],
  mum: [
    { id: "mum:truecolor", label: "Optical true colour", url: MUM.images.truecolor, frame: "A" },
    { id: "mum:falsecolor", label: "Optical false colour NIR", url: MUM.images.falsecolor, frame: "A" },
    { id: "mum:sar_vv", label: "SAR VV (dB)", url: MUM.images.sar_vv, frame: "B" },
    { id: "mum:sar_rgb", label: "SAR composite VV·VH·VV/VH", url: MUM.images.sar_rgb, frame: "B" },
    { id: "mum:fusion_rgb", label: "Fusion composite SAR-VV·NIR·MNDWI", url: MUM.images.fusion_rgb, frame: "A" },
  ],
  nmia: [
    { id: "nmia:t1", label: "2017-01-03 true colour", url: NMIA.images.t1_truecolor, frame: "A" },
    { id: "nmia:t2", label: "2026-01-16 true colour", url: NMIA.images.t2_truecolor, frame: "B" },
    { id: "nmia:t1_fc", label: "2017 false colour NIR", url: NMIA.images.t1_falsecolor, frame: "A" },
    { id: "nmia:t2_fc", label: "2026 false colour NIR", url: NMIA.images.t2_falsecolor, frame: "B" },
  ],
};

export const OVERLAYS: Record<string, RasterOverlay> = {
  "hyd:classes": { id: "hyd:classes", label: "Land cover (spectral)", url: HYD.images.classes, frame: "A", opacity: 0.5, classCoded: true, legend: CLASS_LEGEND },
  "mum:cls_optical": { id: "mum:cls_optical", label: "Land cover — optical only", url: MUM.images.cls_optical, frame: "A", opacity: 0.55, classCoded: true, legend: CLASS_LEGEND },
  "mum:cls_sar": {
    id: "mum:cls_sar",
    label: "SAR classes — radar only",
    url: MUM.images.cls_sar,
    frame: "B",
    opacity: 0.5,
    legend: [
      { label: "SAR-dark (water-like)", color: CLASS_META.water.color },
      { label: "Double-bounce (built-up)", color: CLASS_META.builtup.color },
      { label: "Other", color: EMPHASIS.grey },
    ],
  },
  "mum:cls_fused": { id: "mum:cls_fused", label: "Land cover — fused optical + SAR", url: MUM.images.cls_fused, frame: "A", opacity: 0.55, classCoded: true, legend: CLASS_LEGEND },
  "mum:disagreement": {
    id: "mum:disagreement",
    label: "Sensor disagreements resolved",
    url: MUM.images.disagreement,
    frame: "A",
    opacity: 0.85,
    legend: [
      { label: "SAR-dark but dry (runways, sand)", color: EMPHASIS.orange },
      { label: "Optical ambiguity fixed by SAR", color: EMPHASIS.aqua },
    ],
  },
  "nmia:t1_classes": { id: "nmia:t1_classes", label: "Land cover 2017", url: NMIA.images.t1_classes, frame: "A", opacity: 0.5, classCoded: true, legend: CLASS_LEGEND },
  "nmia:t2_classes": { id: "nmia:t2_classes", label: "Land cover 2026", url: NMIA.images.t2_classes, frame: "B", opacity: 0.5, classCoded: true, legend: CLASS_LEGEND },
  "nmia:change": {
    id: "nmia:change",
    label: "Change map (coloured by 2026 class)",
    url: NMIA.images.change,
    frame: "B",
    opacity: 0.72,
    classCoded: true,
    legend: CLASS_LEGEND.map((c) => ({ ...c, label: `→ ${c.label}` })),
  },
  "nmia:change_vegloss": {
    id: "nmia:change_vegloss",
    label: "Vegetation loss",
    url: NMIA.images.change_vegloss,
    frame: "B",
    opacity: 0.8,
    legend: [{ label: "Vegetation → non-vegetation", color: EMPHASIS.orange }],
  },
  "nmia:change_water": {
    id: "nmia:change_water",
    label: "Water ↔ land",
    url: NMIA.images.change_water,
    frame: "B",
    opacity: 0.85,
    legend: [
      { label: "Water → land", color: EMPHASIS.blue },
      { label: "Land → water", color: EMPHASIS.aqua },
    ],
  },
  "nmia:change_heat": {
    id: "nmia:change_heat",
    label: "Change magnitude (CVA)",
    url: NMIA.images.change_heat,
    frame: "A",
    opacity: 0.8,
    legend: [
      { label: "Low", color: "#51127c" },
      { label: "High", color: "#fcfdbf" },
    ],
  },
};

export function scenarioFamily(id: string): "hyd" | "mum" | "nmia" | null {
  if (id.startsWith("hyd")) return "hyd";
  if (id.startsWith("mum")) return "mum";
  if (id.startsWith("nmia")) return "nmia";
  return null;
}
