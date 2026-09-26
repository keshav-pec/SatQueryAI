import Link from "next/link";
import { Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="hairline-top bg-bg-2">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] md:px-8">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-ink-3">
            An agentic vision-language assistant that answers natural-language questions about single, cross-modal and multi-temporal satellite imagery — with evidence you can check.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">Product</p>
          <ul className="space-y-2 text-[13.5px] text-ink-2">
            <li><Link className="hover:text-ink" href="/">Overview</Link></li>
            <li><Link className="hover:text-ink" href="/analysis">Analysis console</Link></li>
            <li><Link className="hover:text-ink" href="/api-docs">REST API</Link></li>
            <li><a className="hover:text-ink" href="/demo/samples/HYD_S2L2A_20250107_T44QKE.tif" download>Sample GeoTIFF</a></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Built for</p>
          <ul className="space-y-2 text-[13.5px] text-ink-2">
            <li>Smart India Hackathon</li>
            <li>Problem statement 26167</li>
            <li>Space technology theme</li>
            <li>Mentored by ISRO / SAC</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Data & credits</p>
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Test scenes contain modified Copernicus Sentinel-1/2 data (2017–2026) processed by ESA, accessed via Microsoft Planetary Computer. Basemap imagery © Esri, Maxar, Earthstar Geographics. Adaptation data: BigEarthNet.txt.
          </p>
        </div>
      </div>
      <div className="hairline-top">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-5 py-4 text-[12px] text-ink-3 md:px-8">
          <span>SatQuery AI — interactive vision-language assistant for multimodal remote sensing</span>
          <span className="mono">Next.js · FastAPI · LangGraph · Qwen2-VL + LoRA</span>
        </div>
      </div>
    </footer>
  );
}
