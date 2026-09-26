import type { EvidenceItem } from "@/lib/types";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export interface SnapshotInput {
  baseUrl: string;
  overlays: { url: string; opacity: number }[];
  evidence: EvidenceItem[];
  maxWidth?: number;
}

/** Burns the base image, raster overlays and vector evidence into one JPEG data URL. */
export async function composeEvidenceImage({ baseUrl, overlays, evidence, maxWidth = 1400 }: SnapshotInput): Promise<{ dataUrl: string; width: number; height: number }> {
  const base = await loadImage(baseUrl);
  const scale = Math.min(1, maxWidth / base.naturalWidth) * 1.6;
  const w = Math.round(base.naturalWidth * scale);
  const h = Math.round(base.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base, 0, 0, w, h);
  for (const o of overlays) {
    try {
      const img = await loadImage(o.url);
      ctx.globalAlpha = o.opacity;
      ctx.drawImage(img, 0, 0, w, h);
    } catch {
      /* overlay missing: skip */
    }
  }
  ctx.globalAlpha = 1;
  const lw = Math.max(2, w / 500);
  ctx.font = `600 ${Math.round(w / 70)}px Inter, system-ui, sans-serif`;
  for (const ev of evidence) {
    const color = ev.color ?? "#3bd5ff";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    let labelAt: [number, number] | null = null;
    if (ev.kind === "polygon" && Array.isArray(ev.pixel) && Array.isArray(ev.pixel[0])) {
      const ring = ev.pixel as number[][];
      ctx.beginPath();
      ring.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)));
      ctx.closePath();
      ctx.globalAlpha = 0.16;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      const b = ev.bboxPx ?? [0, 0, 0, 0];
      labelAt = [b[0] * scale, b[1] * scale - 6];
    } else if (ev.kind === "box" && ev.bboxPx) {
      const [x0, y0, x1, y1] = ev.bboxPx;
      ctx.setLineDash([lw * 3, lw * 2]);
      ctx.strokeRect(x0 * scale, y0 * scale, (x1 - x0) * scale, (y1 - y0) * scale);
      ctx.setLineDash([]);
      labelAt = [x0 * scale, y0 * scale - 6];
    } else if (ev.kind === "points" && ev.points) {
      for (const p of ev.points) {
        ctx.beginPath();
        ctx.arc(p.px[0] * scale, p.px[1] * scale, lw * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const b = ev.bboxPx;
      if (b) labelAt = [b[0] * scale, b[1] * scale - 6];
    }
    if (labelAt) {
      const text = ev.label;
      const tw = ctx.measureText(text).width;
      const pad = 5;
      const x = Math.max(4, Math.min(w - tw - pad * 2 - 4, labelAt[0]));
      const y = Math.max(ctx.measureText("M").width + pad * 2, labelAt[1]);
      ctx.fillStyle = "rgba(6,10,18,0.85)";
      ctx.fillRect(x, y - ctx.measureText("M").width - pad * 1.6, tw + pad * 2, ctx.measureText("M").width + pad * 2.2);
      ctx.fillStyle = color;
      ctx.fillText(text, x + pad, y - pad * 0.3);
    }
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: w, height: h };
}
