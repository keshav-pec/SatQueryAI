// Real, lightweight analysis for scenes without cached specialist outputs.
// Mirrors the spectral / SAR rules of scripts/build_demo_assets.py, run in the browser.
import { CLASS_META } from "@/lib/palette";
import type { LoadedImage } from "@/lib/types";

export interface LocalResult {
  tool: "spectral-indices" | "sar-segmenter";
  params: Record<string, string | number | boolean | string[]>;
  output: string;
  ms: number;
  overlayUrl: string;
  legend: { label: string; color: string; classId?: number }[];
  classCoded: boolean;
  shares: { label: string; pct: number; ha: number | null }[];
  answer: string;
}

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function idx(names: string[], code: string, fallback: number) {
  const i = names.findIndex((n) => n.toUpperCase().startsWith(code));
  return i >= 0 ? i : fallback;
}

async function toUrl(rgba: Uint8ClampedArray, w: number, h: number): Promise<string> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
  return URL.createObjectURL(blob);
}

function otsu(values: Float32Array, lo: number, hi: number, bins = 128): number {
  const hist = new Array(bins).fill(0);
  for (const v of values) if (v >= lo && v <= hi) hist[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  const total = hist.reduce((a, b) => a + b, 0);
  let sumAll = 0;
  hist.forEach((c, i) => (sumAll += c * i));
  let w0 = 0, sum0 = 0, best = 0, bestI = 0;
  for (let i = 0; i < bins; i++) {
    w0 += hist[i];
    if (!w0 || w0 === total) continue;
    sum0 += hist[i] * i;
    const m0 = sum0 / w0;
    const m1 = (sumAll - sum0) / (total - w0);
    const between = w0 * (total - w0) * (m0 - m1) ** 2;
    if (between > best) {
      best = between;
      bestI = i;
    }
  }
  return lo + ((bestI + 0.5) / bins) * (hi - lo);
}

export async function analyzeLocally(img: LoadedImage): Promise<LocalResult | null> {
  const r = img.raster;
  if (!r) return null;
  const t0 = performance.now();
  const n = r.width * r.height;
  const pxArea = img.meta.resolution && img.meta.georeferenced && img.meta.epsg !== 4326 ? img.meta.resolution[0] * img.meta.resolution[1] : null;
  const ha = (count: number) => (pxArea ? (count * pxArea) / 1e4 : null);
  const rgba = new Uint8ClampedArray(n * 4);

  if (img.meta.modality === "sar") {
    const vv = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = r.bands[0][i] as number;
      vv[i] = v > 0 ? 10 * Math.log10(v) : NaN;
    }
    const thr = otsu(vv, -28, -5);
    let water = 0, built = 0, valid = 0;
    const W = hex(CLASS_META.water.color);
    const B = hex(CLASS_META.builtup.color);
    for (let i = 0; i < n; i++) {
      const v = vv[i];
      if (!Number.isFinite(v)) continue;
      valid++;
      if (v < thr) {
        water++;
        rgba.set([...W, 255], i * 4);
      } else if (v > -4) {
        built++;
        rgba.set([...B, 255], i * 4);
      }
    }
    const shares = [
      { label: "Radar-dark (water-like)", pct: (100 * water) / valid, ha: ha(water) },
      { label: "Double-bounce (built-up)", pct: (100 * built) / valid, ha: ha(built) },
      { label: "Other", pct: (100 * (valid - water - built)) / valid, ha: ha(valid - water - built) },
    ];
    const ms = performance.now() - t0;
    return {
      tool: "sar-segmenter",
      params: { polarisations: ["VV"], water_threshold_db: "otsu", builtup_threshold_db: -4 },
      output: `Otsu split at ${thr.toFixed(1)} dB · dark ${shares[0].pct.toFixed(1)} % · double-bounce ${shares[1].pct.toFixed(1)} %`,
      ms,
      overlayUrl: await toUrl(rgba, r.width, r.height),
      legend: [
        { label: "Radar-dark (water-like)", color: CLASS_META.water.color },
        { label: "Double-bounce (built-up)", color: CLASS_META.builtup.color },
      ],
      classCoded: false,
      shares,
      answer: "",
    };
  }

  if (r.bands.length < 4) return null;
  const names = img.meta.bandNames;
  const scale = Number(img.meta.tags.SCALE_FACTOR) || (img.meta.dtype.startsWith("uint16") ? 1e-4 : 1);
  const G = r.bands[idx(names, "B03", 1)];
  const R = r.bands[idx(names, "B04", 2)];
  const NIR = r.bands[idx(names, "B08", 3)];
  const swirI = names.some((b) => b.toUpperCase().startsWith("B11")) ? idx(names, "B11", 4) : r.bands.length >= 5 ? 4 : -1;
  const SW = swirI >= 0 ? r.bands[swirI] : null;
  const counts = { water: 0, vegetation: 0, builtup: 0, bare: 0 };
  let valid = 0;
  const colors = Object.fromEntries(Object.entries(CLASS_META).map(([k, v]) => [k, hex(v.color)])) as Record<keyof typeof counts, number[]>;
  for (let i = 0; i < n; i++) {
    const g = (G[i] as number) * scale;
    const red = (R[i] as number) * scale;
    const nir = (NIR[i] as number) * scale;
    if (!(g > 0) || !(red > 0) || !(nir > 0)) continue;
    valid++;
    const ndvi = (nir - red) / (nir + red);
    const water = SW ? (() => {
      const s = (SW[i] as number) * scale;
      return (g - s) / (g + s) > 0 && nir < 0.11 && ndvi < 0.12;
    })() : (g - nir) / (g + nir) > 0.1;
    let cls: keyof typeof counts;
    if (water) cls = "water";
    else if (ndvi > 0.33) cls = "vegetation";
    else if ((red - g) / (red + g) > 0.12) cls = "bare";
    else cls = "builtup";
    counts[cls]++;
    rgba.set([...colors[cls], 255], i * 4);
  }
  if (!valid) return null;
  const order: (keyof typeof counts)[] = ["water", "vegetation", "builtup", "bare"];
  const shares = order.map((k) => ({ label: CLASS_META[k].label, pct: (100 * counts[k]) / valid, ha: ha(counts[k]) }));
  const ms = performance.now() - t0;
  return {
    tool: "spectral-indices",
    params: { indices: SW ? ["NDVI", "MNDWI"] : ["NDVI", "NDWI"], veg_ndvi: 0.33, water_rule: SW ? "MNDWI > 0 ∧ NIR < 0.11" : "NDWI > 0.1" },
    output: order.map((k) => `${CLASS_META[k].label.split(" /")[0].toLowerCase()} ${((100 * counts[k]) / valid).toFixed(1)} %`).join(" · "),
    ms,
    overlayUrl: await toUrl(rgba, r.width, r.height),
    legend: order.map((k) => ({ label: CLASS_META[k].label, color: CLASS_META[k].color, classId: CLASS_META[k].id })),
    classCoded: true,
    shares,
    answer: "",
  };
}
