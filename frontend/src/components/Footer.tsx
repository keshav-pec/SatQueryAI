"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Satellite, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer
      style={{
        background: "var(--navy-900)",
        color: "var(--grey-400)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gold top accent */}
      <div className="gold-line" style={{ height: 2 }} />

      <div
        className="container"
        style={{
          padding: "3.5rem 1.5rem 2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "2.5rem",
        }}
      >
        {/* ─── Brand Column ─── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "var(--navy-700)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
              }}
            >
              <Image
                src="/images/pngImage2.png"
                alt="SatQuery AI"
                width={28}
                height={28}
                style={{ objectFit: "contain" }}
              />
            </div>
            <span style={{ color: "var(--surface-white)", fontWeight: 700, fontSize: "1.0625rem" }}>
              SatQuery AI
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.7, maxWidth: "280px", color: "var(--grey-400)" }}>
            An interactive vision-language assistant for multimodal remote sensing image analysis through natural-language queries.
          </p>
        </div>

        {/* ─── Quick Links Column ─── */}
        <div>
          <h4 style={{ color: "var(--surface-white)", fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Navigation
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
              { href: "/api-docs", label: "API Documentation" },
              { href: "/analysis", label: "Analysis / QnA" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: "var(--grey-400)",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  transition: "color 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold-300)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--grey-400)"; }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ─── Capabilities Column ─── */}
        <div>
          <h4 style={{ color: "var(--surface-white)", fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Capabilities
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
            <span>Single-Image VQA</span>
            <span>Change Detection</span>
            <span>Cross-Modal Fusion</span>
            <span>Source-Grounded Answering</span>
            <span>Agentic Orchestration</span>
          </div>
        </div>

        {/* ─── Tech Column ─── */}
        <div>
          <h4 style={{ color: "var(--surface-white)", fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Technology
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {["Python", "FastAPI", "PyTorch", "Qwen2-VL", "LangGraph", "Next.js", "GeoTIFF"].map((tech) => (
              <span
                key={tech}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "100px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  background: "var(--navy-700)",
                  color: "var(--grey-300)",
                  border: "1px solid var(--navy-600)",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "1.25rem 1.5rem",
          textAlign: "center",
          fontSize: "0.8125rem",
          color: "var(--grey-500)",
        }}
      >
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", flexWrap: "wrap" }}>
          <Satellite size={14} style={{ color: "var(--gold-500)" }} />
          <span>SatQuery AI — Multimodal Remote Sensing Analysis Platform</span>
        </div>
      </div>
    </footer>
  );
}
