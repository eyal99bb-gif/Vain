// Real AI adapter backed by Google Gemini (active when GEMINI_API_KEY is set).
import { GoogleGenAI } from "@google/genai";
import { midaEnv } from "../../env";
import type { GarmentType, ScrapedProduct } from "../../types";
import type { AiAdapter, GeneratedImage, ImageInput } from "./types";
import {
  avatarPrompt,
  EXTRACT_PRODUCT_SCHEMA,
  extractProductPrompt,
  tryOnPrompt,
} from "./prompts";

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: midaEnv.GEMINI_API_KEY! });
}

function imagePart(img: ImageInput) {
  return {
    inlineData: { mimeType: img.mimeType, data: img.data.toString("base64") },
  };
}

async function generateImage(
  prompt: string,
  images: ImageInput[]
): Promise<GeneratedImage> {
  const response = await getClient().models.generateContent({
    model: midaEnv.GEMINI_IMAGE_MODEL,
    contents: [
      { role: "user", parts: [{ text: prompt }, ...images.map(imagePart)] },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }

  const blockReason =
    response.promptFeedback?.blockReason ??
    response.candidates?.[0]?.finishReason;
  throw new Error(
    `Gemini returned no image${blockReason ? ` (${blockReason})` : ""}`
  );
}

interface LlmSizeChart {
  rows: {
    label: string;
    measures: { key: string; minCm: number; maxCm: number }[];
  }[];
}

interface LlmProduct {
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  images?: string[];
  colors?: string[];
  garmentType?: GarmentType;
  sizeChart?: LlmSizeChart | null;
}

const MEASURE_KEYS = new Set([
  "chest",
  "waist",
  "hips",
  "inseam",
  "shoulders",
  "height",
]);

export function createGeminiAdapter(): AiAdapter {
  return {
    async generateAvatar(photos, measurements) {
      return generateImage(avatarPrompt(measurements), photos);
    },

    async generateTryOn(avatar, productImage, meta) {
      return generateImage(tryOnPrompt(meta), [avatar, productImage]);
    },

    async extractProduct(html, url) {
      const response = await getClient().models.generateContent({
        model: midaEnv.GEMINI_TEXT_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: `${extractProductPrompt(url)}\n\n${html}` }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EXTRACT_PRODUCT_SCHEMA,
        },
      });

      const raw = response.text;
      if (!raw) return {};
      let parsed: LlmProduct;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {};
      }

      const result: Partial<ScrapedProduct> = {};
      if (parsed.title) result.title = parsed.title;
      if (typeof parsed.price === "number") result.price = parsed.price;
      if (parsed.currency) result.currency = parsed.currency;
      if (parsed.images?.length) result.images = parsed.images;
      if (parsed.colors?.length) result.colors = parsed.colors;
      if (parsed.garmentType) result.garmentType = parsed.garmentType;

      if (parsed.sizeChart?.rows?.length) {
        const rows = parsed.sizeChart.rows
          .map((row) => ({
            label: row.label,
            values: Object.fromEntries(
              row.measures
                .filter(
                  (m) => MEASURE_KEYS.has(m.key) && m.minCm > 0 && m.maxCm > 0
                )
                .map((m) => [
                  m.key,
                  { min: Math.min(m.minCm, m.maxCm), max: Math.max(m.minCm, m.maxCm) },
                ])
            ),
          }))
          .filter((row) => Object.keys(row.values).length > 0);
        if (rows.length > 0) {
          result.sizeChart = { unit: "cm", rows };
          result.sizeChartSource = "llm";
        }
      }

      return result;
    },
  };
}
