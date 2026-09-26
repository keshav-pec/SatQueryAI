import type { DecodedRaster, FileFormat, LonLat, Modality, RasterMeta, ValidationCheck } from "@/lib/types";
import { crsName, toLonLat } from "./proj";

const COMPRESSION: Record<number, string> = {
  1: "None",
  5: "LZW",
  7: "JPEG",
  8: "Deflate",
  32946: "Deflate",
  32773: "PackBits",
  34887: "LERC",
  50000: "ZSTD",
  50001: "WebP",
};

const MAX_DECODE_PX = 4_200_000;

async function sniff(file: File): Promise<FileFormat> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if ((head[0] === 0x49 && head[1] === 0x49) || (head[0] === 0x4d && head[1] === 0x4d)) return "TIFF";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "PNG";
  if (head[0] === 0xff && head[1] === 0xd8) return "JPEG";
  return "Unsupported";
}

function dtypeOf(format: number, bits: number): string {
  const kind = format === 3 ? "float" : format === 2 ? "int" : "uint";
  return `${kind}${bits}`;
}

function percentile(values: ArrayLike<number>, p: number[], skip?: number | null, stride = 7): number[] {
  const sample: number[] = [];
  for (let i = 0; i < values.length; i += stride) {
    const v = values[i];
    if (!Number.isFinite(v) || (skip !== null && skip !== undefined && v === skip) || v === 0) continue;
    sample.push(v);
  }
  if (!sample.length) return p.map(() => 0);
  sample.sort((a, b) => a - b);
  return p.map((q) => sample[Math.min(sample.length - 1, Math.max(0, Math.floor((q / 100) * sample.length)))]);
}

function bandIndex(names: string[], code: string, fallback: number): number {
  const i = names.findIndex((n) => n.toUpperCase().startsWith(code));
  return i >= 0 ? i : fallback;
}

/** Renders a percentile-stretched RGB (optical) or dB-greyscale (SAR) preview from decoded bands. */
export async function renderPreview(r: DecodedRaster, modality: Modality, bandNames: string[], nodata: number | null): Promise<string> {
  const { width, height, bands } = r;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  const out = img.data;
  const n = width * height;

  if (modality === "sar" || bands.length < 3) {
    const src = bands[0];
    const isLinear = modality === "sar";
    const [lo, hi] = isLinear ? [-25, 5] : percentile(src, [2, 98], nodata);
    for (let i = 0; i < n; i++) {
      const raw = src[i] as number;
      const v = isLinear ? (raw > 0 ? 10 * Math.log10(raw) : lo) : raw;
      const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
      const g = Math.round(t * 255);
      out[i * 4] = g;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = g;
      out[i * 4 + 3] = raw === nodata ? 0 : 255;
    }
  } else {
    const idx = [bandIndex(bandNames, "B04", 2), bandIndex(bandNames, "B03", 1), bandIndex(bandNames, "B02", 0)];
    const ranges = idx.map((b) => percentile(bands[b], [2, 98], nodata));
    for (let i = 0; i < n; i++) {
      let empty = true;
      for (let c = 0; c < 3; c++) {
        const raw = bands[idx[c]][i] as number;
        if (raw !== 0 && raw !== nodata) empty = false;
        const [lo, hi] = ranges[c];
        const t = Math.max(0, Math.min(1, (raw - lo) / (hi - lo || 1)));
        out[i * 4 + c] = Math.round(Math.pow(t, 1 / 1.15) * 255);
      }
      out[i * 4 + 3] = empty ? 0 : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  return URL.createObjectURL(blob);
}

function inferModality(tags: Record<string, string>, bands: number, dtype: string, bandNames: string[]): Modality {
  const sensor = (tags.SENSOR || "").toUpperCase();
  const names = bandNames.join(" ").toUpperCase();
  if (sensor.includes("SAR") || /\bV[VH]\b|\bH[HV]\b|GAMMA0|SIGMA0/.test(names)) return "sar";
  if (sensor.includes("MSI") || sensor.includes("OPTICAL") || /\bB0?\d/.test(names)) return "optical";
  if (dtype.startsWith("float") && bands <= 2) return "sar";
  if (bands >= 3) return "optical";
  return "unknown";
}

export interface InspectResult {
  meta: RasterMeta;
  raster: DecodedRaster | null;
  previewUrl: string;
}

/** Reads real metadata (and, for moderate sizes, the pixels) of a user-supplied image, entirely in the browser. */
export async function inspectFile(file: File): Promise<InspectResult> {
  const format = await sniff(file);
  const base: RasterMeta = {
    name: file.name,
    bytes: file.size,
    format,
    width: 0,
    height: 0,
    bands: 0,
    dtype: "—",
    compression: "—",
    georeferenced: false,
    epsg: null,
    crsName: "Not georeferenced",
    resolution: null,
    bounds: null,
    corners: null,
    center: null,
    modality: "unknown",
    sensor: "Unknown",
    platform: "—",
    productType: "—",
    acquired: null,
    bandNames: [],
    nodata: null,
    nodataPct: null,
    cloudCover: null,
    tags: {},
    geoIssue: null,
  };

  if (format === "PNG" || format === "JPEG") {
    const url = URL.createObjectURL(file);
    const dims = await new Promise<[number, number]>((res) => {
      const im = new Image();
      im.onload = () => res([im.naturalWidth, im.naturalHeight]);
      im.onerror = () => res([0, 0]);
      im.src = url;
    });
    return {
      meta: { ...base, width: dims[0], height: dims[1], bands: 3, dtype: "uint8", modality: "optical", sensor: "Benchmark RGB (assumed)" },
      raster: null,
      previewUrl: url,
    };
  }
  if (format !== "TIFF") return { meta: base, raster: null, previewUrl: "" };

  const { fromBlob } = await import("geotiff");
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bands = image.getSamplesPerPixel();
  const dtype = dtypeOf(image.getSampleFormat(0) ?? 1, image.getBitsPerSample(0) ?? 8);
  let compression = "—";
  try {
    const c = image.getFileDirectory().getValue("Compression") as unknown as number | undefined;
    compression = c ? COMPRESSION[c] ?? `Code ${c}` : "None";
  } catch {
    /* tag missing */
  }

  const geoKeys = (image.getGeoKeys() ?? {}) as Record<string, number | undefined>;
  const epsg = (geoKeys.ProjectedCSTypeGeoKey && geoKeys.ProjectedCSTypeGeoKey !== 32767 ? geoKeys.ProjectedCSTypeGeoKey : null) ??
    (geoKeys.GeographicTypeGeoKey && geoKeys.GeographicTypeGeoKey !== 32767 ? geoKeys.GeographicTypeGeoKey : null) ?? null;

  let resolution: [number, number] | null = null;
  let bounds: [number, number, number, number] | null = null;
  let corners: RasterMeta["corners"] = null;
  try {
    const res = image.getResolution();
    const bb = image.getBoundingBox();
    resolution = [Math.abs(res[0]), Math.abs(res[1])];
    bounds = [bb[0], bb[1], bb[2], bb[3]];
    const pts: ([number, number] | null)[] = [
      toLonLat(epsg, bb[0], bb[3]),
      toLonLat(epsg, bb[2], bb[3]),
      toLonLat(epsg, bb[2], bb[1]),
      toLonLat(epsg, bb[0], bb[1]),
    ];
    if (pts.every(Boolean)) corners = pts as [LonLat, LonLat, LonLat, LonLat];
  } catch {
    /* no geotransform */
  }

  // Reject geotransforms that cannot be real for the declared CRS (e.g. pixel units labelled as degrees)
  let geoIssue: string | null = null;
  if (bounds && epsg === 4326 && (bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90)) {
    geoIssue = `Geotransform is not valid for EPSG:4326 (x ${bounds[0].toFixed(0)}…${bounds[2].toFixed(0)}, y ${bounds[1].toFixed(0)}…${bounds[3].toFixed(0)})`;
  } else if (bounds && epsg && epsg >= 32601 && epsg <= 32760 && (bounds[0] < 100000 || bounds[2] > 900000 || bounds[1] < -1 || bounds[3] > 10000000)) {
    geoIssue = `Geotransform is outside the UTM zone's valid range (EPSG:${epsg})`;
  }
  if (geoIssue) corners = null;

  const tags: Record<string, string> = {};
  const bandNames: string[] = [];
  try {
    const md = (await image.getGDALMetadata()) ?? {};
    for (const [k, v] of Object.entries(md)) tags[k] = String(v);
    for (let b = 0; b < bands; b++) {
      const bm = (await image.getGDALMetadata(b)) ?? {};
      const desc = (bm as Record<string, unknown>).DESCRIPTION;
      bandNames.push(desc ? String(desc) : `Band ${b + 1}`);
    }
  } catch {
    for (let b = 0; b < bands; b++) bandNames.push(`Band ${b + 1}`);
  }
  const nodata = image.getGDALNoData();
  const modality = inferModality(tags, bands, dtype, bandNames);

  let raster: DecodedRaster | null = null;
  let nodataPct: number | null = null;
  if (width * height <= MAX_DECODE_PX) {
    const data = (await image.readRasters()) as unknown as DecodedRaster["bands"];
    raster = { width, height, bands: Array.from(data) };
  } else {
    const scale = Math.sqrt(MAX_DECODE_PX / (width * height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const data = (await image.readRasters({ width: w, height: h, resampleMethod: "nearest" })) as unknown as DecodedRaster["bands"];
    raster = { width: w, height: h, bands: Array.from(data) };
  }
  if (raster) {
    const b0 = raster.bands[0];
    let empty = 0;
    let seen = 0;
    for (let i = 0; i < b0.length; i += 5) {
      seen++;
      const v = b0[i] as number;
      if (v === 0 || v === nodata || !Number.isFinite(v)) empty++;
    }
    nodataPct = seen ? (100 * empty) / seen : null;
  }
  const previewUrl = raster ? await renderPreview(raster, modality, bandNames, nodata) : "";
  const isFullRes = raster && raster.width === width;

  const lons = corners?.map((c) => c[0]) ?? [];
  const lats = corners?.map((c) => c[1]) ?? [];
  const center: LonLat | null = corners ? [lons.reduce((a, b) => a + b, 0) / 4, lats.reduce((a, b) => a + b, 0) / 4] : null;

  return {
    meta: {
      ...base,
      width,
      height,
      bands,
      dtype,
      compression,
      georeferenced: Boolean(corners),
      epsg,
      crsName: crsName(epsg),
      resolution,
      bounds,
      corners,
      center,
      modality,
      sensor: tags.SENSOR || (modality === "sar" ? "SAR (inferred)" : modality === "optical" ? "Optical / multispectral (inferred)" : "Unknown"),
      platform: tags.PLATFORM || "—",
      productType: tags.PRODUCT_TYPE || "—",
      acquired: tags.ACQUISITION_DATE || null,
      bandNames,
      nodata,
      nodataPct,
      cloudCover: tags.CLOUD_COVER ? Number(tags.CLOUD_COVER) : null,
      tags,
      geoIssue,
    },
    raster: isFullRes ? raster : null,
    previewUrl,
  };
}

export function fileChecks(meta: RasterMeta): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const mb = (meta.bytes / 1048576).toFixed(1);
  if (meta.format === "TIFF") {
    checks.push({
      id: "format",
      label: "Format",
      status: meta.georeferenced ? "pass" : "warn",
      detail: meta.georeferenced ? `GeoTIFF · ${meta.compression} · ${mb} MB` : `TIFF without georeferencing · ${mb} MB`,
    });
  } else if (meta.format === "PNG" || meta.format === "JPEG") {
    checks.push({ id: "format", label: "Format", status: "warn", detail: `${meta.format} accepted for public benchmark samples only (VRSBench / RSVQA / CDVQA)` });
  } else {
    checks.push({ id: "format", label: "Format", status: "fail", detail: "Unsupported file type — upload GeoTIFF / TIFF" });
    return checks;
  }
  checks.push({
    id: "crs",
    label: "Georeference",
    status: meta.georeferenced ? "pass" : "warn",
    detail: meta.georeferenced
      ? `${meta.epsg ? `EPSG:${meta.epsg}` : ""} · ${meta.crsName}`
      : meta.geoIssue
        ? `${meta.geoIssue} — map view and pairing disabled`
        : "No CRS / geotransform — map view and pairing disabled",
  });
  const bandList = meta.bandNames.length && !meta.bandNames[0].startsWith("Band ")
    ? meta.bandNames.map((b) => b.split(" ")[0]).join(", ")
    : `${meta.bands} band${meta.bands === 1 ? "" : "s"}`;
  checks.push({ id: "bands", label: "Bands", status: meta.bands > 0 ? "pass" : "fail", detail: `${meta.bands} × ${meta.dtype} · ${bandList}` });
  const areaKm2 = meta.resolution ? (meta.width * meta.height * meta.resolution[0] * meta.resolution[1]) / 1e6 : null;
  checks.push({
    id: "grid",
    label: "Grid",
    status: meta.width * meta.height > 64_000_000 ? "warn" : "pass",
    detail: `${meta.width} × ${meta.height} px${meta.resolution && !meta.geoIssue ? ` @ ${meta.resolution[0].toFixed(meta.resolution[0] < 1 ? 4 : 0)} ${meta.epsg === 4326 ? "°" : "m"}` : ""}${areaKm2 && meta.epsg !== 4326 && !meta.geoIssue ? ` · ${areaKm2.toFixed(1)} km²` : ""}`,
  });
  checks.push({
    id: "sensor",
    label: "Sensor",
    status: meta.modality === "unknown" ? "warn" : "pass",
    detail: `${meta.sensor}${meta.modality !== "unknown" ? ` → ${meta.modality === "sar" ? "SAR" : "optical"}` : ""}`,
  });
  checks.push({
    id: "date",
    label: "Acquired",
    status: meta.acquired ? "pass" : "warn",
    detail: meta.acquired ? meta.acquired.replace("T", " ").replace("Z", " UTC") : "No acquisition time in metadata (needed for change analysis)",
  });
  if (meta.nodataPct !== null) {
    checks.push({
      id: "nodata",
      label: "Coverage",
      status: meta.nodataPct > 20 ? "warn" : "pass",
      detail: `${meta.nodataPct.toFixed(1)} % no-data${meta.cloudCover !== null ? ` · cloud ${meta.cloudCover.toFixed(2)} %` : ""}`,
    });
  }
  return checks;
}
