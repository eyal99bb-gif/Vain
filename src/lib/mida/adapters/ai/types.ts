import type { Measurements, ScrapedProduct } from "../../types";

export interface ImageInput {
  data: Buffer;
  mimeType: string;
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

export interface TryOnMeta {
  productTitle: string;
  garmentType: string;
  size: string | null;
  color: string | null;
  /** The chosen size row's measurement ranges from the store chart, in cm. */
  sizeRow: Partial<Record<string, { min: number; max: number }>> | null;
  /** The user's body measurements in cm (girths possibly estimated). */
  userMeasurements: Partial<Record<string, number>> | null;
}

export interface AiAdapter {
  /** Build the canonical normalized avatar from the user's photos. */
  generateAvatar(
    photos: ImageInput[],
    measurements: Measurements
  ): Promise<GeneratedImage>;
  /** Dress the avatar with the product image. */
  generateTryOn(
    avatar: ImageInput,
    productImage: ImageInput,
    meta: TryOnMeta
  ): Promise<GeneratedImage>;
  /** LLM fallback extraction of product data from raw page HTML. */
  extractProduct(html: string, url: string): Promise<Partial<ScrapedProduct>>;
  /**
   * Extract product data by having the model fetch the URL itself (Gemini
   * URL-context tool). Bypasses bot walls that block server-side fetches.
   */
  extractProductFromUrl(url: string): Promise<Partial<ScrapedProduct>>;
}
