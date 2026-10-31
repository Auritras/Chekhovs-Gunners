import { ImageResponse } from "next/og";

// The card shown when the link is pasted into Devfolio, chat or email.
export const alt = "Chekhov's Gunners: every gun you plant should fire";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "Chekhov’s Gunners";
const TAGLINE = "Every gun you plant should fire.";
const LINE = "Find the setups in your story, see where they pay off, and spot the ones that never do.";

/** IM Fell English, the site's display face, fetched once at build time; null falls back to the default font. */
async function fell(text: string, italic: boolean): Promise<ArrayBuffer | null> {
  try {
    const family = italic ? "IM+Fell+English:ital@1" : "IM+Fell+English";
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [regular, italic] = await Promise.all([fell(TITLE, false), fell(TAGLINE, true)]);
  const fonts = [
    ...(regular ? [{ name: "Fell", data: regular, style: "normal" as const, weight: 400 as const }] : []),
    ...(italic ? [{ name: "Fell", data: italic, style: "italic" as const, weight: 400 as const }] : []),
  ];
  const drape = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: 120,
    background: "linear-gradient(90deg, #4a0c11, #8c1c22 55%, #5e1015)",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "radial-gradient(ellipse 70% 90% at 35% 55%, #3a2219, #160c0a 75%)",
          color: "#f5ead4",
          fontFamily: "Fell",
        }}
      >
        <div style={{ ...drape, left: 0, display: "flex" }} />
        <div style={{ ...drape, right: 0, display: "flex" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 54,
            background: "#8c1c22",
            borderBottom: "4px solid #4a0c11",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 26,
            background: "#d6b25b",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 200px",
            width: "100%",
          }}
        >
          <div style={{ fontSize: 112, lineHeight: 1, textShadow: "5px 4px 0 rgba(214,178,91,0.7)" }}>{TITLE}</div>
          <div style={{ fontSize: 46, fontStyle: "italic", marginTop: 22, opacity: 0.92 }}>{TAGLINE}</div>
          <div style={{ fontSize: 28, marginTop: 34, color: "#d6c7a8", fontFamily: "sans-serif", maxWidth: 760 }}>
            {LINE}
          </div>
        </div>
        {/* The gun on the wall. */}
        <svg
          width="190"
          height="120"
          viewBox="0 0 80 50"
          style={{ position: "absolute", right: 170, top: 240 }}
        >
          <path d="M40 2 L22 16 M40 2 L58 16" stroke="rgba(245,234,212,0.6)" strokeWidth="1.5" fill="none" />
          <circle cx="40" cy="3" r="2.5" fill="#d6b25b" />
          <path
            d="M6 16 H70 V22 H74 V28 H34 Q30 28 29 32 L25 46 Q24 48 21 48 H12 Q9 48 10 45 L15 28 H6 Z"
            fill="#f5ead4"
          />
        </svg>
      </div>
    ),
    { ...size, fonts },
  );
}
