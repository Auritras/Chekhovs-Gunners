"use client";

/** Paper layers carry data-depth: how far (px) they drift at the stage edge; nearer layers move more. */
function paperLayers(stage: HTMLElement) {
  return [...stage.querySelectorAll<SVGGElement>(".paper-layer")];
}

/** A toy theatre in cut paper, with a gun on the back wall. Shown before any story is loaded. */
export default function PaperStage() {
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    paperLayers(e.currentTarget).forEach((l) => {
      const d = Number(l.dataset.depth);
      l.style.transform = `translate(${x * d}px, ${y * d * 0.5}px)`;
    });
  }

  function onPointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    paperLayers(e.currentTarget).forEach((l) => (l.style.transform = ""));
  }

  return (
    <figure className="flex max-w-3xl flex-col gap-3">
      <div
        aria-hidden
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative aspect-[16/7] overflow-hidden rounded-sm border border-line bg-paper-deep"
      >
        <svg viewBox="0 0 400 175" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <g data-depth="4" className="paper-layer">
            <rect x="120" y="38" width="160" height="92" className="paper-shadow fill-surface" />
            <g className="paper-shadow">
              <rect x="185" y="68" width="30" height="3" className="fill-ink-soft" />
              <path d="M180 76 h40 v6 h-28 l-4 10 h-8 z" className="fill-ink" />
            </g>
          </g>
          <g data-depth="8" className="paper-layer paper-shadow">
            <path d="M0 130 H400 V175 H0 Z" className="fill-brass" opacity=".85" />
          </g>
          <g data-depth="12" className="paper-layer paper-shadow">
            <path
              d="M0 0 H400 V28 Q370 44 340 28 Q310 44 280 28 Q250 44 220 28 Q190 44 160 28 Q130 44 100 28 Q70 44 40 28 Q20 38 0 28 Z"
              className="fill-curtain"
            />
          </g>
          <g data-depth="18" className="paper-layer paper-shadow">
            <path d="M0 0 H70 Q60 90 95 175 H0 Z" className="fill-curtain-deep" />
            <path d="M400 0 H330 Q340 90 305 175 H400 Z" className="fill-curtain-deep" />
          </g>
        </svg>
      </div>
      <figcaption className="text-sm text-ink-soft">
        The gun is on the wall. Load a story to see whether it fires.
      </figcaption>
    </figure>
  );
}
