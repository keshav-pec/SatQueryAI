import type { LoadedImage, SampleKey } from "@/lib/types";
import { fileChecks, inspectFile } from "@/lib/geo/raster";
import { SAMPLES, sampleKeyForName } from "./data";

const newId = () => Math.random().toString(36).slice(2, 10);

/** Parses a user or sample file into a validated LoadedImage (real GeoTIFF inspection). */
export async function buildLoaded(file: File, slot: "A" | "B"): Promise<LoadedImage> {
  const { meta, raster, previewUrl } = await inspectFile(file);
  const sampleKey = sampleKeyForName(file.name);
  return {
    id: `${slot}-${newId()}`,
    slot,
    file,
    meta,
    checks: fileChecks(meta),
    previewUrl: sampleKey ? SAMPLES[sampleKey].preview : previewUrl,
    sampleKey,
    raster,
  };
}

/** Fetches bundled test GeoTIFFs and inspects them exactly like an upload. */
export async function loadSamples(keys: SampleKey[]): Promise<LoadedImage[]> {
  const slots: ("A" | "B")[] = ["A", "B"];
  return Promise.all(
    keys.map(async (k, i) => {
      const s = SAMPLES[k];
      const blob = await fetch(s.url).then((r) => r.blob());
      return buildLoaded(new File([blob], s.name, { type: "image/tiff" }), slots[i]);
    }),
  );
}
