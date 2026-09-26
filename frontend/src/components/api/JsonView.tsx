"use client";

import { Fragment } from "react";

const MAX_ARRAY = 4;

function isCoordArray(v: unknown[]): boolean {
  return v.length > 0 && Array.isArray(v[0]) && typeof (v[0] as unknown[])[0] === "number";
}

/** Pretty JSON with syntax colouring; long coordinate arrays are elided for reading (copy gets the full JSON). */
function render(v: unknown, indent: number, key: string): React.ReactNode {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (v === null) return <span className="tok-n">null</span>;
  if (typeof v === "string") {
    const s = v.length > 220 ? v.slice(0, 220) + "…" : v;
    return <span className="tok-s">{JSON.stringify(s)}</span>;
  }
  if (typeof v === "number") return <span className="tok-n">{String(v)}</span>;
  if (typeof v === "boolean") return <span className="tok-b">{String(v)}</span>;
  if (Array.isArray(v)) {
    if (!v.length) return <span className="tok-p">[]</span>;
    if (v.every((x) => typeof x === "number" || typeof x === "string") && v.length <= 8) {
      return (
        <>
          <span className="tok-p">[</span>
          {v.map((x, i) => (
            <Fragment key={i}>
              {render(x, 0, key)}
              {i < v.length - 1 && <span className="tok-p">, </span>}
            </Fragment>
          ))}
          <span className="tok-p">]</span>
        </>
      );
    }
    const coords = isCoordArray(v);
    const shown = coords && v.length > MAX_ARRAY ? v.slice(0, 2) : v;
    return (
      <>
        <span className="tok-p">[</span>
        {"\n"}
        {shown.map((x, i) => (
          <Fragment key={i}>
            {inner}
            {render(x, indent + 1, key)}
            {(i < shown.length - 1 || shown.length < v.length) && <span className="tok-p">,</span>}
            {"\n"}
          </Fragment>
        ))}
        {shown.length < v.length && (
          <>
            {inner}
            <span className="tok-c">{`/* … ${v.length - shown.length} more coordinates */`}</span>
            {"\n"}
          </>
        )}
        {pad}
        <span className="tok-p">]</span>
      </>
    );
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (!entries.length) return <span className="tok-p">{"{}"}</span>;
    return (
      <>
        <span className="tok-p">{"{"}</span>
        {"\n"}
        {entries.map(([k, x], i) => (
          <Fragment key={k}>
            {inner}
            <span className="tok-k">{JSON.stringify(k)}</span>
            <span className="tok-p">: </span>
            {render(x, indent + 1, k)}
            {i < entries.length - 1 && <span className="tok-p">,</span>}
            {"\n"}
          </Fragment>
        ))}
        {pad}
        <span className="tok-p">{"}"}</span>
      </>
    );
  }
  return String(v);
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  return <pre className={`code ${className ?? ""}`}>{render(value, 0, "")}</pre>;
}
