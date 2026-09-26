import type { Metadata } from "next";
import ConsoleApp from "@/components/console/ConsoleApp";

export const metadata: Metadata = {
  title: "Analysis Console",
  description: "Load optical, SAR or bi-temporal GeoTIFFs, ask a question and inspect grounded evidence on the image and a real map.",
};

export default function AnalysisPage() {
  return <ConsoleApp />;
}
