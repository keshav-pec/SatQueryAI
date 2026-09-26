"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Download, GitCompareArrows, Image as ImageIcon, Layers, ShieldAlert, XCircle } from "lucide-react";
import type { CompatibilityReport, LoadedImage, Mode, ScenarioId } from "@/lib/types";
import { SCENARIOS } from "@/lib/demo/data";
import { CheckRow, FileSlot } from "./FileSlot";

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: "single", label: "Single", icon: <ImageIcon size={12} /> },
  { id: "cross_modal", label: "Opt + SAR", icon: <Layers size={12} /> },
  { id: "bitemporal", label: "Bi-temporal", icon: <GitCompareArrows size={12} /> },
];

const HINTS: Record<Mode, [string, string][]> = {
  single: [["Optical / multispectral or SAR", "GeoTIFF · drop or click"]],
  cross_modal: [
    ["Optical / multispectral", "e.g. Sentinel-2, Cartosat-2S"],
    ["SAR (co-registered)", "e.g. Sentinel-1, RISAT-1A"],
  ],
  bitemporal: [
    ["Earlier acquisition (T1)", "Same area, earlier date"],
    ["Later acquisition (T2)", "Same area, later date"],
  ],
};

interface Props {
  mode: Mode;
  modeLocked: boolean;
  onMode: (m: Mode) => void;
  images: LoadedImage[];
  loading: Partial<Record<"A" | "B", string>>;
  compat: CompatibilityReport | null;
  activeScenario: ScenarioId | null;
  onScenario: (id: ScenarioId) => void;
  onFile: (slot: "A" | "B", f: File) => void;
  onClear: (slot: "A" | "B") => void;
}

export function InputRail({ mode, modeLocked, onMode, images, loading, compat, activeScenario, onScenario, onFile, onClear }: Props) {
  const imgA = images.find((i) => i.slot === "A") ?? null;
  const imgB = images.find((i) => i.slot === "B") ?? null;
  const showB = mode !== "single" || !!imgB || !!loading.B;
  const hints = HINTS[mode];
  const compatRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (compat) compatRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [compat]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-bg-2/60">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">1 · Input configuration</p>
            {modeLocked && <span className="badge badge-cyan !h-5 !text-[10.5px]">auto-detected</span>}
          </div>
          <div className="segmented w-full">
            {MODES.map((m) => (
              <button key={m.id} type="button" className="flex-1 justify-center !gap-1.5 !px-2" data-active={mode === m.id} onClick={() => onMode(m.id)} disabled={modeLocked && mode !== m.id} title={modeLocked ? "Detected from the loaded pair" : undefined}>
                <span className="hidden 2xl:inline-flex">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="eyebrow mb-2">2 · Test scenes (real Sentinel data)</p>
          <div className="space-y-2">
            {SCENARIOS.map((s) => {
              const active = activeScenario === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onScenario(s.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all ${active ? "border-cyan/50 bg-cyan/[0.06]" : "border-line hover:border-line-2 hover:bg-white/[0.02]"}`}
                >
                  <span className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumb} alt="" className={`h-full object-cover ${s.thumb2 ? "w-1/2" : "w-full"}`} />
                    {s.thumb2 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumb2} alt="" className="h-full w-1/2 border-l border-bg object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{s.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{s.subtitle}</span>
                    <span className={`mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide ${s.expectFail ? "text-warn" : "text-cyan-2"}`}>
                      {s.expectFail && <ShieldAlert size={11} />}
                      {s.tag}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="eyebrow mb-2">3 · Or upload your own</p>
          <div className="space-y-2">
            <FileSlot key={imgA?.id ?? "slot-a"} slot="A" title={hints[0][0]} hint={hints[0][1]} image={imgA} loadingName={loading.A} defaultOpen={!imgB && !loading.B} onFile={(f) => onFile("A", f)} onClear={() => onClear("A")} />
            {showB && (
              <FileSlot
                key={imgB?.id ?? "slot-b"}
                slot="B"
                title={hints[1]?.[0] ?? "Second image (optional)"}
                hint={hints[1]?.[1] ?? "For change or cross-modal analysis"}
                image={imgB}
                loadingName={loading.B}
                defaultOpen={false}
                onFile={(f) => onFile("B", f)}
                onClear={() => onClear("B")}
              />
            )}
            {!showB && imgA && (
              <button type="button" className="w-full rounded-lg border border-dashed border-line-2 px-3 py-2 text-left text-[12px] text-ink-3 hover:border-cyan/40 hover:text-ink-2" onClick={() => onMode("bitemporal")}>
                + Add a second image for change or optical–SAR analysis
              </button>
            )}
          </div>
        </section>

        {compat && (
          <section ref={compatRef} className={`scroll-mt-4 rounded-xl border p-3 ${compat.status === "fail" ? "border-crit/40 bg-crit/[0.05]" : compat.status === "warn" ? "border-warn/30 bg-warn/[0.04]" : "border-ok/30 bg-ok/[0.04]"}`}>
            <div className="mb-1.5 flex items-center gap-2">
              {compat.status === "fail" ? <XCircle size={15} className="text-crit" /> : <CheckCircle2 size={15} className={compat.status === "ok" ? "text-ok" : "text-warn"} />}
              <p className="text-[12.5px] font-semibold text-ink">Pair compatibility</p>
            </div>
            <p className={`mb-2 text-[12px] ${compat.status === "fail" ? "text-crit" : "text-ink-2"}`}>{compat.summary}</p>
            {compat.checks.map((c) => (
              <CheckRow key={c.id} {...c} />
            ))}
          </section>
        )}
      </div>
      <div className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
        GeoTIFF / TIFF for geospatial imagery; PNG / JPEG accepted for public benchmark samples only.{" "}
        <a href="/demo/samples/HYD_S2L2A_20250107_T44QKE.tif" download className="inline-flex items-center gap-1 text-cyan-2 hover:underline">
          <Download size={11} /> sample
        </a>
      </div>
    </aside>
  );
}
