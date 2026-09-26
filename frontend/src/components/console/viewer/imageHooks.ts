"use client";

import { useEffect, useRef, useState } from "react";
import { CLASS_META } from "@/lib/palette";

const CLASS_RGB: [number, number, number, number][] = (Object.values(CLASS_META) as { id: number; color: string }[]).map((c) => [
  c.id,
  parseInt(c.color.slice(1, 3), 16),
  parseInt(c.color.slice(3, 5), 16),
  parseInt(c.color.slice(5, 7), 16),
]);

const imageCache = new Map<string, Promise<ImageData>>();

function loadImageData(url: string): Promise<ImageData> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, c.width, c.height));
      };
      img.onerror = reject;
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

export function classAt(data: ImageData | null, x: number, y: number): number | null {
  if (!data) return null;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= data.width || yi >= data.height) return null;
  const i = (yi * data.width + xi) * 4;
  if (data.data[i + 3] < 20) return 0;
  const r = data.data[i];
  const g = data.data[i + 1];
  const b = data.data[i + 2];
  let best = 0;
  let bestD = 1e9;
  for (const [id, cr, cg, cb] of CLASS_RGB) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return bestD < 2400 ? best : 0;
}

/** Decoded RGBA pixels of an image (for hover probes). */
export function useImageData(url: string | null): ImageData | null {
  const [res, setRes] = useState<{ url: string; data: ImageData | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadImageData(url)
      .then((data) => !cancelled && setRes({ url, data }))
      .catch(() => !cancelled && setRes({ url, data: null }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return res && res.url === url ? res.data : null;
}

/** Class-filtered URLs for several overlays at once (keyed by overlay id). */
export function useFilteredUrls(items: { id: string; url: string; hidden: number[] }[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items.map((i) => `${i.id}:${i.url}:${i.hidden.slice().sort().join(".")}`).join("|");
  const made = useRef<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const next: Record<string, string> = {};
    const jobs = items.map(async (it) => {
      if (!it.hidden.length) {
        next[it.id] = it.url;
        return;
      }
      const data = await loadImageData(it.url);
      const copy = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
      const hiddenSet = new Set(it.hidden);
      for (let i = 0; i < copy.data.length; i += 4) {
        if (copy.data[i + 3] < 20) continue;
        const cls = classAt(copy, (i / 4) % copy.width, Math.floor(i / 4 / copy.width));
        if (cls && hiddenSet.has(cls)) copy.data[i + 3] = 0;
      }
      const c = document.createElement("canvas");
      c.width = copy.width;
      c.height = copy.height;
      c.getContext("2d")!.putImageData(copy, 0, 0);
      const blob: Blob | null = await new Promise((res) => c.toBlob(res));
      if (blob) {
        const u = URL.createObjectURL(blob);
        made.current.push(u);
        next[it.id] = u;
      }
    });
    Promise.all(jobs).then(() => {
      if (!cancelled) setUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
