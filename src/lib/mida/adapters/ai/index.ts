import { midaEnv } from "../../env";
import type { AiAdapter } from "./types";

let adapter: AiAdapter | null = null;

export async function getAi(): Promise<AiAdapter> {
  if (!adapter) {
    if (midaEnv.aiMode === "real") {
      const { createGeminiAdapter } = await import("./gemini");
      adapter = createGeminiAdapter();
    } else {
      const { createDemoAdapter } = await import("./demo");
      adapter = createDemoAdapter();
    }
  }
  return adapter;
}

export type { AiAdapter, GeneratedImage, ImageInput, TryOnMeta } from "./types";
