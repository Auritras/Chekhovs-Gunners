"use client";

import { useEffect, useRef, useState } from "react";
import { GUN_BODY, GUN_TRIGGER } from "@/components/effects/GunGlyph";
import { unlock } from "@/lib/view/achievementStore";

/** Paper layers carry data-depth: how far (px) they drift at the header edge; nearer layers move more. */
function paperLayers(stage: HTMLElement) {
  return [...stage.querySelectorAll<HTMLElement>(".paper-layer")];
}

/** Side drape in cut paper: pleated curtain clipped to a tied-back swag; mirrored on the right. */
function Drape({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      data-depth="10"
      className={`paper-layer paper-shadow absolute -inset-y-2 w-[clamp(28px,8vw,130px)] ${
        side === "left" ? "-left-3" : "-right-3 -scale-x-100"
      }`}
    >
      <div className="drape curtain h-full w-full" />
    </div>
  );
}

/**
 * The page header as a toy theatre in cut paper: a dark back wall with a spotlight,
 * paper drapes, a scalloped valance, a brass stage lip, and a gun on the wall.
 */
export default function PaperHeader({ fireKey }: { fireKey?: unknown }) {
  const gunRef = useRef<SVGSVGElement>(null);

  // Easter egg: six clicks (six chambers) and the gun fires a "BANG!" flag, once per visit.
  const clicks = useRef<{ n: number; last: number }>({ n: 0, last: 0 });
  const [bang, setBang] = useState(false);
  function onGunClick() {
    const now = Date.now();
    const c = clicks.current;
    c.n = now - c.last > 2500 ? 1 : c.n + 1;
    c.last = now;
    if (c.n < 6) return;
    c.n = 0;
    try {
      if (window.sessionStorage.getItem("cg-bang")) return;
      window.sessionStorage.setItem("cg-bang", "1");
    } catch {
      // Storage blocked: allow it anyway.
    }
    setBang(true);
    unlock("six-chambers");
    const gun = gunRef.current;
    gun?.classList.remove("gun-recoil");
    void gun?.getBoundingClientRect();
    gun?.classList.add("gun-recoil");
    setTimeout(() => setBang(false), 2600);
  }

  // A new report with guns left unfired: the gun on the wall fires once (recoil and gold dust).
  useEffect(() => {
    const gun = gunRef.current;
    if (!fireKey || !gun || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gun.classList.remove("gun-recoil");
    void gun.getBoundingClientRect(); // restart the animation on repeat reports
    gun.classList.add("gun-recoil");
  }, [fireKey]);

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    paperLayers(e.currentTarget).forEach((l) => {
      const d = Number(l.dataset.depth);
      // Tailwind's scale/translate utilities use their own CSS properties, so this composes with them.
      l.style.transform = `translate(${x * d}px, ${y * d * 0.5}px)`;
    });
  }

  function onPointerLeave(e: React.PointerEvent<HTMLElement>) {
    paperLayers(e.currentTarget).forEach((l) => (l.style.transform = ""));
  }

  return (
    <header
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="stage-wall relative overflow-hidden text-curtain-ink"
    >
      <div aria-hidden className="halftone" />

      {/* The gun on the back wall, hung beside the title (above the title's box, so it can be hovered). */}
      <div
        aria-hidden
        data-depth="3"
        onClick={onGunClick}
        className="paper-layer paper-shadow absolute right-[clamp(48px,15vw,240px)] top-1/2 z-10 hidden -translate-y-1/2 sm:block"
      >
        {bang && (
          <span className="bang-flag absolute left-[88%] top-[18%] flex items-center">
            <span className="h-px w-6 bg-curtain-ink/80" />
            <span className="bg-curtain-ink px-2 py-0.5 font-display text-sm font-bold tracking-wide text-curtain">
              BANG!
            </span>
          </span>
        )}
        <svg ref={gunRef} viewBox="0 0 80 50" className="gun-hang h-10 w-16 overflow-visible lg:h-14 lg:w-24">
          <path d="M40 2 L22 16 M40 2 L58 16" className="stroke-curtain-ink/60" strokeWidth="1.5" fill="none" />
          <circle cx="40" cy="3" r="2.5" className="fill-brass" />
          <g className="gun-body">
            <path d={GUN_BODY} className="fill-curtain-ink" />
            <path d={GUN_TRIGGER} className="stroke-curtain-ink" strokeWidth="2.5" fill="none" />
          </g>
          {/* A puff of gold dust from the muzzle. */}
          <g className="gun-puff fill-brass">
            <circle cx="82" cy="19" r="4" />
            <circle cx="89" cy="15" r="3" />
            <circle cx="88" cy="23" r="2.5" />
            <circle cx="95" cy="12" r="1.2" />
            <circle cx="97" cy="20" r="1" />
            <circle cx="93" cy="27" r="1.2" />
          </g>
        </svg>
      </div>

      <Drape side="left" />
      <Drape side="right" />

      <div aria-hidden data-depth="6" className="paper-layer paper-shadow absolute -inset-x-4 top-0">
        <div className="valance curtain h-8 sm:h-10" />
      </div>

      <div className="relative px-[clamp(28px,8vw,130px)] pb-14 pt-16 sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <h1
            data-text="Chekhov’s Gunners"
            className="riso-title font-display text-[2.6rem] leading-[1.05] sm:text-7xl"
          >
            Chekhov’s Gunners
          </h1>
          <p className="mt-2 font-display text-xl italic opacity-90 sm:text-2xl">
            Every gun you plant should fire.
          </p>
        </div>
      </div>

      <div
        aria-hidden
        data-depth="4"
        className="paper-layer paper-shadow-up absolute -inset-x-4 bottom-0 h-3 bg-brass sm:h-4"
      />
    </header>
  );
}
