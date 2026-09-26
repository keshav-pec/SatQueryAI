import type { AgentResult, CompatibilityReport, LoadedImage } from "@/lib/types";
import { OVERLAYS } from "@/lib/demo/layers";

/** Shape of POST /v1/analyze responses (the contract the backend implements). */
export function toApiResponse(r: AgentResult, images: LoadedImage[], compat: CompatibilityReport | null) {
  const mode = images.length === 2 ? compat?.inferredMode ?? "cross_modal" : "single";
  return {
    id: `req_${r.id}`,
    object: "analysis",
    created: r.createdAt,
    query: r.query,
    input: {
      mode,
      images: images.map((i) => ({
        slot: i.slot,
        name: i.meta.name,
        format: i.meta.format === "TIFF" && i.meta.georeferenced ? "GeoTIFF" : i.meta.format,
        sensor: i.meta.sensor,
        modality: i.meta.modality,
        crs: i.meta.epsg ? `EPSG:${i.meta.epsg}` : null,
        size_px: [i.meta.width, i.meta.height],
        resolution_m: i.meta.resolution?.[0] ?? null,
        bands: i.meta.bandNames.map((b) => b.split(" ")[0]),
        acquired: i.meta.acquired,
        checks: Object.fromEntries(i.checks.map((c) => [c.id, c.status])),
      })),
      compatibility: compat
        ? { status: compat.status, iou: compat.iou !== null ? Number(compat.iou.toFixed(3)) : null, temporal_gap_h: compat.temporalGapHours !== null ? Number(compat.temporalGapHours.toFixed(1)) : null, summary: compat.summary }
        : null,
    },
    task: r.task,
    task_label: r.taskLabel,
    status: r.task === "rejected" ? "rejected" : "completed",
    error: r.error ?? null,
    answer: r.answer,
    highlights: r.highlights,
    confidence: r.confidence,
    confidence_parts: Object.fromEntries(r.confidenceParts.map((p) => [p.label.toLowerCase().replace(/[^a-z]+/g, "_"), p.value])),
    evidence: r.evidence.map((e) => ({
      id: e.id,
      type: e.kind,
      label: e.label,
      confidence: e.confidence,
      geometry: e.points
        ? { type: "MultiPoint", coordinates: e.points.map((p) => p.lonlat) }
        : e.lonlat
          ? { type: "Polygon", coordinates: [[...e.lonlat, e.lonlat[0]]] }
          : null,
      pixel_bbox: e.bboxPx ?? null,
      stats: Object.fromEntries((e.stats ?? []).map((s) => [s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), s.value])),
    })),
    overlays: r.overlays.map((id) => ({ id, label: OVERLAYS[id]?.label, url: OVERLAYS[id]?.url, legend: OVERLAYS[id]?.legend.map((l) => ({ label: l.label, color: l.color })) })),
    charts: r.charts,
    execution_trace: r.trace.map((s, i) => ({ step: i + 1, stage: s.stage, tool: s.tool, version: s.version, title: s.title, params: s.params, output: s.output, duration_ms: s.ms, status: s.status })),
    models: r.models,
    reports: r.task === "rejected" ? { json: `/v1/reports/${r.id}.json` } : { pdf: `/v1/reports/${r.id}.pdf`, geojson: `/v1/reports/${r.id}.geojson`, json: `/v1/reports/${r.id}.json` },
    usage: { pipeline_ms: r.totalMs, tools_invoked: new Set(r.trace.map((s) => s.tool)).size },
  };
}

export function toValidateResponse(images: LoadedImage[], compat: CompatibilityReport | null) {
  return {
    object: "validation",
    valid: images.every((i) => !i.checks.some((c) => c.status === "fail")) && (!compat || compat.status !== "fail"),
    inferred_mode: images.length === 2 ? compat?.inferredMode ?? null : "single",
    files: images.map((i) => ({
      name: i.meta.name,
      format: i.meta.format === "TIFF" && i.meta.georeferenced ? "GeoTIFF" : i.meta.format,
      crs: i.meta.epsg ? `EPSG:${i.meta.epsg}` : null,
      size_px: [i.meta.width, i.meta.height],
      modality: i.meta.modality,
      checks: i.checks.map((c) => ({ id: c.id, status: c.status, detail: c.detail })),
    })),
    pair: compat ? { status: compat.status, summary: compat.summary, checks: compat.checks.map((c) => ({ id: c.id, status: c.status, detail: c.detail })) } : null,
  };
}
