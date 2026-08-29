"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Satellite,
  Upload,
  ArrowRight,
  FileImage,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  HelpCircle,
  Download,
  Bot,
  Network,
  ScanSearch,
  FileCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
interface ExecutionTraceStep {
  step: string;
  message?: string;
  action?: string;
  tool_used?: string;
  status?: string;
  [key: string]: unknown;
}

interface AnalysisResponse {
  query: string;
  result: string;
  execution_trace: ExecutionTraceStep[];
}

const API_ENDPOINT = "http://127.0.0.1:8050/analyze";

// ─── Loader Components ────────────────────────────────────────────────────
function NeuralConnector({ index }: { index: number }) {
  const duration = 1.2;
  const numConnectors = 3;
  const totalCycle = duration * numConnectors;
  const delay = index * duration;
  
  return (
    <svg
      viewBox="0 0 120 40"
      style={{ width: "100%", height: "40px", display: "block", overflow: "visible" }}
      preserveAspectRatio="none"
    >
      <path d="M 0 20 C 30 20, 30 8, 60 20 S 90 32, 120 20" fill="none" stroke="var(--grey-300)" strokeWidth="2" strokeLinecap="round" />
      <motion.path
        d="M 0 20 C 30 20, 30 8, 60 20 S 90 32, 120 20"
        fill="none"
        stroke={`url(#impulseGradLoader-${index})`}
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
          opacity: { duration: duration, times: [0, 0.1, 0.9, 1], repeat: Infinity, repeatDelay: totalCycle - duration, delay: delay }
        }}
      />
      <motion.circle cx="0" cy="20" fill="var(--blue-400)" initial={{ r: 3.5, opacity: 1 }} animate={{ r: [3.5, 6, 3.5], opacity: [1, 0.4, 1] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: totalCycle - 0.5, delay: delay }} />
      <motion.circle cx="120" cy="20" fill="var(--blue-400)" initial={{ r: 3.5, opacity: 1 }} animate={{ r: [3.5, 6, 3.5], opacity: [1, 0.4, 1] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: totalCycle - 0.5, delay: delay + duration * 0.8 }} />
      <defs>
        <linearGradient id={`impulseGradLoader-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--blue-400)" stopOpacity="0" />
          <stop offset="40%" stopColor="var(--blue-400)" stopOpacity="1" />
          <stop offset="60%" stopColor="var(--gold-400)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--gold-400)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const TRACE_STEPS = [
  { icon: <Bot size={22} />, title: "Initialize" },
  { icon: <Network size={22} />, title: "Routing" },
  { icon: <ScanSearch size={22} />, title: "Execution" },
  { icon: <FileCheck size={22} />, title: "Synthesis" }
];

import { useEffect } from "react";

function ExecutionTraceLoader() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setActiveStep(1), 1000);
    const t2 = setTimeout(() => setActiveStep(2), 2500);
    const t3 = setTimeout(() => setActiveStep(3), 9000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--navy-800)" }}>
          Running Analysis Pipeline
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--grey-500)", marginTop: "0.25rem" }}>
          Agentic execution in progress
        </p>
      </div>

      <div className="neural-flow-container" style={{ width: "100%", maxWidth: "600px", padding: "0 2rem" }}>
        {TRACE_STEPS.map((step, i) => {
          const isActive = activeStep === i;
          const isPassed = activeStep > i;
          return (
            <React.Fragment key={step.title}>
              <div className="neural-step">
                <div className="neural-node">
                  <div className="neural-node-ring" style={{ border: isActive ? "2px solid var(--gold-400)" : isPassed ? "2px solid var(--blue-400)" : "1px solid var(--grey-300)" }} />
                  <div className="neural-node-inner" style={{ background: isActive || isPassed ? "var(--surface-white)" : "var(--grey-50)", color: isActive || isPassed ? "var(--blue-500)" : "var(--grey-300)", transition: "all 0.3s ease" }}>
                    {step.icon}
                  </div>
                </div>
                <h3 style={{ fontSize: "0.875rem", fontWeight: isActive ? 700 : 600, marginTop: "0.875rem", color: isActive ? "var(--navy-800)" : isPassed ? "var(--navy-700)" : "var(--grey-400)", transition: "all 0.3s ease" }}>
                  {step.title}
                </h3>
              </div>
              {i < TRACE_STEPS.length - 1 && (
                <div className="neural-connector" style={{ opacity: isPassed || activeStep === i ? 1 : 0.3, transition: "opacity 0.3s ease" }}>
                  <NeuralConnector index={i} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ marginTop: "4rem", width: "100%", maxWidth: "540px" }}>
        <div style={{ background: "var(--navy-900)", padding: "1.25rem", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.75rem" }}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: "var(--gold-400) transparent var(--gold-400) transparent", animationDuration: "1s" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--grey-300)", textTransform: "uppercase", letterSpacing: "0.04em" }}>System Trace</span>
          </div>
          <div className="mono" style={{ fontSize: "0.8125rem", color: "var(--grey-300)", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {activeStep >= 0 && <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}><span style={{ color: "var(--blue-300)" }}>[Initialize]</span> Parsing query and imagery...</motion.div>}
            {activeStep >= 1 && <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}><span style={{ color: "var(--blue-300)" }}>[Routing]</span> Agent selecting specialist model...</motion.div>}
            {activeStep >= 2 && <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}><span style={{ color: "var(--blue-300)" }}>[Execution]</span> Vision-Language Model processing input. This may take up to 20s...</motion.div>}
            {activeStep >= 3 && <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}><span style={{ color: "var(--blue-300)" }}>[Synthesis]</span> Formulating grounded visual evidence...</motion.div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sample Queries ───────────────────────────────────────────────────────
const SAMPLE_QUERIES = [
  "Describe the land-cover and major objects visible in this image.",
  "What is the primary land cover shown in this image?",
  "Are there any water bodies in this region?",
  "What changed between these two dates?",
  "Use the optical and SAR images together to identify built-up regions.",
];

// ─── File Dropzone ────────────────────────────────────────────────────────
function FileDropzone({
  label,
  hint,
  file,
  onFileChange,
  onClear,
  id,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onClear: () => void;
  id: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) onFileChange(droppedFile);
    },
    [onFileChange]
  );

  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <label
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--grey-500)",
          marginBottom: "0.5rem",
          display: "block",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </label>
      <div
        className={`dropzone ${isDragOver ? "active" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          minHeight: "72px",
          background: "var(--surface-white)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          id={id}
          style={{ display: "none" }}
          accept=".tif,.tiff"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />

        {file ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--blue-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileImage size={18} style={{ color: "var(--blue-500)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--navy-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--grey-400)" }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--grey-400)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--grey-100)";
                e.currentTarget.style.color = "var(--grey-700)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "var(--grey-400)";
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--grey-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Upload size={18} style={{ color: "var(--grey-400)" }} />
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", color: "var(--grey-500)" }}>{hint}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--grey-400)" }}>
                GeoTIFF (.tif, .tiff)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Execution Trace ──────────────────────────────────────────────────────
function ExecutionTrace({ trace }: { trace: ExecutionTraceStep[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        marginTop: "1rem",
        border: "1px solid var(--grey-200)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.75rem 1rem",
          background: "var(--grey-50)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.2s ease",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--grey-100)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--grey-50)"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Layers size={14} style={{ color: "var(--grey-400)" }} />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--grey-600)" }}>
            Execution Trace
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--grey-400)" }}>
            ({trace.length} steps)
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={14} style={{ color: "var(--grey-400)" }} />
        ) : (
          <ChevronDown size={14} style={{ color: "var(--grey-400)" }} />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                background: "var(--navy-900)",
                padding: "1rem 1.25rem",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {trace.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="mono"
                  style={{
                    fontSize: "0.8125rem",
                    lineHeight: 1.65,
                    display: "flex",
                    gap: "0.625rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span style={{ color: "var(--grey-600)", userSelect: "none", flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ color: "var(--blue-300)", fontWeight: 600, flexShrink: 0 }}>
                    [{step.step}]
                  </span>
                  <span style={{ color: "var(--grey-300)" }}>
                    {step.message || step.action || step.tool_used || "—"}
                    {step.status && (
                      <span style={{ color: "var(--gold-300)", marginLeft: "0.5rem" }}>
                        ({step.status})
                      </span>
                    )}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Analysis Result ──────────────────────────────────────────────────────
function AnalysisResult({ response }: { response: AnalysisResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        style={{
          background: "var(--surface-white)",
          border: "1px solid var(--grey-200)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderBottom: "1px solid var(--grey-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--grey-500)" }}>
            Analysis Result
          </span>
          <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
            Complete
          </span>
        </div>

        {/* Query echo */}
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderBottom: "1px solid var(--grey-100)",
            background: "var(--grey-50)",
          }}
        >
          <p style={{ fontSize: "0.75rem", color: "var(--grey-400)", marginBottom: "0.125rem" }}>
            Your query
          </p>
          <p style={{ fontSize: "0.9375rem", color: "var(--grey-600)", fontStyle: "italic" }}>
            &ldquo;{response.query}&rdquo;
          </p>
        </div>

        {/* Response */}
        <div style={{ padding: "1.25rem" }}>
          <div
            style={{
              fontSize: "0.9375rem",
              color: "var(--grey-700)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {response.result}
          </div>
        </div>
      </div>

      {/* Trace */}
      {response.execution_trace?.length > 0 && (
        <ExecutionTrace trace={response.execution_trace} />
      )}
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: "280px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-xl)",
            background: "var(--grey-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <Satellite size={26} style={{ color: "var(--grey-300)" }} />
        </div>
        <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--grey-500)", marginBottom: "0.375rem" }}>
          No analysis yet
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--grey-400)", lineHeight: 1.6 }}>
          Upload a GeoTIFF satellite image and ask a question to get started.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [query, setQuery] = useState("");
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !file1) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    const formData = new FormData();
    formData.append("query", query.trim());
    formData.append("file1", file1);
    if (file2) formData.append("file2", file2);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Error ${res.status}: ${res.statusText}`);
      }

      const data: AnalysisResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = query.trim().length > 0 && file1 !== null && !isLoading;

  return (
    <div style={{ paddingTop: "68px", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ─── Main Layout ─── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ─── Left Panel: Input ─── */}
        <aside
          style={{
            width: "42%",
            minWidth: "360px",
            maxWidth: "520px",
            borderRight: "1px solid var(--grey-200)",
            background: "var(--grey-50)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* Query */}
            <div>
              <label
                htmlFor="query-input"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--grey-500)",
                  marginBottom: "0.5rem",
                  display: "block",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                What would you like to analyse?
              </label>
              <textarea
                id="query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Describe the land cover in this region..."
                rows={4}
                style={{
                  width: "100%",
                  background: "var(--surface-white)",
                  border: "1.5px solid var(--grey-200)",
                  borderRadius: "var(--radius-lg)",
                  padding: "0.875rem 1rem",
                  fontSize: "0.9375rem",
                  color: "var(--grey-700)",
                  resize: "none",
                  outline: "none",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--blue-400)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--grey-200)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Sample queries */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
                <HelpCircle size={12} style={{ color: "var(--grey-400)" }} />
                <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--grey-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Sample Queries
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {SAMPLE_QUERIES.map((sq) => (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => setQuery(sq)}
                    style={{
                      background: "var(--surface-white)",
                      border: "1px solid var(--grey-200)",
                      borderRadius: "100px",
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.75rem",
                      color: "var(--grey-500)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--blue-400)";
                      e.currentTarget.style.color = "var(--blue-500)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--grey-200)";
                      e.currentTarget.style.color = "var(--grey-500)";
                    }}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ flex: 1, height: 1, background: "var(--grey-200)" }} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--grey-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Images
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--grey-200)" }} />
            </div>

            {/* Dropzones */}
            <FileDropzone
              id="file1-input"
              label="Primary Image"
              hint="Optical or SAR satellite image"
              file={file1}
              onFileChange={setFile1}
              onClear={() => setFile1(null)}
            />
            <FileDropzone
              id="file2-input"
              label="Secondary Image (optional)"
              hint="For change detection or cross-modal analysis"
              file={file2}
              onFileChange={setFile2}
              onClear={() => setFile2(null)}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.9375rem",
                ...(canSubmit ? {} : {
                  background: "var(--grey-200)",
                  color: "var(--grey-400)",
                  boxShadow: "none",
                  cursor: "not-allowed",
                }),
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} style={{ animation: "spin-slow 0.75s linear infinite" }} />
                  <span>Analysing...</span>
                </>
              ) : (
                <>
                  <span>Run Analysis</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </aside>

        {/* ─── Right Panel: Output ─── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface-white)", position: "relative" }}>
          
          {/* Background Satellite */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0 }}>
            <div className="animate-float">
              <Image
                src="/images/pngImage1.png"
                alt=""
                width={400}
                height={400}
                style={{ objectFit: "contain", filter: "grayscale(30%)", opacity: 0.12 }}
                priority={false}
              />
            </div>
          </div>

          {/* Section header */}
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderBottom: "1px solid var(--grey-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
              zIndex: 1,
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--grey-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Results
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem 1.25rem",
                    borderRadius: "var(--radius-lg)",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                  }}
                >
                  <p style={{ fontSize: "0.9375rem", color: "#DC2626" }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading */}
            {isLoading && <ExecutionTraceLoader />}

            {/* Response */}
            {!isLoading && response && <AnalysisResult response={response} />}

            {/* Empty */}
            {!isLoading && !response && !error && <EmptyState />}
          </div>
        </main>
      </div>

      {/* ─── Mobile responsive override ─── */}
      <style jsx global>{`
        @media (max-width: 768px) {
          aside {
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            border-right: none !important;
            border-bottom: 1px solid var(--grey-200);
          }
        }
      `}</style>
    </div>
  );
}
