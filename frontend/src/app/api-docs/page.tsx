"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Server,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Code2,
  FileJson,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

// ─── Fade-in-on-scroll wrapper ─────────────────────────────────────────
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `all 0.6s ${delay}s cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      {children}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div style={{ paddingTop: "68px" }}>
      {/* ─── Page Header ─── */}
      <section
        style={{
          position: "relative",
          padding: "4rem 1.5rem 3.5rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/images/pattern_bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.04,
          }}
        />
        <div className="container" style={{ position: "relative" }}>
          <FadeIn>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span className="section-label" style={{ marginBottom: 0 }}>API Reference</span>
              <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                <CheckCircle size={12} />
                v1.0
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, marginBottom: "1rem" }}>
              API Documentation
            </h1>
            <p style={{ fontSize: "1.0625rem", color: "var(--grey-500)", maxWidth: "640px", lineHeight: 1.7 }}>
              The SatQuery AI backend exposes a RESTful API built with FastAPI.
              Use the endpoint below to submit satellite imagery and natural-language
              queries for automated analysis.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
              <a
                href="http://127.0.0.1:8050/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ fontSize: "0.875rem" }}
              >
                <BookOpen size={16} />
                Interactive API Console
                <ExternalLink size={14} />
              </a>
              <Link href="/analysis" className="btn btn-primary" style={{ fontSize: "0.875rem" }}>
                Try Analysis
                <ArrowRight size={16} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Base URL ─── */}
      <section className="section section-alt" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
        <div className="container">
          <FadeIn>
            <div
              style={{
                background: "var(--surface-white)",
                border: "1px solid var(--grey-200)",
                borderRadius: "var(--radius-lg)",
                padding: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <Server size={20} style={{ color: "var(--blue-500)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--grey-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Base URL
                </div>
                <code className="mono" style={{ fontSize: "1rem", fontWeight: 600, color: "var(--navy-800)" }}>
                  http://127.0.0.1:8050
                </code>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Endpoint: POST /analyze ─── */}
      <section className="section" style={{ paddingTop: "2.5rem" }}>
        <div className="container">
          <FadeIn>
            <div
              style={{
                background: "var(--surface-white)",
                border: "1px solid var(--grey-200)",
                borderRadius: "var(--radius-xl)",
                overflow: "hidden",
              }}
            >
              {/* Endpoint header */}
              <div
                style={{
                  padding: "1.5rem",
                  borderBottom: "1px solid var(--grey-200)",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: "#16A34A",
                    color: "white",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-source-code), monospace",
                    letterSpacing: "0.02em",
                  }}
                >
                  POST
                </span>
                <code className="mono" style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--navy-800)" }}>
                  /analyze
                </code>
                <span style={{ fontSize: "0.875rem", color: "var(--grey-500)" }}>
                  — Analyse satellite imagery with a natural-language query
                </span>
              </div>

              {/* Description */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--grey-100)" }}>
                <p style={{ fontSize: "0.9375rem", color: "var(--grey-600)", lineHeight: 1.7 }}>
                  The main analysis endpoint. Submit a text query along with one or two satellite
                  images (GeoTIFF format). The agentic orchestrator will classify the task,
                  select the appropriate specialist model, execute the pipeline, and return
                  an evidence-grounded response with a full execution trace.
                </p>
              </div>

              {/* Request format */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--grey-100)" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Code2 size={16} style={{ color: "var(--blue-500)" }} />
                  Request Format
                </h3>
                <span className="badge badge-blue" style={{ marginBottom: "1rem", display: "inline-flex" }}>
                  Content-Type: multipart/form-data
                </span>
              </div>

              {/* Parameters table */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--grey-100)" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem" }}>
                  Parameters
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)" }}>query</code>
                        </td>
                        <td><span className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>string</span></td>
                        <td><span className="badge badge-gold" style={{ fontSize: "0.6875rem" }}>Required</span></td>
                        <td>The natural-language question to ask about the satellite imagery.</td>
                      </tr>
                      <tr>
                        <td>
                          <code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)" }}>file1</code>
                        </td>
                        <td><span className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>File</span></td>
                        <td><span className="badge badge-gold" style={{ fontSize: "0.6875rem" }}>Required</span></td>
                        <td>Primary satellite image (e.g., optical or single SAR). Supported: GeoTIFF (.tif, .tiff).</td>
                      </tr>
                      <tr>
                        <td>
                          <code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)" }}>file2</code>
                        </td>
                        <td><span className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>File</span></td>
                        <td><span style={{ fontSize: "0.8125rem", color: "var(--grey-400)" }}>Optional</span></td>
                        <td>Secondary image for bi-temporal change detection or co-registered optical–SAR pair analysis.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* cURL example */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--grey-100)" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Code2 size={16} style={{ color: "var(--blue-500)" }} />
                  Request Example
                </h3>
                <div className="code-block">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    <span className="comment"># Single-image VQA</span>{"\n"}
                    <span className="keyword">curl</span> -X POST <span className="url">http://127.0.0.1:8050/analyze</span> \{"\n"}
                    {"  "}-F <span className="string">&quot;query=What is the primary land cover in this image?&quot;</span> \{"\n"}
                    {"  "}-F <span className="string">&quot;file1=@./data/Sentinel-2/patch_S2.tif&quot;</span>{"\n"}
                    {"\n"}
                    <span className="comment"># Cross-modal analysis (Optical + SAR pair)</span>{"\n"}
                    <span className="keyword">curl</span> -X POST <span className="url">http://127.0.0.1:8050/analyze</span> \{"\n"}
                    {"  "}-F <span className="string">&quot;query=Identify built-up and water regions using both images&quot;</span> \{"\n"}
                    {"  "}-F <span className="string">&quot;file1=@./data/patch_S1_SAR.tif&quot;</span> \{"\n"}
                    {"  "}-F <span className="string">&quot;file2=@./data/patch_S2_Optical.tif&quot;</span>
                  </pre>
                </div>
              </div>

              {/* Response Schema */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--grey-100)" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileJson size={16} style={{ color: "var(--blue-500)" }} />
                  Response Schema
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)" }}>query</code></td>
                        <td><span className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>string</span></td>
                        <td>The original query echoed back.</td>
                      </tr>
                      <tr>
                        <td><code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)" }}>result</code></td>
                        <td><span className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>string</span></td>
                        <td>The AI-generated analysis result / answer.</td>
                      </tr>
                      <tr>
                        <td><code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)" }}>execution_trace</code></td>
                        <td><span className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>array</span></td>
                        <td>
                          Auditable execution summary. Each entry contains <code className="mono">step</code> (string),
                          and optional <code className="mono">message</code>, <code className="mono">action</code>,
                          <code className="mono">tool_used</code>, <code className="mono">status</code> fields.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Response example */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--grey-100)" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileJson size={16} style={{ color: "var(--blue-500)" }} />
                  Response Example
                </h3>
                <div className="code-block">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
{`{
  `}<span className="keyword">&quot;query&quot;</span>{`: `}<span className="string">&quot;What is the primary land cover?&quot;</span>{`,
  `}<span className="keyword">&quot;result&quot;</span>{`: `}<span className="string">&quot;The primary land cover is agricultural cropland with scattered vegetation patches.&quot;</span>{`,
  `}<span className="keyword">&quot;execution_trace&quot;</span>{`: [
    {
      `}<span className="keyword">&quot;step&quot;</span>{`: `}<span className="string">&quot;Initialization&quot;</span>{`,
      `}<span className="keyword">&quot;message&quot;</span>{`: `}<span className="string">&quot;Received query: 'What is the primary land cover?'&quot;</span>{`
    },
    {
      `}<span className="keyword">&quot;step&quot;</span>{`: `}<span className="string">&quot;Routing&quot;</span>{`,
      `}<span className="keyword">&quot;action&quot;</span>{`: `}<span className="string">&quot;Selected single_image_vqa because exactly 1 image was provided.&quot;</span>{`
    },
    {
      `}<span className="keyword">&quot;step&quot;</span>{`: `}<span className="string">&quot;Execution&quot;</span>{`,
      `}<span className="keyword">&quot;tool_used&quot;</span>{`: `}<span className="string">&quot;Single-Image VQA (Qwen2-VL-LoRA)&quot;</span>{`,
      `}<span className="keyword">&quot;status&quot;</span>{`: `}<span className="string">&quot;Success&quot;</span>{`
    }
  ]
}`}
                  </pre>
                </div>
              </div>

              {/* Error Codes */}
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertCircle size={16} style={{ color: "#DC2626" }} />
                  Error Codes
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Status Code</th>
                        <th>Meaning</th>
                        <th>Common Cause</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="badge badge-success">200</span></td>
                        <td>Success</td>
                        <td>Analysis completed successfully.</td>
                      </tr>
                      <tr>
                        <td><span className="badge badge-gold">422</span></td>
                        <td>Validation Error</td>
                        <td>Missing required fields (query or file1).</td>
                      </tr>
                      <tr>
                        <td><span style={{ ...{padding: "0.375rem 0.875rem", borderRadius: "100px", fontSize: "0.8125rem", fontWeight: 500, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA"} }}>500</span></td>
                        <td>Internal Server Error</td>
                        <td>Model inference failure, unsupported file format, or corrupted image data.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Additional endpoints ─── */}
      <section className="section section-alt">
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <span className="section-label">Additional Endpoints</span>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Other API Routes</h2>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "1.5rem",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              {/* GET / */}
              <div className="feature-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <span
                    style={{
                      background: "var(--blue-500)",
                      color: "white",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-source-code), monospace",
                    }}
                  >
                    GET
                  </span>
                  <code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)", fontSize: "0.9375rem" }}>/</code>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--grey-500)", lineHeight: 1.6 }}>
                  Health check endpoint. Returns a JSON message confirming the SatQuery AI backend is running.
                </p>
              </div>

              {/* GET /docs */}
              <div className="feature-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <span
                    style={{
                      background: "var(--blue-500)",
                      color: "white",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-source-code), monospace",
                    }}
                  >
                    GET
                  </span>
                  <code className="mono" style={{ fontWeight: 600, color: "var(--navy-800)", fontSize: "0.9375rem" }}>/docs</code>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--grey-500)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                  Auto-generated interactive API console provided by FastAPI. Test endpoints directly in the browser.
                </p>
                <a
                  href="http://127.0.0.1:8050/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--blue-500)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontWeight: 500,
                  }}
                >
                  Open API Console <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
