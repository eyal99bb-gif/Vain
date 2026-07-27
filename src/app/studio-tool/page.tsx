import type { Metadata } from "next";
import StudioTool from "./StudioTool";

export const metadata: Metadata = {
  title: "Vain's Studio Tool — AI Tattoo Stencil Generator",
  description:
    "Turn any tattoo design into a clean, transfer-ready stencil in seconds. High-contrast line extraction built for thermal paper, tuned by artists.",
};

export default function StudioToolPage() {
  return <StudioTool />;
}
