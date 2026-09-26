// Cached specialist-model outputs for the bundled test scenes. Every number is
// read from the generated evidence JSON, so answer text, overlays and charts agree.
import { HIGHLIGHT, ACCENT } from "@/lib/palette";
import type { EvidenceItem, LonLat, ScenarioId, TaskType, ToolCall, ViewId } from "@/lib/types";
import type { Intent } from "@/lib/engine/intent";
import { ha, latlon, nf0, pct } from "@/lib/format";
import { HYD, MUM, NMIA } from "./data";

export interface CannedResponse {
  task: TaskType;
  answer: string;
  highlights: string[];
  evidence: EvidenceItem[];
  overlays: string[];
  base?: string;
  charts: string[];
  view: ViewId;
  confidence: number;
  confidenceParts: { label: string; value: number }[];
  tools: ToolCall[];
  focus?: string;
}

interface PolyRec {
  label: string;
  pixel: number[][];
  holes_pixel?: number[][][];
  lonlat: number[][];
  bbox_px: number[];
  centroid_px: number[];
  centroid_lonlat: number[];
  area_ha: number;
  area_km2: number;
  perimeter_m: number;
  [k: string]: unknown;
}
interface BoxRec {
  label: string;
  bbox_px: number[];
  lonlat: number[][];
  centroid_lonlat: number[];
  size_m: number[];
  length_m?: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function polyEv(rec: PolyRec, id: string, o: { label?: string; detail: string; confidence: number; stats?: { label: string; value: string }[]; frame?: "A" | "B"; color?: string }): EvidenceItem {
  return {
    id,
    kind: "polygon",
    label: o.label ?? rec.label,
    detail: o.detail,
    confidence: o.confidence,
    pixel: rec.pixel,
    holes: rec.holes_pixel,
    lonlat: rec.lonlat as LonLat[],
    bboxPx: rec.bbox_px as [number, number, number, number],
    color: o.color ?? HIGHLIGHT,
    stats: o.stats,
    frame: o.frame ?? "A",
  };
}

function boxEv(rec: BoxRec, id: string, o: { label?: string; detail: string; confidence: number; stats?: { label: string; value: string }[]; color?: string }): EvidenceItem {
  const b = rec.bbox_px as [number, number, number, number];
  return {
    id,
    kind: "box",
    label: o.label ?? rec.label,
    detail: o.detail,
    confidence: o.confidence,
    pixel: b,
    bboxPx: b,
    lonlat: rec.lonlat as LonLat[],
    color: o.color ?? HIGHLIGHT,
    stats: o.stats,
    frame: "A",
  };
}

const tool = (t: string, version: string, title: string, stage: ToolCall["stage"], params: ToolCall["params"], output: string, ms: number): ToolCall => ({
  tool: t,
  version,
  title,
  stage,
  params,
  output,
  ms,
});

const conf = (model: number, agree: number, quality: number) => [
  { label: "Model likelihood", value: model },
  { label: "Cross-tool agreement", value: agree },
  { label: "Input quality", value: quality },
];

const matches = (q: string, re: RegExp) => re.test(q.toLowerCase());

// ─── Hyderabad · single optical ───────────────────────────────────────────

const hydLake = HYD.water_bodies.list[0] as unknown as PolyRec & { mndwi_mean: number; ndwi_mean: number };
const hydSmallWater = HYD.water_bodies.list[1] as unknown as PolyRec;
const hydGreen = HYD.green_spaces as unknown as PolyRec[];
const hydBoxes = HYD.boxes as unknown as Record<"runway" | "airport" | "parade_ground" | "rail_yard", BoxRec>;
const hydGreenLabels = ["Sanjeevaiah Park & northern shore", "Tree cover around Begumpet Airport", "Secunderabad tree belt (north-east)", "Green patch south-west of the airport"];
const hc = HYD.classes;
const hydLakeSpec = HYD.spectral.profiles.lake;
const hydBuiltSpec = HYD.spectral.profiles.builtup;

function hydEvidence() {
  const lake = polyEv(hydLake, "hyd-lake", {
    detail: "Largest connected water region · MNDWI-refined mask",
    confidence: 0.96,
    stats: [
      { label: "Area", value: `${ha(hydLake.area_ha, 1)} (${hydLake.area_km2.toFixed(2)} km²)` },
      { label: "Perimeter", value: `${(hydLake.perimeter_m / 1000).toFixed(1)} km` },
      { label: "Centroid", value: latlon(hydLake.centroid_lonlat) },
      { label: "Mean MNDWI", value: hydLake.mndwi_mean.toFixed(2) },
    ],
  });
  const small = polyEv(hydSmallWater, "hyd-water-2", {
    label: "Small tank (south-west)",
    detail: "Secondary water body below salience threshold",
    confidence: 0.62,
    stats: [
      { label: "Area", value: ha(hydSmallWater.area_ha, 1) },
      { label: "Centroid", value: latlon(hydSmallWater.centroid_lonlat) },
    ],
  });
  const runway = boxEv(hydBoxes.runway, "hyd-runway", {
    detail: "Linear bright paved surface, low NDVI, high SWIR",
    confidence: 0.94,
    stats: [
      { label: "Length", value: `≈ ${(hydBoxes.runway.length_m! / 1000).toFixed(2)} km` },
      { label: "Centre", value: latlon(hydBoxes.runway.centroid_lonlat) },
      { label: "Orientation", value: "East–west (09/27)" },
    ],
  });
  const airport = boxEv(hydBoxes.airport, "hyd-airport", {
    detail: "Runway, taxiways, apron and terminal area",
    confidence: 0.88,
    stats: [{ label: "Extent", value: `${(hydBoxes.airport.size_m[0] / 1000).toFixed(2)} × ${(hydBoxes.airport.size_m[1] / 1000).toFixed(2)} km` }],
  });
  const parade = boxEv(hydBoxes.parade_ground, "hyd-parade", {
    detail: "Large open ground, bare/grass surface",
    confidence: 0.81,
    stats: [{ label: "Size", value: `${hydBoxes.parade_ground.size_m[0]} × ${hydBoxes.parade_ground.size_m[1]} m` }],
  });
  const rail = boxEv(hydBoxes.rail_yard, "hyd-rail", {
    detail: "Converging parallel track bundle",
    confidence: 0.78,
    stats: [{ label: "Size", value: `${hydBoxes.rail_yard.size_m[0]} × ${hydBoxes.rail_yard.size_m[1]} m` }],
  });
  const greens = hydGreen.map((g, i) =>
    polyEv(g, `hyd-green-${i}`, {
      label: hydGreenLabels[i] ?? g.label,
      detail: "Connected vegetation patch (NDVI > 0.33)",
      confidence: i === 0 ? 0.86 : 0.8,
      color: "#7ee07e",
      stats: [
        { label: "Area", value: ha(g.area_ha, 1) },
        { label: "Centroid", value: latlon(g.centroid_lonlat) },
      ],
    }),
  );
  return { lake, small, runway, airport, parade, rail, greens };
}

const hydPre = (): ToolCall[] => [
  tool("spectral-indices", "1.0.0", "Land-cover evidence", "execute", { indices: ["NDVI", "MNDWI", "NDBI"], veg_ndvi: 0.33, water_mndwi: 0.0, sieve_px: 12 }, `4 classes · built-up ${pct(hc.builtup.pct)} · veg ${pct(hc.vegetation.pct)} · water ${pct(hc.water.pct)}`, 380),
];

function hydRespond(intent: Intent, q: string): CannedResponse {
  const ev = hydEvidence();
  const lakeGround: CannedResponse = {
    task: "grounding",
    answer:
      `**Grounded: Hussain Sagar Lake** — the single large water body in the scene.\n\n` +
      `• **Area** ${ha(hydLake.area_ha, 1)} (${hydLake.area_km2.toFixed(2)} km²) · **perimeter** ≈ ${(hydLake.perimeter_m / 1000).toFixed(1)} km\n` +
      `• **Centroid** ${latlon(hydLake.centroid_lonlat)} · extent ≈ ${((hydLake.bbox_px[2] - hydLake.bbox_px[0]) / 100).toFixed(1)} × ${((hydLake.bbox_px[3] - hydLake.bbox_px[1]) / 100).toFixed(1)} km\n` +
      `• **Spectral evidence** — mean MNDWI ${hydLake.mndwi_mean.toFixed(2)} inside the mask; SWIR-1 reflectance ${hydLakeSpec[4].toFixed(3)} vs ${hydBuiltSpec[4].toFixed(3)} for the surrounding built-up area, which confirms open water.\n\n` +
      `A second, much smaller tank (${ha(hydSmallWater.area_ha, 1)}) was found in the south-west; it falls below the salience threshold for “the water body” and is listed as secondary evidence.`,
    highlights: [`${hydLake.area_km2.toFixed(2)} km²`, `MNDWI ${hydLake.mndwi_mean.toFixed(2)}`, "2 candidates"],
    evidence: [ev.lake, ev.small],
    overlays: [],
    charts: ["hyd-spectral", "hyd-composition"],
    view: "split",
    confidence: 0.95,
    confidenceParts: conf(0.94, 0.97, 0.99),
    tools: [
      tool("rs-grounder", "0.9.0", "Ground referring expression", "execute", { text: "the water body", box_threshold: 0.35, top_k: 3, refine: "spectral" }, "2 candidate regions · top score 0.93", 820),
      tool("spectral-indices", "1.0.0", "Refine mask (MNDWI)", "execute", { water_mndwi: 0.0, nir_max: 0.11, sieve_px: 12 }, `mask ${ha(hydLake.area_ha, 1)} · IoU with box proposal 0.91`, 240),
    ],
    focus: "hyd-lake",
  };
  const runwayAnswer: CannedResponse = {
    task: intent.task === "grounding" ? "grounding" : "vqa",
    answer:
      `**Yes — Begumpet Airport (VOHY).** Its single east–west runway (09/27) is clearly resolved across the northern third of the image.\n\n` +
      `• **Runway** ≈ ${(hydBoxes.runway.length_m! / 1000).toFixed(1)} km long, centred at ${latlon(hydBoxes.runway.centroid_lonlat)} (pixels x ${hydBoxes.runway.bbox_px[0]}–${hydBoxes.runway.bbox_px[2]}, y ${hydBoxes.runway.bbox_px[1]}–${hydBoxes.runway.bbox_px[3]})\n` +
      `• **Airport complex** ≈ ${(hydBoxes.airport.size_m[0] / 1000).toFixed(2)} × ${(hydBoxes.airport.size_m[1] / 1000).toFixed(2)} km including taxiways, the apron and terminal on the southern side\n` +
      `• Evidence: a straight, bright, non-vegetated strip with high SWIR reflectance — consistent with paved concrete/asphalt, not a road (width and length ratio).`,
    highlights: ["Begumpet Airport", `≈ ${(hydBoxes.runway.length_m! / 1000).toFixed(1)} km runway`],
    evidence: [ev.runway, ev.airport],
    overlays: [],
    charts: ["hyd-composition"],
    view: "split",
    confidence: 0.93,
    confidenceParts: conf(0.92, 0.94, 0.99),
    tools: [
      tool("satquery-vlm", "1.2.0", "Answer existence question", "execute", { question_type: "presence", temperature: 0.2, image_size: 672 }, "yes (p = 0.97)", 690),
      tool("rs-grounder", "0.9.0", "Localise airport / runway", "execute", { text: "airport runway", box_threshold: 0.35, top_k: 2, refine: "none" }, "2 boxes · runway score 0.91", 760),
    ],
    focus: "hyd-runway",
  };

  if (intent.task === "grounding") {
    if (intent.target === "airport / runway") return runwayAnswer;
    if (intent.target === "vegetation") {
      return {
        task: "grounding",
        answer:
          `**Highlighted ${ev.greens.length} green spaces** larger than 30 ha (NDVI > 0.33):\n\n` +
          ev.greens.map((g) => `• **${g.label}** — ${g.stats?.[0].value}`).join("\n") +
          `\n\nTogether, vegetation covers ${pct(hc.vegetation.pct)} of the scene (${ha(hc.vegetation.ha)}). The land-cover overlay shows every vegetated pixel; toggle classes in the legend to isolate them.`,
        highlights: [`${pct(hc.vegetation.pct)} vegetated`, `${ev.greens.length} patches`],
        evidence: ev.greens,
        overlays: ["hyd:classes"],
        charts: ["hyd-composition", "hyd-spectral"],
        view: "image",
        confidence: 0.88,
        confidenceParts: conf(0.87, 0.9, 0.99),
        tools: [...hydPre(), tool("rs-grounder", "0.9.0", "Ground 'green spaces'", "execute", { text: "parks and green spaces", box_threshold: 0.3, top_k: 4, refine: "spectral" }, "4 regions ≥ 30 ha", 780)],
        focus: "hyd-green-0",
      };
    }
    if (intent.target === "railway yard") {
      return {
        task: "grounding",
        answer: `**Secunderabad Junction railway yard** — the bundle of converging parallel tracks on the eastern edge of the scene, ≈ ${hydBoxes.rail_yard.size_m[0]} × ${hydBoxes.rail_yard.size_m[1]} m, centred at ${latlon(hydBoxes.rail_yard.centroid_lonlat)}.\n\nAt 10 m resolution individual tracks are not resolved; the yard is recognised from its linear texture and bright ballast/roof signature.`,
        highlights: ["Railway yard"],
        evidence: [ev.rail],
        overlays: [],
        charts: [],
        view: "split",
        confidence: 0.79,
        confidenceParts: conf(0.78, 0.8, 0.99),
        tools: [tool("rs-grounder", "0.9.0", "Ground 'railway station'", "execute", { text: "railway station yard", box_threshold: 0.3, top_k: 2 }, "1 box · score 0.74", 740)],
        focus: "hyd-rail",
      };
    }
    if (intent.target === "open ground") {
      return {
        task: "grounding",
        answer: `**Parade Ground, Secunderabad** — a large rectangular open ground (≈ ${hydBoxes.parade_ground.size_m[0]} × ${hydBoxes.parade_ground.size_m[1]} m) in the north-east, centred at ${latlon(hydBoxes.parade_ground.centroid_lonlat)}. Its bright, smooth, reddish surface is typical of bare compacted soil with sparse grass.`,
        highlights: ["Open ground"],
        evidence: [ev.parade],
        overlays: [],
        charts: [],
        view: "split",
        confidence: 0.83,
        confidenceParts: conf(0.82, 0.84, 0.99),
        tools: [tool("rs-grounder", "0.9.0", "Ground 'open ground'", "execute", { text: "large open ground", box_threshold: 0.3, top_k: 2 }, "1 box · score 0.8", 700)],
        focus: "hyd-parade",
      };
    }
    return lakeGround;
  }

  if (intent.task === "captioning") {
    return {
      task: "captioning",
      answer:
        `**Sentinel-2 true-colour scene (10 m) of central Hyderabad–Secunderabad**, acquired ${HYD.acquired_local} and covering ${HYD.grid.area_km2.toFixed(1)} km².\n\n` +
        `The scene is dominated by **dense built-up urban fabric (${pct(hc.builtup.pct)})**. At its centre lies the heart-shaped **Hussain Sagar lake** (${hydLake.area_km2.toFixed(2)} km², ${pct(hc.water.pct)} of the scene); its greenish, turbid water points to high algal content. The **Begumpet Airport** runway (≈ ${(hydBoxes.runway.length_m! / 1000).toFixed(1)} km, east–west) crosses the northern third, with the apron and terminal on its southern side. **Vegetation covers ${pct(hc.vegetation.pct)}** — tree canopy around the airport and in Secunderabad to the north-east, the **Sanjeevaiah Park** belt on the lake's northern shore and scattered urban parks. Bare or open land is minimal (${pct(hc.bare.pct)}), mostly sports grounds such as the **Parade Ground**, and the **Secunderabad Junction railway yard** marks the eastern edge.\n\n` +
        `**Major objects:** Hussain Sagar lake · Begumpet Airport runway 09/27 · Sanjeevaiah Park · Parade Ground · Secunderabad railway yard.`,
      highlights: [`Built-up ${pct(hc.builtup.pct)}`, `Vegetation ${pct(hc.vegetation.pct)}`, `Water ${pct(hc.water.pct)}`, "5 objects"],
      evidence: [ev.lake, ev.runway, ev.greens[0], ev.parade, ev.rail],
      overlays: ["hyd:classes"],
      charts: ["hyd-composition", "hyd-spectral"],
      view: "image",
      confidence: 0.91,
      confidenceParts: conf(0.9, 0.93, 0.99),
      tools: [
        ...hydPre(),
        tool("rs-grounder", "0.9.0", "Propose salient objects", "execute", { text: "salient objects", box_threshold: 0.3, top_k: 5, refine: "spectral" }, "5 objects: lake, runway, park, ground, rail yard", 910),
        tool("satquery-vlm", "1.2.0", "Generate caption", "execute", { prompt: "rs-caption-v2", temperature: 0.2, max_new_tokens: 320, image_size: 672 }, "caption · 162 tokens", 1380),
      ],
    };
  }

  // VQA
  if (matches(q, /airport|runway|airstrip|aircraft|plane/)) return runwayAnswer;
  if (matches(q, /clean|pollut|quality|algae|algal|eutroph|turbid/)) {
    return {
      task: "vqa",
      answer:
        `**Not verifiable from imagery alone — but the spectral signature suggests eutrophic, turbid water.**\n\n` +
        `Inside the lake the green band (${hydLakeSpec[1].toFixed(3)}) exceeds blue (${hydLakeSpec[0].toFixed(3)}) and red (${hydLakeSpec[2].toFixed(3)}), and near-infrared stays elevated at ${hydLakeSpec[3].toFixed(3)}, where clear open water is usually below 0.03. This combination is typical of high chlorophyll (algal bloom) and suspended sediment.\n\n` +
        `Recommendation: confirm with in-situ sampling or a dedicated chlorophyll-a / turbidity retrieval before drawing conclusions. Confidence is deliberately reported low.`,
      highlights: ["Low confidence", `NIR ${hydLakeSpec[3].toFixed(3)}`, "Likely eutrophic"],
      evidence: [ev.lake],
      overlays: [],
      charts: ["hyd-spectral"],
      view: "image",
      confidence: 0.62,
      confidenceParts: conf(0.66, 0.7, 0.99),
      tools: [
        tool("spectral-indices", "1.0.0", "Extract lake spectrum", "execute", { region: "hyd-lake", bands: ["B02", "B03", "B04", "B08", "B11", "B12"] }, "6-band mean reflectance", 210),
        tool("satquery-vlm", "1.2.0", "Answer with uncertainty", "execute", { question_type: "attribute", temperature: 0.1, abstain_below: 0.7 }, "hedged answer (p = 0.64)", 980),
      ],
      focus: "hyd-lake",
    };
  }
  if (matches(q, /how many|count|number of/) && matches(q, /water|lake|tank|pond/)) {
    return {
      task: "vqa",
      answer:
        `**2 water bodies** larger than 1 ha are visible:\n\n` +
        `• **Hussain Sagar** — ${ha(hydLake.area_ha, 1)}, centred at ${latlon(hydLake.centroid_lonlat)}\n` +
        `• **Small tank** in the south-west — ${ha(hydSmallWater.area_ha, 1)}, at ${latlon(hydSmallWater.centroid_lonlat)}\n\n` +
        `Together, open water covers ${pct(hc.water.pct)} of the scene.`,
      highlights: ["2 water bodies"],
      evidence: [ev.lake, ev.small],
      overlays: [],
      charts: ["hyd-composition"],
      view: "image",
      confidence: 0.9,
      confidenceParts: conf(0.89, 0.93, 0.99),
      tools: [...hydPre(), tool("satquery-vlm", "1.2.0", "Answer counting question", "execute", { question_type: "count", temperature: 0.0 }, "2", 640)],
    };
  }
  if (matches(q, /vegetation|green|tree|ndvi/)) {
    return {
      task: "vqa",
      answer:
        `**${pct(hc.vegetation.pct)} of the scene** — about ${ha(hc.vegetation.ha)} of ${nf0.format(HYD.grid.area_km2 * 100)} ha — is vegetated (NDVI > 0.33). The scene-wide mean NDVI is ${HYD.ndvi_mean.toFixed(2)}.\n\n` +
        `The largest green areas are ${ev.greens[1].label.toLowerCase()} (${ev.greens[1].stats?.[0].value}), the ${ev.greens[2].label.toLowerCase().replace(" (north-east)", "")} (${ev.greens[2].stats?.[0].value}) and the ${ev.greens[0].label.toLowerCase().replace("sanjeevaiah", "Sanjeevaiah")} (${ev.greens[0].stats?.[0].value}).`,
      highlights: [pct(hc.vegetation.pct), `NDVI ${HYD.ndvi_mean.toFixed(2)}`],
      evidence: ev.greens,
      overlays: ["hyd:classes"],
      base: "hyd:falsecolor",
      charts: ["hyd-composition", "hyd-spectral"],
      view: "image",
      confidence: 0.92,
      confidenceParts: conf(0.9, 0.95, 0.99),
      tools: [...hydPre(), tool("satquery-vlm", "1.2.0", "Answer quantitative question", "execute", { question_type: "proportion", temperature: 0.0 }, `${pct(hc.vegetation.pct)}`, 610)],
    };
  }
  if (matches(q, /dominant|main|primary|most|majority|built|urban/)) {
    return {
      task: "vqa",
      answer: `**Built-up land** dominates: ${pct(hc.builtup.pct)} of the scene (${ha(hc.builtup.ha)}), followed by vegetation ${pct(hc.vegetation.pct)}, water ${pct(hc.water.pct)} and bare/open land ${pct(hc.bare.pct)}. The urban fabric is dense and continuous except for the lake, the airport and the green belts.`,
      highlights: [`Built-up ${pct(hc.builtup.pct)}`],
      evidence: [],
      overlays: ["hyd:classes"],
      charts: ["hyd-composition"],
      view: "image",
      confidence: 0.94,
      confidenceParts: conf(0.93, 0.95, 0.99),
      tools: [...hydPre(), tool("satquery-vlm", "1.2.0", "Answer land-cover question", "execute", { question_type: "comparison", temperature: 0.0 }, "built-up", 560)],
    };
  }
  if (matches(q, /water|lake/)) return lakeGround;
  return {
    ...hydRespond({ task: "captioning", confidence: intent.confidence, target: intent.target }, q),
    task: "vqa",
  };
}

// ─── Mumbai · SAR only / optical only / fused ─────────────────────────────

const mumRunways = MUM.runways as unknown as PolyRec[];
const mumWater = MUM.water_bodies as unknown as (PolyRec & { vv_mean_db: number })[];
const mumPC = MUM.per_class;
const mc = MUM.classes;
const mcorr = MUM.corrections;
const coastal = mumRunways.slice(1);
const coastalHa = coastal.reduce((s, r) => s + r.area_ha, 0);

function mumEvidence(frame: "A" | "B") {
  const runway = polyEv(mumRunways[0], "mum-runway", {
    label: "CSMIA runways & taxiways",
    detail: "Radar-dark smooth tarmac — optically dry (MNDWI < −0.05)",
    confidence: 0.92,
    color: ACCENT,
    frame,
    stats: [
      { label: "Area", value: ha(mumRunways[0].area_ha, 1) },
      { label: "Centroid", value: latlon(mumRunways[0].centroid_lonlat) },
      { label: "SAR", value: `VV < ${MUM.sar_water_threshold_db} dB (water-like)` },
    ],
  });
  const beaches = coastal.map((r, i) =>
    polyEv(r, `mum-coast-${i}`, {
      label: "Beach / intertidal flat",
      detail: "Smooth wet sand — dark in SAR, bright in optical",
      confidence: 0.74,
      color: ACCENT,
      frame,
      stats: [{ label: "Area", value: ha(r.area_ha, 1) }],
    }),
  );
  const water = mumWater.slice(0, 3).map((w, i) =>
    polyEv(w, `mum-water-${i}`, {
      label: w.label,
      detail: "Agreed by optical MNDWI and SAR backscatter",
      confidence: i < 2 ? 0.97 : 0.9,
      frame,
      stats: [
        { label: "Area", value: ha(w.area_ha, 1) },
        { label: "Mean VV", value: `${w.vv_mean_db.toFixed(1)} dB` },
      ],
    }),
  );
  const vessels: EvidenceItem = {
    id: "mum-vessels",
    kind: "points",
    label: `${MUM.vessels.length} SAR point targets`,
    detail: "Bright scatterers inside the water mask (moored vessels)",
    confidence: 0.81,
    color: ACCENT,
    frame: "B",
    points: MUM.vessels.map((v, i) => ({ px: v.px as [number, number], lonlat: v.lonlat as LonLat, label: `T${i + 1} · ${v.vv_db.toFixed(1)} dB` })),
    bboxPx: (() => {
      const xs = MUM.vessels.map((v) => v.px[0]);
      const ys = MUM.vessels.map((v) => v.px[1]);
      return [Math.min(...xs) - 20, Math.min(...ys) - 20, Math.max(...xs) + 20, Math.max(...ys) + 20] as [number, number, number, number];
    })(),
    stats: [
      { label: "Targets", value: String(MUM.vessels.length) },
      { label: "VV range", value: `${Math.min(...MUM.vessels.map((v) => v.vv_db)).toFixed(1)} … +${Math.max(...MUM.vessels.map((v) => v.vv_db)).toFixed(1)} dB` },
      { label: "Location", value: "Mahim Bay" },
    ],
  };
  return { runway, beaches, water, vessels };
}

const sarTools = (): ToolCall[] => [
  tool("sar-segmenter", "1.1.0", "Segment SAR backscatter", "execute", { polarisations: ["VV", "VH"], water_threshold_db: "otsu", builtup_threshold_db: -4, sieve_px: 12 }, `Otsu split at ${MUM.sar_water_threshold_db} dB · dark ${pct(mc.sar.water.pct)} · double-bounce ${pct(mc.sar.builtup.pct)}`, 520),
];

function mumSarRespond(intent: Intent, q: string): CannedResponse {
  const ev = mumEvidence("B");
  const vesselAnswer: CannedResponse = {
    task: intent.task === "grounding" ? "grounding" : "vqa",
    answer:
      `**Yes — ${MUM.vessels.length} bright point targets on water**, all inside **Mahim Bay** (VV ${Math.min(...MUM.vessels.map((v) => v.vv_db)).toFixed(0)} dB up to +${Math.max(...MUM.vessels.map((v) => v.vv_db)).toFixed(0)} dB against a ${mumWater[1].vv_mean_db.toFixed(1)} dB bay background).\n\n` +
      `Each target spans only a few 10 m pixels and they cluster near the Mahim–Bandra fishing moorings, which is consistent with **moored fishing vessels**. Metal hulls act as strong corner reflectors, so SAR picks them up at night and through cloud — at 10 m they are barely resolvable in optical imagery.`,
    highlights: [`${MUM.vessels.length} targets`, "Mahim Bay", "Night-time pass"],
    evidence: [ev.vessels],
    overlays: [],
    charts: ["mum-hist"],
    view: "image",
    confidence: 0.81,
    confidenceParts: conf(0.8, 0.84, 0.97),
    tools: [...sarTools(), tool("sar-point-detector", "0.7.0", "Detect bright targets on water", "execute", { min_vv_db: -2, max_target_px: 60, guard_px: 8 }, `${MUM.vessels.length} targets · 0 on land`, 430)],
    focus: "mum-vessels",
  };
  if (matches(q, /ship|boat|vessel/)) return vesselAnswer;
  if (intent.task === "grounding" || matches(q, /low backscatter|dark/)) {
    const isLow = matches(q, /low backscatter|dark|represent/);
    return {
      task: isLow ? "vqa" : "grounding",
      answer:
        (isLow
          ? `**Low backscatter (VV below the Otsu threshold of ${MUM.sar_water_threshold_db} dB) covers ${ha(mc.sar.water.ha)} — ${pct(mc.sar.water.pct)} of the scene.** It has two physically different causes:\n\n`
          : `**Highlighted radar-dark water (VV < ${MUM.sar_water_threshold_db} dB):** ${mumWater.slice(0, 3).map((w) => `${w.label} (${ha(w.area_ha)})`).join(", ")}.\n\n`) +
        `• **Open water** — Arabian Sea (${ha(mumWater[0].area_ha)}), Mahim Bay (${ha(mumWater[1].area_ha)}), the Mithi River and creeks; mean VV ${mumPC.water.vv_db} dB, VH ${mumPC.water.vh_db} dB.\n` +
        `• **Smooth dry surfaces** — the CSMIA runways & taxiways (${ha(mumRunways[0].area_ha)}) and ${ha(coastalHa)} of beach sand and intertidal flats along Juhu–Bandra. They mirror the radar pulse away from the sensor, exactly like calm water.\n\n` +
        `⚠ From SAR alone these cannot be separated reliably. Pair this image with the co-registered optical scene (MNDWI) to get a clean water map — try the **Mumbai — optical + SAR** scenario.`,
      highlights: [`Otsu ${MUM.sar_water_threshold_db} dB`, `${ha(mc.sar.water.ha)} radar-dark`, "Ambiguous: runways"],
      evidence: [...ev.water, ev.runway, ...ev.beaches.slice(0, 2)],
      overlays: ["mum:cls_sar"],
      base: "mum:sar_vv",
      charts: ["mum-hist"],
      view: "image",
      confidence: 0.84,
      confidenceParts: conf(0.86, 0.78, 0.97),
      tools: [...sarTools(), tool("rs-grounder", "0.9.0", "Ground 'water body' (SAR)", "execute", { text: "water body", box_threshold: 0.35, top_k: 5, refine: "sar" }, "5 regions · 2 flagged ambiguous", 800)],
      focus: "mum-water-0",
    };
  }
  return {
    task: intent.task === "vqa" ? "vqa" : "captioning",
    answer:
      `**Sentinel-1A C-band SAR scene (VV + VH, 10 m, terrain-corrected γ⁰) over Bandra–Kurla–Santacruz, Mumbai**, acquired on a descending pass at **06:33 IST on 07 Jan 2025 — before sunrise**, when no optical sensor could image the city.\n\n` +
      `Most of the land returns **strong, grainy backscatter** (built-up mean VV ${mumPC.builtup.vv_db} dB) — double-bounce from dense buildings between Bandra and Kurla. **Very dark, smooth surfaces** (≈ ${mumPC.water.vv_db} dB) are the **Arabian Sea** to the west, **Mahim Bay** to the south-west and the winding **Mithi River**. The **X-shaped dark feature** in the north is the **CSMIA runway system**: smooth tarmac reflects the pulse away from the sensor, just like calm water. Mangroves along the Mithi River return moderately bright signals (VH ${mumPC.vegetation.vh_db} dB) from trunk–water double-bounce. A cluster of **bright point targets in Mahim Bay** is consistent with moored vessels, and the bright line across the bay is the **Bandra–Worli Sea Link**.`,
    highlights: ["Pre-dawn pass", `Otsu ${MUM.sar_water_threshold_db} dB`, `${MUM.vessels.length} point targets`],
    evidence: [ev.water[0], ev.water[1], ev.runway, ev.vessels],
    overlays: ["mum:cls_sar"],
    base: "mum:sar_vv",
    charts: ["mum-hist"],
    view: "image",
    confidence: 0.88,
    confidenceParts: conf(0.87, 0.88, 0.97),
    tools: [
      ...sarTools(),
      tool("sar-point-detector", "0.7.0", "Detect bright targets on water", "execute", { min_vv_db: -2, max_target_px: 60 }, `${MUM.vessels.length} targets`, 410),
      tool("satquery-vlm", "1.2.0", "Generate SAR caption", "execute", { prompt: "rs-caption-sar-v1", render: "VV dB greyscale", temperature: 0.2, max_new_tokens: 320 }, "caption · 171 tokens", 1420),
    ],
  };
}

function mumOptRespond(intent: Intent, q: string): CannedResponse {
  const ev = mumEvidence("A");
  const o = mc.optical;
  if (intent.task === "grounding" || matches(q, /water/)) {
    return {
      task: "grounding",
      answer:
        `**Highlighted ${ev.water.length} water bodies** from optical MNDWI:\n\n` +
        ev.water.map((w) => `• **${w.label}** — ${w.stats?.[0].value}`).join("\n") +
        `\n\nOpen water covers ${pct(o.water.pct)} of the scene. Smaller ponds and creek arms are visible in the land-cover overlay.`,
      highlights: [`${pct(o.water.pct)} water`],
      evidence: ev.water,
      overlays: ["mum:cls_optical"],
      charts: ["mum-class-compare"],
      view: "split",
      confidence: 0.94,
      confidenceParts: conf(0.93, 0.95, 0.99),
      tools: [tool("spectral-indices", "1.0.0", "Optical land cover", "execute", { water_mndwi: 0.0, veg_ndvi: 0.33, sieve_px: 12 }, `water ${pct(o.water.pct)}`, 360), tool("rs-grounder", "0.9.0", "Ground 'water bodies'", "execute", { text: "water bodies", top_k: 3, refine: "spectral" }, "3 regions", 760)],
      focus: "mum-water-1",
    };
  }
  return {
    task: intent.task === "vqa" ? "vqa" : "captioning",
    answer:
      `**Sentinel-2 true-colour scene (10 m, ${MUM.acquired_local.s2}) of Mumbai's western suburbs from Juhu to Kurla**, ${MUM.grid.area_km2.toFixed(1)} km².\n\n` +
      `**Built-up land covers ${pct(o.builtup.pct)}** — dense residential and commercial fabric including the Bandra–Kurla Complex and Dharavi. **Vegetation (${pct(o.vegetation.pct)})** is dominated by mangroves along the Mithi River and Mahim creek. **Water (${pct(o.water.pct)})** comprises the Arabian Sea, Mahim Bay and the Mithi River. The **CSMIA airport** with its two crossing runways and Terminal 2 occupies the north, and the Bandra–Worli Sea Link crosses the bay in the south-west.`,
    highlights: [`Built-up ${pct(o.builtup.pct)}`, `Vegetation ${pct(o.vegetation.pct)}`, `Water ${pct(o.water.pct)}`],
    evidence: [ev.water[0], ev.water[1], { ...ev.runway, label: "CSMIA airport runways", color: HIGHLIGHT }],
    overlays: ["mum:cls_optical"],
    charts: ["mum-class-compare"],
    view: "image",
    confidence: 0.9,
    confidenceParts: conf(0.89, 0.91, 0.99),
    tools: [
      tool("spectral-indices", "1.0.0", "Optical land cover", "execute", { veg_ndvi: 0.33, water_mndwi: 0.0, sieve_px: 12 }, `built-up ${pct(o.builtup.pct)}`, 360),
      tool("satquery-vlm", "1.2.0", "Generate caption", "execute", { prompt: "rs-caption-v2", temperature: 0.2, max_new_tokens: 320 }, "caption · 128 tokens", 1300),
    ],
  };
}

const fusionTools = (): ToolCall[] => [
  tool("spectral-indices", "1.0.0", "Optical evidence (S2)", "execute", { indices: ["NDVI", "MNDWI", "NDBI"], veg_ndvi: 0.33, water_mndwi: 0.0, sieve_px: 12 }, `water ${pct(mc.optical.water.pct)} · built-up ${pct(mc.optical.builtup.pct)}`, 380),
  ...sarTools(),
  tool("optsar-fusion", "1.0.0", "Fuse optical + SAR evidence", "fuse", { ruleset: "rs-fusion-v1", min_agreement: 0.5, co_registration: "verified" }, `${ha(mcorr.sar_false_water_ha + mcorr.optical_builtup_to_open_ha + mcorr.optical_bare_to_builtup_ha)} reconciled · water IoU ${MUM.agreement.water_iou.toFixed(2)} → fused`, 640),
];

function mumFusionRespond(intent: Intent, q: string): CannedResponse {
  const ev = mumEvidence("A");
  const f = mc.fused;
  const disagreeHa = mcorr.sar_false_water_ha + mcorr.optical_builtup_to_open_ha + mcorr.optical_bare_to_builtup_ha;
  const vessel = mumSarRespond({ ...intent, task: "vqa" }, "vessel");

  if (matches(q, /ship|boat|vessel/)) {
    return {
      ...vessel,
      task: "fusion_vqa",
      answer: vessel.answer + `\n\nIn the fused view, the optical image confirms these targets sit on open water (MNDWI > 0.3 around each point), ruling out bright structures on land.`,
      tools: [...fusionTools().slice(0, 2), vessel.tools[1]],
      view: "fusion",
      overlays: [],
    };
  }
  if (matches(q, /runway|airport|tarmac/)) {
    return {
      task: "fusion_vqa",
      answer:
        `**Because smooth tarmac is a mirror for C-band radar.** At 5.6 cm wavelength the runway surface is smooth, so the pulse reflects specularly away from the sensor and almost nothing returns — the same behaviour as calm water. Radar alone therefore places the CSMIA runways and taxiways (**${ha(mumRunways[0].area_ha)}**) below the ${MUM.sar_water_threshold_db} dB water threshold.\n\n` +
        `The optical image resolves it: those pixels are bright and dry (MNDWI < −0.05, high SWIR), so the fusion step reclassifies them as **impervious built-up** — ${ha(mcorr.smooth_impervious_ha)} of tarmac across the scene. The same logic moves ${ha(mcorr.smooth_open_ha)} of beach sand and intertidal flats to open land.`,
      highlights: [`${ha(mumRunways[0].area_ha)} runways`, "Specular reflection", "Fixed by optical"],
      evidence: [ev.runway],
      overlays: ["mum:disagreement"],
      charts: ["mum-scatter", "mum-hist"],
      view: "fusion",
      confidence: 0.92,
      confidenceParts: conf(0.91, 0.93, 0.98),
      tools: fusionTools(),
      focus: "mum-runway",
    };
  }
  if (matches(q, /mangrove|vegetation|green|tree/)) {
    return {
      task: "fusion_vqa",
      answer:
        `**Vegetation covers ${ha(f.vegetation.ha)} (${pct(f.vegetation.pct)})**, most of it **mangrove forest** along the Mithi River and Mahim creek, plus parks and tree-lined campuses.\n\n` +
        `Both sensors agree on ${pct(mumPC.vegetation.agreement_pct)} of these pixels: optically they are strongly green (mean NDVI ${mumPC.vegetation.ndvi.toFixed(2)}), and in radar they return relatively bright cross-polarised signals (VH ${mumPC.vegetation.vh_db} dB) from canopy volume scattering and trunk–water double-bounce — the typical SAR signature of mangroves, which separates them from grass and scrub.`,
      highlights: [pct(f.vegetation.pct), `NDVI ${mumPC.vegetation.ndvi.toFixed(2)}`, `VH ${mumPC.vegetation.vh_db} dB`],
      evidence: [],
      overlays: ["mum:cls_fused"],
      charts: ["mum-class-compare", "mum-scatter"],
      view: "fusion",
      confidence: 0.87,
      confidenceParts: conf(0.86, 0.84, 0.98),
      tools: fusionTools(),
    };
  }
  if (matches(q, /disagree|differ|conflict|why|mismatch|complement/)) {
    return {
      task: "fusion_vqa",
      answer:
        `**The sensors disagree on ${ha(disagreeHa)} (${((100 * disagreeHa) / (MUM.grid.area_km2 * 100)).toFixed(1)} % of the scene)**, in two systematic ways:\n\n` +
        `• **Radar-dark but dry — ${ha(mcorr.sar_false_water_ha)} (orange).** CSMIA runways/taxiways and Juhu–Bandra beaches and intertidal flats. Smooth surfaces mirror the radar pulse (VV like water) while the optical image shows bright, dry ground.\n` +
        `• **Spectrally ambiguous land — ${ha(mcorr.optical_bare_to_builtup_ha + mcorr.optical_builtup_to_open_ha)} (green).** ${ha(mcorr.optical_bare_to_builtup_ha)} of red- and tin-roofed dense settlements that optical reads as bare soil, and ${ha(mcorr.optical_builtup_to_open_ha)} of open grounds it reads as built-up. SAR separates them by structure: buildings give double-bounce returns (VV ${mumPC.builtup.vv_db} dB), open ground does not (${mumPC.bare.vv_db} dB).\n\n` +
        `**Fusion rule:** trust SAR for structure (built-up vs open), trust optical for surface wetness and vegetation.`,
      highlights: [`${ha(disagreeHa)} reconciled`, `water IoU ${MUM.agreement.water_iou.toFixed(2)}`, `built-up IoU ${MUM.agreement.builtup_iou.toFixed(2)}`],
      evidence: [ev.runway, ...ev.beaches.slice(0, 2)],
      overlays: ["mum:disagreement"],
      charts: ["mum-scatter", "mum-class-compare", "mum-hist"],
      view: "fusion",
      confidence: 0.9,
      confidenceParts: conf(0.88, 0.92, 0.98),
      tools: fusionTools(),
      focus: "mum-runway",
    };
  }
  if (matches(q, /cloud|night|time|when|acquisition|dark|sun/)) {
    return {
      task: "fusion_vqa",
      answer:
        `The optical image was acquired at **${MUM.acquired_local.s2}** (sun-synchronous morning pass); the SAR image at **${MUM.acquired_local.s1} — before sunrise**, which optical sensors cannot do. The two are **19 h 22 min** apart, short enough for land cover to be unchanged, which the validator accepts for cross-modal fusion.\n\n` +
        `Because C-band radar penetrates cloud and needs no sunlight, the same workflow keeps producing water and built-up maps during the monsoon, when Sentinel-2 or Cartosat optical scenes over Mumbai are routinely cloud-covered.`,
      highlights: ["SAR 06:33 IST", "Optical 11:11 IST", "Gap 19 h 22 min"],
      evidence: [],
      overlays: [],
      charts: [],
      view: "fusion",
      confidence: 0.96,
      confidenceParts: conf(0.95, 0.97, 0.99),
      tools: [tool("geo-validator", "1.2.0", "Read acquisition metadata", "execute", { fields: ["ACQUISITION_DATE", "ORBIT_STATE"] }, "S2 05:41 UTC · S1 01:03 UTC (descending)", 90)],
    };
  }
  // Default: the PS representative query — joint built-up / water extraction
  return {
    task: "fusion_extraction",
    answer:
      `**Built-up and water-covered regions from optical + SAR evidence (${MUM.grid.area_km2.toFixed(1)} km²):**\n\n` +
      `• **Built-up — ${ha(f.builtup.ha)} (${pct(f.builtup.pct)})**: continuous urban fabric from Bandra and Santacruz to Kurla, including BKC, Dharavi and the CSMIA terminal area.\n` +
      `• **Water — ${ha(f.water.ha)} (${pct(f.water.pct)})**: Arabian Sea (${ha(mumWater[0].area_ha)}), Mahim Bay (${ha(mumWater[1].area_ha)}), Mithi River (${ha(mumWater[2].area_ha)}) and small ponds and creeks.\n` +
      `• Remaining land: vegetation ${ha(f.vegetation.ha)} (${pct(f.vegetation.pct)}, mostly mangroves) and open land ${ha(f.bare.ha)} (${pct(f.bare.pct)}).\n\n` +
      `**Why both sensors were needed**\n` +
      `• **SAR alone** would call ${ha(mcorr.sar_false_water_ha)} “water”: the CSMIA runways and taxiways and ${ha(mcorr.smooth_open_ha)} of beach sand and intertidal flats are radar-dark. Optical MNDWI shows they are dry.\n` +
      `• **Optical alone** reads ${ha(mcorr.optical_bare_to_builtup_ha)} of red- and tin-roofed dense settlements as bare soil and ${ha(mcorr.optical_builtup_to_open_ha)} of open ground as built-up. SAR double-bounce (VV > −8 dB) settles both.\n` +
      `• Water is the most reliable class (${pct(mumPC.water.agreement_pct, 0)} cross-sensor agreement); built-up agreement is ${pct(mumPC.builtup.agreement_pct, 0)}.`,
    highlights: [`Built-up ${pct(f.builtup.pct)}`, `Water ${pct(f.water.pct)}`, `${ha(disagreeHa)} corrected by fusion`],
    evidence: [ev.water[0], ev.water[1], ev.water[2], ev.runway],
    overlays: ["mum:cls_fused"],
    charts: ["mum-class-compare", "mum-hist", "mum-scatter"],
    view: "fusion",
    confidence: 0.93,
    confidenceParts: conf(0.92, 0.94, 0.98),
    tools: [...fusionTools(), tool("satquery-vlm", "1.2.0", "Explain complementarity", "execute", { prompt: "rs-fusion-explain-v1", temperature: 0.2, max_new_tokens: 384 }, "answer · 214 tokens", 1250)],
  };
}

// ─── Navi Mumbai airport · bi-temporal ────────────────────────────────────

const regions = NMIA.regions as unknown as (PolyRec & { changed_ha: number; dominant: string; breakdown: { key: string; ha: number }[] })[];
const fp = NMIA.footprint as unknown as PolyRec & { changed_ha: number; changed_pct: number; breakdown: { key: string; ha: number }[]; t1: Record<string, number>; t2: Record<string, number> };
const n1 = NMIA.classes.t1;
const n2 = NMIA.classes.t2;
const nch = NMIA.change;
const byType = Object.fromEntries(nch.by_type.map((t) => [t.key, t.ha]));
const fpBy = Object.fromEntries(fp.breakdown.map((t) => [t.key, t.ha]));
const tsByYear = Object.fromEntries(NMIA.timeseries.map((t) => [t.year, t]));

function nmiaEvidence() {
  const foot = polyEv(fp, "nmia-footprint", {
    label: "NMIA airport platform",
    detail: `${pct(fp.changed_pct)} of pixels changed · dominant: open land → built-up`,
    confidence: 0.95,
    color: HIGHLIGHT,
    frame: "B",
    stats: [
      { label: "Area", value: ha(fp.area_ha, 1) },
      { label: "Changed", value: `${ha(fp.changed_ha)} (${pct(fp.changed_pct)})` },
      { label: "Centroid", value: latlon(fp.centroid_lonlat) },
      { label: "Built-up", value: `${pct(fp.t1.builtup)} → ${pct(fp.t2.builtup)}` },
      { label: "Vegetation", value: `${pct(fp.t1.vegetation)} → ${pct(fp.t2.vegetation)}` },
    ],
  });
  // Secondary change clusters are ragged, so they are shown as labelled pins rather than outlines
  const others: EvidenceItem[] = regions
    .slice(1)
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.dominant !== "veg_gain")
    .map(({ r, i }) => {
      const top = r.breakdown[0];
      const [cx, cy] = r.centroid_px;
      return {
        id: `nmia-region-${i + 1}`,
        kind: "points" as const,
        label: r.label,
        detail: `${ha(r.changed_ha)} changed · mostly ${top?.key.replaceAll("_", " ") ?? "mixed"}`,
        confidence: r.label.startsWith("Ulwe") ? 0.86 : 0.74,
        color: ACCENT,
        frame: "B" as const,
        points: [{ px: [cx, cy] as [number, number], lonlat: r.centroid_lonlat as LonLat, label: r.label }],
        bboxPx: [cx - 30, cy - 30, cx + 30, cy + 30] as [number, number, number, number],
        stats: [
          { label: "Changed", value: ha(r.changed_ha, 1) },
          { label: "Centroid", value: latlon(r.centroid_lonlat) },
          ...r.breakdown.slice(0, 2).map((b) => ({ label: b.key.replaceAll("_", " "), value: ha(b.ha, 1) })),
        ],
      };
    });
  return { foot, others };
}

const nmiaTools = (): ToolCall[] => [
  tool("spectral-indices", "1.0.0", "Land cover · 2017-01-03", "execute", { ruleset: "periurban-dry-season", veg_ndvi: 0.3, sieve_px: 16 }, `built-up ${pct(n1.builtup.pct)} · veg ${pct(n1.vegetation.pct)}`, 360),
  tool("spectral-indices", "1.0.0", "Land cover · 2026-01-16", "execute", { ruleset: "periurban-dry-season", veg_ndvi: 0.3, sieve_px: 16 }, `built-up ${pct(n2.builtup.pct)} · veg ${pct(n2.vegetation.pct)}`, 350),
  tool("change-detector", "1.0.0", "Detect & localise change", "execute", { method: "post-classification + CVA", cva_threshold: nch.cva_threshold, min_region_px: 25 }, `${ha(nch.changed_ha)} changed (${pct(nch.changed_pct)}) · ${regions.length} regions`, 880),
];

function nmiaRespond(intent: Intent, q: string): CannedResponse {
  const ev = nmiaEvidence();
  const builtDelta = n2.builtup.ha - n1.builtup.ha;
  const vegNet = n2.vegetation.ha - n1.vegetation.ha;
  const waterNet = n2.water.ha - n1.water.ha;
  const ulwe = regions.find((r) => r.label.startsWith("Ulwe"));
  const channel = regions.find((r) => r.label.startsWith("Realigned"));
  const creek = regions.find((r) => r.label.startsWith("Creek"));

  if (intent.task === "timeseries" || matches(q, /trend|year|timeline|when|progress|timelapse/)) {
    const y = (yr: number) => tsByYear[yr];
    return {
      task: "timeseries",
      answer:
        `**Year-by-year inside the airport platform** (one clear Jan–Feb Sentinel-2 scene per year, same tile):\n\n` +
        `• **2017** — ${pct(y(2017).footprint_vegetation_pct ?? 0, 0)} vegetation, ${pct(y(2017).footprint_water_pct ?? 0, 0)} water: mangrove, wetland, creeks and laterite hills.\n` +
        `• **2018** — vegetation down to ${pct(y(2018).footprint_vegetation_pct ?? 0, 0)}, water ${pct(y(2018).footprint_water_pct ?? 0, 0)}: clearing has begun.\n` +
        `• **2019** — vegetation ${pct(y(2019).footprint_vegetation_pct ?? 0, 0)}, water ${pct(y(2019).footprint_water_pct ?? 0, 1)}: the site was cleared and the creeks filled or diverted within about a year.\n` +
        `• **2020 → 2026** — the platform stays above ${Math.min(...NMIA.timeseries.filter((t) => t.year >= 2020).map((t) => t.footprint_developed_pct ?? 0)).toFixed(0)} % developed while paved and built surfaces spread as the runway, taxiways and terminal are built (${pct(y(2026).footprint_builtup_pct ?? 0, 0)} impervious in 2026).\n\n` +
        `Press **play** on the timeline to step through all ${NMIA.timeseries.length} epochs.`,
      highlights: ["2017 → 2026", "Cleared by 2019", `${NMIA.timeseries.length} epochs`],
      evidence: [ev.foot],
      overlays: [],
      charts: ["nmia-timeseries", "nmia-dumbbell"],
      view: "timeline",
      confidence: 0.89,
      confidenceParts: conf(0.88, 0.87, 0.97),
      tools: [
        tool("timeseries-profiler", "0.9.0", "Profile footprint per epoch", "execute", { epochs: NMIA.timeseries.length, season: "Jan–Feb", tile: "43QBB", footprint: "nmia-footprint" }, `${NMIA.timeseries.length} epochs · vegetation ${pct(y(2017).footprint_vegetation_pct ?? 0, 0)} → ${pct(y(2026).footprint_vegetation_pct ?? 0, 0)}`, 1650),
        tool("cd-vqa", "0.8.0", "Summarise trend", "execute", { temperature: 0.1, max_new_tokens: 256 }, "answer · 158 tokens", 900),
      ],
      focus: "nmia-footprint",
    };
  }

  if (matches(q, /built|urban|construct|develop|increas|decreas|unchanged/)) {
    return {
      task: "change_vqa",
      answer:
        `**Increased.** Built-up / developed surface grew from **${ha(n1.builtup.ha)} (${pct(n1.builtup.pct)}) in Jan 2017 to ${ha(n2.builtup.ha)} (${pct(n2.builtup.pct)}) in Jan 2026 — +${ha(builtDelta)}, about ×${(n2.builtup.ha / n1.builtup.ha).toFixed(1)}.**\n\n` +
        `• Inside the airport platform, built-up share rose from ${pct(fp.t1.builtup)} to ${pct(fp.t2.builtup)}; most of the rest is graded open land (${pct(fp.t2.bare)}).\n` +
        (ulwe ? `• Outside it, the **Ulwe node** in the south-west added ≈ ${ha(ulwe.breakdown.find((b) => b.key === "bare_to_built")?.ha ?? 0)} of new built-up area.\n` : "") +
        `• By origin: ${ha(NMIA.transitions.matrix_ha[3][2])} of 2017 open land, ${ha(NMIA.transitions.matrix_ha[1][2])} of vegetation and ${ha(NMIA.transitions.matrix_ha[0][2])} of former water are built-up in 2026.`,
      highlights: ["Increased", `+${ha(builtDelta)}`, `×${(n2.builtup.ha / n1.builtup.ha).toFixed(1)}`],
      evidence: [ev.foot, ...ev.others.filter((o) => o.label.startsWith("Ulwe"))],
      overlays: ["nmia:change"],
      charts: ["nmia-dumbbell", "nmia-transitions", "nmia-timeseries"],
      view: "compare",
      confidence: 0.94,
      confidenceParts: conf(0.93, 0.95, 0.97),
      tools: [...nmiaTools(), tool("cd-vqa", "0.8.0", "Answer change question", "execute", { question_type: "increase/decrease", class: "built-up", temperature: 0.0 }, "increased (p = 0.98)", 720)],
      focus: "nmia-footprint",
    };
  }

  if (matches(q, /vegetation|mangrove|forest|green|tree/)) {
    return {
      task: "change_vqa",
      answer:
        `**${ha(nch.veg_loss_ha)} of vegetation was lost** (changed pixels, CVA > ${nch.cva_threshold}): ${ha(byType.veg_to_built)} became built-up / developed, ${ha(byType.veg_to_bare)} became open land and the rest turned to water.\n\n` +
        `• Inside the airport platform, vegetation cover fell from **${pct(fp.t1.vegetation)} to ${pct(fp.t2.vegetation)}** — mangrove and wetland scrub along the old creek channels was cleared.\n` +
        `• Elsewhere ${ha(byType.veg_gain)} regained vegetation (mainly hill slopes, partly seasonal), so the **net change is ${vegNet < 0 ? "−" : "+"}${ha(Math.abs(vegNet))}** (${ha(n1.vegetation.ha)} → ${ha(n2.vegetation.ha)}).`,
      highlights: [`−${ha(nch.veg_loss_ha)} gross`, `net ${vegNet < 0 ? "−" : "+"}${ha(Math.abs(vegNet))}`],
      evidence: [ev.foot],
      overlays: ["nmia:change_vegloss"],
      charts: ["nmia-timeseries", "nmia-bytype"],
      view: "compare",
      confidence: 0.9,
      confidenceParts: conf(0.89, 0.9, 0.97),
      tools: [...nmiaTools(), tool("cd-vqa", "0.8.0", "Answer change question", "execute", { question_type: "quantity", class: "vegetation", temperature: 0.0 }, `${ha(nch.veg_loss_ha)}`, 700)],
      focus: "nmia-footprint",
    };
  }

  if (matches(q, /water|creek|river|filled|divert|reclaim|wetland/)) {
    return {
      task: "change_vqa",
      answer:
        `**Yes.** ${ha(nch.water_to_land_ha)} of 2017 water became land by 2026 — **${ha(fpBy.water_to_land ?? 0)} of it inside the airport platform**, where creek channels and ponds were filled${creek ? `, plus creek-edge reclamation in the north-west (${ha(creek.breakdown.find((b) => b.key === "water_to_land")?.ha ?? 0)})` : ""}.\n\n` +
        `In the other direction ${ha(nch.land_to_water_ha)} became water${channel ? `, including a **new channel along the southern edge of the platform** (${ha(channel.breakdown.find((b) => b.key === "land_to_water")?.ha ?? 0)})` : ""}, consistent with the river diversion carried out for the project. **Net open-water change: ${waterNet < 0 ? "−" : "+"}${ha(Math.abs(waterNet))}** (${ha(n1.water.ha)} → ${ha(n2.water.ha)}).`,
      highlights: [`${ha(nch.water_to_land_ha)} filled`, `${ha(nch.land_to_water_ha)} new water`, `net ${waterNet < 0 ? "−" : "+"}${ha(Math.abs(waterNet))}`],
      evidence: [ev.foot, ...ev.others.filter((o) => /Realigned|Creek/.test(o.label))],
      overlays: ["nmia:change_water"],
      charts: ["nmia-transitions", "nmia-bytype"],
      view: "compare",
      confidence: 0.88,
      confidenceParts: conf(0.87, 0.88, 0.97),
      tools: [...nmiaTools(), tool("cd-vqa", "0.8.0", "Answer change question", "execute", { question_type: "yes/no + quantity", class: "water", temperature: 0.0 }, "yes (p = 0.95)", 690)],
      focus: "nmia-footprint",
    };
  }

  // Default: change description — the PS representative query
  return {
    task: intent.task === "grounding" ? "grounding" : "change_description",
    answer:
      `**Between 03 Jan 2017 and 16 Jan 2026, ${ha(nch.changed_ha)} (${pct(nch.changed_pct)} of the ${NMIA.grid.area_km2.toFixed(1)} km² scene) changed land cover.** The change is concentrated in one compact platform at the centre of the scene — the **Navi Mumbai International Airport** site.\n\n` +
      `**Where the change occurred**\n` +
      `• **Airport platform — ${ha(fp.area_ha)}, ${pct(fp.changed_pct, 0)} changed** (centred ${latlon(fp.centroid_lonlat, 3)}): laterite hills and fields levelled and built over (${ha(fpBy.bare_to_built ?? 0)} open land → built-up), mangrove and wetland cleared (${ha(fpBy.veg_to_built ?? 0)} → built-up, ${ha(fpBy.veg_to_bare ?? 0)} → open land) and ${ha(fpBy.water_to_land ?? 0)} of creek channels reclaimed.\n` +
      (ulwe ? `• **Ulwe node, south-west — ${ha(ulwe.changed_ha)}**: new built-up blocks on previously open land.\n` : "") +
      (channel ? `• **Southern boundary — ${ha(channel.changed_ha)}**: a new water channel, consistent with the river diversion for the project.\n` : "") +
      `• Scattered vegetation regrowth on hill slopes to the south and east (partly seasonal, lower confidence).\n\n` +
      `**Net effect:** built-up land ×${(n2.builtup.ha / n1.builtup.ha).toFixed(1)} (${ha(n1.builtup.ha)} → ${ha(n2.builtup.ha)}), vegetation ${vegNet < 0 ? "−" : "+"}${ha(Math.abs(vegNet))} net (${ha(nch.veg_loss_ha)} lost), open water ${waterNet < 0 ? "−" : "+"}${ha(Math.abs(waterNet))}.`,
    highlights: [`${ha(nch.changed_ha)} changed`, `Platform ${ha(fp.area_ha)}`, `Built-up ×${(n2.builtup.ha / n1.builtup.ha).toFixed(1)}`],
    evidence: [ev.foot, ...ev.others],
    overlays: ["nmia:change"],
    charts: ["nmia-dumbbell", "nmia-transitions", "nmia-bytype", "nmia-timeseries"],
    view: "compare",
    confidence: 0.92,
    confidenceParts: conf(0.91, 0.93, 0.97),
    tools: [...nmiaTools(), tool("cd-vqa", "0.8.0", "Describe change", "execute", { prompt: "cd-describe-v1", temperature: 0.2, max_new_tokens: 384 }, "answer · 236 tokens", 1350)],
    focus: "nmia-footprint",
  };
}

function nmiaSingleRespond(frame: "A" | "B"): CannedResponse {
  const is2026 = frame === "B";
  const c = is2026 ? n2 : n1;
  return {
    task: "captioning",
    answer: is2026
      ? `**Sentinel-2 true-colour scene (10 m, 16 Jan 2026) of the Navi Mumbai International Airport site.** A large graded platform with a single long runway, parallel taxiways and a terminal apron dominates the centre. Built-up / developed land covers ${pct(c.builtup.pct)}, open land ${pct(c.bare.pct)}, vegetation ${pct(c.vegetation.pct)} (mangroves along Panvel creek to the north, hills to the south) and water ${pct(c.water.pct)}. A straight channel runs along the platform's southern edge.\n\nLoad the 2017 scene as a second image to analyse what changed.`
      : `**Sentinel-2 true-colour scene (10 m, 03 Jan 2017) south of Kharghar, Navi Mumbai.** The broad meandering Panvel creek crosses the north, fringed by dense mangrove and wetland. The centre and south are a mosaic of laterite hills (some visibly quarried), dry fields and small villages. Open land covers ${pct(c.bare.pct)}, vegetation ${pct(c.vegetation.pct)}, water ${pct(c.water.pct)} and built-up only ${pct(c.builtup.pct)}, concentrated in planned urban nodes at the edges.\n\nLoad the 2026 scene as a second image to analyse what changed.`,
    highlights: [`Built-up ${pct(c.builtup.pct)}`, `Vegetation ${pct(c.vegetation.pct)}`],
    evidence: [],
    overlays: [is2026 ? "nmia:t2_classes" : "nmia:t1_classes"],
    charts: [],
    view: "image",
    confidence: 0.88,
    confidenceParts: conf(0.87, 0.89, 0.97),
    tools: [
      tool("spectral-indices", "1.0.0", "Land-cover evidence", "execute", { ruleset: "periurban-dry-season", sieve_px: 16 }, `built-up ${pct(c.builtup.pct)}`, 360),
      tool("satquery-vlm", "1.2.0", "Generate caption", "execute", { prompt: "rs-caption-v2", temperature: 0.2, max_new_tokens: 320 }, "caption · 118 tokens", 1250),
    ],
  };
}

export function respond(scenario: ScenarioId, intent: Intent, query: string, frame: "A" | "B" = "A"): CannedResponse | null {
  switch (scenario) {
    case "hyd":
      return hydRespond(intent, query);
    case "mum-sar":
      return mumSarRespond(intent, query);
    case "mum-opt":
      return mumOptRespond(intent, query);
    case "mum-fusion":
      return mumFusionRespond(intent, query);
    case "nmia":
      return nmiaRespond(intent, query);
    case "nmia-single":
      return nmiaSingleRespond(frame);
    default:
      return null;
  }
}

