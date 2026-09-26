"use client";

import { X } from "lucide-react";
import type { BaseLayer } from "@/lib/demo/layers";
import type { Basemap } from "@/components/map/MapView";
import type { ActiveOverlay } from "./model";

interface Props {
  baseLayers: BaseLayer[];
  baseId: string | null;
  onBase: (id: string) => void;
  overlays: ActiveOverlay[];
  onToggle: (id: string) => void;
  onOpacity: (id: string, v: number) => void;
  onClassToggle: (id: string, classId: number) => void;
  evidenceOn: boolean;
  evidenceCount: number;
  onEvidence: () => void;
  mapControls: boolean;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  mapImageOpacity: number;
  onMapImageOpacity: (v: number) => void;
  onClose: () => void;
}

export function LayerPanel(p: Props) {
  return (
    <div data-no-pan className="glass absolute right-3 top-14 z-30 max-h-[calc(100%-5rem)] w-[288px] overflow-y-auto rounded-xl p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Layers</p>
        <button type="button" className="icon-btn !h-7 !w-7" onClick={p.onClose} aria-label="Close layers">
          <X size={14} />
        </button>
      </div>

      {p.baseLayers.length > 0 && (
        <div className="mb-3">
          <p className="eyebrow mb-1.5 !text-[10.5px]">Base image</p>
          <div className="space-y-0.5">
            {p.baseLayers.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-ink-2 hover:bg-white/[0.04]">
                <input type="radio" name="base" checked={p.baseId === b.id} onChange={() => p.onBase(b.id)} className="accent-[#3bd5ff]" />
                <span className="truncate">{b.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <p className="eyebrow mb-1.5 !text-[10.5px]">Analysis layers</p>
        {p.overlays.length === 0 && <p className="px-1.5 text-[12px] text-ink-3">Model outputs appear here after you ask a question.</p>}
        <div className="space-y-2">
          {p.overlays.map((o) => (
            <div key={o.id} className="rounded-lg border border-line bg-bg-2/70 p-2">
              <div className="flex items-center gap-2">
                <button type="button" className="switch" data-on={o.state.visible} onClick={() => p.onToggle(o.id)} aria-label={`Toggle ${o.label}`} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{o.label}</span>
              </div>
              {o.state.visible && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="w-12 text-[11px] text-ink-3">Opacity</span>
                    <input type="range" className="range" min={0} max={1} step={0.05} value={o.state.opacity} onChange={(e) => p.onOpacity(o.id, Number(e.target.value))} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {o.legend.map((l) => {
                      const hidden = l.classId !== undefined && o.state.hidden.includes(l.classId);
                      const clickable = o.classCoded && l.classId !== undefined;
                      return (
                        <button
                          key={l.label}
                          type="button"
                          disabled={!clickable}
                          onClick={() => clickable && p.onClassToggle(o.id, l.classId!)}
                          className={`flex items-center gap-1.5 text-[11.5px] ${hidden ? "text-ink-3 line-through" : "text-ink-2"} ${clickable ? "cursor-pointer hover:text-ink" : "cursor-default"}`}
                          title={clickable ? "Click to show / hide this class" : undefined}
                        >
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color, opacity: hidden ? 0.3 : 1 }} />
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-bg-2/70 p-2">
        <button type="button" className="switch" data-on={p.evidenceOn} onClick={p.onEvidence} aria-label="Toggle evidence" />
        <span className="flex-1 text-[12.5px] text-ink">Evidence regions</span>
        <span className="badge !h-5">{p.evidenceCount}</span>
      </div>

      {p.mapControls && (
        <div>
          <p className="eyebrow mb-1.5 !text-[10.5px]">Map</p>
          <div className="segmented mb-2 w-full">
            {(["satellite", "hybrid", "dark"] as Basemap[]).map((b) => (
              <button key={b} type="button" className="flex-1 justify-center capitalize" data-active={p.basemap === b} onClick={() => p.onBasemap(b)}>
                {b === "hybrid" ? "Labels" : b}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-0.5">
            <span className="w-24 text-[11px] text-ink-3">Input image on map</span>
            <input type="range" className="range" min={0} max={1} step={0.05} value={p.mapImageOpacity} onChange={(e) => p.onMapImageOpacity(Number(e.target.value))} />
          </div>
        </div>
      )}
    </div>
  );
}
