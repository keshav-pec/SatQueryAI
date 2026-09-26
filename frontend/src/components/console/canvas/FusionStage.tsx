"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, GitMerge, Radar, Sun } from "lucide-react";
import { MUM } from "@/lib/demo/data";
import { OVERLAYS } from "@/lib/demo/layers";
import { CLASS_BY_ID, CLASS_META, type ClassKey } from "@/lib/palette";
import { readOptical, readSar, type OpticalSample, type SarSample } from "@/lib/geo/probe";
import { pixelToLonLat } from "@/lib/geo/proj";
import { latlon } from "@/lib/format";
import { EvidenceLabels, EvidenceSvg } from "../viewer/EvidenceLayer";
import { ZoomPane, type ViewState } from "../viewer/ZoomPane";
import { classAt, useImageData } from "../viewer/imageHooks";
import type { ActiveOverlay, StageModel } from "./model";
import { EmptyStage } from "./Stages";

const THR = MUM.sar_water_threshold_db;

function opticalVerdict(o: OpticalSample): { cls: ClassKey; why: string } {
  if (o.mndwi > 0 && o.nir < 0.11 && o.ndvi < 0.12) return { cls: "water", why: `MNDWI ${o.mndwi.toFixed(2)} > 0 and dark NIR` };
  if (o.ndvi > 0.33) return { cls: "vegetation", why: `NDVI ${o.ndvi.toFixed(2)} > 0.33` };
  if (o.redness > 0.12) return { cls: "bare", why: `red soil signature (${o.redness.toFixed(2)})` };
  return { cls: "builtup", why: "grey, non-vegetated surface" };
}

function sarVerdict(s: SarSample): { label: string; kind: "dark" | "bright" | "mid"; why: string } {
  if (s.vv < THR) return { label: "Radar-dark (water-like)", kind: "dark", why: `VV ${s.vv.toFixed(1)} dB < Otsu ${THR} dB` };
  if (s.vv > -4) return { label: "Double-bounce (structures)", kind: "bright", why: `VV ${s.vv.toFixed(1)} dB > −4 dB` };
  return { label: "Volume / rough surface", kind: "mid", why: `VV ${s.vv.toFixed(1)} dB, VH ${s.vh.toFixed(1)} dB` };
}

function resolution(opt: ClassKey, sar: "dark" | "bright" | "mid", fused: ClassKey | null): { agree: boolean; text: string } {
  if (!fused) return { agree: true, text: "Run the fusion query to see the fused decision." };
  if (opt === "water" && sar === "dark") return { agree: true, text: "Both sensors agree: open water." };
  if (sar === "dark" && fused !== "water") return { agree: false, text: "Radar-dark but optically dry → smooth surface (runway, sand). Optical evidence wins." };
  if (opt === "bare" && fused === "builtup") return { agree: false, text: "Optical reads bare soil; SAR double-bounce reveals structures → built-up." };
  if (opt === "builtup" && fused === "bare") return { agree: false, text: "Optical reads built-up; weak SAR return shows open ground → open land." };
  if (opt === fused) return { agree: true, text: `Consistent evidence → ${CLASS_META[fused].label.toLowerCase()}.` };
  return { agree: false, text: `Evidence combined by rs-fusion-v1 → ${CLASS_META[fused].label.toLowerCase()}.` };
}

function Inspector({ m, hover, fusedReady }: { m: StageModel; hover: { x: number; y: number } | null; fusedReady: boolean }) {
  const fusedData = useImageData(OVERLAYS["mum:cls_fused"].url);
  const optImg = m.images.find((i) => i.meta.modality === "optical");
  const sarImg = m.images.find((i) => i.meta.modality === "sar");
  const o = hover ? readOptical(optImg, hover.x, hover.y) : null;
  const s = hover ? readSar(sarImg, hover.x, hover.y) : null;
  const fusedId = hover && fusedReady ? classAt(fusedData, hover.x, hover.y) : null;
  const fused = fusedId ? CLASS_BY_ID[fusedId] : null;
  const ov = o ? opticalVerdict(o) : null;
  const sv = s ? sarVerdict(s) : null;
  const res = ov && sv ? resolution(ov.cls, sv.kind, fused) : null;
  const pc = MUM.per_class as Record<string, { agreement_pct: number }>;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitMerge size={15} className="text-cyan" />
        <p className="text-[13.5px] font-semibold text-ink">Per-pixel fusion inspector</p>
        <span className="ml-auto mono text-[10.5px] text-ink-3">optsar-fusion · rs-fusion-v1</span>
      </div>
      {hover && o && s && ov && sv ? (
        <div className="space-y-2.5">
          <p className="mono text-[11px] text-ink-3">
            px {Math.floor(hover.x)}, {Math.floor(hover.y)}
            {m.corners ? ` · ${latlon(pixelToLonLat(m.corners, m.dims.width, m.dims.height, hover.x, hover.y))}` : ""}
          </p>
          <div className="rounded-lg border border-line bg-bg-2 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
              <Sun size={12} className="text-saffron" /> Optical says
              <span className="ml-auto flex items-center gap-1.5 text-ink">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CLASS_META[ov.cls].color }} />
                {CLASS_META[ov.cls].label}
              </span>
            </p>
            <p className="mono text-[11px] text-ink-2">
              NDVI {o.ndvi.toFixed(2)} · MNDWI {o.mndwi.toFixed(2)} · NIR {o.nir.toFixed(3)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-3">{ov.why}</p>
          </div>
          <div className="rounded-lg border border-line bg-bg-2 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
              <Radar size={12} className="text-cyan" /> SAR says
              <span className="ml-auto text-ink">{sv.label}</span>
            </p>
            <p className="mono text-[11px] text-ink-2">
              VV {s.vv.toFixed(1)} dB · VH {s.vh.toFixed(1)} dB · VV/VH {(s.vv - s.vh).toFixed(1)} dB
            </p>
            <p className="mt-0.5 text-[11px] text-ink-3">{sv.why}</p>
          </div>
          <div className={`rounded-lg border p-2.5 ${res?.agree ? "border-ok/30 bg-ok/[0.05]" : "border-warn/30 bg-warn/[0.05]"}`}>
            <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
              {res?.agree ? <CheckCircle2 size={12} className="text-ok" /> : <ArrowRight size={12} className="text-warn" />} Fused decision
              {fused && (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CLASS_META[fused].color }} />
                  {CLASS_META[fused].label}
                </span>
              )}
            </p>
            <p className="text-[11.5px] text-ink-2">{res?.text}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-ink-3">Hover any image. Values are read live from both GeoTIFFs at the same co-registered pixel, and the fusion rule that decided the class is explained here.</p>
          <div className="rounded-lg border border-line bg-bg-2 p-2.5 text-[11.5px] leading-relaxed text-ink-2">
            <p className="mb-1 font-semibold text-ink">Fusion rules (rs-fusion-v1)</p>
            <p>• <b className="text-ink">Water</b> — optical MNDWI &gt; 0 and SAR VV &lt; {(THR + 4).toFixed(1)} dB, or strong MNDWI</p>
            <p>• <b className="text-ink">Tarmac / sand</b> — SAR-dark but MNDWI &lt; −0.05 → not water</p>
            <p>• <b className="text-ink">Built-up</b> — SAR double-bounce VV &gt; −8 dB, or optical grey surface with VV &gt; {(THR + 2).toFixed(1)} dB</p>
            <p>• <b className="text-ink">Vegetation</b> — NDVI &gt; 0.33 (SAR VH confirms canopy)</p>
          </div>
        </div>
      )}
      <div className="mt-auto pt-3">
        <p className="eyebrow mb-1.5 !text-[10.5px]">Cross-sensor agreement by class</p>
        <div className="space-y-1.5">
          {(["water", "vegetation", "builtup", "bare"] as ClassKey[]).map((k) => (
            <div key={k} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CLASS_META[k].color }} />
              <span className="w-24 shrink-0 text-ink-2">{CLASS_META[k].label.split(" /")[0]}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${pc[k]?.agreement_pct ?? 0}%`, background: CLASS_META[k].color }} />
              </div>
              <span className="w-10 shrink-0 text-right tnum text-ink">{(pc[k]?.agreement_pct ?? 0).toFixed(0)} %</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const imgStyle = (scale: number): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  imageRendering: scale > 2.2 ? "pixelated" : "auto",
  pointerEvents: "none",
});

export function FusionStage({ m }: { m: StageModel }) {
  const [view, setView] = useState<ViewState | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const opt = m.baseLayers.find((b) => b.id === "mum:truecolor") ?? m.baseLayers.find((b) => b.frame === "A");
  const sar = m.baseLayers.find((b) => b.id === "mum:sar_vv") ?? m.baseLayers.find((b) => b.frame === "B");
  const composite = m.baseLayers.find((b) => b.id === "mum:fusion_rgb");
  const fusedOverlay = m.overlays.find((o) => o.id === "mum:cls_fused");
  const fusedReady = !!fusedOverlay;
  if (!opt || !sar) return <EmptyStage title="Optical + SAR pair needed" body="Load a co-registered optical and SAR pair to open the fusion workspace." icon={<Radar size={20} />} />;
  const optImg = m.images.find((i) => i.meta.modality === "optical");
  const sarImg = m.images.find((i) => i.meta.modality === "sar");

  const fusedPane = fusedOverlay
    ? { key: "fused", title: "Fused land cover", sub: "optsar-fusion · rs-fusion-v1", url: opt.url, overlays: [{ ...fusedOverlay, state: { ...fusedOverlay.state, visible: true, opacity: Math.max(0.6, fusedOverlay.state.opacity) } }] as ActiveOverlay[] }
    : { key: "fused", title: "Fusion composite", sub: "R: SAR VV · G: NIR · B: MNDWI", url: composite?.url ?? opt.url, overlays: [] as ActiveOverlay[] };
  const panes = [
    { key: "opt", title: "Optical · Sentinel-2 L2A", sub: optImg?.meta.acquired?.replace("T", " ").slice(0, 16) + " UTC", url: opt.url, overlays: [] as ActiveOverlay[] },
    { key: "sar", title: "SAR · Sentinel-1 VV (γ⁰)", sub: sarImg?.meta.acquired?.replace("T", " ").slice(0, 16) + " UTC · pre-dawn", url: sar.url, overlays: [] as ActiveOverlay[] },
    fusedPane,
  ];

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-line">
      {panes.map((p, idx) => (
        <div key={p.key} className="relative min-h-0 min-w-0 bg-bg">
          <div className="glass pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-md px-2 py-1">
            <p className="text-[11.5px] font-semibold text-ink">{p.title}</p>
            <p className="mono text-[10px] text-ink-3">{p.sub}</p>
          </div>
          <ZoomPane
            width={m.dims.width}
            height={m.dims.height}
            view={view}
            onView={setView}
            focus={idx === 0 ? m.focus : null}
            fitKey={m.fitKey}
            className="h-full w-full bg-[#04070d]"
            onHover={(pt) => {
              setHover(pt);
              m.onHover(pt ? { source: "image", x: pt.x, y: pt.y, frame: idx === 1 ? "B" : "A" } : null);
            }}
            overlay={(v) => (
              <>
                {hover && (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-y-0 w-px bg-cyan/70" style={{ left: hover.x * v.scale + v.tx }} />
                    <div className="absolute inset-x-0 h-px bg-cyan/70" style={{ top: hover.y * v.scale + v.ty }} />
                    <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan" style={{ left: hover.x * v.scale + v.tx, top: hover.y * v.scale + v.ty }} />
                  </div>
                )}
                {idx === 2 && m.evidence.length > 0 && <EvidenceLabels items={m.evidence} view={v} activeId={m.activeEvidence} onSelect={m.onSelectEvidence} max={4} />}
              </>
            )}
          >
            {(v) => (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.title} draggable={false} style={imgStyle(v.scale)} />
                {p.overlays.map((o) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={o.id} src={o.src} alt="" draggable={false} style={{ ...imgStyle(v.scale), opacity: o.state.opacity }} />
                ))}
                {idx === 2 && <EvidenceSvg items={m.evidence} width={m.dims.width} height={m.dims.height} scale={v.scale} activeId={m.activeEvidence} onSelect={m.onSelectEvidence} />}
                {idx === 1 && <EvidenceSvg items={m.evidence.filter((e) => e.kind === "points")} width={m.dims.width} height={m.dims.height} scale={v.scale} activeId={m.activeEvidence} />}
              </>
            )}
          </ZoomPane>
        </div>
      ))}
      <div className="min-h-0 min-w-0">
        <Inspector m={m} hover={hover} fusedReady={fusedReady} />
      </div>
    </div>
  );
}
