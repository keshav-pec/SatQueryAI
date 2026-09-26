import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/site/Navbar";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "SatQuery AI — Agentic Vision-Language Assistant for Remote Sensing",
    template: "%s · SatQuery AI",
  },
  description:
    "Ask questions of satellite imagery in plain language. SatQuery AI validates optical, SAR and multi-temporal inputs, routes the query to remote-sensing specialist models and returns evidence-grounded answers with maps, charts, confidence and an auditable execution trace.",
  keywords: ["remote sensing", "vision-language model", "VQA", "visual grounding", "change detection", "SAR", "Sentinel-2", "Sentinel-1", "ISRO", "Smart India Hackathon"],
};

export const viewport: Viewport = {
  themeColor: "#060a12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
