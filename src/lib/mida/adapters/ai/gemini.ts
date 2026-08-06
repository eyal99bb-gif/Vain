// Real AI adapter backed by Google Gemini (active when GEMINI_API_KEY is set).
import { GoogleGenAI } from "@google/genai";
import { midaEnv } from "../../env";
import type { GarmentType, ScrapedProduct } from "../../types";
import type { AiAdapter, GeneratedImage, ImageInput } from "./types";
import {
  avatarPrompt,
  DESCRIBE_GARMENT_PROMPT,
  EXTRACT_PRODUCT_SCHEMA,
  extractProductPrompt,
  sizeChartHuntPrompt,
  tryOnPrompt,
  urlContextPrompt,
} from "./prompts";

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: midaEnv.GEMINI_API_KEY! });
}

function imagePart(img: ImageInput) {
  return {
    inlineData: { mimeType: img.mimeType, data: img.data.toString("base64") },
  };
}

/**
 * Only transient conditions are worth paying for again. A safety block or a
 * bad request fails identically every time — retrying it billed us three
 * times for one certain failure.
 */
function isTransient(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(429|500|502|503|504)\b|overload|unavailable|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(
    message
  );
}

const GEMINI_TIMEOUT_MS = 60_000;

async function generateImage(
  prompt: string,
  images: ImageInput[]
): Promise<GeneratedImage> {
  let lastError: Error = new Error("Gemini returned no image");

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 3000 * attempt));
    try {
      const response = await getClient().models.generateContent({
        model: midaEnv.GEMINI_IMAGE_MODEL,
        contents: [
          { role: "user", parts: [{ text: prompt }, ...images.map(imagePart)] },
        ],
        config: { abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS) },
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

      // A refusal is deterministic: stop immediately instead of paying again.
      const blockReason =
        response.promptFeedback?.blockReason ??
        response.candidates?.[0]?.finishReason;
      throw new Error(
        `Gemini returned no image${blockReason ? ` (${blockReason})` : ""}`
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isTransient(lastError)) throw lastError;
    }
  }
  throw lastError;
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

/** Map a parsed LLM product object to our ScrapedProduct shape. */
function mapLlmProduct(parsed: LlmProduct): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {};
  if (parsed.title) result.title = parsed.title;
  if (typeof parsed.price === "number") result.price = parsed.price;
  if (parsed.currency) result.currency = parsed.currency;
  if (parsed.images?.length) {
    result.images = parsed.images.filter((u) => /^https?:\/\//.test(u));
  }
  if (parsed.colors?.length) result.colors = parsed.colors;
  if (parsed.garmentType) result.garmentType = parsed.garmentType;

  if (parsed.sizeChart?.rows?.length) {
    const rows = parsed.sizeChart.rows
      .map((row) => ({
        label: row.label,
        values: Object.fromEntries(
          row.measures
            .filter((m) => MEASURE_KEYS.has(m.key) && m.minCm > 0 && m.maxCm > 0)
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
}

/** Parse JSON that a model may have wrapped in a ```json fence. */
function parseLooseJson(text: string): LlmProduct | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the first {...} block if there's surrounding prose.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function createGeminiAdapter(): AiAdapter {
  return {
    async generateAvatar(photos, measurements) {
      return generateImage(avatarPrompt(measurements), photos);
    },

    async generateTryOn(avatar, productImages, meta) {
      return generateImage(tryOnPrompt(meta), [avatar, ...productImages]);
    },

    async extractSizeChartFromUrls(productUrl, guideUrls) {
      // The URL-context tool only fetches URLs present in the prompt text —
      // it can't follow links it discovers. So when no guide URLs are known,
      // first ask for the size-guide link, then hunt with it explicitly.
      if (guideUrls.length === 0) {
        try {
          const discovery = await getClient().models.generateContent({
            model: midaEnv.GEMINI_TEXT_MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Find links to size-guide / size-chart pages ('מדריך מידות') on ${productUrl}. Return ONLY minified JSON: {"urls":[absolute URLs, up to 3]} — or {"urls":[]} if none.`,
                  },
                ],
              },
            ],
            config: { tools: [{ urlContext: {} }] },
          });
          const raw = discovery.text;
          const parsed = raw
            ? (parseLooseJson(raw) as { urls?: string[] } | null)
            : null;
          guideUrls = (parsed?.urls ?? [])
            .filter((u) => /^https?:\/\//.test(u))
            .slice(0, 3);
        } catch {
          // discovery is best-effort
        }
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await getClient().models.generateContent({
            model: midaEnv.GEMINI_TEXT_MODEL,
            contents: [
              {
                role: "user",
                parts: [{ text: sizeChartHuntPrompt(productUrl, guideUrls) }],
              },
            ],
            config: { tools: [{ urlContext: {} }] },
          });
          const raw = response.text;
          const parsed = raw ? parseLooseJson(raw) : null;
          if (parsed) {
            const mapped = mapLlmProduct(parsed);
            if (mapped.sizeChart) return mapped.sizeChart;
          }
        } catch {
          // retry once, then give up quietly
        }
      }
      return null;
    },

    async describeGarmentImage(image) {
      try {
        const response = await getClient().models.generateContent({
          model: midaEnv.GEMINI_TEXT_MODEL,
          contents: [
            {
              role: "user",
              parts: [{ text: DESCRIBE_GARMENT_PROMPT }, imagePart(image)],
            },
          ],
          config: { responseMimeType: "application/json" },
        });
        const raw = response.text;
        if (!raw) return {};
        const parsed = JSON.parse(
          raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
        );
        return {
          title: typeof parsed.title === "string" ? parsed.title : undefined,
          garmentType:
            typeof parsed.garmentType === "string"
              ? parsed.garmentType
              : undefined,
          colors: Array.isArray(parsed.colors) ? parsed.colors : undefined,
        };
      } catch {
        return {};
      }
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
      const parsed = parseLooseJson(raw);
      return parsed ? mapLlmProduct(parsed) : {};
    },

    async extractProductFromUrl(url) {
      // The URL-context tool has Google's servers fetch the page, so this
      // works even when the store blocks server-side fetches. responseSchema
      // can't combine with tools, so we parse loosely. The tool call is slow
      // and occasionally transient-fails, so retry once.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await getClient().models.generateContent({
            model: midaEnv.GEMINI_TEXT_MODEL,
            contents: [
              { role: "user", parts: [{ text: urlContextPrompt(url) }] },
            ],
            config: { tools: [{ urlContext: {} }] },
          });
          const raw = response.text;
          const parsed = raw ? parseLooseJson(raw) : null;
          const mapped = parsed ? mapLlmProduct(parsed) : {};
          if (mapped.title) return mapped;
        } catch {
          if (attempt === 1) throw new Error("url-context extraction failed");
        }
      }
      return {};
    },
  };
}
