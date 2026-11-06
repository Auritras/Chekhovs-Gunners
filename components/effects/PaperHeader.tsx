"use client";

import { useEffect, useRef, useState } from "react";
import { GUN_BODY, GUN_DETAIL, GUN_TRIGGER } from "@/components/effects/GunGlyph";
import { unlock } from "@/lib/view/achievementStore";
import Programme from "@/components/effects/Programme";
import HouseLights from "@/components/effects/HouseLights";

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

  // 29 January, Chekhov's birthday: the tagline wishes him well. Read on the client only,
  // so the server-rendered page and the browser agree on first paint.
  const [birthday, setBirthday] = useState(false);
  useEffect(() => {
    const now = new Date();
    if (now.getMonth() !== 0 || now.getDate() !== 29) return;
    const id = setTimeout(() => setBirthday(true), 0);
    return () => clearTimeout(id);
  }, []);

  // Easter egg: six clicks (six chambers) and the gun fires a "BANG!" flag.
  const clicks = useRef<{ n: number; last: number }>({ n: 0, last: 0 });
  const [bang, setBang] = useState(false);
  function onGunClick() {
    const now = Date.now();
    const c = clicks.current;
    c.n = now - c.last > 2500 ? 1 : c.n + 1;
    c.last = now;
    if (c.n < 6) return;
    c.n = 0;
    setBang(true);
    unlock("six-chambers");
    const gun = gunRef.current;
    gun?.classList.remove("gun-recoil");
    void gun?.getBoundingClientRect();
    gun?.classList.add("gun-recoil");
    setTimeout(() => setBang(false), 2600);
  }

  // A curtain call: the gun on the wall takes a bow, muzzle dipping on its nail.
  useEffect(() => {
    const bow = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gunRef.current?.animate(
        [
          { transform: "none" },
          { transform: "rotate(24deg)", offset: 0.35 },
          { transform: "rotate(24deg)", offset: 0.6 },
          { transform: "rotate(-4deg)", offset: 0.85 },
          { transform: "none" },
        ],
        { duration: 1300, easing: "ease-in-out" },
      );
    };
    window.addEventListener("cg-bow", bow);
    return () => window.removeEventListener("cg-bow", bow);
  }, []);

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

      {/* The gun on the back wall: beside the programme ticket on narrower screens, and on wide ones
          moved in toward the content column (above the title's box, so it can be hovered).
          Its BANG! flag springs straight up, so it needs no room beside it. */}
      <div
        aria-hidden
        data-depth="3"
        onClick={onGunClick}
        className="paper-layer paper-shadow absolute right-[max(calc(clamp(28px,8vw,130px)_+_5rem),calc((100%_-_64rem)/2_-_2rem))] top-1/2 z-10 hidden -translate-y-1/2 sm:block"
      >
        {bang && (
          // Out of the barrel to the side where there is room (wide screens); straight up otherwise,
          // so it never runs into the programme ticket beside the gun.
          <span className="absolute bottom-[64%] left-[94%] -translate-x-full min-[1680px]:bottom-auto min-[1680px]:left-[88%] min-[1680px]:top-[18%] min-[1680px]:translate-x-0">
            <span className="bang-flag flex flex-col items-end min-[1680px]:flex-row min-[1680px]:items-center">
              <span className="bg-curtain-ink px-2 py-0.5 font-display text-sm font-bold tracking-wide text-curtain">
                BANG!
              </span>
              <span className="h-6 w-px bg-curtain-ink/80 min-[1680px]:order-first min-[1680px]:h-px min-[1680px]:w-6" />
            </span>
          </span>
        )}
        <svg ref={gunRef} viewBox="0 0 80 50" className="gun-hang h-10 w-16 overflow-visible lg:h-14 lg:w-24">
          <path d="M40 2 L22 16 M40 2 L58 16" className="stroke-curtain-ink/60" strokeWidth="1.5" fill="none" />
          <circle cx="40" cy="3" r="2.5" className="fill-brass" />
          <g className="gun-body">
            <path d={GUN_BODY + GUN_DETAIL} fillRule="evenodd" className="fill-curtain-ink" />
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

      {/* The valance sits in front of the house-lights cord, so the cord hangs from behind it. */}
      <div aria-hidden data-depth="6" className="paper-layer paper-shadow absolute -inset-x-4 top-0 z-10">
        <div className="valance curtain h-8 sm:h-10" />
      </div>

      {/* The house lights: a pull-cord hanging from the valance, just inside the left drape. */}
      <div className="absolute left-[calc(clamp(28px,8vw,130px)-0.75rem)] top-2 z-[5]">
        <HouseLights />
      </div>

      {/* The programme: a ticket on a string from the valance, just inside the right drape. */}
      <div className="absolute right-[calc(clamp(28px,8vw,130px)-1.25rem)] top-2 z-[5]">
        <Programme />
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
            {birthday ? "Happy birthday, Anton." : "Every gun you plant should fire."}
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
