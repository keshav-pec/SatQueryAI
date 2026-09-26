"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

export interface FocusRequest {
  bbox: [number, number, number, number];
  nonce: number;
}

interface Props {
  width: number;
  height: number;
  view?: ViewState | null;
  onView?: (v: ViewState) => void;
  focus?: FocusRequest | null;
  onHover?: (p: { x: number; y: number } | null) => void;
  fitKey?: string;
  children: React.ReactNode | ((v: ViewState) => React.ReactNode);
  overlay?: (v: ViewState, size: { w: number; h: number }) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function fitView(cw: number, ch: number, w: number, h: number): ViewState {
  const scale = Math.min(cw / w, ch / h) * 0.98;
  return { scale, tx: (cw - w * scale) / 2, ty: (ch - h * scale) / 2 };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Pan / zoom container. Children are laid out in image-pixel space. */
export function ZoomPane({ width, height, view, onView, focus, onHover, fitKey, children, overlay, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [inner, setInner] = useState<ViewState | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const anim = useRef<number | null>(null);
  const controlled = view !== undefined && onView !== undefined;
  const v = (controlled ? view : inner) ?? null;
  const vRef = useRef(v);
  useLayoutEffect(() => {
    vRef.current = v;
  });

  const setV = useCallback(
    (nv: ViewState) => {
      if (controlled) onView!(nv);
      else setInner(nv);
    },
    [controlled, onView],
  );

  const stop = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const animateTo = useCallback(
    (target: ViewState, duration = 700) => {
      stop();
      const from = vRef.current;
      if (!from) {
        setV(target);
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const k = ease(t);
        // interpolate in log-scale for a natural zoom feel
        const scale = Math.exp(Math.log(from.scale) + (Math.log(target.scale) - Math.log(from.scale)) * k);
        setV({ scale, tx: from.tx + (target.tx - from.tx) * k, ty: from.ty + (target.ty - from.ty) * k });
        if (t < 1) anim.current = requestAnimationFrame(tick);
        else anim.current = null;
      };
      anim.current = requestAnimationFrame(tick);
    },
    [setV],
  );

  useEffect(() => stop, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit on first layout, when the content changes, and when the container is resized
  const lastFit = useRef<string>("");
  useEffect(() => {
    if (!size.w || !size.h || !width || !height) return;
    const key = `${fitKey}|${width}x${height}|${Math.round(size.w)}x${Math.round(size.h)}`;
    if (key === lastFit.current && vRef.current) return;
    lastFit.current = key;
    stop();
    setV(fitView(size.w, size.h, width, height));
  }, [size.w, size.h, width, height, fitKey, setV]);

  // Programmatic focus on a bbox
  useEffect(() => {
    if (!focus || !size.w) return;
    const [x0, y0, x1, y1] = focus.bbox;
    const bw = Math.max(40, x1 - x0);
    const bh = Math.max(40, y1 - y0);
    const fit = fitView(size.w, size.h, width, height).scale;
    const scale = Math.max(fit, Math.min(fit * 8, Math.min(size.w / (bw * 1.8), size.h / (bh * 1.8))));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    animateTo({ scale, tx: size.w / 2 - cx * scale, ty: size.h / 2 - cy * scale }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // Wheel zoom (non-passive so the page does not scroll)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const cur = vRef.current;
      if (!cur) return;
      e.preventDefault();
      stop();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const fit = fitView(rect.width, rect.height, width, height).scale;
      const next = Math.max(fit * 0.6, Math.min(fit * 16, cur.scale * Math.exp(-e.deltaY * 0.0016)));
      const k = next / cur.scale;
      setV({ scale: next, tx: mx - (mx - cur.tx) * k, ty: my - (my - cur.ty) * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [width, height, setV]);

  const toImage = (clientX: number, clientY: number) => {
    const cur = vRef.current;
    if (!cur || !ref.current) return null;
    const rect = ref.current.getBoundingClientRect();
    const x = (clientX - rect.left - cur.tx) / cur.scale;
    const y = (clientY - rect.top - cur.ty) / cur.scale;
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  };

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden ${className ?? ""}`}
      style={{ cursor: grabbing ? "grabbing" : "crosshair", touchAction: "none", ...style }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest("[data-no-pan]")) return;
        ref.current?.setPointerCapture?.(e.pointerId);
        stop();
        drag.current = { x: e.clientX, y: e.clientY };
        setGrabbing(true);
      }}
      onPointerMove={(e) => {
        const cur = vRef.current;
        if (drag.current && cur) {
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          setV({ ...cur, tx: cur.tx + dx, ty: cur.ty + dy });
        }
        onHover?.(toImage(e.clientX, e.clientY));
      }}
      onPointerUp={() => {
        drag.current = null;
        setGrabbing(false);
      }}
      onPointerLeave={() => {
        drag.current = null;
        setGrabbing(false);
        onHover?.(null);
      }}
      onDoubleClick={() => size.w && animateTo(fitView(size.w, size.h, width, height), 600)}
    >
      {v && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: "0 0",
            transform: `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`,
            willChange: "transform",
          }}
        >
          {typeof children === "function" ? children(v) : children}
        </div>
      )}
      {v && overlay?.(v, size)}
    </div>
  );
}
