"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Play, ShieldAlert } from "lucide-react";
import { SAMPLES, SCENARIOS, SUGGESTIONS, resolveScenario } from "@/lib/demo/data";
import { loadSamples } from "@/lib/demo/load";
import { checkPair } from "@/lib/geo/compat";
import { runAgent } from "@/lib/engine/agent";
import { TOOL_REGISTRY } from "@/lib/engine/registry";
import { toApiResponse, toValidateResponse } from "@/lib/api/response";
import type { LoadedImage, ScenarioId } from "@/lib/types";
import { bytes } from "@/lib/format";
import { JsonView } from "./JsonView";
import { CopyButton } from "./CodeBlock";

type Endpoint = "analyze" | "validate" | "tools";
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export function Playground() {
  const [endpoint, setEndpoint] = useState<Endpoint>("analyze");
  const [scene, setScene] = useState<ScenarioId>("mum-fusion");
  const [query, setQuery] = useState(SUGGESTIONS["mum-fusion"][0]);
  const [target, setTarget] = useState<"offline" | "live">("offline");
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<{ status: number; ms: number; body: unknown; engine: string } | null>(null);
  const cache = useRef(new Map<string, LoadedImage[]>());

  const card = SCENARIOS.find((s) => s.id === scene)!;
  const files = card.files.map((k) => SAMPLES[k]);

  async function send() {
    const t0 = performance.now();
    setRes(null);
    try {
      if (endpoint === "tools") {
        setBusy("GET /v1/tools");
        await new Promise((r) => setTimeout(r, 180));
        setRes({ status: 200, ms: performance.now() - t0, engine: "offline", body: { object: "list", data: TOOL_REGISTRY.map((t) => ({ id: t.id, version: t.version, name: t.name, role: t.role, tasks: t.tasks, method: t.method, permitted_params: t.params })) } });
        return;
      }
      setBusy(`Uploading ${files.length} file${files.length > 1 ? "s" : ""} (${bytes(files.reduce((s, f) => s + f.bytes, 0))})…`);
      let images = cache.current.get(scene);
      if (!images) {
        images = await loadSamples(card.files);
        cache.current.set(scene, images);
      }
      const compat = images.length === 2 ? checkPair(images[0], images[1]) : null;
      if (endpoint === "validate") {
        setBusy("Validating…");
        setRes({ status: 200, ms: performance.now() - t0, engine: "offline", body: toValidateResponse(images, compat) });
        return;
      }
      if (target === "live" && API) {
        setBusy(`POST ${API}/analyze`);
        const fd = new FormData();
        fd.append("query", query);
        fd.append("file1", images[0].file);
        if (images[1]) fd.append("file2", images[1].file);
        const r = await fetch(`${API}/analyze`, { method: "POST", body: fd });
        setRes({ status: r.status, ms: performance.now() - t0, engine: "live (legacy /analyze)", body: await r.json().catch(() => ({ error: "non-JSON response" })) });
        return;
      }
      const sid = resolveScenario(images.map((i) => i.sampleKey), compat?.status === "fail");
      const mode = images.length === 2 ? compat?.inferredMode ?? "cross_modal" : "single";
      for await (const ev of runAgent({ query, mode, scenarioId: sid, images, compat, speed: 5 })) {
        if (ev.step && ev.step.status === "running") setBusy(`${ev.step.tool}@${ev.step.version} · ${ev.step.title}`);
        if (ev.result) {
          const body = toApiResponse(ev.result, images, compat);
          setRes({ status: ev.result.task === "rejected" ? 409 : 200, ms: performance.now() - t0, engine: "offline", body });
        }
      }
    } catch (e) {
      setRes({ status: 502, ms: performance.now() - t0, engine: target, body: { error: { code: "UPSTREAM_UNREACHABLE", message: e instanceof Error ? e.message : String(e) } } });
    } finally {
      setBusy(null);
    }
  }

  const method = endpoint === "tools" ? "GET" : "POST";
  const path = endpoint === "tools" ? "/v1/tools" : endpoint === "validate" ? "/v1/validate" : target === "live" && API ? "/analyze" : "/v1/analyze";
  const json = res ? JSON.stringify(res.body, null, 2) : "";

  return (
    <div className="panel overflow-hidden">
      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 border-b border-line p-5 lg:border-b-0 lg:border-r">
          <div>
            <p className="eyebrow mb-2">Endpoint</p>
            <div className="segmented w-full">
              {(["analyze", "validate", "tools"] as Endpoint[]).map((e) => (
                <button key={e} type="button" className="flex-1 justify-center" data-active={endpoint === e} onClick={() => setEndpoint(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          {endpoint !== "tools" && (
            <div>
              <p className="eyebrow mb-2">images (multipart)</p>
              <div className="space-y-1.5">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setScene(s.id);
                      setQuery(SUGGESTIONS[s.id][0]);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${scene === s.id ? "border-cyan/45 bg-cyan/[0.06]" : "border-line hover:border-line-2"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumb} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-ink">{s.title}</span>
                      <span className="block truncate mono text-[10.5px] text-ink-3">{s.files.map((k) => SAMPLES[k].name).join(" + ")}</span>
                    </span>
                    {s.expectFail && <ShieldAlert size={13} className="ml-auto shrink-0 text-warn" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {endpoint === "analyze" && (
            <div>
              <p className="eyebrow mb-2">query</p>
              <textarea className="field mono !text-[12.5px]" rows={3} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          {API && endpoint === "analyze" && (
            <div className="segmented w-full">
              <button type="button" className="flex-1 justify-center" data-active={target === "offline"} onClick={() => setTarget("offline")}>
                Offline engine
              </button>
              <button type="button" className="flex-1 justify-center" data-active={target === "live"} onClick={() => setTarget("live")}>
                Live server
              </button>
            </div>
          )}
          <button type="button" className="btn btn-primary w-full" onClick={send} disabled={!!busy || (endpoint === "analyze" && !query.trim())}>
            {busy ? <Loader2 size={15} className="animate-spin-slow" /> : <Play size={15} />}
            Send request
          </button>
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            {target === "live" && API
              ? `Requests go to ${API}. The current FastAPI server implements the legacy /analyze contract.`
              : "Runs in your browser: the sample GeoTIFFs are fetched and validated for real, and answers come from the cached specialist outputs. Set NEXT_PUBLIC_API_URL to target a live server."}
          </p>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className={`rounded px-1.5 py-0.5 mono text-[11px] font-bold ${method === "GET" ? "bg-cyan/15 text-cyan-2" : "bg-ok/15 text-ok"}`}>{method}</span>
            <span className="truncate mono text-[12.5px] text-ink">{path}</span>
            {res && (
              <span className="ml-auto flex items-center gap-2">
                <span className={`badge ${res.status < 300 ? "badge-ok" : res.status < 500 ? "badge-warn" : "badge-crit"}`}>{res.status} {res.status === 200 ? "OK" : res.status === 409 ? "Conflict" : "Error"}</span>
                <span className="mono text-[11px] text-ink-3">{Math.round(res.ms)} ms · {res.engine}</span>
                <CopyButton text={json} />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Download response"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `satquery-${endpoint}-response.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 3000);
                  }}
                >
                  <Download size={14} />
                </button>
              </span>
            )}
          </div>
          <div className="min-h-[420px] flex-1 overflow-auto bg-[#070c15]">
            {busy && (
              <div className="flex items-center gap-2 px-5 py-4 mono text-[12px] text-cyan-2">
                <Loader2 size={13} className="animate-spin-slow" /> {busy}
              </div>
            )}
            {res ? (
              <JsonView value={res.body} className="!max-h-[560px] !rounded-none !border-0" />
            ) : (
              !busy && <p className="px-5 py-4 mono text-[12px] text-ink-3">{"// Choose an endpoint and press “Send request”."}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
