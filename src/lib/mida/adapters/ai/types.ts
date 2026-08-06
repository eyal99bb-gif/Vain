import type { NormalizedSizeChart, ScrapedProduct } from "../../types";

export interface ImageInput {
  data: Buffer;
  mimeType: string;
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

export interface GarmentRef {
  title: string;
  garmentType: string;
  color: string | null;
}

export interface TryOnMeta {
  /** Garments in the same order as the product images (1-3). */
  garments: GarmentRef[];
  /** True when the base image is a previous try-on result (layered look). */
  isLayered: boolean;
  /** Size fit info for the garment that has a size chart (if any). */
  size: string | null;
  /** Title of the garment the size applies to. */
  sizeGarmentTitle: string | null;
  /** The chosen size row's measurement ranges from the store chart, in cm. */
  sizeRow: Partial<Record<string, { min: number; max: number }>> | null;
  /** The user's body measurements in cm (girths possibly estimated). */
  userMeasurements: Partial<Record<string, number>> | null;
}

export interface GarmentDescription {
  title?: string;
  garmentType?: string;
  colors?: string[];
}

export interface AiAdapter {
  /** Dress the person photo with the product image(s), in order. */
  generateTryOn(
    avatar: ImageInput,
    productImages: ImageInput[],
    meta: TryOnMeta
  ): Promise<GeneratedImage>;
  /** Describe a garment from a user-uploaded screenshot/photo. */
  describeGarmentImage(image: ImageInput): Promise<GarmentDescription>;
  /**
   * Hunt for the product's size chart via URL-context — charts usually hide
   * behind a "size guide" click, so the model checks guide pages too.
   */
  extractSizeChartFromUrls(
    productUrl: string,
    guideUrls: string[]
  ): Promise<NormalizedSizeChart | null>;
  /** LLM fallback extraction of product data from raw page HTML. */
  extractProduct(html: string, url: string): Promise<Partial<ScrapedProduct>>;
  /**
   * Extract product data by having the model fetch the URL itself (Gemini
   * URL-context tool). Bypasses bot walls that block server-side fetches.
   */
  extractProductFromUrl(url: string): Promise<Partial<ScrapedProduct>>;
}
