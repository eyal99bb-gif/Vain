import type { Metadata } from "next";
import StencilStudio from "./StencilStudio";

export const metadata: Metadata = {
  title: "Stencil Studio — Vain's Studio Tool",
  description:
    "Upload a design and convert it into a clean, high-contrast tattoo stencil right in your browser. Adjust detail and line weight, then download as PNG.",
};

export default function StencilStudioPage() {
  return <StencilStudio />;
}
