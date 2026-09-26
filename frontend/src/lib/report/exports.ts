import type { AgentResult, CompatibilityReport, LoadedImage } from "@/lib/types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/⚠/g, "!").replace(/[→]/g, "->").replace(/[−–]/g, "-").replace(/≈/g, "~").replace(/×/g, "x").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/·/g, "-").replace(/°/g, " deg").replace(/²/g, "2").replace(/γ⁰/g, "gamma0").replace(/…/g, "...");

export function inputsManifest(images: LoadedImage[]) {
  return images.map((i) => ({
    slot: i.slot,
    name: i.meta.name,
    format: i.meta.format,
    sensor: i.meta.sensor,
    modality: i.meta.modality,
    acquired: i.meta.acquired,
    crs: i.meta.epsg ? `EPSG:${i.meta.epsg}` : null,
    size_px: [i.meta.width, i.meta.height],
    resolution: i.meta.resolution,
    bands: i.meta.bandNames,
    corners_lonlat: i.meta.corners,
  }));
}

export function exportJson(result: AgentResult, images: LoadedImage[], compat: CompatibilityReport | null) {
  const payload = {
    report_id: result.id,
    generated_at: result.createdAt,
    query: result.query,
    task: result.task,
    task_label: result.taskLabel,
    confidence: result.confidence,
    confidence_parts: result.confidenceParts,
    answer: result.answer,
    inputs: inputsManifest(images),
    compatibility: compat,
    evidence: result.evidence.map(({ pixel, holes, ...e }) => ({ ...e, pixel_geometry: pixel ? "omitted" : undefined, holes: holes ? holes.length : undefined })),
    execution_trace: result.trace.map((s, i) => ({ step: i + 1, stage: s.stage, tool: s.tool, version: s.version, title: s.title, params: s.params, output: s.output, duration_ms: s.ms, status: s.status })),
    models: result.models,
    error: result.error ?? null,
  };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `satquery-${result.id}-trace.json`);
}

export function exportGeoJson(result: AgentResult) {
  const features: object[] = [];
  for (const e of result.evidence) {
    const props = { id: e.id, label: e.label, detail: e.detail, confidence: e.confidence, task: result.task, query: result.query, ...Object.fromEntries((e.stats ?? []).map((s) => [s.label.toLowerCase().replace(/\s+/g, "_"), s.value])) };
    if (e.points) {
      for (const p of e.points) features.push({ type: "Feature", properties: { ...props, target: p.label }, geometry: { type: "Point", coordinates: p.lonlat } });
    } else if (e.lonlat && e.lonlat.length >= 3) {
      const ring = [...e.lonlat, e.lonlat[0]];
      features.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [ring] } });
    }
  }
  const fc = { type: "FeatureCollection", name: `satquery-${result.id}`, crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }, features };
  download(new Blob([JSON.stringify(fc)], { type: "application/geo+json" }), `satquery-${result.id}-evidence.geojson`);
}

export async function exportPdf(result: AgentResult, images: LoadedImage[], snapshot: { dataUrl: string; width: number; height: number } | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210;
  const M = 14;
  let y = 0;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 130, 145);
      doc.text("Contains modified Copernicus Sentinel data (2017-2026) processed by ESA  |  SatQuery AI analysis report", M, 290);
      doc.text(`Page ${p} / ${pages}`, W - M, 290, { align: "right" });
    }
  };
  const ensure = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 16;
    }
  };
  const heading = (t: string) => {
    ensure(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(20, 28, 40);
    doc.text(t.toUpperCase(), M, y);
    doc.setDrawColor(255, 153, 51);
    doc.setLineWidth(0.6);
    doc.line(M, y + 1.6, M + 14, y + 1.6);
    y += 7;
  };
  const para = (t: string, size = 9.5, color: [number, number, number] = [40, 48, 60]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const block of plain(t).split("\n")) {
      if (!block.trim()) {
        y += 2;
        continue;
      }
      const lines = doc.splitTextToSize(block, W - 2 * M) as string[];
      ensure(lines.length * size * 0.42 + 1);
      doc.text(lines, M, y);
      y += lines.length * size * 0.42 + 1.2;
    }
  };

  // Header band
  doc.setFillColor(6, 10, 18);
  doc.rect(0, 0, W, 30, "F");
  doc.setFillColor(255, 153, 51);
  doc.rect(0, 30, W, 1.1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text("SatQuery AI - Analysis Report", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(170, 180, 198);
  doc.text(`Report ${result.id.toUpperCase()}  |  ${new Date(result.createdAt).toLocaleString("en-IN")}  |  Task: ${plain(result.taskLabel)}`, M, 21);
  doc.text(`Pipeline: ${result.models.join(", ")}`.slice(0, 150), M, 26);
  y = 40;

  heading("Query");
  para(`"${result.query}"`, 10.5, [20, 28, 40]);
  y += 2;

  // Confidence strip
  if (result.task !== "rejected") {
    ensure(14);
    doc.setFillColor(244, 246, 250);
    doc.roundedRect(M, y - 4, W - 2 * M, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 28, 40);
    doc.text(`Confidence ${(result.confidence * 100).toFixed(0)} %`, M + 4, y + 3.4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 90, 105);
    doc.text(result.confidenceParts.map((p) => `${p.label} ${(p.value * 100).toFixed(0)} %`).join("   |   "), M + 46, y + 3.4);
    y += 13;
  }

  heading("Answer");
  para(result.answer);
  y += 2;

  if (snapshot) {
    const imgW = W - 2 * M;
    const imgH = Math.min(150, (snapshot.height / snapshot.width) * imgW);
    const drawW = (snapshot.width / snapshot.height) * imgH;
    ensure(imgH + 12);
    heading("Visual evidence");
    doc.addImage(snapshot.dataUrl, "JPEG", M + (imgW - drawW) / 2, y, drawW, imgH);
    y += imgH + 6;
  }

  if (result.evidence.length) {
    heading("Evidence");
    for (const e of result.evidence) {
      ensure(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 28, 40);
      doc.text(`${plain(e.label)}  (${(e.confidence * 100).toFixed(0)} %)`, M, y);
      y += 4.2;
      para(`${e.detail}${e.stats?.length ? " - " + e.stats.map((s) => `${s.label}: ${s.value}`).join("; ") : ""}`, 8.5, [80, 90, 105]);
      y += 1;
    }
  }

  heading("Inputs");
  for (const i of images) {
    para(`${i.slot}: ${i.meta.name} - ${i.meta.sensor} - ${i.meta.acquired ?? "date n/a"} - ${i.meta.crsName} - ${i.meta.width} x ${i.meta.height} px - ${i.meta.bands} x ${i.meta.dtype}`, 8.5);
  }
  y += 2;

  heading("Execution trace (auditable)");
  doc.setFontSize(8);
  result.trace.forEach((s, idx) => {
    const params = Object.entries(s.params)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`)
      .join(", ");
    const line = `${String(idx + 1).padStart(2, "0")}  [${s.stage}] ${s.tool}@${s.version} - ${s.title} (${s.ms} ms, ${s.status})`;
    ensure(11);
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.setTextColor(20, 28, 40);
    doc.text(plain(line), M, y);
    y += 3.6;
    doc.setFont("courier", "normal");
    doc.setTextColor(90, 100, 115);
    const wrapped = doc.splitTextToSize(plain(`params: ${params || "-"}  ->  ${s.output}`), W - 2 * M - 6) as string[];
    doc.text(wrapped, M + 6, y);
    y += wrapped.length * 3.3 + 1.6;
  });

  footer();
  doc.save(`satquery-${result.id}-report.pdf`);
}
