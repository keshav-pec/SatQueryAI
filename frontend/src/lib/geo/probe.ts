import type { LoadedImage } from "@/lib/types";

export interface ProbeValue {
  label: string;
  value: string;
}

function bandIdx(names: string[], code: string, fallback: number) {
  const i = names.findIndex((n) => n.toUpperCase().startsWith(code));
  return i >= 0 ? i : fallback;
}

/** Real per-pixel values read from the decoded GeoTIFF bands. */
export function probeImage(img: LoadedImage | undefined | null, x: number, y: number): ProbeValue[] | null {
  const r = img?.raster;
  if (!img || !r) return null;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return null;
  const i = yi * r.width + xi;
  const names = img.meta.bandNames;
  if (img.meta.modality === "sar") {
    const vv = r.bands[0]?.[i] as number | undefined;
    const vh = r.bands[1]?.[i] as number | undefined;
    const db = (v?: number) => (v && v > 0 ? 10 * Math.log10(v) : NaN);
    const out: ProbeValue[] = [];
    if (vv !== undefined) out.push({ label: "VV", value: `${db(vv).toFixed(1)} dB` });
    if (vh !== undefined) out.push({ label: "VH", value: `${db(vh).toFixed(1)} dB` });
    if (vv && vh) out.push({ label: "VV/VH", value: `${(db(vv) - db(vh)).toFixed(1)} dB` });
    return out;
  }
  if (r.bands.length >= 4) {
    const scale = Number(img.meta.tags.SCALE_FACTOR) || (img.meta.dtype.startsWith("uint16") ? 1e-4 : 1);
    const g = (r.bands[bandIdx(names, "B03", 1)][i] as number) * scale;
    const red = (r.bands[bandIdx(names, "B04", 2)][i] as number) * scale;
    const nir = (r.bands[bandIdx(names, "B08", 3)][i] as number) * scale;
    const swirIdx = bandIdx(names, "B11", 4);
    const swir = r.bands[swirIdx] ? (r.bands[swirIdx][i] as number) * scale : NaN;
    const ndvi = (nir - red) / (nir + red);
    const mndwi = (g - swir) / (g + swir);
    const out: ProbeValue[] = [{ label: "NDVI", value: Number.isFinite(ndvi) ? ndvi.toFixed(2) : "—" }];
    if (Number.isFinite(mndwi)) out.push({ label: "MNDWI", value: mndwi.toFixed(2) });
    out.push({ label: "NIR", value: nir.toFixed(3) });
    return out;
  }
  const v = r.bands[0][i] as number;
  return [{ label: "Value", value: Number.isInteger(v) ? String(v) : v.toFixed(3) }];
}

export interface OpticalSample {
  ndvi: number;
  mndwi: number;
  nir: number;
  redness: number;
}
export interface SarSample {
  vv: number;
  vh: number;
}

/** Raw optical indices at a pixel (reflectance from the uint16 L2A bands). */
export function readOptical(img: LoadedImage | undefined | null, x: number, y: number): OpticalSample | null {
  const r = img?.raster;
  if (!img || !r || img.meta.modality !== "optical" || r.bands.length < 5) return null;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return null;
  const i = yi * r.width + xi;
  const n = img.meta.bandNames;
  const scale = Number(img.meta.tags.SCALE_FACTOR) || 1e-4;
  const g = (r.bands[bandIdx(n, "B03", 1)][i] as number) * scale;
  const red = (r.bands[bandIdx(n, "B04", 2)][i] as number) * scale;
  const nir = (r.bands[bandIdx(n, "B08", 3)][i] as number) * scale;
  const swir = (r.bands[bandIdx(n, "B11", 4)][i] as number) * scale;
  return { ndvi: (nir - red) / (nir + red), mndwi: (g - swir) / (g + swir), nir, redness: (red - g) / (red + g) };
}

/** Backscatter in dB at a pixel. */
export function readSar(img: LoadedImage | undefined | null, x: number, y: number): SarSample | null {
  const r = img?.raster;
  if (!img || !r || img.meta.modality !== "sar") return null;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return null;
  const i = yi * r.width + xi;
  const db = (v: number) => (v > 0 ? 10 * Math.log10(v) : NaN);
  return { vv: db(r.bands[0][i] as number), vh: r.bands[1] ? db(r.bands[1][i] as number) : NaN };
}
