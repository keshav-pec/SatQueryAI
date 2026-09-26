"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Radar, ScanLine, Upload, X, XCircle } from "lucide-react";
import type { LoadedImage } from "@/lib/types";
import { bytes } from "@/lib/format";

export function CheckRow({ status, label, detail }: { status: "pass" | "warn" | "fail" | "info"; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 py-[3px]">
      <span className="mt-[1px] shrink-0">
        {status === "pass" ? <CheckCircle2 size={13} className="text-ok" /> : status === "warn" ? <AlertTriangle size={13} className="text-warn" /> : status === "fail" ? <XCircle size={13} className="text-crit" /> : <ScanLine size={13} className="text-ink-3" />}
      </span>
      <span className="w-[74px] shrink-0 text-[11.5px] text-ink-3">{label}</span>
      <span className={`min-w-0 break-words text-[11.5px] leading-snug ${status === "fail" ? "text-crit" : "text-ink-2"}`}>{detail}</span>
    </div>
  );
}

interface Props {
  slot: "A" | "B";
  title: string;
  hint: string;
  image: LoadedImage | null;
  loadingName?: string;
  defaultOpen?: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}

export function FileSlot({ slot, title, hint, image, loadingName, defaultOpen = true, onFile, onClear }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  if (loadingName) {
    return (
      <div className="panel-2 p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan/10">
            <Loader2 size={16} className="animate-spin-slow text-cyan" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">{loadingName}</p>
            <p className="text-[11.5px] text-ink-3">Reading GeoTIFF header, geokeys and pixels…</p>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div className="shimmer h-full w-full" />
        </div>
      </div>
    );
  }

  if (image) {
    const m = image.meta;
    const fails = image.checks.some((c) => c.status === "fail");
    return (
      <div className={`panel-2 overflow-hidden ${fails ? "!border-crit/40" : ""}`}>
        <div className="flex items-center gap-3 p-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-line-2 bg-bg">
            {image.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">{slot}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate mono text-[12px] font-medium text-ink" title={m.name}>
              {m.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className={`badge ${m.modality === "sar" ? "badge-cyan" : "badge-saffron"}`}>{m.modality === "sar" ? <Radar size={11} /> : null}{m.modality === "sar" ? "SAR" : m.modality === "optical" ? "Optical" : "Unknown"}</span>
              <span className="badge">{bytes(m.bytes)}</span>
              {m.acquired && <span className="badge">{m.acquired.slice(0, 10)}</span>}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClear} aria-label={`Remove image ${slot}`}>
            <X size={15} />
          </button>
        </div>
        <div className="border-t border-line bg-bg-2/60 px-3 py-2">
          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
            {fails ? <XCircle size={13} className="text-crit" /> : image.checks.some((c) => c.status === "warn") ? <AlertTriangle size={13} className="text-warn" /> : <CheckCircle2 size={13} className="text-ok" />}
            <span className="text-[11.5px] text-ink-2">
              {image.checks.filter((c) => c.status === "pass").length}/{image.checks.length} input checks passed
              <span className="text-ink-3"> · {m.format === "TIFF" && m.georeferenced ? "GeoTIFF" : m.format}{m.epsg ? ` · EPSG:${m.epsg}` : ""} · {m.bands} band{m.bands === 1 ? "" : "s"}</span>
            </span>
            <span className="ml-auto text-ink-3">{open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
          </button>
          {open && (
            <div className="mt-1.5">
              {image.checks.map((c) => (
                <CheckRow key={c.id} {...c} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 transition-colors ${over ? "border-cyan bg-cyan/[0.06]" : "border-line-2 hover:border-cyan/50 hover:bg-white/[0.02]"}`}
    >
      <input
        ref={input}
        type="file"
        accept=".tif,.tiff,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-ink-3">
        <Upload size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">
          {title} <span className="font-normal text-ink-3">· {slot}</span>
        </p>
        <p className="text-[11.5px] text-ink-3">{hint}</p>
      </div>
    </div>
  );
}
