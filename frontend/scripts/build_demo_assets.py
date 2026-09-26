#!/usr/bin/env python3
"""
Build the SatQuery AI demo assets from real, open Copernicus Sentinel data.

Small AOI windows are read straight from Microsoft Planetary Computer COGs
(anonymous SAS tokens, no account needed). Simple, reproducible remote-sensing
methods (spectral indices, SAR thresholding, rule-based optical-SAR fusion,
post-classification change detection) turn them into the evidence the UI shows:

  public/demo/<scenario>/*.jpg|png   previews and overlays used by the UI
  public/demo/samples/*.tif          GeoTIFF test samples (drag these into the app)
  src/lib/demo/generated/*.json      stats, polygons and chart series for fixtures

Usage (from frontend/):
  ../venv/bin/python scripts/build_demo_assets.py            # all scenarios
  ../venv/bin/python scripts/build_demo_assets.py hyd nmia   # a subset

Requires: numpy, rasterio, requests, pillow (all in the project venv).
Contains modified Copernicus Sentinel data (2016-2026), processed by ESA.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import rasterio
import requests
from PIL import Image
from rasterio import features
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform as warp_transform
from rasterio.warp import transform_bounds

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "demo"
SAMPLES = PUBLIC / "samples"
GEN = ROOT / "src" / "lib" / "demo" / "generated"
CACHE = Path(os.environ.get("DEMO_CACHE", ROOT / "scripts" / ".cache"))

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
SAS = "https://planetarycomputer.microsoft.com/api/sas/v1/token/{}"

S2_BANDS = ["B02", "B03", "B04", "B08", "B11", "B12"]
S2_META = {
    "B02": ("Blue", 490), "B03": ("Green", 560), "B04": ("Red", 665),
    "B08": ("NIR", 842), "B11": ("SWIR-1", 1610), "B12": ("SWIR-2", 2190),
}

# Land-cover palette shared with the UI (src/lib/demo/palette.ts)
CLASS_IDS = {"water": 1, "vegetation": 2, "builtup": 3, "bare": 4}
# Validated (dataviz six-checks, dark surface #0d131d, all-pairs) - keep in sync with palette.ts
CLASS_RGB = {
    1: (0x39, 0x87, 0xE5),  # water       #3987e5
    2: (0x00, 0x83, 0x00),  # vegetation  #008300
    3: (0xD5, 0x51, 0x81),  # built-up    #d55181
    4: (0xC9, 0x85, 0x00),  # bare / open #c98500
}
ORANGE = (0xD9, 0x59, 0x26)  # emphasis: losses / SAR-only errors  #d95926
AQUA = (0x19, 0x9E, 0x70)    # emphasis: optical-only errors / new water  #199e70

# ─── Planetary Computer helpers ────────────────────────────────────────────

_tokens: dict[str, str] = {}


def token(collection: str) -> str:
    if collection not in _tokens:
        r = requests.get(SAS.format(collection), timeout=60)
        r.raise_for_status()
        _tokens[collection] = r.json()["token"]
    return _tokens[collection]


def get_item(collection: str, item_id: str) -> dict:
    cache = CACHE / "items" / f"{item_id}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    r = requests.get(f"{STAC}/collections/{collection}/items/{item_id}", timeout=60)
    r.raise_for_status()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(r.text)
    return r.json()


def search(collection: str, bbox, datetime: str, cloud: float | None = None, limit=100):
    body = {"collections": [collection], "bbox": bbox, "datetime": datetime, "limit": limit}
    if cloud is not None:
        body["query"] = {"eo:cloud_cover": {"lt": cloud}}
    r = requests.post(f"{STAC}/search", json=body, timeout=90)
    r.raise_for_status()
    return r.json()["features"]


# ─── Output grid ───────────────────────────────────────────────────────────


class Grid:
    """A north-up UTM grid snapped to the Sentinel-2 10 m lattice."""

    def __init__(self, epsg: int, bbox_lonlat, res: float = 10.0):
        self.epsg = epsg
        self.crs = f"EPSG:{epsg}"
        self.res = res
        minx, miny, maxx, maxy = transform_bounds("EPSG:4326", self.crs, *bbox_lonlat, densify_pts=21)
        minx, miny = math.floor(minx / res) * res, math.floor(miny / res) * res
        maxx, maxy = math.ceil(maxx / res) * res, math.ceil(maxy / res) * res
        self.bounds = (minx, miny, maxx, maxy)
        self.width = int(round((maxx - minx) / res))
        self.height = int(round((maxy - miny) / res))
        self.transform = from_origin(minx, maxy, res, res)

    @property
    def key(self) -> str:
        return f"{self.epsg}_{int(self.bounds[0])}_{int(self.bounds[3])}_{self.width}x{self.height}"

    def px_to_lonlat(self, xs, ys):
        X = [self.bounds[0] + x * self.res for x in xs]
        Y = [self.bounds[3] - y * self.res for y in ys]
        lon, lat = warp_transform(self.crs, "EPSG:4326", X, Y)
        return lon, lat

    def corners_lonlat(self):
        xs = [0, self.width, self.width, 0]
        ys = [0, 0, self.height, self.height]
        lon, lat = self.px_to_lonlat(xs, ys)
        return [[round(a, 6), round(b, 6)] for a, b in zip(lon, lat)]  # TL, TR, BR, BL

    def describe(self) -> dict:
        corners = self.corners_lonlat()
        lons = [c[0] for c in corners]
        lats = [c[1] for c in corners]
        clon, clat = self.px_to_lonlat([self.width / 2], [self.height / 2])
        return {
            "epsg": self.epsg,
            "crs": self.crs,
            "resolution_m": self.res,
            "width": self.width,
            "height": self.height,
            "bounds_utm": [round(v, 1) for v in self.bounds],
            "corners_lonlat": corners,
            "bbox_lonlat": [round(min(lons), 6), round(min(lats), 6), round(max(lons), 6), round(max(lats), 6)],
            "center_lonlat": [round(clon[0], 6), round(clat[0], 6)],
            "area_km2": round(self.width * self.height * self.res * self.res / 1e6, 2),
        }


def read_into_grid(href: str, grid: Grid, resampling: Resampling, cache_key: str) -> np.ndarray:
    path = CACHE / "arrays" / f"{cache_key}_{grid.key}.npy"
    if path.exists():
        return np.load(path)
    with rasterio.open(href) as src:
        nodata = src.nodata if src.nodata is not None else 0
        with WarpedVRT(
            src,
            crs=grid.crs,
            transform=grid.transform,
            width=grid.width,
            height=grid.height,
            resampling=resampling,
            src_nodata=nodata,
            nodata=nodata,
        ) as vrt:
            arr = vrt.read(1)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.save(path, arr)
    return arr


def read_s2(item: dict, grid: Grid, bands=S2_BANDS) -> dict:
    """Surface reflectance (float32, NaN = nodata) harmonised across processing baselines."""
    baseline = float(item["properties"].get("s2:processing_baseline", "0") or 0)
    offset = 1000.0 if baseline >= 4.0 else 0.0
    tok = token("sentinel-2-l2a")
    out = {}
    for b in bands:
        href = item["assets"][b]["href"] + "?" + tok
        res = Resampling.nearest if b in ("B02", "B03", "B04", "B08") else Resampling.bilinear
        dn = read_into_grid(href, grid, res, f"{item['id']}_{b}").astype(np.float32)
        refl = (dn - offset) / 10000.0
        refl[dn == 0] = np.nan
        out[b] = np.clip(refl, 0, 1.5)
    return out


def read_s1(item: dict, grid: Grid) -> dict:
    """Sentinel-1 RTC gamma0 (linear power, float32, NaN = nodata)."""
    tok = token("sentinel-1-rtc")
    out = {}
    for pol in ("vv", "vh"):
        href = item["assets"][pol]["href"] + "?" + tok
        arr = read_into_grid(href, grid, Resampling.bilinear, f"{item['id']}_{pol}").astype(np.float32)
        arr[(arr <= -32000) | (arr <= 0)] = np.nan
        out[pol] = arr
    return out


def nodata_fraction(s2: dict) -> float:
    return float(np.isnan(s2["B04"]).mean())


def pick_covering_item(collection, bbox, datetime, grid, cloud=1.0, exclude=()) -> dict:
    """Least-cloudy S2 item whose tile fully covers the grid (no nodata)."""
    feats = [f for f in search(collection, bbox, datetime, cloud) if f["id"] not in exclude]
    feats.sort(key=lambda f: (f["properties"].get("eo:cloud_cover", 100), f["properties"]["datetime"]))
    for f in feats:
        if f["properties"].get("proj:epsg") != grid.epsg:
            continue
        item = get_item(collection, f["id"])
        probe = read_s2(item, grid, bands=["B04"])
        if float(np.isnan(probe["B04"]).mean()) == 0.0:
            return item
    raise RuntimeError(f"No fully covering {collection} item for {datetime}")


# ─── Indices, classification, SAR ─────────────────────────────────────────


def nd(a, b):
    with np.errstate(invalid="ignore", divide="ignore"):
        return (a - b) / (a + b)


def indices(s2: dict) -> dict:
    return {
        "ndvi": nd(s2["B08"], s2["B04"]),
        "ndwi": nd(s2["B03"], s2["B08"]),
        "mndwi": nd(s2["B03"], s2["B11"]),
        "ndbi": nd(s2["B11"], s2["B08"]),
    }


def local_std(a: np.ndarray, r: int = 2) -> np.ndarray:
    """Moving-window standard deviation (texture), numpy only."""
    a = np.nan_to_num(a, nan=np.nanmean(a))
    k = 2 * r + 1
    pad = np.pad(a, r, mode="reflect")
    c1 = np.cumsum(np.cumsum(np.pad(pad, ((1, 0), (1, 0))), 0), 1)
    c2 = np.cumsum(np.cumsum(np.pad(pad * pad, ((1, 0), (1, 0))), 0), 1)
    h, w = a.shape

    def box(c):
        return c[k:k + h, k:k + w] - c[0:h, k:k + w] - c[k:k + h, 0:w] + c[0:h, 0:w]

    n = k * k
    mean = box(c1) / n
    var = np.maximum(box(c2) / n - mean * mean, 0)
    return np.sqrt(var)


def to_db(lin: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        return 10.0 * np.log10(lin)


def otsu(values: np.ndarray, lo: float, hi: float, bins: int = 256) -> float:
    v = values[np.isfinite(values)]
    v = v[(v >= lo) & (v <= hi)]
    hist, edges = np.histogram(v, bins=bins, range=(lo, hi))
    centers = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(hist)
    w1 = w0[-1] - w0
    m0 = np.cumsum(hist * centers) / np.maximum(w0, 1)
    mt = (hist * centers).sum()
    m1 = (mt - np.cumsum(hist * centers)) / np.maximum(w1, 1)
    between = w0 * w1 * (m0 - m1) ** 2
    return float(centers[np.argmax(between)])


def classify_optical(s2: dict, ix: dict, params: dict | None = None) -> np.ndarray:
    """Rule-based 4-class land cover from Sentinel-2 indices.

    water      MNDWI above threshold, dark NIR, no vegetation signal (handles turbid creeks)
    vegetation NDVI above threshold
    bare/open  remaining pixels with a red soil signature ((B04-B03)/(B04+B03)), e.g. laterite, dry fields
    built-up   remaining pixels (roofs, paving, graded construction surfaces)
    """
    p = {"water_mndwi": 0.0, "water_nir": 0.11, "water_ndvi": 0.12, "veg_ndvi": 0.33, "bare_red": 0.12}
    p.update(params or {})
    valid = np.isfinite(s2["B04"])
    cls = np.zeros(s2["B04"].shape, np.uint8)
    water = (ix["mndwi"] > p["water_mndwi"]) & (s2["B08"] < p["water_nir"]) & (ix["ndvi"] < p["water_ndvi"])
    veg = (~water) & (ix["ndvi"] > p["veg_ndvi"])
    rest = valid & ~water & ~veg
    redness = nd(s2["B04"], s2["B03"])
    bare = rest & (redness > p["bare_red"])
    cls[rest] = CLASS_IDS["builtup"]
    cls[bare] = CLASS_IDS["bare"]
    cls[veg & valid] = CLASS_IDS["vegetation"]
    cls[water & valid] = CLASS_IDS["water"]
    return cls


def dos(s2: dict, bands=("B02", "B03", "B04", "B08", "B11"), q=0.5) -> dict:
    """Dark-object subtraction: removes residual haze so thresholds hold across dates."""
    out = dict(s2)
    for b in bands:
        out[b] = np.clip(s2[b] - np.nanpercentile(s2[b], q), 0, None)
    return out


def classify_periurban(s2: dict) -> np.ndarray:
    """Rules calibrated on dry-season (Jan) signatures of a peri-urban coastal site.

    water/wetland  open water, plus dark non-vegetated wet ground
    vegetation     NDVI >= 0.30 (mangroves, scrub hills, plantations)
    built-up       grey urban fabric, paved surfaces (high NDBI), graded construction platforms
    bare/open      remaining land: red laterite, quarried slopes, dry fields, mudflats
    """
    ix = indices(s2)
    valid = np.isfinite(s2["B04"])
    redness = nd(s2["B04"], s2["B03"])
    bright = (s2["B02"] + s2["B03"] + s2["B04"]) / 3
    cls = np.zeros(s2["B04"].shape, np.uint8)
    water = (ix["mndwi"] > 0.0) & (s2["B08"] < 0.11) & (ix["ndvi"] < 0.12)
    wetland = ~water & (bright < 0.045) & (ix["ndvi"] < 0.25) & (ix["mndwi"] > -0.2)
    veg = ~water & ~wetland & (ix["ndvi"] >= 0.30)
    rest = valid & ~water & ~wetland & ~veg
    urban_grey = (redness < 0.09) & (bright > 0.07) & (ix["ndvi"] < 0.25)
    paved = (ix["ndbi"] > 0.10) & (bright > 0.09) & (ix["ndvi"] < 0.20)
    graded = (ix["ndvi"] < 0.10) & (bright > 0.08) & (redness < 0.10)
    built = rest & (urban_grey | paved | graded)
    cls[rest] = CLASS_IDS["bare"]
    cls[built] = CLASS_IDS["builtup"]
    cls[veg & valid] = CLASS_IDS["vegetation"]
    cls[(water | wetland) & valid] = CLASS_IDS["water"]
    return cls


def sieve(cls: np.ndarray, size: int) -> np.ndarray:
    return features.sieve(cls.astype(np.uint8), size=size, connectivity=8)


def class_stats(cls: np.ndarray, res: float = 10.0) -> dict:
    total = int((cls > 0).sum())
    out = {}
    for name, cid in CLASS_IDS.items():
        px = int((cls == cid).sum())
        out[name] = {
            "pixels": px,
            "ha": round(px * res * res / 1e4, 1),
            "km2": round(px * res * res / 1e6, 3),
            "pct": round(100.0 * px / max(total, 1), 2),
        }
    return out


# ─── Vector helpers ────────────────────────────────────────────────────────


def ring_area(ring) -> float:
    a = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def ring_perimeter(ring) -> float:
    return sum(math.dist(p, q) for p, q in zip(ring, ring[1:] + ring[:1]))


def dp_simplify(points, tol):
    if len(points) < 4:
        return points
    if points[0] == points[-1]:
        # Closed ring: split at the vertex farthest from the start, simplify both halves
        far = max(range(len(points)), key=lambda i: math.dist(points[0], points[i]))
        a = dp_simplify(points[:far + 1], tol)
        b = dp_simplify(points[far:], tol)
        return a[:-1] + b
    stack, keep = [(0, len(points) - 1)], {0, len(points) - 1}
    while stack:
        s, e = stack.pop()
        (x1, y1), (x2, y2) = points[s], points[e]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = 0.0, -1
        for i in range(s + 1, e):
            x0, y0 = points[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep.add(idx)
            stack += [(s, idx), (idx, e)]
    return [points[i] for i in sorted(keep)]


def chaikin(ring, iterations=2):
    for _ in range(iterations):
        out = []
        n = len(ring)
        for i in range(n):
            p, q = ring[i], ring[(i + 1) % n]
            out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
            out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
        ring = out
    return ring


def polygons_from_mask(mask: np.ndarray, min_px: int = 30, simplify=1.0, smooth=1):
    """Connected regions of a boolean mask -> list of dicts sorted by area (px)."""
    polys = []
    for geom, val in features.shapes(mask.astype(np.uint8), mask=mask, connectivity=8, transform=Affine.identity()):
        if val != 1:
            continue
        rings = geom["coordinates"]
        outer = [tuple(p) for p in rings[0][:-1]]
        holes = [[tuple(p) for p in r[:-1]] for r in rings[1:]]
        area = ring_area(outer) - sum(ring_area(h) for h in holes)
        if area < min_px:
            continue
        simple = dp_simplify(outer + [outer[0]], simplify)[:-1]
        if smooth:
            simple = chaikin(simple, smooth)
        polys.append({"outer_raw": outer, "outer": simple, "area_px": area,
                      "holes": [chaikin(dp_simplify(h + [h[0]], simplify)[:-1], smooth) for h in holes if ring_area(h) > 40]})
    polys.sort(key=lambda p: -p["area_px"])
    return polys


def polygon_record(poly, grid: Grid, label: str, extra: dict | None = None) -> dict:
    ring = poly["outer"]
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    lon, lat = grid.px_to_lonlat(xs, ys)
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    clon, clat = grid.px_to_lonlat([cx], [cy])
    area_m2 = poly["area_px"] * grid.res * grid.res
    rec = {
        "label": label,
        "pixel": [[round(x, 1), round(y, 1)] for x, y in ring],
        "holes_pixel": [[[round(x, 1), round(y, 1)] for x, y in h] for h in poly.get("holes", [])],
        "lonlat": [[round(a, 5), round(b, 5)] for a, b in zip(lon, lat)],
        "bbox_px": [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)],
        "centroid_px": [round(cx, 1), round(cy, 1)],
        "centroid_lonlat": [round(clon[0], 6), round(clat[0], 6)],
        "area_m2": round(area_m2),
        "area_ha": round(area_m2 / 1e4, 1),
        "area_km2": round(area_m2 / 1e6, 3),
        "perimeter_m": round(ring_perimeter(ring) * grid.res),
    }
    if extra:
        rec.update(extra)
    return rec


def box_record(grid: Grid, label: str, x0, y0, x1, y1, extra: dict | None = None) -> dict:
    lon, lat = grid.px_to_lonlat([x0, x1, x1, x0], [y0, y0, y1, y1])
    clon, clat = grid.px_to_lonlat([(x0 + x1) / 2], [(y0 + y1) / 2])
    rec = {
        "label": label,
        "bbox_px": [x0, y0, x1, y1],
        "lonlat": [[round(a, 6), round(b, 6)] for a, b in zip(lon, lat)],
        "centroid_lonlat": [round(clon[0], 6), round(clat[0], 6)],
        "size_m": [round((x1 - x0) * grid.res), round((y1 - y0) * grid.res)],
    }
    if extra:
        rec.update(extra)
    return rec


# ─── Rendering ─────────────────────────────────────────────────────────────


def stretch(a, lo, hi, gamma=1.0):
    x = np.clip((np.nan_to_num(a, nan=lo) - lo) / (hi - lo), 0, 1)
    return x ** (1 / gamma)


def rgb_u8(r, g, b, alpha=None):
    stack = [np.round(c * 255).astype(np.uint8) for c in (r, g, b)]
    if alpha is not None:
        stack.append(alpha.astype(np.uint8))
    return np.dstack(stack)


def truecolor(s2, lo=0.02, hi=0.26, gamma=1.25):
    return rgb_u8(*(stretch(s2[b], lo, hi, gamma) for b in ("B04", "B03", "B02")))


def falsecolor(s2, hi=0.42):
    return rgb_u8(stretch(s2["B08"], 0.02, hi, 1.1), stretch(s2["B04"], 0.02, 0.26, 1.2), stretch(s2["B03"], 0.02, 0.24, 1.2))


def lut(stops):
    pos = np.array([s[0] for s in stops])
    cols = np.array([[int(s[1][i:i + 2], 16) for i in (1, 3, 5)] for s in stops], np.float32)

    def apply(x):
        x = np.clip(np.nan_to_num(x, nan=0), 0, 1)
        return np.dstack([np.interp(x, pos, cols[:, i]) for i in range(3)]).astype(np.uint8)

    return apply


NDVI_LUT = lut([(0, "#8c510a"), (0.35, "#dfc27d"), (0.5, "#f6e8c3"), (0.65, "#80cdc1"), (0.8, "#35978f"), (1, "#01665e")])
HEAT_LUT = lut([(0, "#000004"), (0.25, "#51127c"), (0.5, "#b73779"), (0.75, "#fc8961"), (1, "#fcfdbf")])


def class_rgba(cls, alpha=255):
    h, w = cls.shape
    out = np.zeros((h, w, 4), np.uint8)
    for cid, rgb in CLASS_RGB.items():
        m = cls == cid
        out[m, :3] = rgb
        out[m, 3] = alpha
    return out


def mask_rgba(mask, rgb, alpha=255):
    h, w = mask.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[mask, :3] = rgb
    out[mask, 3] = alpha
    return out


def save_img(arr, path: Path, quality=90, palette: int = 0):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(arr)
    if palette:
        img = img.quantize(colors=palette, method=Image.Quantize.FASTOCTREE)
    if path.suffix == ".jpg":
        img.convert("RGB").save(path, quality=quality, optimize=True, progressive=True)
    else:
        img.save(path, optimize=True)
    return "/" + str(path.relative_to(ROOT / "public")).replace(os.sep, "/")


def thumb(src_arr, path: Path, size=320):
    img = Image.fromarray(src_arr).convert("RGB")
    img.thumbnail((size, size), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=85, optimize=True)
    return "/" + str(path.relative_to(ROOT / "public")).replace(os.sep, "/")


# ─── GeoTIFF samples ───────────────────────────────────────────────────────


def write_s2_geotiff(path: Path, s2: dict, grid: Grid, item: dict, extra_tags: dict | None = None):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = np.stack([np.round(np.nan_to_num(s2[b], nan=0) * 10000).clip(0, 65535).astype(np.uint16) for b in S2_BANDS])
    p = item["properties"]
    acq = dt.datetime.fromisoformat(p["datetime"].replace("Z", "+00:00"))
    with rasterio.open(
        path, "w", driver="GTiff", width=grid.width, height=grid.height, count=len(S2_BANDS),
        dtype="uint16", crs=grid.crs, transform=grid.transform, nodata=0,
        compress="deflate", predictor=2, tiled=True, blockxsize=256, blockysize=256,
    ) as dst:
        dst.write(data)
        for i, b in enumerate(S2_BANDS, start=1):
            name, wl = S2_META[b]
            dst.set_band_description(i, f"{b} {name} {wl}nm")
        tags = {
            "SENSOR": "Sentinel-2 MSI",
            "PLATFORM": p.get("platform", "Sentinel-2").upper(),
            "PRODUCT_TYPE": "S2MSI2A (Level-2A, surface reflectance)",
            "ACQUISITION_DATE": acq.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "MGRS_TILE": p.get("s2:mgrs_tile", ""),
            "CLOUD_COVER": f"{p.get('eo:cloud_cover', 0):.3f}",
            "PROCESSING_BASELINE": p.get("s2:processing_baseline", ""),
            "BANDS": ",".join(S2_BANDS),
            "SCALE_FACTOR": "0.0001",
            "SOURCE_PRODUCT": item["id"],
            "SOURCE": "Contains modified Copernicus Sentinel data processed by ESA; accessed via Microsoft Planetary Computer",
            "TIFFTAG_DATETIME": acq.strftime("%Y:%m:%d %H:%M:%S"),
            "TIFFTAG_IMAGEDESCRIPTION": f"SatQuery AI test sample | Sentinel-2 L2A | {acq.date()}",
        }
        tags.update(extra_tags or {})
        dst.update_tags(**tags)
    return path


def write_s1_geotiff(path: Path, s1: dict, grid: Grid, item: dict, extra_tags: dict | None = None):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = np.stack([np.nan_to_num(s1[p], nan=0).astype(np.float32) for p in ("vv", "vh")])
    p = item["properties"]
    acq = dt.datetime.fromisoformat(p["datetime"].replace("Z", "+00:00"))
    with rasterio.open(
        path, "w", driver="GTiff", width=grid.width, height=grid.height, count=2,
        dtype="float32", crs=grid.crs, transform=grid.transform, nodata=0,
        compress="deflate", predictor=3, tiled=True, blockxsize=256, blockysize=256,
    ) as dst:
        dst.write(data)
        dst.set_band_description(1, "VV gamma0 (linear)")
        dst.set_band_description(2, "VH gamma0 (linear)")
        tags = {
            "SENSOR": "Sentinel-1 C-SAR",
            "PLATFORM": p.get("platform", "SENTINEL-1").upper(),
            "PRODUCT_TYPE": "IW GRD, radiometrically terrain corrected (RTC gamma0)",
            "ACQUISITION_DATE": acq.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "ORBIT_STATE": p.get("sat:orbit_state", ""),
            "RELATIVE_ORBIT": str(p.get("sat:relative_orbit", "")),
            "POLARIZATIONS": "VV,VH",
            "FREQUENCY_BAND": "C (5.405 GHz)",
            "UNITS": "linear power",
            "SOURCE_PRODUCT": item["id"],
            "SOURCE": "Contains modified Copernicus Sentinel data processed by ESA; RTC by Catalyst/Microsoft Planetary Computer",
            "TIFFTAG_DATETIME": acq.strftime("%Y:%m:%d %H:%M:%S"),
            "TIFFTAG_IMAGEDESCRIPTION": f"SatQuery AI test sample | Sentinel-1 RTC VV/VH | {acq.date()}",
        }
        tags.update(extra_tags or {})
        dst.update_tags(**tags)
    return path


def file_info(path: Path) -> dict:
    return {
        "name": path.name,
        "url": "/" + str(path.relative_to(ROOT / "public")).replace(os.sep, "/"),
        "bytes": path.stat().st_size,
    }


def item_summary(item: dict) -> dict:
    p = item["properties"]
    return {
        "id": item["id"],
        "platform": p.get("platform"),
        "datetime": p["datetime"],
        "date": p["datetime"][:10],
        "cloud_cover": round(p.get("eo:cloud_cover", 0) or 0, 3) if "eo:cloud_cover" in p else None,
        "mgrs_tile": p.get("s2:mgrs_tile"),
        "processing_baseline": p.get("s2:processing_baseline"),
        "orbit_state": p.get("sat:orbit_state"),
        "relative_orbit": p.get("sat:relative_orbit"),
        "polarizations": p.get("sar:polarizations"),
    }


def spectral_profile(s2: dict, mask: np.ndarray) -> list:
    return [round(float(np.nanmean(s2[b][mask])), 4) for b in S2_BANDS]


def write_json(name: str, data: dict):
    GEN.mkdir(parents=True, exist_ok=True)
    (GEN / f"{name}.json").write_text(json.dumps(data, separators=(",", ":")))
    print(f"  wrote src/lib/demo/generated/{name}.json")


def r2(x, n=2):
    return round(float(x), n)


def local_time(iso: str, tz_hours=5.5, label="IST") -> str:
    t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00")) + dt.timedelta(hours=tz_hours)
    return t.strftime(f"%Y-%m-%d %H:%M {label}")


def rasterize_ring(ring_px, grid: Grid) -> np.ndarray:
    geom = {"type": "Polygon", "coordinates": [[(x, y) for x, y in ring_px] + [tuple(ring_px[0])]]}
    return features.rasterize([(geom, 1)], out_shape=(grid.height, grid.width), transform=Affine.identity()).astype(bool)


def point_px(grid: Grid, lon: float, lat: float):
    X, Y = warp_transform("EPSG:4326", grid.crs, [lon], [lat])
    return (X[0] - grid.bounds[0]) / grid.res, (grid.bounds[3] - Y[0]) / grid.res


# ─── Scenario 1: Hyderabad, single optical image ──────────────────────────

HYD = {
    "bbox": [78.440, 17.395, 78.505, 17.465],
    "epsg": 32644,
    "item": "S2B_MSIL2A_20250107T051119_R019_T44QKE_20250107T080132",
    # Hand-checked on the true-colour render (pixel coordinates, 10 m grid)
    "boxes": {
        "runway": ("Begumpet Airport runway 09/27", (165, 131, 482, 141)),
        "airport": ("Begumpet Airport (VOHY/BPM)", (123, 62, 498, 184)),
        "parade_ground": ("Parade Ground, Secunderabad", (552, 220, 600, 247)),
        "rail_yard": ("Secunderabad Jn railway yard", (628, 345, 702, 388)),
    },
    "named_green": {"Sanjeevaiah Park": (78.4822, 17.4351)},
}


def build_hyd():
    print("▶ Hyderabad (single optical)")
    grid = Grid(HYD["epsg"], HYD["bbox"])
    item = get_item("sentinel-2-l2a", HYD["item"])
    s2 = read_s2(item, grid)
    ix = indices(s2)
    cls = sieve(classify_optical(s2, ix), 12)
    out = PUBLIC / "hyd"
    tc = truecolor(s2)
    images = {
        "truecolor": save_img(tc, out / "truecolor.jpg"),
        "falsecolor": save_img(falsecolor(s2), out / "falsecolor.jpg"),
        "ndvi": save_img(NDVI_LUT((ix["ndvi"] + 0.1) / 0.9), out / "ndvi.jpg"),
        "classes": save_img(class_rgba(cls), out / "classes.png"),
        "thumb": thumb(tc, out / "thumb.jpg"),
    }

    water = cls == CLASS_IDS["water"]
    wpolys = polygons_from_mask(water, min_px=40, simplify=1.0, smooth=1)
    lake_poly = wpolys[0]
    lake_mask = rasterize_ring(lake_poly["outer_raw"], grid) & water
    lake = polygon_record(lake_poly, grid, "Hussain Sagar Lake", {
        "ndwi_mean": r2(np.nanmean(ix["ndwi"][lake_mask]), 3),
        "mndwi_mean": r2(np.nanmean(ix["mndwi"][lake_mask]), 3),
        "ndvi_mean": r2(np.nanmean(ix["ndvi"][lake_mask]), 3),
    })
    water_bodies = [lake] + [
        polygon_record(p, grid, f"Water body {i + 2}") for i, p in enumerate(wpolys[1:8]) if p["area_px"] >= 100
    ]

    # A vegetated patch inside the lake's northern lobe (floating vegetation / island)
    hull = rasterize_ring(lake_poly["outer_raw"], grid)
    inner_veg = hull & (cls == CLASS_IDS["vegetation"])
    inner = {
        "ha": r2(inner_veg.sum() * 0.01, 1),
        "ndvi_mean": r2(np.nanmean(ix["ndvi"][inner_veg]), 3) if inner_veg.any() else None,
    }

    veg = cls == CLASS_IDS["vegetation"]
    vpolys = polygons_from_mask(veg, min_px=300, simplify=2.5, smooth=1)
    green = []
    for name, (lon, lat) in HYD["named_green"].items():
        px, py = point_px(grid, lon, lat)
        for p in vpolys:
            if rasterize_ring(p["outer_raw"], grid)[int(py), int(px)]:
                green.append(polygon_record(p, grid, name))
                break
    for p in vpolys:
        if len(green) >= 4:
            break
        rec = polygon_record(p, grid, "Urban green patch")
        if all(rec["centroid_px"] != g["centroid_px"] for g in green):
            green.append(rec)

    boxes = {k: box_record(grid, label, *xyxy) for k, (label, xyxy) in HYD["boxes"].items()}
    rx0, ry0, rx1, ry1 = HYD["boxes"]["runway"][1]
    boxes["runway"]["length_m"] = round((rx1 - rx0) * grid.res)

    profiles = {name: spectral_profile(s2, cls == cid) for name, cid in CLASS_IDS.items()}
    profiles["lake"] = spectral_profile(s2, lake_mask)

    sample = write_s2_geotiff(SAMPLES / "HYD_S2L2A_20250107_T44QKE.tif", s2, grid, item,
                              {"SCENE": "Hyderabad - Hussain Sagar"})
    write_json("hyd", {
        "id": "hyd",
        "grid": grid.describe(),
        "item": item_summary(item),
        "acquired_local": local_time(item["properties"]["datetime"]),
        "images": images,
        "sample": file_info(sample),
        "classes": class_stats(cls),
        "water_bodies": {"count_ge_1ha": sum(1 for w in water_bodies if w["area_ha"] >= 1), "list": water_bodies},
        "lake_inner_vegetation": inner,
        "green_spaces": green,
        "boxes": boxes,
        "ndvi_mean": r2(np.nanmean(ix["ndvi"]), 3),
        "spectral": {
            "bands": S2_BANDS,
            "wavelengths_nm": [S2_META[b][1] for b in S2_BANDS],
            "profiles": profiles,
        },
    })


# ─── Scenario 2: Mumbai, co-registered optical + SAR ───────────────────────

MUM = {
    "bbox": [72.815, 19.030, 72.905, 19.105],
    "epsg": 32643,
    "s2": "S2B_MSIL2A_20250106T054129_R005_T43QBB_20250106T080057",
    "s1": "S1A_IW_GRDH_1SDV_20250107T010325_20250107T010350_057331_070E12_rtc",
    "water_names": [
        ("Arabian Sea", (72.818, 19.080)),
        ("Mahim Bay", (72.832, 19.037)),
        ("Mithi River", (72.873, 19.066)),
    ],
}
SAR_CLASS_RGB = {1: CLASS_RGB[1], 3: CLASS_RGB[3], 5: (0x6B, 0x76, 0x88)}


def build_mum():
    print("▶ Mumbai (optical + SAR)")
    grid = Grid(MUM["epsg"], MUM["bbox"])
    it2 = get_item("sentinel-2-l2a", MUM["s2"])
    it1 = get_item("sentinel-1-rtc", MUM["s1"])
    s2 = read_s2(it2, grid)
    s1 = read_s1(it1, grid)
    ix = indices(s2)
    vv, vh = to_db(s1["vv"]), to_db(s1["vh"])
    out = PUBLIC / "mum"

    opt = sieve(classify_optical(s2, ix), 12)

    # SAR-only: Otsu water threshold on VV (dB) within the dark mode, strong double-bounce = built-up
    t_water = otsu(vv, -28, -5)
    sar = np.full(opt.shape, 5, np.uint8)  # 5 = other (vegetation / open land)
    sar[vv > -4.0] = CLASS_IDS["builtup"]
    sar[vv < t_water] = CLASS_IDS["water"]
    sar = sieve(sar, 12)

    # Rule-based late fusion (optical spectral evidence + SAR structural evidence)
    ow = opt == CLASS_IDS["water"]
    sw = sar == CLASS_IDS["water"]
    fused = np.zeros(opt.shape, np.uint8)
    water_f = (ow & (vv < t_water + 4)) | (ix["mndwi"] > 0.35) | (sw & (ix["mndwi"] > -0.05) & (ix["ndvi"] < 0.1))
    veg_f = ~water_f & (ix["ndvi"] > 0.33)
    rest = ~water_f & ~veg_f
    built_f = rest & ((vv > -8.0) | ((opt == CLASS_IDS["builtup"]) & (vv > t_water + 2)))
    # SAR-dark but optically dry: dark tarmac (runways) is impervious, bright sand / intertidal is open land
    smooth = rest & sw & (ix["mndwi"] < -0.05)
    bright_rgb = (s2["B02"] + s2["B03"] + s2["B04"]) / 3
    smooth_impervious = smooth & (bright_rgb < 0.16) & (nd(s2["B04"], s2["B03"]) < 0.08)
    fused[rest] = CLASS_IDS["bare"]
    fused[(built_f & ~smooth) | smooth_impervious] = CLASS_IDS["builtup"]
    fused[veg_f] = CLASS_IDS["vegetation"]
    fused[water_f] = CLASS_IDS["water"]
    fused = sieve(fused, 12)

    # Disagreements the fusion resolves
    sar_false_water = sw & ~(fused == CLASS_IDS["water"])
    sar_false_water = sieve(sar_false_water.astype(np.uint8), 30).astype(bool)
    opt_overcall = (opt == CLASS_IDS["builtup"]) & (fused == CLASS_IDS["bare"])
    opt_overcall = sieve(opt_overcall.astype(np.uint8), 30).astype(bool)
    opt_undercall = (opt == CLASS_IDS["bare"]) & (fused == CLASS_IDS["builtup"])  # red roofs read as soil
    opt_undercall = sieve(opt_undercall.astype(np.uint8), 30).astype(bool)
    dis = np.zeros(opt.shape + (4,), np.uint8)
    dis[sar_false_water] = (*ORANGE, 255)
    dis[opt_overcall | opt_undercall] = (*AQUA, 255)

    runway_polys = polygons_from_mask(sar_false_water, min_px=300, simplify=2.0, smooth=1)
    runways = [polygon_record(p, grid, "SAR-dark smooth surface (not water)") for p in runway_polys[:4]]
    if runways:
        runways[0]["label"] = "CSMIA runways & taxiways"

    wpolys = polygons_from_mask(fused == CLASS_IDS["water"], min_px=150, simplify=1.8, smooth=1)
    water_bodies = []
    for p in wpolys[:10]:
        m = rasterize_ring(p["outer_raw"], grid)
        name = "Water body"
        for nm, (lon, lat) in MUM["water_names"]:
            px, py = point_px(grid, lon, lat)
            if 0 <= int(py) < grid.height and 0 <= int(px) < grid.width and m[int(py), int(px)]:
                name = nm
                break
        water_bodies.append(polygon_record(p, grid, name, {"vv_mean_db": r2(np.nanmean(vv[m & (fused == 1)]), 1)}))

    # Point targets on water (moored vessels / structures): bright VV blobs inside the fused water mask
    water_core = features.sieve((fused == CLASS_IDS["water"]).astype(np.uint8), 2000).astype(bool)
    bright = water_core & (vv > -2.0)
    vessels = []
    for geom, val in features.shapes(bright.astype(np.uint8), mask=bright, connectivity=8, transform=Affine.identity()):
        ring = geom["coordinates"][0]
        xs = [q[0] for q in ring]
        ys = [q[1] for q in ring]
        a = ring_area([tuple(q) for q in ring[:-1]])
        if a > 60:  # large bright structures (bridges, jetties) are not point targets
            continue
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        x0, x1 = int(max(cx - 8, 0)), int(min(cx + 9, grid.width))
        y0, y1 = int(max(cy - 8, 0)), int(min(cy + 9, grid.height))
        if cx < 25 or cy > grid.height - 10 or water_core[y0:y1, x0:x1].mean() < 0.85:
            continue  # scene-edge sidelobes and shoreline clutter
        lon, lat = grid.px_to_lonlat([cx], [cy])
        yy, xx = int(cy), int(cx)
        vessels.append({"px": [round(cx, 1), round(cy, 1)], "lonlat": [round(lon[0], 6), round(lat[0], 6)],
                        "vv_db": r2(np.nanmax(vv[max(yy - 1, 0):yy + 2, max(xx - 1, 0):xx + 2]), 1), "pixels": int(a)})

    tc = truecolor(s2)
    sar_gray = stretch(vv, -25, 5, 1.0)
    sar_rgb = rgb_u8(stretch(vv, -22, 2), stretch(vh, -28, -5), stretch(vv - vh, 2, 14))
    fusion_rgb = rgb_u8(stretch(vv, -20, 4), stretch(s2["B08"], 0.02, 0.38, 1.1), stretch(ix["mndwi"], -0.5, 0.6))
    sar_cls_rgba = np.zeros(opt.shape + (4,), np.uint8)
    for cid, rgb in SAR_CLASS_RGB.items():
        sar_cls_rgba[sar == cid, :3] = rgb
        sar_cls_rgba[sar == cid, 3] = 255
    images = {
        "truecolor": save_img(tc, out / "truecolor.jpg"),
        "falsecolor": save_img(falsecolor(s2), out / "falsecolor.jpg"),
        "sar_vv": save_img(rgb_u8(sar_gray, sar_gray, sar_gray), out / "sar_vv.jpg"),
        "sar_rgb": save_img(sar_rgb, out / "sar_rgb.jpg"),
        "fusion_rgb": save_img(fusion_rgb, out / "fusion_rgb.jpg"),
        "cls_optical": save_img(class_rgba(opt), out / "cls_optical.png"),
        "cls_sar": save_img(sar_cls_rgba, out / "cls_sar.png"),
        "cls_fused": save_img(class_rgba(fused), out / "cls_fused.png"),
        "disagreement": save_img(dis, out / "disagreement.png"),
        "thumb_optical": thumb(tc, out / "thumb_optical.jpg"),
        "thumb_sar": thumb(rgb_u8(sar_gray, sar_gray, sar_gray), out / "thumb_sar.jpg"),
    }

    def iou(a, b):
        return r2((a & b).sum() / max((a | b).sum(), 1), 3)

    bins = np.linspace(-30, 10, 81)
    hist = {"edges_db": [r2(b, 1) for b in bins], "total": np.histogram(vv[np.isfinite(vv)], bins)[0].tolist(), "by_class": {}}
    for name, cid in CLASS_IDS.items():
        m = (fused == cid) & np.isfinite(vv)
        hist["by_class"][name] = np.histogram(vv[m], bins)[0].tolist()

    rng = np.random.default_rng(7)
    valid = np.isfinite(vv) & np.isfinite(ix["mndwi"]) & (fused > 0)
    ys, xs = np.nonzero(valid)
    pick = rng.choice(len(ys), size=1400, replace=False)
    scatter = [[r2(vv[ys[i], xs[i]], 1), r2(ix["mndwi"][ys[i], xs[i]], 3), r2(ix["ndvi"][ys[i], xs[i]], 3), int(fused[ys[i], xs[i]]),
                bool(sar_false_water[ys[i], xs[i]])] for i in pick]

    per_class = {}
    for name, cid in CLASS_IDS.items():
        m = fused == cid
        if not m.any():
            continue
        per_class[name] = {"vv_db": r2(np.nanmean(vv[m]), 1), "vh_db": r2(np.nanmean(vh[m]), 1),
                           "ndvi": r2(np.nanmean(ix["ndvi"][m]), 3), "mndwi": r2(np.nanmean(ix["mndwi"][m]), 3)}
        per_class[name]["agreement_pct"] = r2(100 * (
            (opt[m] == cid).mean() * 0.5 + ((sar[m] == cid).mean() if cid in (1, 3) else (sar[m] == 5).mean()) * 0.5), 1)

    s2_path = write_s2_geotiff(SAMPLES / "MUM_S2L2A_20250106_T43QBB.tif", s2, grid, it2, {"SCENE": "Mumbai - BKC / CSMIA"})
    s1_path = write_s1_geotiff(SAMPLES / "MUM_S1RTC_20250107_VVVH.tif", s1, grid, it1, {"SCENE": "Mumbai - BKC / CSMIA"})
    sar_stats = {name: {"pixels": int((sar == cid).sum()), "ha": r2((sar == cid).sum() * 0.01, 1),
                        "pct": r2(100 * (sar == cid).mean(), 2)} for name, cid in (("water", 1), ("builtup", 3), ("other", 5))}
    write_json("mum", {
        "id": "mum",
        "grid": grid.describe(),
        "items": {"s2": item_summary(it2), "s1": item_summary(it1)},
        "acquired_local": {"s2": local_time(it2["properties"]["datetime"]), "s1": local_time(it1["properties"]["datetime"])},
        "images": images,
        "samples": {"s2": file_info(s2_path), "s1": file_info(s1_path)},
        "sar_water_threshold_db": r2(t_water, 1),
        "classes": {"optical": class_stats(opt), "sar": sar_stats, "fused": class_stats(fused)},
        "agreement": {
            "water_iou": iou(ow, sw),
            "builtup_iou": iou(opt == CLASS_IDS["builtup"], sar == CLASS_IDS["builtup"]),
            "fused_vs_optical_pct": r2(100 * (fused == opt).mean(), 1),
        },
        "corrections": {
            "sar_false_water_ha": r2(sar_false_water.sum() * 0.01, 1),
            "optical_builtup_to_open_ha": r2(opt_overcall.sum() * 0.01, 1),
            "optical_bare_to_builtup_ha": r2(opt_undercall.sum() * 0.01, 1),
            "smooth_open_ha": r2((smooth & ~smooth_impervious).sum() * 0.01, 1),
            "smooth_impervious_ha": r2(smooth_impervious.sum() * 0.01, 1),
        },
        "runways": runways,
        "water_bodies": water_bodies,
        "vessels": vessels,
        "per_class": per_class,
        "histogram": hist,
        "scatter": scatter,
    })


# ─── Scenario 3: Navi Mumbai International Airport, bi-temporal ────────────

NMIA = {
    "bbox": [73.030, 18.965, 73.110, 19.025],
    "epsg": 32643,
    "t1": "S2A_MSIL2A_20170103T054222_R005_T43QBB_20210529T134925",
    "t2": "S2C_MSIL2A_20260116T054201_R005_T43QBB_20260116T091409",
    "tile": "43QBB",
    # Airport platform boundary digitised on the 2026-01-16 true-colour render (pixel coordinates)
    "footprint_px": [(100, 273), (300, 249), (358, 246), (371, 262), (567, 241), (682, 376), (625, 445), (100, 502)],
    "ulwe_node": (73.038, 18.972),
}
CHANGE_TYPES = [
    # key, label, rgb, test(from, to)
    ("veg_to_built", "Vegetation → built-up / developed", (242, 153, 74), lambda a, b: (a == 2) & (b == 3)),
    ("bare_to_built", "Open land → built-up / developed", (235, 87, 87), lambda a, b: (a == 4) & (b == 3)),
    ("veg_to_bare", "Vegetation → open land", (242, 201, 76), lambda a, b: (a == 2) & (b == 4)),
    ("water_to_land", "Water → land (reclamation)", (155, 81, 224), lambda a, b: (a == 1) & (b != 1)),
    ("land_to_water", "Land → water", (45, 212, 191), lambda a, b: (a != 1) & (b == 1)),
    ("veg_gain", "Vegetation gain", (163, 230, 53), lambda a, b: (a != 2) & (b == 2) & (a != 1)),
    ("other", "Other change", (189, 189, 189), lambda a, b: np.ones_like(a, bool)),
]


CLUSTER_LABELS = {
    "land_to_water": "Realigned water channel",
    "water_to_land": "Creek-edge reclamation",
    "veg_gain": "Vegetation regrowth (hill slopes)",
    "bare_to_built": "New built-up area",
    "veg_to_built": "Vegetation cleared for development",
    "veg_to_bare": "Vegetation cleared (open land)",
}


def nmia_yearly_items(grid: Grid) -> dict:
    """One clear Jan-Feb scene per year on the same MGRS tile; least hazy of the clearest eight."""
    cache = CACHE / "nmia_yearly_janfeb.json"
    if cache.exists():
        return {int(k): v for k, v in json.loads(cache.read_text()).items()}
    picks = {}
    for yr in range(2016, 2027):
        body = {"collections": ["sentinel-2-l2a"], "bbox": NMIA["bbox"], "datetime": f"{yr}-01-01/{yr}-02-28",
                "limit": 100, "query": {"eo:cloud_cover": {"lt": 1}, "s2:mgrs_tile": {"eq": NMIA["tile"]}}}
        feats = requests.post(f"{STAC}/search", json=body, timeout=90).json()["features"]
        feats.sort(key=lambda f: f["properties"]["eo:cloud_cover"])
        best = None
        for f in feats[:8]:
            item = get_item("sentinel-2-l2a", f["id"])
            b = read_s2(item, grid, ["B02"])["B02"]
            if np.isnan(b).any():
                continue
            haze = float(np.nanmedian(b))
            if best is None or haze < best[0]:
                best = (haze, f["id"])
        if best:
            picks[yr] = best[1]
            print(f"  {yr}: {best[1]} (median blue {best[0]:.3f})")
    cache.write_text(json.dumps(picks, indent=1))
    return picks


def build_nmia():
    print("▶ Navi Mumbai airport (bi-temporal)")
    grid = Grid(NMIA["epsg"], NMIA["bbox"])
    it1 = get_item("sentinel-2-l2a", NMIA["t1"])
    it2 = get_item("sentinel-2-l2a", NMIA["t2"])
    a, b = read_s2(it1, grid), read_s2(it2, grid)
    ia, ib = indices(a), indices(b)
    c1 = sieve(classify_periurban(a), 16)
    c2 = sieve(classify_periurban(b), 16)
    out = PUBLIC / "nmia"

    # Change vector magnitude over (NDVI, MNDWI, NDBI, brightness)
    bright_a = (a["B02"] + a["B03"] + a["B04"]) / 3
    bright_b = (b["B02"] + b["B03"] + b["B04"]) / 3
    cva = np.sqrt((ib["ndvi"] - ia["ndvi"]) ** 2 + (ib["mndwi"] - ia["mndwi"]) ** 2 +
                  (ib["ndbi"] - ia["ndbi"]) ** 2 + (4 * (bright_b - bright_a)) ** 2)
    changed = (c1 != c2) & (cva > 0.12)
    changed = sieve(changed.astype(np.uint8), 25).astype(bool)

    ctype = np.zeros(c1.shape, np.uint8)
    remaining = changed.copy()
    by_type = []
    for i, (key, label, _rgb, test) in enumerate(CHANGE_TYPES, start=1):
        m = remaining & test(c1, c2)
        remaining &= ~m
        ctype[m] = i
        by_type.append({"key": key, "label": label, "ha": r2(m.sum() * 0.01, 1)})
    change_rgba = class_rgba(np.where(changed, c2, 0).astype(np.uint8))
    veg_loss = changed & (c1 == CLASS_IDS["vegetation"]) & (c2 != CLASS_IDS["vegetation"])
    water_to_land = changed & (c1 == CLASS_IDS["water"]) & (c2 != CLASS_IDS["water"])
    land_to_water = changed & (c1 != CLASS_IDS["water"]) & (c2 == CLASS_IDS["water"])
    water_rgba = mask_rgba(water_to_land, CLASS_RGB[1])
    water_rgba[land_to_water] = (*AQUA, 255)

    def breakdown_of(m):
        rows = []
        for i, (key, label, rgb, _t) in enumerate(CHANGE_TYPES, start=1):
            ha = r2((ctype[m] == i).sum() * 0.01, 1)
            if ha > 0:
                rows.append({"key": key, "ha": ha})
        return sorted(rows, key=lambda x: -x["ha"])

    ring = [tuple(map(float, q)) for q in NMIA["footprint_px"]]
    fp_mask = rasterize_ring(ring, grid)
    fp_poly = {"outer": ring, "outer_raw": ring, "area_px": float(fp_mask.sum()), "holes": []}
    fp_changed = fp_mask & changed
    fp_bd = breakdown_of(fp_changed)
    footprint = polygon_record(fp_poly, grid, "NMIA airside platform", {
        "changed_ha": r2(fp_changed.sum() * 0.01, 1),
        "changed_pct": r2(100 * fp_changed.sum() / max(fp_mask.sum(), 1), 1),
        "dominant": fp_bd[0]["key"] if fp_bd else "other",
        "breakdown": fp_bd,
        "cva_mean": r2(np.nanmean(cva[fp_mask]), 3),
        "t1": {n: r2(100 * (c1[fp_mask] == cid).mean(), 1) for n, cid in CLASS_IDS.items()},
        "t2": {n: r2(100 * (c2[fp_mask] == cid).mean(), 1) for n, cid in CLASS_IDS.items()},
    })

    regions = [footprint]
    outside = changed & ~fp_mask
    ux, uy = point_px(grid, *NMIA["ulwe_node"])
    for p in polygons_from_mask(outside, min_px=300, simplify=2.5, smooth=1)[:5]:
        pm = rasterize_ring(p["outer_raw"], grid)
        m = pm & outside
        bd = breakdown_of(m)
        cx = sum(q[0] for q in p["outer"]) / len(p["outer"])
        cy_ = sum(q[1] for q in p["outer"]) / len(p["outer"])
        label = "Ulwe node expansion" if math.dist((cx, cy_), (ux, uy)) < 120 else CLUSTER_LABELS.get(
            bd[0]["key"] if bd else "other", "Change cluster")
        regions.append(polygon_record(p, grid, label, {
            "changed_ha": r2(m.sum() * 0.01, 1),
            "dominant": bd[0]["key"] if bd else "other",
            "breakdown": bd,
            "cva_mean": r2(np.nanmean(cva[m]), 3),
        }))

    k = len(CLASS_IDS)
    names = list(CLASS_IDS.keys())
    mat = np.zeros((k, k))
    for i, n1 in enumerate(names):
        for j, n2 in enumerate(names):
            mat[i, j] = ((c1 == CLASS_IDS[n1]) & (c2 == CLASS_IDS[n2])).sum() * 0.01

    # Yearly time series
    series = []
    yearly = nmia_yearly_items(grid)
    yearly[2017], yearly[2026] = NMIA["t1"], NMIA["t2"]
    for yr in sorted(yearly):
        it = get_item("sentinel-2-l2a", yearly[yr])
        s = read_s2(it, grid, ["B02", "B03", "B04", "B08", "B11"])
        s["B12"] = s["B11"]
        ixy = indices(s)
        cy = sieve(classify_periurban(s), 16)
        st = class_stats(cy)
        img = save_img(truecolor(s), out / "years" / f"{yr}.jpg", quality=84)
        series.append({
            "year": yr,
            "date": it["properties"]["datetime"][:10],
            "item": it["id"],
            "image": img,
            **{f"{n}_pct": st[n]["pct"] for n in names},
            **{f"{n}_ha": st[n]["ha"] for n in names},
            "ndvi_mean": r2(np.nanmean(ixy["ndvi"]), 3),
            "footprint_builtup_pct": r2(100 * (cy[fp_mask] == 3).mean(), 1) if fp_mask.any() else None,
            "footprint_vegetation_pct": r2(100 * (cy[fp_mask] == 2).mean(), 1) if fp_mask.any() else None,
            "footprint_water_pct": r2(100 * (cy[fp_mask] == 1).mean(), 1) if fp_mask.any() else None,
            "footprint_developed_pct": r2(100 * np.isin(cy[fp_mask], (3, 4)).mean(), 1) if fp_mask.any() else None,
        })
        print(f"  {yr} built-up {st['builtup']['pct']}% veg {st['vegetation']['pct']}% footprint built {series[-1]['footprint_builtup_pct']}%")

    tc1, tc2 = truecolor(a), truecolor(b)
    heat = HEAT_LUT(np.clip(cva / 0.6, 0, 1))
    heat_rgba = np.dstack([heat, (np.clip(np.nan_to_num(cva / 0.35), 0, 1) * 235).astype(np.uint8)])
    images = {
        "t1_truecolor": save_img(tc1, out / "t1_truecolor.jpg"),
        "t2_truecolor": save_img(tc2, out / "t2_truecolor.jpg"),
        "t1_falsecolor": save_img(falsecolor(a), out / "t1_falsecolor.jpg"),
        "t2_falsecolor": save_img(falsecolor(b), out / "t2_falsecolor.jpg"),
        "t1_classes": save_img(class_rgba(c1), out / "t1_classes.png"),
        "t2_classes": save_img(class_rgba(c2), out / "t2_classes.png"),
        "change": save_img(change_rgba, out / "change.png"),
        "change_vegloss": save_img(mask_rgba(veg_loss, ORANGE), out / "change_vegloss.png"),
        "change_water": save_img(water_rgba, out / "change_water.png"),
        "change_heat": save_img(heat_rgba, out / "change_heat.png", palette=96),
        "thumb_t1": thumb(tc1, out / "thumb_t1.jpg"),
        "thumb_t2": thumb(tc2, out / "thumb_t2.jpg"),
    }
    t1_path = write_s2_geotiff(SAMPLES / "NMIA_S2L2A_20170103_T43QBB.tif", a, grid, it1, {"SCENE": "Navi Mumbai airport site"})
    t2_path = write_s2_geotiff(SAMPLES / "NMIA_S2L2A_20260116_T43QBB.tif", b, grid, it2, {"SCENE": "Navi Mumbai airport site"})
    write_json("nmia", {
        "id": "nmia",
        "grid": grid.describe(),
        "items": {"t1": item_summary(it1), "t2": item_summary(it2)},
        "images": images,
        "samples": {"t1": file_info(t1_path), "t2": file_info(t2_path)},
        "classes": {"t1": class_stats(c1), "t2": class_stats(c2)},
        "transitions": {"classes": names, "matrix_ha": [[r2(v, 1) for v in row] for row in mat]},
        "change": {
            "changed_ha": r2(changed.sum() * 0.01, 1),
            "changed_pct": r2(100 * changed.mean(), 2),
            "cva_threshold": 0.12,
            "by_type": by_type,
            "veg_loss_ha": r2(veg_loss.sum() * 0.01, 1),
            "water_to_land_ha": r2(water_to_land.sum() * 0.01, 1),
            "land_to_water_ha": r2(land_to_water.sum() * 0.01, 1),
        },
        "regions": regions,
        "footprint": footprint,
        "timeseries": series,
    })


SCENARIOS = {"hyd": build_hyd, "mum": build_mum, "nmia": build_nmia}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(SCENARIOS)
    for name in wanted:
        SCENARIOS[name]()
    print("done")
