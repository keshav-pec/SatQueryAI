"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { AttributionControl, Map as MLMap, Marker, NavigationControl, ScaleControl, setWorkerUrl } from "maplibre-gl";
import type { GeoJSONSource, ImageSource, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { EvidenceItem, LonLat } from "@/lib/types";

export type Basemap = "satellite" | "hybrid" | "dark";

export interface MapImageLayer {
  id: string;
  url: string;
  corners: [LonLat, LonLat, LonLat, LonLat];
  opacity: number;
  visible: boolean;
}

export interface MapFootprint {
  id: string;
  corners: [LonLat, LonLat, LonLat, LonLat];
  label: string;
  color: string;
}

export interface MapMarker {
  id: string;
  lonlat: LonLat;
  label: string;
  sublabel?: string;
  anchor?: "top" | "left" | "right";
  onClick?: () => void;
}

export interface MapLine {
  id: string;
  coords: LonLat[];
  label?: string;
  color?: string;
}

export interface GeoMapProps {
  footprints?: MapFootprint[];
  lines?: MapLine[];
  images?: MapImageLayer[];
  evidence?: EvidenceItem[];
  markers?: MapMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  fitTo?: { bbox: [number, number, number, number]; nonce: number; maxZoom?: number; duration?: number } | null;
  basemap?: Basemap;
  onHover?: (ll: LonLat | null) => void;
  globe?: boolean;
  initialView?: { center: LonLat; zoom: number; pitch?: number; bearing?: number };
  spin?: boolean;
  interactive?: boolean;
  showControls?: boolean;
  className?: string;
}

// Worker copied to /public by scripts/copy-maplibre-worker.mjs (bundlers relocate import.meta.url)
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

function buildStyle(globe: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community",
      },
      labels: {
        type: "raster",
        tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 19,
      },
      dark: {
        type: "raster",
        tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#060a12" } },
      { id: "dark", type: "raster", source: "dark", layout: { visibility: "none" } },
      { id: "esri", type: "raster", source: "esri", paint: { "raster-fade-duration": 200 } },
      { id: "labels", type: "raster", source: "labels", layout: { visibility: "none" } },
    ],
    ...(globe
      ? {
          projection: { type: "globe" },
          sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
        }
      : {}),
  } as StyleSpecification;
}

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };

function evidenceToGeoJSON(items: EvidenceItem[], activeId?: string | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const e of items) {
    const props = { id: e.id, color: e.color ?? "#3bd5ff", active: e.id === activeId ? 1 : 0, label: e.label };
    if (e.points) {
      for (const p of e.points) features.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: p.lonlat } });
    } else if (e.lonlat && e.lonlat.length >= 3) {
      features.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [[...e.lonlat, e.lonlat[0]]] } });
    }
  }
  return { type: "FeatureCollection", features };
}

function footprintsToGeoJSON(fps: MapFootprint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fps.map((f) => ({
      type: "Feature",
      properties: { id: f.id, color: f.color, label: f.label },
      geometry: { type: "Polygon", coordinates: [[...f.corners, f.corners[0]]] },
    })),
  };
}

function labelAnchor(e: EvidenceItem): LonLat | null {
  if (e.points?.length) return e.points[0].lonlat;
  if (!e.lonlat?.length) return null;
  // top-most vertex keeps the label clear of the shape
  return e.lonlat.reduce((best, p) => (p[1] > best[1] ? p : best), e.lonlat[0]);
}

export default function GeoMap({
  footprints = [],
  lines = [],
  images = [],
  evidence = [],
  markers = [],
  activeId,
  onSelect,
  fitTo,
  basemap = "satellite",
  onHover,
  globe = false,
  initialView,
  spin = false,
  interactive = true,
  showControls = true,
  className,
}: GeoMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const labelMarkers = useRef<Marker[]>([]);
  const poiMarkers = useRef<Marker[]>([]);
  const lineMarkers = useRef<Marker[]>([]);
  const imageIds = useRef<Set<string>>(new Set());
  const handlers = useRef({ onSelect, onHover });
  useEffect(() => {
    handlers.current = { onSelect, onHover };
  });

  useEffect(() => {
    if (!el.current) return;
    const m = new MLMap({
      container: el.current,
      style: buildStyle(globe),
      center: initialView?.center ?? [78.9, 21.5],
      zoom: initialView?.zoom ?? 3.6,
      pitch: initialView?.pitch ?? 0,
      bearing: initialView?.bearing ?? 0,
      attributionControl: false,
      interactive,
      maxZoom: 18.5,
      fadeDuration: 150,
    });
    map.current = m;
    if (showControls) {
      m.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      m.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    }
    m.addControl(new AttributionControl({ compact: true }), "bottom-right");
    m.on("load", () => {
      m.addSource("footprints", { type: "geojson", data: EMPTY_FC });
      m.addSource("evidence", { type: "geojson", data: EMPTY_FC });
      m.addSource("lines", { type: "geojson", data: EMPTY_FC });
      m.addLayer({ id: "ln", type: "line", source: "lines", paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [2, 2] } });
      m.addLayer({ id: "fp-fill", type: "fill", source: "footprints", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.04 } });
      m.addLayer({ id: "fp-line", type: "line", source: "footprints", paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-dasharray": [3, 2] } });
      m.addLayer({
        id: "ev-fill",
        type: "fill",
        source: "evidence",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["==", ["get", "active"], 1], 0.24, 0.1] },
      });
      m.addLayer({
        id: "ev-line",
        type: "line",
        source: "evidence",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": ["get", "color"], "line-width": ["case", ["==", ["get", "active"], 1], 3.2, 2] },
      });
      m.addLayer({
        id: "ev-pt",
        type: "circle",
        source: "evidence",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 5, "circle-color": ["get", "color"], "circle-stroke-color": "#0d131d", "circle-stroke-width": 2 },
      });
      for (const layer of ["ev-fill", "ev-pt"]) {
        m.on("click", layer, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) handlers.current.onSelect?.(id);
        });
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }
      setReady(true);
    });
    m.on("mousemove", (e) => handlers.current.onHover?.([e.lngLat.lng, e.lngLat.lat]));
    m.on("mouseout", () => handlers.current.onHover?.(null));
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);
    const ids = imageIds.current;
    const labels = labelMarkers;
    const pois = poiMarkers;
    const lineMks = lineMarkers;
    return () => {
      ro.disconnect();
      labels.current.forEach((mk) => mk.remove());
      pois.current.forEach((mk) => mk.remove());
      lineMks.current.forEach((mk) => mk.remove());
      m.remove();
      map.current = null;
      ids.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.setLayoutProperty("esri", "visibility", basemap === "dark" ? "none" : "visible");
    m.setLayoutProperty("labels", "visibility", basemap === "hybrid" ? "visible" : "none");
    m.setLayoutProperty("dark", "visibility", basemap === "dark" ? "visible" : "none");
  }, [basemap, ready]);

  // Georeferenced image overlays
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const wanted = new Set(images.map((i) => i.id));
    for (const id of [...imageIds.current]) {
      if (!wanted.has(id)) {
        if (m.getLayer(`img-${id}`)) m.removeLayer(`img-${id}`);
        if (m.getSource(`img-${id}`)) m.removeSource(`img-${id}`);
        imageIds.current.delete(id);
      }
    }
    for (const img of images) {
      const sid = `img-${img.id}`;
      const src = m.getSource(sid) as ImageSource | undefined;
      if (!src) {
        m.addSource(sid, { type: "image", url: img.url, coordinates: img.corners });
        m.addLayer({ id: sid, type: "raster", source: sid, paint: { "raster-opacity": img.opacity, "raster-fade-duration": 0, "raster-resampling": "linear" } }, "labels");
        imageIds.current.add(img.id);
      } else if ((src as unknown as { url?: string }).url !== img.url) {
        src.updateImage({ url: img.url, coordinates: img.corners });
      }
      m.setPaintProperty(sid, "raster-opacity", img.opacity);
      m.setLayoutProperty(sid, "visibility", img.visible ? "visible" : "none");
    }
    // keep evidence on top of overlays
    for (const id of ["fp-fill", "fp-line", "ev-fill", "ev-line", "ev-pt"]) if (m.getLayer(id)) m.moveLayer(id);
  }, [images, ready]);

  // Footprints
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("footprints") as GeoJSONSource).setData(footprintsToGeoJSON(footprints));
  }, [footprints, ready]);

  // Evidence + labels
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("evidence") as GeoJSONSource).setData(evidenceToGeoJSON(evidence, activeId));
    labelMarkers.current.forEach((mk) => mk.remove());
    labelMarkers.current = [];
    for (const e of evidence.slice(0, 8)) {
      const at = labelAnchor(e);
      if (!at) continue;
      const node = document.createElement("button");
      const active = e.id === activeId;
      node.textContent = `${e.label} · ${Math.round(e.confidence * 100)}%`;
      node.style.cssText = `font: 600 11.5px/1.2 var(--font-inter), system-ui, sans-serif; padding: 3px 8px; border-radius: 6px; white-space: nowrap; cursor: pointer; border: 1px solid ${e.color ?? "#3bd5ff"}; color: ${active ? "#06131a" : e.color ?? "#3bd5ff"}; background: ${active ? e.color ?? "#3bd5ff" : "rgba(6,10,18,0.86)"}; box-shadow: 0 6px 18px -6px rgba(0,0,0,.7);`;
      node.onclick = (ev) => {
        ev.stopPropagation();
        handlers.current.onSelect?.(e.id);
      };
      labelMarkers.current.push(new Marker({ element: node, anchor: "bottom", offset: [0, -6] }).setLngLat(at).addTo(m));
    }
  }, [evidence, activeId, ready]);

  // Connector lines with a midpoint label (e.g. distance between mismatched footprints)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("lines") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: lines.map((l) => ({ type: "Feature", properties: { id: l.id, color: l.color ?? "#ff6b6b" }, geometry: { type: "LineString", coordinates: l.coords } })),
    });
    lineMarkers.current.forEach((mk) => mk.remove());
    lineMarkers.current = lines
      .filter((l) => l.label)
      .map((l) => {
        const a = l.coords[0];
        const b = l.coords[l.coords.length - 1];
        const node = document.createElement("div");
        node.textContent = l.label!;
        node.style.cssText = `font: 700 12.5px/1.2 var(--font-inter), system-ui, sans-serif; color: #1b0505; background: ${l.color ?? "#ff6b6b"}; padding: 4px 9px; border-radius: 7px; white-space: nowrap; box-shadow: 0 8px 22px -8px rgba(0,0,0,.8);`;
        return new Marker({ element: node }).setLngLat([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]).addTo(m);
      });
  }, [lines, ready]);

  // Point-of-interest markers (home page coverage map)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    poiMarkers.current.forEach((mk) => mk.remove());
    poiMarkers.current = markers.map((mk) => {
      const side = mk.anchor ?? "top";
      const node = document.createElement("button");
      const dot = document.createElement("span");
      dot.style.cssText = `display:block;width:12px;height:12px;border-radius:50%;background:#ff9933;box-shadow:0 0 0 4px rgba(255,153,51,.25),0 0 18px 4px rgba(255,153,51,.45);flex-shrink:0;${side === "top" ? "margin:0 auto 6px" : ""}`;
      const text = document.createElement("span");
      text.style.cssText = "display:block;text-align:left";
      const label = document.createElement("span");
      label.textContent = mk.label;
      label.style.cssText = "display:block;font:600 12px/1.2 var(--font-inter),system-ui;color:#e9eef6;background:rgba(6,10,18,.82);border:1px solid rgba(255,255,255,.16);padding:4px 8px;border-radius:7px;white-space:nowrap";
      text.appendChild(label);
      if (mk.sublabel) {
        const sub = document.createElement("span");
        sub.textContent = mk.sublabel;
        sub.style.cssText = "display:block;margin-top:2px;font:500 10.5px/1.2 var(--font-inter),system-ui;color:#a9b4c6;white-space:nowrap";
        text.appendChild(sub);
      }
      node.style.cssText = `background:none;border:0;cursor:pointer;display:flex;align-items:center;gap:8px;flex-direction:${side === "top" ? "column" : side === "left" ? "row" : "row-reverse"}`;
      node.append(dot, text);
      node.onclick = () => mk.onClick?.();
      const anchor = side === "top" ? "top" : side === "left" ? "left" : "right";
      const offset: [number, number] = side === "top" ? [0, -6] : side === "left" ? [-6, 0] : [6, 0];
      return new Marker({ element: node, anchor, offset }).setLngLat(mk.lonlat).addTo(m);
    });
  }, [markers, ready]);

  // Camera
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !fitTo) return;
    const [minx, miny, maxx, maxy] = fitTo.bbox;
    m.fitBounds(
      [
        [minx, miny],
        [maxx, maxy],
      ],
      { padding: 56, duration: fitTo.duration ?? 2600, maxZoom: fitTo.maxZoom ?? 15.2, essential: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTo?.nonce, ready]);

  // Gentle sway of the globe around its initial centre (landing page)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !spin) return;
    let raf = 0;
    let paused = false;
    const base = m.getCenter();
    const t0 = performance.now();
    const pause = () => (paused = true);
    m.on("mousedown", pause);
    m.on("touchstart", pause);
    const tick = (now: number) => {
      if (!paused && m.getZoom() < 5) m.setCenter([base.lng + 9 * Math.sin((now - t0) / 5200), base.lat]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      m.off("mousedown", pause);
      m.off("touchstart", pause);
    };
  }, [spin, ready]);

  return <div ref={el} className={className} style={{ width: "100%", height: "100%" }} />;
}
