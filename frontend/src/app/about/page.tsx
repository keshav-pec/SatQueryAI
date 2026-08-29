"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import {
  Layers,
  ScanSearch,
  GitCompareArrows,
  Radar,
  ShieldCheck,
  Bot,
  Database,
  BrainCircuit,
  Workflow,
  Settings2,
  Image as ImageIcon,
  FileText,
  ArrowRight,
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

// ─── Capability data ───────────────────────────────────────────────────
const CAPABILITIES = [
  {
    task: "Single-Image VQA",
    input: "One optical or SAR image",
    model: "Qwen2-VL + LoRA",
    output: "Textual answer",
    icon: <ScanSearch size={18} />,
  },
  {
    task: "Bi-Temporal Change VQA",
    input: "Two optical images (different dates)",
    model: "Qwen2-VL + LoRA",
    output: "Change description / answer",
    icon: <GitCompareArrows size={18} />,
  },
  {
    task: "Cross-Modal VQA",
    input: "Co-registered optical + SAR pair",
    model: "Qwen2-VL + LoRA",
    output: "Joint analysis answer",
    icon: <Radar size={18} />,
  },
  {
    task: "Source-Grounded Answering",
    input: "Any supported image(s) + query",
    model: "Evidence extraction pipeline",
    output: "Answer with visual evidence",
    icon: <ShieldCheck size={18} />,
  },
  {
    task: "Agentic Orchestration",
    input: "Query + any image configuration",
    model: "LangGraph state machine",
    output: "Routed pipeline + execution trace",
    icon: <Bot size={18} />,
  },
];

// ─── Dataset data ──────────────────────────────────────────────────────
const DATASETS = [
  {
    name: "BigEarthNet",
    desc: "Multi-label Sentinel-1 and Sentinel-2 benchmark with 590,326 pairs. Primary dataset for remote-sensing domain adaptation of image–text representations.",
    tags: ["Multi-Spectral", "SAR", "Multi-Label"],
  },
  {
    name: "VRSBench",
    desc: "Remote sensing benchmark for evaluating single-image captioning, grounding, and visual question answering capabilities.",
    tags: ["Captioning", "Grounding", "VQA"],
  },
  {
    name: "RSVQA",
    desc: "Remote Sensing Visual Question Answering dataset for evaluating single-image question answering on aerial and satellite imagery.",
    tags: ["VQA", "Optical"],
  },
  {
    name: "CDVQA",
    desc: "Change Detection VQA dataset for evaluating multi-temporal change-based visual question answering from bi-temporal image pairs.",
    tags: ["Change Detection", "Bi-Temporal", "VQA"],
  },
];

// ─── Tech stack ────────────────────────────────────────────────────────
const TECH_STACK = [
  { name: "Python", category: "Backend" },
  { name: "FastAPI", category: "Backend" },
  { name: "PyTorch", category: "ML Framework" },
  { name: "Qwen2-VL", category: "Vision-Language Model" },
  { name: "LoRA / PEFT", category: "Fine-tuning" },
  { name: "LangGraph", category: "Agent Framework" },
  { name: "Rasterio", category: "GeoTIFF Processing" },
  { name: "Transformers", category: "HuggingFace" },
  { name: "Next.js", category: "Frontend" },
  { name: "TypeScript", category: "Frontend" },
  { name: "Framer Motion", category: "Animations" },
  { name: "Tailwind CSS", category: "Styling" },
];

export default function AboutPage() {
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
            opacity: 0.05,
          }}
        />
        <div className="container" style={{ position: "relative" }}>
          <FadeIn>
            <span className="section-label">About the Project</span>
            <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, marginBottom: "1rem" }}>
              SatQuery AI
            </h1>
            <p style={{ fontSize: "1.125rem", color: "var(--grey-500)", maxWidth: "700px", lineHeight: 1.7 }}>
              An interactive vision-language assistant designed for multimodal remote sensing
              image analysis through natural-language text queries. The system supports single-image
              understanding as a mandatory baseline, with principal focus on joint reasoning over
              paired cross-modal and multi-temporal imagery.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ─── Mission / Problem ─── */}
      <section className="section section-alt">
        <div className="container">
          <FadeIn>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2.5rem", alignItems: "center" }}>
              <div>
                <span className="section-label">The Challenge</span>
                <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>
                  Why SatQuery AI?
                </h2>
                <p style={{ fontSize: "0.9375rem", color: "var(--grey-600)", lineHeight: 1.75, marginBottom: "1rem" }}>
                  Most existing remote-sensing AI solutions are developed as isolated applications
                  for a single predefined task — land-cover classification, object detection,
                  or change detection. These systems require users to understand satellite-data
                  characteristics, GIS workflows, and model-specific parameters.
                </p>
                <p style={{ fontSize: "0.9375rem", color: "var(--grey-600)", lineHeight: 1.75, marginBottom: "1rem" }}>
                  Relevant information is often distributed across paired observations acquired
                  at different times or by different sensors. A general-purpose LLM or VLM
                  cannot perform these specialised tasks reliably without adaptation to
                  remote-sensing imagery and domain-specific terminology.
                </p>
                <p style={{ fontSize: "0.9375rem", color: "var(--grey-600)", lineHeight: 1.75 }}>
                  SatQuery AI addresses this by providing an agentic, query-driven framework
                  that selects and executes suitable specialist models, validates inputs,
                  combines outputs, and returns evidence-grounded responses.
                </p>
              </div>
              <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--grey-200)" }}>
                <Image
                  src="/images/image2.jpg"
                  alt="Earth observation network"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Architecture Diagram ─── */}
      <section className="section">
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="section-label">System Architecture</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Agentic Pipeline</h2>
              <p style={{ color: "var(--grey-500)", maxWidth: "560px", margin: "0.75rem auto 0" }}>
                The orchestrator receives user queries, classifies the task, selects
                specialist tools, and returns evidence-grounded responses.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                padding: "2rem 1rem",
                background: "var(--grey-50)",
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--grey-200)",
              }}
            >
              {[
                { icon: <FileText size={20} />, label: "User Query", bg: "var(--gold-100)", color: "var(--gold-600)" },
                null,
                { icon: <Workflow size={20} />, label: "Task Classifier", bg: "var(--blue-50)", color: "var(--blue-500)" },
                null,
                { icon: <Settings2 size={20} />, label: "Model Registry", bg: "var(--blue-50)", color: "var(--blue-500)" },
                null,
                { icon: <BrainCircuit size={20} />, label: "Specialist Models", bg: "var(--navy-800)", color: "var(--gold-300)" },
                null,
                { icon: <Layers size={20} />, label: "Output Aggregation", bg: "var(--blue-50)", color: "var(--blue-500)" },
                null,
                { icon: <ShieldCheck size={20} />, label: "Grounded Response", bg: "#F0FDF4", color: "#16A34A" },
              ].map((item, i) =>
                item === null ? (
                  <ArrowRight key={`arrow-${i}`} size={18} style={{ color: "var(--grey-400)", flexShrink: 0 }} />
                ) : (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "1rem 1.25rem",
                      borderRadius: "var(--radius-lg)",
                      background: item.bg,
                      minWidth: "120px",
                    }}
                  >
                    <div style={{ color: item.color }}>{item.icon}</div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: item.color, textAlign: "center" }}>
                      {item.label}
                    </span>
                  </div>
                )
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Capabilities Table ─── */}
      <section className="section section-alt">
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <span className="section-label">Functional Scope</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Capabilities</h2>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>Task</th>
                    <th style={{ width: "25%" }}>Input</th>
                    <th style={{ width: "25%" }}>Model / Component</th>
                    <th style={{ width: "20%" }}>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map((cap) => (
                    <tr key={cap.task}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ color: "var(--blue-500)" }}>{cap.icon}</span>
                          <span style={{ fontWeight: 600, color: "var(--navy-800)" }}>{cap.task}</span>
                        </div>
                      </td>
                      <td>{cap.input}</td>
                      <td>
                        <span className="badge badge-navy" style={{ fontSize: "0.75rem" }}>
                          {cap.model}
                        </span>
                      </td>
                      <td>{cap.output}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Datasets ─── */}
      <section className="section">
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <span className="section-label">Training & Evaluation</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Datasets</h2>
              <p style={{ color: "var(--grey-500)", maxWidth: "560px", margin: "0.75rem auto 0" }}>
                Remote-sensing domain adaptation and benchmark evaluation datasets.
              </p>
            </div>
          </FadeIn>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {DATASETS.map((ds, i) => (
              <FadeIn key={ds.name} delay={i * 0.06}>
                <div className="feature-card" style={{ height: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      marginBottom: "0.875rem",
                    }}
                  >
                    <Database size={18} style={{ color: "var(--gold-500)" }} />
                    <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>{ds.name}</h3>
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "var(--grey-500)", lineHeight: 1.65, marginBottom: "1rem" }}>
                    {ds.desc}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {ds.tags.map((tag) => (
                      <span key={tag} className="badge badge-blue" style={{ fontSize: "0.6875rem" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Technology Stack ─── */}
      <section className="section section-alt">
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <span className="section-label">Built With</span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Technology Stack</h2>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              {TECH_STACK.map((tech) => (
                <div
                  key={tech.name}
                  style={{
                    background: "var(--surface-white)",
                    border: "1px solid var(--grey-200)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem 1.25rem",
                    textAlign: "center",
                    transition: "all 0.25s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--blue-400)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--grey-200)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--navy-800)" }}>
                    {tech.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--grey-400)", marginTop: "0.25rem" }}>
                    {tech.category}
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
