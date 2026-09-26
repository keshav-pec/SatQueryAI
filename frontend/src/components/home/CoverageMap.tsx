"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Crosshair, Globe2 } from "lucide-react";
import { MapView, type MapFootprint, type MapImageLayer, type MapMarker } from "@/components/map/MapView";
import { HYD, MUM, NMIA } from "@/lib/demo/data";
import type { LonLat } from "@/lib/types";

type Corners = [LonLat, LonLat, LonLat, LonLat];

const AOIS = [
  {
    id: "hyd",
    name: "Hyderabad — Hussain Sagar",
    short: "Hyderabad",
    kind: "single image",
    detail: "Sentinel-2 L2A · 07 Jan 2025 · 702 × 786 px",
    tasks: "VQA · captioning · grounding",
    grid: HYD.grid,
    image: HYD.images.truecolor,
    thumb: HYD.images.thumb,
    anchor: "top" as const,
    href: "/analysis?scene=hyd&q=Describe%20the%20land-cover%20and%20major%20objects%20visible%20in%20this%20image.&run=1",
  },
  {
    id: "mum",
    name: "Mumbai — Bandra · Kurla · CSMIA",
    short: "Mumbai",
    kind: "optical + SAR",
    detail: "Sentinel-2 + Sentinel-1 · 06/07 Jan 2025 · co-registered",
    tasks: "optical–SAR fusion · SAR VQA",
    grid: MUM.grid,
    image: MUM.images.truecolor,
    thumb: MUM.images.thumb_optical,
    anchor: "right" as const,
    href: "/analysis?scene=mum-fusion&q=Use%20the%20optical%20and%20SAR%20images%20together%20to%20identify%20built-up%20and%20water-covered%20regions.&run=1",
  },
  {
    id: "nmia",
    name: "Navi Mumbai International Airport",
    short: "Navi Mumbai",
    kind: "2017 → 2026",
    detail: "Sentinel-2 L2A · 2017 → 2026 · 10 yearly epochs",
    tasks: "change description · change VQA · trend",
    grid: NMIA.grid,
    image: NMIA.images.t2_truecolor,
    thumb: NMIA.images.thumb_t2,
    anchor: "left" as const,
    href: "/analysis?scene=nmia&q=What%20changed%20between%20these%20two%20dates%2C%20and%20where%20did%20the%20change%20occur%3F&run=1",
  },
];

export function CoverageMap() {
  const [fit, setFit] = useState<{ bbox: [number, number, number, number]; nonce: number; maxZoom?: number; duration?: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const nonce = useRef(1);

  const flyTo = (id: string) => {
    const a = AOIS.find((x) => x.id === id)!;
    const b = a.grid.bbox_lonlat as [number, number, number, number];
    setActive(id);
    setFit({ bbox: b, nonce: nonce.current++, maxZoom: 12.6, duration: 3200 });
  };

  const markers: MapMarker[] = useMemo(
    () => AOIS.map((a) => ({ id: a.id, lonlat: a.grid.center_lonlat as LonLat, label: a.short, sublabel: a.kind, anchor: a.anchor, onClick: () => flyTo(a.id) })),
    [],
  );
  const footprints: MapFootprint[] = useMemo(() => AOIS.map((a) => ({ id: a.id, corners: a.grid.corners_lonlat as Corners, label: a.name, color: "#3bd5ff" })), []);
  const images: MapImageLayer[] = useMemo(() => AOIS.map((a) => ({ id: a.id, url: a.image, corners: a.grid.corners_lonlat as Corners, opacity: 0.92, visible: true })), []);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="panel relative h-[520px] overflow-hidden">
        <MapView globe spin={!active} initialView={{ center: [80, 18], zoom: 2.6 }} markers={markers} footprints={footprints} images={images} fitTo={fit} showControls={!!active} />
        <div className="glass pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-2">
          <Globe2 size={13} className="text-cyan" /> Real basemap · test-scene footprints
        </div>
        {active && (
          <button type="button" className="btn btn-ghost btn-sm absolute bottom-3 left-3" onClick={() => { setActive(null); setFit({ bbox: [62, 6, 94, 34], nonce: nonce.current++, maxZoom: 4, duration: 2600 }); }}>
            Back to India
          </button>
        )}
      </div>
      <div className="space-y-3">
        {AOIS.map((a) => (
          <div key={a.id} className={`panel flex gap-3 p-3 transition-colors ${active === a.id ? "!border-cyan/45" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.thumb} alt="" className="h-[84px] w-[84px] shrink-0 rounded-lg border border-line-2 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{a.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-3">{a.detail}</p>
              <p className="mt-1 text-[12px] text-cyan-2">{a.tasks}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => flyTo(a.id)}>
                  <Crosshair size={13} /> Fly to
                </button>
                <Link href={a.href} className="btn btn-quiet btn-sm">
                  Analyse <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        ))}
        <p className="px-1 text-[12px] leading-relaxed text-ink-3">
          Every scene is a real, georeferenced GeoTIFF read from the Copernicus archive. Footprints and overlays sit exactly where the pixels are on Earth.
        </p>
      </div>
    </div>
  );
}
