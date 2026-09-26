import type { CompatibilityReport, LoadedImage, Mode, ValidationCheck } from "@/lib/types";
import { bboxIoU, bboxOf, haversineKm } from "./proj";

function hours(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(tb - ta) / 36e5;
}

export function formatGap(h: number): string {
  if (h < 48) return `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;
  const days = h / 24;
  if (days < 60) return `${Math.round(days)} days`;
  const years = days / 365.25;
  return years >= 1 ? `${years.toFixed(1)} years` : `${Math.round(days / 30.4)} months`;
}

/** Real pair-compatibility checks computed from the two files' metadata. */
export function checkPair(a: LoadedImage, b: LoadedImage): CompatibilityReport {
  const A = a.meta;
  const B = b.meta;
  const checks: ValidationCheck[] = [];
  const hardFail = (id: string, label: string, detail: string) => checks.push({ id, label, status: "fail", detail });

  if (!A.georeferenced || !B.georeferenced || !A.corners || !B.corners) {
    hardFail("geo", "Georeferencing", "Both images must be georeferenced GeoTIFFs to be paired");
    return { status: "fail", inferredMode: null, checks, iou: null, distanceKm: null, temporalGapHours: null, summary: "Pairing needs two georeferenced GeoTIFFs." };
  }

  const sameCrs = A.epsg !== null && A.epsg === B.epsg;
  checks.push({
    id: "crs",
    label: "CRS",
    status: sameCrs ? "pass" : "warn",
    detail: sameCrs ? `Both EPSG:${A.epsg}` : `EPSG:${A.epsg ?? "?"} vs EPSG:${B.epsg ?? "?"} — reprojection required`,
  });

  const bbA = bboxOf(A.corners);
  const bbB = bboxOf(B.corners);
  const iou = bboxIoU(bbA, bbB);
  const distanceKm = A.center && B.center ? haversineKm(A.center, B.center) : null;
  if (iou === 0) {
    hardFail("overlap", "Footprint overlap", `No overlap — footprints are ${distanceKm ? `${Math.round(distanceKm)} km` : "far"} apart (IoU 0.00)`);
  } else {
    checks.push({
      id: "overlap",
      label: "Footprint overlap",
      status: iou > 0.95 ? "pass" : iou > 0.5 ? "warn" : "fail",
      detail: `IoU ${iou.toFixed(3)}${iou > 0.95 ? " — same scene extent" : iou > 0.5 ? " — partial overlap, analysis clipped to intersection" : " — overlap too small"}`,
    });
  }

  const sameGrid = sameCrs && A.width === B.width && A.height === B.height && A.resolution && B.resolution &&
    Math.abs(A.resolution[0] - B.resolution[0]) < 1e-6 && A.bounds && B.bounds &&
    Math.abs(A.bounds[0] - B.bounds[0]) < A.resolution[0] / 2 && Math.abs(A.bounds[3] - B.bounds[3]) < A.resolution[1] / 2;
  if (iou > 0) {
    const offset = A.bounds && B.bounds && A.resolution && sameCrs
      ? Math.hypot(A.bounds[0] - B.bounds[0], A.bounds[3] - B.bounds[3]) / A.resolution[0]
      : null;
    checks.push({
      id: "grid",
      label: "Co-registration",
      status: sameGrid ? "pass" : "warn",
      detail: sameGrid
        ? `Identical ${A.width}×${A.height} grid @ ${A.resolution?.[0]} m · offset ${offset?.toFixed(2) ?? "0.00"} px`
        : `Grids differ${offset !== null ? ` (offset ${offset.toFixed(1)} px)` : ""} — will resample B onto A`,
    });
  }

  const gap = hours(A.acquired, B.acquired);
  const modalities = [A.modality, B.modality].sort().join("+");
  let inferredMode: Mode | null = null;
  if (modalities === "optical+sar") {
    inferredMode = "cross_modal";
    checks.push({ id: "modality", label: "Modality pair", status: "pass", detail: "Optical + SAR → cross-modal fusion" });
    if (gap !== null) {
      checks.push({
        id: "time",
        label: "Acquisition gap",
        status: gap <= 72 ? "pass" : gap <= 24 * 12 ? "warn" : "fail",
        detail: `${formatGap(gap)}${gap <= 72 ? " — near-simultaneous" : " — scene may have changed between acquisitions"}`,
      });
    }
  } else if (A.modality === B.modality && A.modality !== "unknown") {
    inferredMode = "bitemporal";
    checks.push({ id: "modality", label: "Modality pair", status: "pass", detail: `${A.modality === "sar" ? "SAR" : "Optical"} + ${B.modality === "sar" ? "SAR" : "optical"} → bi-temporal` });
    if (gap !== null) {
      checks.push({
        id: "time",
        label: "Temporal baseline",
        status: gap >= 24 ? "pass" : "warn",
        detail: gap >= 24 ? `${formatGap(gap)} between acquisitions` : "Same-day pair — little change expected",
      });
    } else {
      checks.push({ id: "time", label: "Temporal baseline", status: "warn", detail: "Acquisition dates missing — order assumed A → B" });
    }
    const sameBands = A.bands === B.bands && A.dtype === B.dtype;
    checks.push({ id: "radiometry", label: "Band set", status: sameBands ? "pass" : "warn", detail: sameBands ? `Matching ${A.bands}-band ${A.dtype}` : "Band sets differ — using common bands" });
  } else {
    checks.push({ id: "modality", label: "Modality pair", status: "warn", detail: "Could not infer modalities from metadata" });
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const status = fails ? "fail" : warns ? "warn" : "ok";
  const summary = fails
    ? "Pair rejected — the images do not describe the same area."
    : inferredMode === "cross_modal"
      ? "Co-registered optical–SAR pair."
      : inferredMode === "bitemporal"
        ? `Bi-temporal pair${gap !== null ? `, ${formatGap(gap)} apart` : ""}.`
        : "Pair accepted with warnings.";
  return { status, inferredMode: fails ? null : inferredMode, checks, iou, distanceKm, temporalGapHours: gap, summary };
}
