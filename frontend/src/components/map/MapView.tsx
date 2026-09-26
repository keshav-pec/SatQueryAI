"use client";

import dynamic from "next/dynamic";
import type { GeoMapProps } from "./GeoMap";

const GeoMap = dynamic(() => import("./GeoMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-bg-2">
      <span className="text-[12px] text-ink-3">Loading map…</span>
    </div>
  ),
});

export function MapView(props: GeoMapProps) {
  return <GeoMap {...props} />;
}

export type { GeoMapProps, Basemap, MapFootprint, MapImageLayer, MapLine, MapMarker } from "./GeoMap";
