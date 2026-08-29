import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SatQuery AI — Interactive Vision-Language Assistant for Remote Sensing",
  description:
    "An agentic vision-language assistant for analysing single and paired remote-sensing images through natural-language queries. Supports VQA, change detection, cross-modal fusion, and source-grounded answering.",
  keywords: [
    "satellite imagery",
    "remote sensing",
    "VQA",
    "change detection",
    "SAR",
    "optical imagery",
    "AI",
    "vision-language model",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceCodePro.variable}`}
    >
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
