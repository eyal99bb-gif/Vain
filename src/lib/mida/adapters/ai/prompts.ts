// All Gemini prompts live here so try-on quality can be iterated in one place.
import type { Measurements } from "../../types";
import type { TryOnMeta } from "./types";

export function avatarPrompt(m: Measurements): string {
  return [
    "Create a single clean full-body studio photo of the person from the reference photo(s).",
    "Keep the person's face, hair, skin tone, body shape and proportions exactly as in the reference.",
    `Body data for accurate proportions: height ${m.heightCm} cm, weight ${m.weightKg} kg` +
      (m.chestCm ? `, chest ${m.chestCm} cm` : "") +
      (m.waistCm ? `, waist ${m.waistCm} cm` : "") +
      (m.hipsCm ? `, hips ${m.hipsCm} cm` : "") +
      ".",
    "Pose: standing straight, facing the camera, arms relaxed at the sides, neutral expression.",
    "Clothing: plain fitted neutral-gray t-shirt and plain fitted neutral-gray pants.",
    "Background: seamless light-gray studio background, soft even lighting, no shadows on the wall.",
    "Framing: full body visible head to shoes, centered, vertical orientation.",
    "Do not add text, watermarks, props, or other people.",
  ].join(" ");
}

export function tryOnPrompt(meta: TryOnMeta): string {
  return [
    "Dress the person from the first image in the garment shown in the second image.",
    "This is a virtual try-on: keep the person's face, hair, skin tone, body shape, pose and proportions from the first image exactly unchanged.",
    `Garment: ${meta.productTitle}${meta.color ? `, color ${meta.color}` : ""} (${meta.garmentType}).`,
    meta.size
      ? `Render the fabric drape realistically for size ${meta.size} on this specific body.`
      : "Render the fabric drape realistically for this specific body.",
    "Replace only the relevant clothing; keep other clothing items the person wears where the garment does not cover.",
    "Keep the light-gray studio background and lighting from the first image.",
    "Photorealistic result, no text or watermarks.",
  ].join(" ");
}

export function extractProductPrompt(url: string): string {
  return [
    `The following is stripped HTML from the product page ${url}.`,
    "Extract the product information as JSON.",
    "For sizeChart: only include it if an actual size chart with body measurements exists in the page; convert all values to centimeters (values given in inches must be multiplied by 2.54).",
    "Measure keys must be among: chest, waist, hips, inseam, shoulders, height.",
    "garmentType must be one of: top, pants, dress, outerwear, skirt, unknown.",
    "If a field is unknown, use null (or [] for lists). Do not invent data.",
  ].join(" ");
}

/** Prompt for URL-context extraction (model fetches the page itself). */
export function urlContextPrompt(url: string): string {
  return [
    `Extract product data from this page: ${url}`,
    'Return ONLY minified JSON, no markdown fences: {"title":string,"price":number|null,"currency":string|null,"colors":[string],"garmentType":"top"|"pants"|"dress"|"outerwear"|"skirt"|"unknown","images":[direct product image URLs, up to 5],"sizeChart":{"rows":[{"label":string,"measures":[{"key":"chest"|"waist"|"hips"|"inseam"|"shoulders","minCm":number,"maxCm":number}]}]}|null}',
    "Convert any inch values to centimeters (×2.54). Use full absolute https image URLs.",
    "If there is no real size chart on the page, set sizeChart to null. Do not invent data.",
  ].join("\n");
}

/** responseSchema for extractProduct (Gemini structured output). */
export const EXTRACT_PRODUCT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", nullable: true },
    price: { type: "number", nullable: true },
    currency: { type: "string", nullable: true },
    images: { type: "array", items: { type: "string" } },
    colors: { type: "array", items: { type: "string" } },
    garmentType: {
      type: "string",
      enum: ["top", "pants", "dress", "outerwear", "skirt", "unknown"],
    },
    sizeChart: {
      type: "object",
      nullable: true,
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              measures: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    minCm: { type: "number" },
                    maxCm: { type: "number" },
                  },
                  required: ["key", "minCm", "maxCm"],
                },
              },
            },
            required: ["label", "measures"],
          },
        },
      },
      required: ["rows"],
    },
  },
  required: ["images", "colors", "garmentType"],
} as const;
