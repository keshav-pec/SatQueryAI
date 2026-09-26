// Chart + overlay colours. Validated with the dataviz six-checks against the
// dark panel surface (#0d131d): land-cover set passes all-pairs (normal-vision
// ΔE ≥ 19.3; CVD 6.9 warn is covered by legends + hover probes). Keep in sync
// with CLASS_RGB in scripts/build_demo_assets.py.

export const CLASS_META = {
  water: { id: 1, label: "Water", color: "#3987e5" },
  vegetation: { id: 2, label: "Vegetation", color: "#008300" },
  builtup: { id: 3, label: "Built-up", color: "#d55181" },
  bare: { id: 4, label: "Bare / open land", color: "#c98500" },
} as const;

export type ClassKey = keyof typeof CLASS_META;
export const CLASS_ORDER: ClassKey[] = ["water", "vegetation", "builtup", "bare"];
export const CLASS_BY_ID: Record<number, ClassKey> = { 1: "water", 2: "vegetation", 3: "builtup", 4: "bare" };

/** Single-colour emphasis layers (validated first-three slots). */
export const EMPHASIS = {
  orange: "#d95926",
  aqua: "#199e70",
  blue: "#3987e5",
  grey: "#6b7688",
} as const;

/** Grounding / selection highlight on imagery (UI accent, not a data series). */
export const HIGHLIGHT = "#3bd5ff";
export const ACCENT = "#ff9933";

/** Blue sequential ramp, dark → light for the dark surface (anchor flips in dark). */
export const SEQ_BLUE_DARK = ["#0d366b", "#104281", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb"];

export const CHART = {
  surface: "#0d131d",
  grid: "#1c2533",
  axis: "#2a3547",
  ink: "#e9eef6",
  ink2: "#a9b4c6",
  ink3: "#7d889b",
  deemph: "#3a465a",
};

export function seqColor(t: number): string {
  const i = Math.max(0, Math.min(SEQ_BLUE_DARK.length - 1, Math.round(t * (SEQ_BLUE_DARK.length - 1))));
  return SEQ_BLUE_DARK[i];
}
