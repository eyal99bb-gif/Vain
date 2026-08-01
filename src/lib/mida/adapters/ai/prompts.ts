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

const MEASURE_LABELS: Record<string, string> = {
  chest: "chest",
  waist: "waist",
  hips: "hips",
  inseam: "inseam",
  shoulders: "shoulder width",
  height: "height",
};

/**
 * Fixed virtual try-on prompt. The contract: the FIRST image (the user's own
 * photo) must stay pixel-faithful everywhere except the garment area — only
 * the garment is replaced, fitted according to the store's size measurements.
 */
export function tryOnPrompt(meta: TryOnMeta): string {
  const lines = [
    "TASK: Virtual try-on. Edit the FIRST image only.",
    "Replace ONLY the garment the person is currently wearing in the covered area with the garment shown in the SECOND image" +
      ` (${meta.productTitle}${meta.color ? `, color ${meta.color}` : ""}, type: ${meta.garmentType}).`,
    "PRESERVE EXACTLY, unchanged from the first image: the person's face, expression, hair, skin tone, body shape and proportions, pose, hands, all other clothing items, the background, lighting, shadows, camera angle, framing and image composition. Outside the garment area the image must remain identical to the original photo.",
    "Reproduce the second image's garment faithfully: same color, fabric, texture, pattern, neckline, sleeves and details. Do not redesign it.",
  ];

  // Size-accurate drape: give the model the garment's measurements for the
  // chosen size next to the wearer's own measurements.
  if (meta.size && meta.sizeRow && Object.keys(meta.sizeRow).length > 0) {
    const pairs: string[] = [];
    for (const [key, range] of Object.entries(meta.sizeRow)) {
      if (!range) continue;
      const label = MEASURE_LABELS[key] ?? key;
      const user = meta.userMeasurements?.[key];
      pairs.push(
        `${label} ${range.min}-${range.max} cm${user ? ` (wearer's ${label}: ${user} cm)` : ""}`
      );
    }
    if (pairs.length > 0) {
      lines.push(
        `FIT: Render the garment in size ${meta.size}, whose measurements are: ${pairs.join("; ")}. Drape the fabric realistically for these numbers on this specific body — show tightness where the wearer's measurement approaches or exceeds the garment's, and looseness where the garment is larger.`
      );
    }
  } else if (meta.size) {
    lines.push(
      `FIT: Render the garment in size ${meta.size}, draped realistically on this specific body.`
    );
  } else {
    lines.push("FIT: Drape the garment realistically on this specific body.");
  }

  lines.push(
    "OUTPUT: One photorealistic image, same resolution and aspect as the first image. No text, no watermark, no added objects or people."
  );

  return lines.join("\n");
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
