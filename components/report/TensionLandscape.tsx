"use client";

import { useEffect, useRef } from "react";

const LINES = 18;

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
    const max = Math.max(1, ...tension);
    const values = tension.map((v) => v / max);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    let w = 0;
    let h = 0;
    let t = 0;
    let frame = 0;
    let visible = true;

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
        const base = h * 0.2 + depth * h * 0.75;
        const major = k % 5 === 0;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const u = w === 0 ? 0 : x / w;
          const ridge = heightAt(values, u) * h * 0.55 * Math.pow(1 - depth, 0.6);
          const wobble = Math.sin(u * 9 + k * 0.7 + t) * 2 + Math.sin(u * 23 - k + t * 0.6) * 1;
          const y = base - ridge * (0.5 + 0.5 * Math.sin(depth * 3.1)) + wobble;
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

    const loop = () => {
      if (visible) {
        t += 0.01;
        draw();
      }
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      draw();
      if (!reduce.matches) frame = requestAnimationFrame(loop);
    };

    const onResize = () => {
      size();
      draw();
    };

    size();
    start();
    const observer = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
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

  return <canvas ref={canvasRef} aria-hidden className="block h-24 w-full sm:h-28" />;
}
