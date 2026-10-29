"use client";

import { useEffect, useRef } from "react";

const LINES = 18;
const REVEAL_MS = 1400;

/** Smoothstep between chapter values so the ridge rises and falls with the story. */
function heightAt(values: number[], u: number): number {
  if (values.length === 1) return values[0];
  const p = u * (values.length - 1);
  const i = Math.min(Math.floor(p), values.length - 2);
  const f = p - i;
  const s = f * f * (3 - 2 * f);
  return values[i] * (1 - s) + values[i + 1] * s;
}

/** Contour lines shaped by per-chapter tension. Decorative: the bars below carry the data. */
export default function TensionLandscape({ tension }: { tension: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || tension.length === 0) return;
    // Scale between the quietest and most loaded chapter so the peak stands out.
    const min = Math.min(...tension);
    const range = Math.max(...tension) - min;
    const values = tension.map((v) => (range === 0 ? 0.5 : 0.1 + (0.9 * (v - min)) / range));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    let w = 0;
    let h = 0;
    let t = 0;
    let frame = 0;
    let visible = false;
    // The lines draw in left to right the first time the landscape is on screen.
    let reveal = reduce.matches ? 1 : 0;
    let revealStart: number | null = null;

    const size = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const style = getComputedStyle(canvas);
      const ink = style.getPropertyValue("--ink-soft").trim();
      const accent = style.getPropertyValue("--curtain").trim();
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < LINES; k++) {
        const depth = k / (LINES - 1);
        // Upper lines rise most; lines bunch together over the peak like contours on a hill.
        const base = h * 0.52 + depth * h * 0.45;
        const major = k % 5 === 0;
        ctx.beginPath();
        for (let x = 0; x <= w * reveal; x += 4) {
          const u = w === 0 ? 0 : x / w;
          const ridge = heightAt(values, u) * h * (0.5 - depth * 0.3);
          const wobble = Math.sin(u * 9 + k * 0.7 + t) * 1.5 + Math.sin(u * 23 - k + t * 0.6) * 0.75;
          const y = base - ridge + wobble;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = major ? accent : ink;
        ctx.globalAlpha = major ? 0.8 : 0.3;
        ctx.lineWidth = major ? 1.3 : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (visible) {
        if (reveal < 1) {
          revealStart ??= now;
          const p = Math.min(1, (now - revealStart) / REVEAL_MS);
          reveal = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        }
        t += 0.01;
        draw();
      }
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (reduce.matches) reveal = 1;
      draw();
      if (!reduce.matches) frame = requestAnimationFrame(loop);
    };

    const onResize = () => {
      size();
      draw();
    };

    size();
    start();
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observer.observe(canvas);
    window.addEventListener("resize", onResize);
    dark.addEventListener("change", draw);
    reduce.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      dark.removeEventListener("change", draw);
      reduce.removeEventListener("change", start);
    };
  }, [tension]);

  // Label at most about eight chapters so long books don't crowd the axis.
  const n = tension.length;
  const step = Math.ceil(n / 8);
  const marks = Array.from({ length: n }, (_, i) => i).filter((i) => i % step === 0 || i === n - 1);

  return (
    <div aria-hidden className="flex flex-col gap-1">
      <canvas ref={canvasRef} className="block h-32 w-full sm:h-40" />
      <div className="relative h-4 text-xs tabular-nums text-muted">
        {marks.map((i) => {
          const u = n === 1 ? 0.5 : i / (n - 1);
          const align = u === 0 ? "" : u === 1 ? "-translate-x-full" : "-translate-x-1/2";
          return (
            <span key={i} className={`absolute top-0 whitespace-nowrap ${align}`} style={{ left: `${u * 100}%` }}>
              Ch {i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}
