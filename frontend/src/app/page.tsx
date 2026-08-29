"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Satellite,
  ScanSearch,
  ArrowDownCircle,
  ArrowRight,
  Upload,
  MessageSquareText,
  Cpu,
  FileCheck,
  GitCompareArrows,
  Radar,
  Bot,
  ShieldCheck,
} from "lucide-react";

// ─── Fade-in-on-scroll wrapper ─────────────────────────────────────────
function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `all 0.7s ${delay}s cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Feature Data ──────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <ScanSearch size={24} />,
    title: "Single-Image VQA",
    desc: "Ask natural-language questions about optical or SAR satellite imagery and receive evidence-grounded answers powered by remote-sensing-adapted models.",
  },
  {
    icon: <GitCompareArrows size={24} />,
    title: "Change Detection",
    desc: "Analyse bi-temporal image pairs to identify, describe, and localise land-cover changes over time with change-based visual question answering.",
  },
  {
    icon: <Radar size={24} />,
    title: "Cross-Modal Fusion",
    desc: "Combine co-registered optical and SAR imagery to extract complementary information — spectral context from optical, structural from radar.",
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "Source-Grounded Answering",
    desc: "Every response is backed by visual evidence extracted directly from the satellite imagery, ensuring transparent, verifiable, and trustworthy analysis.",
  },
  {
    icon: <Bot size={24} />,
    title: "Agentic Orchestration",
    desc: "An intelligent controller automatically classifies your query, selects the appropriate specialist models, validates inputs, and sequences the execution pipeline.",
  },
];

// ─── Step Data ─────────────────────────────────────────────────────────
const STEPS = [
  { icon: <Upload size={22} />, title: "Upload", desc: "Upload single or paired GeoTIFF satellite images" },
  { icon: <MessageSquareText size={22} />, title: "Query", desc: "Ask a natural-language question about the imagery" },
  { icon: <Cpu size={22} />, title: "AI Processes", desc: "The agent selects and executes specialist models" },
  { icon: <FileCheck size={22} />, title: "Results", desc: "Receive grounded textual and visual analysis" },
];

// ─── Neural Impulse Connector SVG ──────────────────────────────────────
function NeuralConnector({ index }: { index: number }) {
  const duration = 1.2;
  const numConnectors = 3;
  const totalCycle = duration * numConnectors;
  const delay = index * duration;
  
  return (
    <svg
      viewBox="0 0 120 40"
      style={{
        width: "100%",
        height: "40px",
        display: "block",
        overflow: "visible",
      }}
      preserveAspectRatio="none"
    >
      {/* Base path (static faint line) */}
      <path
        d="M 0 20 C 30 20, 30 8, 60 20 S 90 32, 120 20"
        fill="none"
        stroke="var(--grey-300)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Animated impulse path */}
      <motion.path
        d="M 0 20 C 30 20, 30 8, 60 20 S 90 32, 120 20"
        fill="none"
        stroke={`url(#impulseGrad-${index})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="20 100"
        initial={{ strokeDashoffset: 0, opacity: 0 }}
        animate={{ strokeDashoffset: [0, -120], opacity: [0, 1, 1, 0] }}
        transition={{
          duration: duration,
          ease: "linear",
          repeat: Infinity,
          repeatDelay: totalCycle - duration,
          delay: delay,
          opacity: {
            duration: duration,
            times: [0, 0.1, 0.9, 1],
            repeat: Infinity,
            repeatDelay: totalCycle - duration,
            delay: delay,
          }
        }}
      />
      {/* Left node (pulses when impulse leaves) */}
      <motion.circle 
        cx="0" cy="20" fill="var(--blue-400)" 
        initial={{ r: 3.5, opacity: 1 }}
        animate={{ r: [3.5, 6, 3.5], opacity: [1, 0.4, 1] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: totalCycle - 0.5, delay: delay }}
      />
      {/* Right node (pulses when impulse arrives) */}
      <motion.circle 
        cx="120" cy="20" fill="var(--blue-400)" 
        initial={{ r: 3.5, opacity: 1 }}
        animate={{ r: [3.5, 6, 3.5], opacity: [1, 0.4, 1] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: totalCycle - 0.5, delay: delay + duration * 0.8 }}
      />
      <defs>
        <linearGradient id={`impulseGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--blue-400)" stopOpacity="0" />
          <stop offset="40%" stopColor="var(--blue-400)" stopOpacity="1" />
          <stop offset="60%" stopColor="var(--gold-400)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--gold-400)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="hero-section">
        <div className="hero-bg" style={{ backgroundImage: "url(/images/image1.jpg)" }} />
        <div className="hero-overlay" />

        <div className="container" style={{ padding: "0 1.5rem", position: "relative", zIndex: 3 }}>
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ paddingTop: "6rem" }}
          >
            <div
              className="section-label"
              style={{ color: "var(--gold-300)", marginBottom: "1.25rem" }}
            >
              Vision-Language Assistant for Remote Sensing
            </div>

            <h1
              style={{
                fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
                fontWeight: 800,
                color: "var(--surface-white)",
                lineHeight: 1.1,
                marginBottom: "1.5rem",
                letterSpacing: "-0.02em",
              }}
            >
              Analyse Satellite Imagery
              <br />
              with <span className="gold-accent">Natural Language</span>
            </h1>

            <p
              style={{
                fontSize: "1.125rem",
                color: "rgba(255,255,255,0.75)",
                maxWidth: "540px",
                lineHeight: 1.7,
                marginBottom: "2.5rem",
              }}
            >
              SatQuery AI is an agentic assistant that interprets your queries,
              selects specialist remote-sensing models, and returns evidence-grounded
              analysis from optical, SAR, and multi-temporal satellite imagery.
            </p>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link href="/analysis" className="btn btn-gold">
                Start Analysis
                <ArrowRight size={18} />
              </Link>
              <Link href="/about" className="btn btn-secondary">
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          style={{
            position: "absolute",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <ArrowDownCircle size={28} />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SATELLITE IMAGE SHOWCASE (Visual Intelligence)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="section">
        <div className="container">
          <FadeInSection>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="section-label">Visual Intelligence</span>
              <h2 style={{ fontSize: "2rem", fontWeight: 700 }}>
                Satellite Remote Sensing
              </h2>
              <p style={{ color: "var(--grey-500)", maxWidth: "560px", margin: "0.75rem auto 0", fontSize: "1.0625rem" }}>
                From optical imagery to SAR data — SatQuery AI understands the full spectrum
                of remote-sensing modalities.
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.1}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {[
                { src: "/images/image1.jpg", title: "Optical Satellite View", desc: "High-resolution Earth observation from orbit" },
                { src: "/images/earth_night.jpg", title: "Night-time Observation", desc: "Urban infrastructure and settlement mapping" },
                { src: "/images/satellite_scanning.jpg", title: "Active Radar Scanning", desc: "SAR-based terrain and structure analysis" },
              ].map((img) => (
                <div
                  key={img.title}
                  style={{
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    border: "1px solid var(--grey-200)",
                    background: "var(--surface-white)",
                    transition: "all 0.35s var(--ease-out)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {/* Fixed 16:10 container with object-position:center to crop evenly */}
                  <div style={{ position: "relative", aspectRatio: "16 / 10", overflow: "hidden" }}>
                    <Image
                      src={img.src}
                      alt={img.title}
                      fill
                      style={{ objectFit: "cover", objectPosition: "center center" }}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                      {img.title}
                    </h3>
                    <p style={{ fontSize: "0.875rem", color: "var(--grey-500)" }}>
                      {img.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SUPPORTED FORMATS BANNER (Input Specs)
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/images/image2.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(7,26,51,0.92), rgba(10,46,92,0.88))",
          }}
        />
        <div
          className="container"
          style={{
            position: "relative",
            zIndex: 2,
            padding: "3.5rem 1.5rem",
            textAlign: "center",
          }}
        >
          <FadeInSection>
            <span className="section-label" style={{ color: "var(--gold-300)" }}>
              Input Specifications
            </span>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--surface-white)",
                marginBottom: "1.5rem",
              }}
            >
              Supported Image Formats
            </h2>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "GeoTIFF", desc: "Primary geospatial format" },
                { label: "TIFF", desc: "Standard raster format" },
              ].map((fmt) => (
                <div
                  key={fmt.label}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.25rem 2rem",
                    minWidth: "180px",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--gold-300)", marginBottom: "0.25rem" }}>
                    {fmt.label}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.6)" }}>
                    {fmt.desc}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)", marginTop: "1rem" }}>
              PNG and JPEG may be accepted for prescribed public benchmark datasets only.
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — Neural Impulse Flow (Workflow)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="section" id="how-it-works">
        <div className="container">
          <FadeInSection>
            <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
              <span className="section-label">Workflow</span>
              <h2 style={{ fontSize: "2rem", fontWeight: 700 }}>How It Works</h2>
              <p style={{ color: "var(--grey-500)", maxWidth: "520px", margin: "0.75rem auto 0", fontSize: "1.0625rem" }}>
                From image upload to evidence-grounded answers — a neural pipeline
                that routes your query through specialist models.
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.15}>
            <div className="neural-flow-container">
              {STEPS.map((step, i) => (
                <React.Fragment key={step.title}>
                  {/* Step node */}
                  <div className="neural-step">
                    <div className="neural-node">
                      <div className="neural-node-ring" />
                      <div className="neural-node-inner">
                        {step.icon}
                      </div>
                    </div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, marginTop: "0.875rem", marginBottom: "0.25rem", color: "var(--navy-800)" }}>
                      {step.title}
                    </h3>
                    <p style={{ fontSize: "0.8125rem", color: "var(--grey-500)", lineHeight: 1.55, maxWidth: "160px", margin: "0 auto" }}>
                      {step.desc}
                    </p>
                  </div>

                  {/* Neural connector between steps */}
                  {i < STEPS.length - 1 && (
                    <div className="neural-connector">
                      <NeuralConnector index={i} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURES SECTION (Core Capabilities)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="section section-alt" id="features">
        <div className="container">
          <FadeInSection>
            <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
              <span className="section-label">Core Capabilities</span>
              <h2 style={{ fontSize: "2rem", fontWeight: 700 }}>
                Intelligent Multi-Task Analysis
              </h2>
              <p style={{ color: "var(--grey-500)", maxWidth: "600px", margin: "0.75rem auto 0", fontSize: "1.0625rem" }}>
                A unified platform that adapts to your query and automatically selects
                the appropriate analysis pipeline.
              </p>
            </div>
          </FadeInSection>

          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <FadeInSection key={f.title} delay={i * 0.08}>
                <div className="feature-card" style={{ height: "100%", background: "var(--surface-white)" }}>
                  <div className="feature-card-icon">{f.icon}</div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, marginBottom: "0.625rem" }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: "0.9375rem", color: "var(--grey-500)", lineHeight: 1.65 }}>
                    {f.desc}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA SECTION (Ready to analyse)
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        className="section section-dark"
        style={{
          backgroundImage: "url(/images/pattern_bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "overlay",
        }}
      >
        <div className="container" style={{ textAlign: "center" }}>
          <FadeInSection>
            <div style={{ maxWidth: "560px", margin: "0 auto" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--navy-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.5rem",
                }}
                className="animate-pulse-glow"
              >
                <Satellite size={26} style={{ color: "var(--gold-300)" }} />
              </div>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--surface-white)", marginBottom: "1rem" }}>
                Ready to Analyse Satellite Imagery?
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "var(--grey-400)", marginBottom: "2rem", lineHeight: 1.65 }}>
                Upload your GeoTIFF images, ask a question, and let the AI agent
                select the optimal analysis pipeline for you.
              </p>
              <Link href="/analysis" className="btn btn-gold">
                Go to Analysis
                <ArrowRight size={18} />
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>
    </>
  );
}
