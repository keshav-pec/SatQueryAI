// Evidence computed offline from real Copernicus Sentinel-1/2 data by
// scripts/build_demo_assets.py (re-run it to regenerate these JSON files).
import hydJson from "./generated/hyd.json";
import mumJson from "./generated/mum.json";
import nmiaJson from "./generated/nmia.json";
import type { LonLat, SampleKey, ScenarioId, Mode, Modality } from "@/lib/types";

export const HYD = hydJson;
export const MUM = mumJson;
export const NMIA = nmiaJson;

export type Grid = typeof HYD.grid;

export interface SampleFile {
  key: SampleKey;
  name: string;
  url: string;
  bytes: number;
  modality: Modality;
  sensor: string;
  platform: string;
  date: string;
  acquiredLocal: string;
  preview: string;
  thumb: string;
  grid: Grid;
  place: string;
}

export const SAMPLES: Record<SampleKey, SampleFile> = {
  "hyd-s2": {
    key: "hyd-s2",
    ...HYD.sample,
    modality: "optical",
    sensor: "Sentinel-2 MSI L2A",
    platform: HYD.item.platform,
    date: HYD.item.date,
    acquiredLocal: HYD.acquired_local,
    preview: HYD.images.truecolor,
    thumb: HYD.images.thumb,
    grid: HYD.grid,
    place: "Hyderabad · Hussain Sagar",
  },
  "mum-s2": {
    key: "mum-s2",
    ...MUM.samples.s2,
    modality: "optical",
    sensor: "Sentinel-2 MSI L2A",
    platform: MUM.items.s2.platform,
    date: MUM.items.s2.date,
    acquiredLocal: MUM.acquired_local.s2,
    preview: MUM.images.truecolor,
    thumb: MUM.images.thumb_optical,
    grid: MUM.grid,
    place: "Mumbai · Bandra–Kurla",
  },
  "mum-s1": {
    key: "mum-s1",
    ...MUM.samples.s1,
    modality: "sar",
    sensor: "Sentinel-1 C-SAR (RTC)",
    platform: MUM.items.s1.platform,
    date: MUM.items.s1.date,
    acquiredLocal: MUM.acquired_local.s1,
    preview: MUM.images.sar_vv,
    thumb: MUM.images.thumb_sar,
    grid: MUM.grid,
    place: "Mumbai · Bandra–Kurla",
  },
  "nmia-t1": {
    key: "nmia-t1",
    ...NMIA.samples.t1,
    modality: "optical",
    sensor: "Sentinel-2 MSI L2A",
    platform: NMIA.items.t1.platform,
    date: NMIA.items.t1.date,
    acquiredLocal: "2017-01-03 11:12 IST",
    preview: NMIA.images.t1_truecolor,
    thumb: NMIA.images.thumb_t1,
    grid: NMIA.grid,
    place: "Navi Mumbai airport site",
  },
  "nmia-t2": {
    key: "nmia-t2",
    ...NMIA.samples.t2,
    modality: "optical",
    sensor: "Sentinel-2 MSI L2A",
    platform: NMIA.items.t2.platform,
    date: NMIA.items.t2.date,
    acquiredLocal: "2026-01-16 11:12 IST",
    preview: NMIA.images.t2_truecolor,
    thumb: NMIA.images.thumb_t2,
    grid: NMIA.grid,
    place: "Navi Mumbai airport site",
  },
};

export function sampleKeyForName(name: string): SampleKey | null {
  const hit = Object.values(SAMPLES).find((s) => s.name.toLowerCase() === name.toLowerCase());
  return hit ? hit.key : null;
}

export interface ScenarioCard {
  id: ScenarioId;
  title: string;
  subtitle: string;
  mode: Mode;
  files: SampleKey[];
  thumb: string;
  thumb2?: string;
  tag: string;
  center: LonLat;
  expectFail?: boolean;
}

export const SCENARIOS: ScenarioCard[] = [
  {
    id: "hyd",
    title: "Hyderabad — Hussain Sagar",
    subtitle: "Sentinel-2 L2A · 07 Jan 2025 · 10 m",
    mode: "single",
    files: ["hyd-s2"],
    thumb: HYD.images.thumb,
    tag: "Single · optical",
    center: HYD.grid.center_lonlat as LonLat,
  },
  {
    id: "mum-sar",
    title: "Mumbai — SAR only",
    subtitle: "Sentinel-1 VV/VH · 07 Jan 2025 · 06:33 IST",
    mode: "single",
    files: ["mum-s1"],
    thumb: MUM.images.thumb_sar,
    tag: "Single · SAR",
    center: MUM.grid.center_lonlat as LonLat,
  },
  {
    id: "mum-fusion",
    title: "Mumbai — optical + SAR",
    subtitle: "S2 06 Jan + S1 07 Jan 2025 · co-registered",
    mode: "cross_modal",
    files: ["mum-s2", "mum-s1"],
    thumb: MUM.images.thumb_optical,
    thumb2: MUM.images.thumb_sar,
    tag: "Cross-modal pair",
    center: MUM.grid.center_lonlat as LonLat,
  },
  {
    id: "nmia",
    title: "Navi Mumbai Airport — 2017 → 2026",
    subtitle: "Sentinel-2 L2A · 03 Jan 2017 / 16 Jan 2026",
    mode: "bitemporal",
    files: ["nmia-t1", "nmia-t2"],
    thumb: NMIA.images.thumb_t1,
    thumb2: NMIA.images.thumb_t2,
    tag: "Bi-temporal pair",
    center: NMIA.grid.center_lonlat as LonLat,
  },
  {
    id: "mismatch",
    title: "Guardrail test — mismatched pair",
    subtitle: "Hyderabad optical + Mumbai SAR",
    mode: "cross_modal",
    files: ["hyd-s2", "mum-s1"],
    thumb: HYD.images.thumb,
    thumb2: MUM.images.thumb_sar,
    tag: "Should be rejected",
    center: HYD.grid.center_lonlat as LonLat,
    expectFail: true,
  },
];

export const SUGGESTIONS: Record<ScenarioId, string[]> = {
  hyd: [
    "Describe the land-cover and major objects visible in this image.",
    "Highlight the water body referred to in the query.",
    "Is there an airport in this image? Where is the runway?",
    "What percentage of the area is covered by vegetation?",
    "How many water bodies are visible?",
    "Does the lake water look clean?",
  ],
  "mum-opt": [
    "Describe the land-cover and major objects visible in this image.",
    "Highlight the water bodies.",
    "What percentage of the scene is built-up?",
  ],
  "mum-sar": [
    "Describe this SAR image.",
    "Which regions show low backscatter and what do they represent?",
    "Are there any ships or boats visible?",
    "Highlight the water body.",
  ],
  "mum-fusion": [
    "Use the optical and SAR images together to identify built-up and water-covered regions.",
    "Where do the optical and SAR images disagree, and why?",
    "Why does the airport runway look like water in SAR?",
    "Are there any vessels in Mahim Bay?",
    "Which areas are mangroves or vegetation?",
  ],
  nmia: [
    "What changed between these two dates, and where did the change occur?",
    "Has the built-up area increased, decreased, or remained unchanged?",
    "How much vegetation was lost?",
    "Show the year-by-year trend of the construction.",
    "Was any water body filled or diverted?",
  ],
  "nmia-single": ["Describe the land-cover and major objects visible in this image.", "What percentage of the scene is vegetation?"],
  mismatch: ["Use the optical and SAR images together to identify built-up and water-covered regions.", "What changed between these two images?"],
  generic: ["Describe the land-cover and major objects visible in this image.", "Highlight the water body referred to in the query."],
};

/** Resolve which demo scenario a set of loaded files corresponds to. */
export function resolveScenario(keys: (SampleKey | null)[], compatFailed: boolean): ScenarioId {
  const k = keys.filter(Boolean) as SampleKey[];
  if (keys.length === 2) {
    if (compatFailed) return "mismatch";
    const set = new Set(k);
    if (set.has("mum-s2") && set.has("mum-s1")) return "mum-fusion";
    if (set.has("nmia-t1") && set.has("nmia-t2")) return "nmia";
    return k.length === 2 ? "mismatch" : "generic";
  }
  if (keys.length === 1) {
    switch (k[0]) {
      case "hyd-s2":
        return "hyd";
      case "mum-s1":
        return "mum-sar";
      case "mum-s2":
        return "mum-opt";
      case "nmia-t1":
      case "nmia-t2":
        return "nmia-single";
      default:
        return "generic";
    }
  }
  return "generic";
}
