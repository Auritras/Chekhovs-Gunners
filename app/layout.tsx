import type { Metadata } from "next";
import { IM_Fell_English, Instrument_Sans, Literata } from "next/font/google";
import "./globals.css";

const display = IM_Fell_English({
  variable: "--font-fell",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const text = Literata({
  variable: "--font-literata",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const ui = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const description =
  "Every gun you plant should fire. Find the setups in your story, see where they pay off, and spot the ones that never do.";

export const metadata: Metadata = {
  // Absolute base so the link-preview image resolves when the URL is shared.
  metadataBase: new URL("https://chekhovs-gunners.vercel.app"),
  title: "Chekhov's Gunners",
  description,
  openGraph: {
    title: "Chekhov's Gunners",
    description,
    siteName: "Chekhov's Gunners",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Chekhov's Gunners", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${text.variable} ${ui.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
