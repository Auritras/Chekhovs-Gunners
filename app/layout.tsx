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

export const metadata: Metadata = {
  title: "Chekhov's Gunners",
  description: "Every gun you plant should fire. Find the setups in your story, see where they pay off, and spot the ones that never do.",
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
