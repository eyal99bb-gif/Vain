// schema.org Product extraction from JSON-LD script tags.
import type { CheerioAPI } from "cheerio";
import type { ScrapedProduct } from "../types";

interface JsonLdOffer {
  price?: number | string;
  priceCurrency?: string;
  lowPrice?: number | string;
}

interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  image?: string | string[] | { url?: string }[];
  color?: string | string[];
  offers?: JsonLdOffer | JsonLdOffer[];
  hasVariant?: JsonLdProduct[];
}

function isProductType(t: string | string[] | undefined): boolean {
  if (!t) return false;
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => /product/i.test(x));
}

function* walkJson(node: unknown): Generator<JsonLdProduct> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJson(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (isProductType(obj["@type"] as string | string[] | undefined)) {
    yield obj as JsonLdProduct;
  }
  // Traverse @graph and other nested containers.
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") yield* walkJson(value);
  }
}

function normalizeImages(image: JsonLdProduct["image"]): string[] {
  if (!image) return [];
  const arr = Array.isArray(image) ? image : [image];
  return arr
    .map((i) => (typeof i === "string" ? i : (i?.url ?? "")))
    .filter((u) => u.startsWith("http"));
}

export function parseJsonLd($: CheerioAPI): Partial<ScrapedProduct> {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    let json: unknown;
    try {
      json = JSON.parse($(el).text());
    } catch {
      continue;
    }

    for (const product of walkJson(json)) {
      const result: Partial<ScrapedProduct> = {};
      if (product.name) result.title = product.name;

      const images = normalizeImages(product.image);
      if (images.length) result.images = images;

      const offers = Array.isArray(product.offers)
        ? product.offers[0]
        : product.offers;
      const rawPrice = offers?.price ?? offers?.lowPrice;
      const price =
        typeof rawPrice === "string" ? parseFloat(rawPrice) : rawPrice;
      if (price !== undefined && Number.isFinite(price)) result.price = price;
      if (offers?.priceCurrency) result.currency = offers.priceCurrency;

      const colors = new Set<string>();
      const addColor = (c: string | string[] | undefined) => {
        if (!c) return;
        (Array.isArray(c) ? c : [c]).forEach((x) => x && colors.add(x));
      };
      addColor(product.color);
      product.hasVariant?.forEach((v) => addColor(v.color));
      if (colors.size) result.colors = [...colors];

      if (result.title) return result;
    }
  }
  return {};
}
