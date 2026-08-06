// All Gemini prompts live here so try-on quality can be iterated in one place.
import type { TryOnMeta } from "./types";

const MEASURE_LABELS: Record<string, string> = {
  chest: "chest",
  waist: "waist",
  hips: "hips",
  inseam: "inseam",
  shoulders: "shoulder width",
  height: "height",
};

const ORDINALS = ["SECOND", "THIRD", "FOURTH"];

/**
 * Fixed virtual try-on prompt. The contract: the FIRST image (the user's own
 * photo) must stay pixel-faithful everywhere except the garment areas; each
 * garment is copied one-to-one from its reference image, fitted according to
 * the store's size measurements.
 */
export function tryOnPrompt(meta: TryOnMeta): string {
  const lines = [
    "TASK: Virtual try-on. Edit the FIRST image only.",
  ];

  meta.garments.forEach((g, i) => {
    const ordinal = ORDINALS[i] ?? `${i + 2}th`;
    lines.push(
      `Dress the person in the garment shown in the ${ordinal} image` +
        ` (${g.title}${g.color ? `, color ${g.color}` : ""}, type: ${g.garmentType}), replacing whatever they currently wear in that area.`
    );
  });
  if (meta.garments.length > 1) {
    lines.push(
      "Dress the person in ALL the garments above together, as one coherent outfit."
    );
  }
  if (meta.isLayered) {
    lines.push(
      "The person may already be wearing garments added in previous try-on steps — keep those EXACTLY intact; add or replace clothing only in the area covered by the new garment."
    );
  }

  lines.push(
    "PRESERVE EXACTLY, unchanged from the first image: the person's face, expression, hair, skin tone, body shape and proportions, pose, hands, any clothing in areas the new garments do not cover, the background, lighting, shadows, camera angle, framing and image composition. Outside the garment areas the image must remain identical to the original photo.",
    "GARMENT FIDELITY — copy each garment EXACTLY one-to-one from its reference image: identical colors and shades, prints, graphics, logos, text, patterns, fabric and texture, collar/neckline, sleeves, buttons, zippers, pockets, seams, stitching, trims, cut and length. Never substitute, redesign, simplify, recolor, or invent details that are not in the reference image."
  );

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
        `FIT: Render ${meta.sizeGarmentTitle ? `"${meta.sizeGarmentTitle}"` : "the garment"} in size ${meta.size}, whose measurements are: ${pairs.join("; ")}. Drape the fabric realistically for these numbers on this specific body — show tightness where the wearer's measurement approaches or exceeds the garment's, and looseness where the garment is larger.`
      );
    }
  } else if (meta.size) {
    lines.push(
      `FIT: Render the garment in size ${meta.size}, draped realistically on this specific body.`
    );
  } else {
    lines.push("FIT: Drape the garments realistically on this specific body.");
  }

  lines.push(
    "OUTPUT: One photorealistic image, same resolution, aspect and composition as the first image, showing exactly ONE person — the same person in the same position and scale as the input photo. Never produce a before/after, side-by-side, collage or duplicate figure. No text, no watermark, no added objects or people."
  );

  return lines.join("\n");
}

/** Focused size-chart hunt: the chart usually hides behind a click. */
export function sizeChartHuntPrompt(
  productUrl: string,
  guideUrls: string[]
): string {
  return [
    `Find the SIZE CHART for the clothing product at: ${productUrl}`,
    guideUrls.length
      ? `The size chart may live on one of these size-guide pages — check them too: ${guideUrls.join(" , ")}`
      : "The chart is usually NOT on the product page itself: look for a size-guide link on the product page (e.g. 'מדריך מידות', 'size guide', often under /customer-service/, /pages/, /help/), then OPEN that URL too and read the chart from there.",
    "If the store has one general size chart for this garment category, that chart counts.",
    'Return ONLY minified JSON, no markdown: {"sizeChart":{"rows":[{"label":string,"measures":[{"key":"chest"|"waist"|"hips"|"inseam"|"shoulders"|"height","minCm":number,"maxCm":number}]}]}|null}',
    "Body measurements only (not garment flat measurements when both exist). Convert inches to centimeters (×2.54). A single value becomes min=max. If you cannot find a real size chart, return {\"sizeChart\":null}. Never invent numbers.",
  ].join("\n");
}

/** Prompt for describing a garment from a user-uploaded screenshot. */
export const DESCRIBE_GARMENT_PROMPT = [
  "The image is a screenshot or photo of a clothing product.",
  'Return ONLY minified JSON: {"title":short product name in Hebrew,"garmentType":"top"|"pants"|"dress"|"outerwear"|"skirt"|"unknown","colors":[color names in Hebrew]}',
  "Do not invent details you cannot see.",
].join("\n");

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
