"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecutionTraceStep {
  step: string;
  message?: string;
  action?: string;
  [key: string]: unknown;
}

interface AnalysisResponse {
  query: string;
  result: string;
  execution_trace: ExecutionTraceStep[];
}

const API_ENDPOINT = "http://127.0.0.1:8050/analyze";

// ─── File Dropzone ────────────────────────────────────────────────────────────

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
    <div>
      <label className="text-xs font-medium text-stone-500 mb-1.5 block">
        {label}
      </label>
      <div
        className={`dropzone ${isDragOver ? "active" : ""} rounded-lg p-4 flex items-center gap-3 cursor-pointer min-h-[72px] bg-white`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
      >
        <input
          ref={inputRef}
          type="file"
          id={id}
          className="hidden"
          accept=".tif,.tiff,.png,.jpg,.jpeg"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />

        {file ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 w-full"
          >
            <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
              <FileImage className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-700 truncate font-medium">
                {file.name}
              </p>
              <p className="text-xs text-stone-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-3 w-full">
            <div className="w-9 h-9 rounded-md bg-stone-100 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-stone-400" />
            </div>
            <div>
              <p className="text-sm text-stone-500">{hint}</p>
              <p className="text-xs text-stone-400">
                TIFF · GeoTIFF · PNG · JPEG
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Execution Trace ──────────────────────────────────────────────────────────

function ExecutionTrace({ trace }: { trace: ExecutionTraceStep[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4 border border-stone-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs font-medium text-stone-600">
            Execution Steps
          </span>
          <span className="text-xs text-stone-400">
            ({trace.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-stone-900 p-4 max-h-[280px] overflow-y-auto">
              {trace.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="font-mono text-[13px] leading-relaxed flex gap-2 mb-0.5"
                >
                  <span className="text-stone-600 select-none shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-blue-400 font-medium shrink-0">
                    [{step.step}]
                  </span>
                  <span className="text-stone-300">
                    {step.message || step.action || "—"}
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

// ─── Analysis Result ──────────────────────────────────────────────────────────

function AnalysisResult({ response }: { response: AnalysisResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Result card */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
          <span className="text-xs font-medium text-stone-500">
            Analysis Result
          </span>
          <span className="text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
            Complete
          </span>
        </div>

        {/* Query echo */}
        <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/60">
          <p className="text-xs text-stone-400 mb-0.5">Your query</p>
          <p className="text-sm text-stone-600 italic">
            &quot;{response.query}&quot;
          </p>
        </div>

        {/* Response */}
        <div className="px-5 py-4">
          <div className="text-[15px] text-stone-700 leading-relaxed whitespace-pre-wrap">
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
          <Satellite className="w-6 h-6 text-stone-300" />
        </div>
        <p className="text-sm font-medium text-stone-500 mb-1">
          No analysis yet
        </p>
        <p className="text-xs text-stone-400 leading-relaxed">
          Upload a satellite image and ask a question to get started.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SatQueryDashboard() {
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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Satellite className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-stone-800 leading-tight">
              SatQuery AI
            </h1>
            <p className="text-[11px] text-stone-400 leading-tight">
              Remote Sensing Analysis
            </p>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Input ── */}
        <aside className="w-[40%] min-w-[360px] border-r border-stone-200 bg-stone-50/50 flex flex-col overflow-hidden">
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-5 space-y-5"
          >
            {/* Query */}
            <div>
              <label
                htmlFor="query-input"
                className="text-xs font-medium text-stone-500 mb-1.5 block"
              >
                What would you like to analyze?
              </label>
              <textarea
                id="query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Describe the land cover in this region..."
                rows={4}
                className="w-full bg-white border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[11px] font-medium text-stone-400">
                Images
              </span>
              <div className="flex-1 h-px bg-stone-200" />
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
              className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200
                ${canSubmit
                  ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99] shadow-sm"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
                }
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Run Analysis</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </aside>

        {/* ── Right: Output ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Section label */}
          <div className="px-5 py-2.5 border-b border-stone-100">
            <span className="text-xs font-medium text-stone-400">
              Results
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col">
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100"
                >
                  <p className="text-sm text-red-600">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading */}
            {isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="spinner mx-auto" />
                  <p className="text-sm text-stone-400">
                    Running analysis pipeline...
                  </p>
                </div>
              </div>
            )}

            {/* Response */}
            {!isLoading && response && <AnalysisResult response={response} />}

            {/* Empty */}
            {!isLoading && !response && !error && <EmptyState />}
          </div>
        </main>
      </div>
    </div>
  );
}
