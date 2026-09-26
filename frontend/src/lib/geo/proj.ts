import type { LonLat } from "@/lib/types";

// WGS84 ellipsoid
const A_AXIS = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;

/** Inverse transverse Mercator (Krüger series, sub-mm accuracy within a zone). */
export function utmToLonLat(easting: number, northing: number, zone: number, north = true): LonLat {
  const n = F / (2 - F);
  const A = (A_AXIS / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64);
  const beta = [n / 2 - (2 * n * n) / 3 + (37 * n ** 3) / 96, (n * n) / 48 + n ** 3 / 15, (17 * n ** 3) / 480];
  const delta = [2 * n - (2 * n * n) / 3 - 2 * n ** 3, (7 * n * n) / 3 - (8 * n ** 3) / 5, (56 * n ** 3) / 15];
  const x = easting - 500000;
  const y = north ? northing : northing - 10000000;
  const xi = y / (K0 * A);
  const eta = x / (K0 * A);
  let xiP = xi;
  let etaP = eta;
  for (let j = 1; j <= 3; j++) {
    xiP -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
  const lambda0 = ((zone * 6 - 183) * Math.PI) / 180;
  const lambda = lambda0 + Math.atan(Math.sinh(etaP) / Math.cos(xiP));
  return [(lambda * 180) / Math.PI, (phi * 180) / Math.PI];
}

export function mercatorToLonLat(x: number, y: number): LonLat {
  const R = 6378137;
  return [((x / R) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
}

/** Projected coordinate → lon/lat for the CRSs we support (UTM WGS84, geographic, web mercator). */
export function toLonLat(epsg: number | null, x: number, y: number): LonLat | null {
  if (!epsg) return null;
  if (epsg === 4326) return [x, y];
  if (epsg === 3857 || epsg === 900913) return mercatorToLonLat(x, y);
  if (epsg >= 32601 && epsg <= 32660) return utmToLonLat(x, y, epsg - 32600, true);
  if (epsg >= 32701 && epsg <= 32760) return utmToLonLat(x, y, epsg - 32700, false);
  return null;
}

export function crsName(epsg: number | null): string {
  if (!epsg) return "Not georeferenced";
  if (epsg === 4326) return "WGS 84 (geographic)";
  if (epsg === 3857) return "WGS 84 / Pseudo-Mercator";
  if (epsg >= 32601 && epsg <= 32660) return `WGS 84 / UTM zone ${epsg - 32600}N`;
  if (epsg >= 32701 && epsg <= 32760) return `WGS 84 / UTM zone ${epsg - 32700}S`;
  return `EPSG:${epsg}`;
}

export function haversineKm(a: LonLat, b: LonLat): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Pixel (col,row) → lon/lat by bilinear interpolation of the four image corners. */
export function pixelToLonLat(corners: [LonLat, LonLat, LonLat, LonLat], width: number, height: number, px: number, py: number): LonLat {
  const u = px / width;
  const v = py / height;
  const [tl, tr, br, bl] = corners;
  const top: LonLat = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u];
  const bot: LonLat = [bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u];
  return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
}

export function bboxOf(points: LonLat[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function bboxIoU(a: [number, number, number, number], b: [number, number, number, number]): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return ua > 0 ? inter / ua : 0;
}

export function formatLonLat([lon, lat]: LonLat, digits = 4): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lon).toFixed(digits)}° ${ew}`;
}
