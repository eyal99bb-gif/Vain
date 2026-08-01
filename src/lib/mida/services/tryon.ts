import { getAi } from "../adapters/ai";
import type { GarmentRef, ImageInput } from "../adapters/ai";
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import type { StorageAdapter } from "../adapters/storage";
import { runJob } from "../jobs";
import { recommendSize } from "../sizing/recommend";
import type { Product, Profile, TryOn } from "../types";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
};

export interface TryOnView {
  id: string;
  status: TryOn["status"];
  resultUrl: string | null;
  sizeRec: TryOn["sizeRec"];
  error: string | null;
}

export async function toTryOnView(tryon: TryOn): Promise<TryOnView> {
  const storage = await getStorage();
  return {
    id: tryon.id,
    status: tryon.status,
    resultUrl: tryon.resultKey ? storage.url(tryon.resultKey) : null,
    sizeRec: tryon.sizeRec,
    error: tryon.error,
  };
}

/**
 * Fetch one product's image. Handles both remote store URLs (browser-like
 * headers — CDNs bot-block bare fetches) and images stored by us (screenshot
 * uploads, whose URLs are served by /api/files).
 */
async function fetchProductImage(
  product: Product,
  preferredIndex: number,
  storage: StorageAdapter
): Promise<ImageInput | null> {
  const candidates = [
    product.images[preferredIndex],
    ...product.images,
  ].filter((u): u is string => !!u);

  for (const imageUrl of [...new Set(candidates)].slice(0, 3)) {
    // Our own stored objects (screenshot products) — read from storage.
    if (imageUrl.startsWith("/api/files/")) {
      const obj = await storage.get(imageUrl.slice("/api/files/".length));
      if (obj && !obj.contentType.includes("svg")) {
        return { data: obj.data, mimeType: obj.contentType };
      }
      continue;
    }
    try {
      const res = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { ...BROWSER_HEADERS, Referer: product.url || imageUrl },
      });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/") && !type.includes("svg")) {
        return { data: Buffer.from(await res.arrayBuffer()), mimeType: type };
      }
    } catch {
      // try the next image
    }
  }
  return null;
}

/**
 * Create a try-on for 1-3 products dressed together: the size recommendation
 * is computed synchronously (pure function — the size answer never waits on
 * Gemini) for the first product that has a size chart; image generation runs
 * as a post-response job.
 */
export async function startTryOn(
  profile: Profile,
  productIds: string[],
  productImageIndex: number,
  baseTryOnId?: string
): Promise<{ ok: true; tryon: TryOn } | { ok: false; error: string }> {
  const repos = await getRepos();

  if (profile.avatarStatus !== "ready" || !profile.avatarKey) {
    return { ok: false, error: "no_avatar" };
  }

  // Layered look: dress the new garment on top of a previous result, so
  // already-dressed garments stay fixed in the base image.
  let baseResultKey: string | null = null;
  if (baseTryOnId) {
    const baseTryOn = await repos.tryons.getById(baseTryOnId);
    if (
      !baseTryOn ||
      baseTryOn.profileId !== profile.id ||
      baseTryOn.status !== "ready" ||
      !baseTryOn.resultKey
    ) {
      return { ok: false, error: "base_tryon_not_ready" };
    }
    baseResultKey = baseTryOn.resultKey;
  }

  const products: Product[] = [];
  for (const id of productIds.slice(0, 3)) {
    const product = await repos.products.getById(id);
    if (!product) return { ok: false, error: "product_not_found" };
    products.push(product);
  }
  if (products.length === 0) return { ok: false, error: "product_not_found" };

  // Size recommendation applies to the first product that has a size chart.
  const sizedProduct = products.find((p) => p.sizeChart) ?? null;
  const sizeRec =
    sizedProduct?.sizeChart && profile.heightCm && profile.weightKg
      ? recommendSize({
          measurements: {
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            chestCm: profile.chestCm ?? undefined,
            waistCm: profile.waistCm ?? undefined,
            hipsCm: profile.hipsCm ?? undefined,
            inseamCm: profile.inseamCm ?? undefined,
            shouldersCm: profile.shouldersCm ?? undefined,
          },
          fitPreference: profile.fitPreference,
          garmentType: sizedProduct.garmentType,
          sizeChart: sizedProduct.sizeChart,
          sizeChartSource: sizedProduct.sizeChartSource,
        })
      : null;

  const tryon = await repos.tryons.create({
    profileId: profile.id,
    productId: products[0].id,
    productIds: products.map((p) => p.id),
    status: "pending",
    productImageIndex,
    resultKey: null,
    error: null,
    sizeRec,
  });

  runJob(`tryon:${tryon.id}`, async () => {
    try {
      await repos.tryons.update(tryon.id, { status: "processing" });
      const storage = await getStorage();
      const ai = await getAi();

      // Base image: a previous try-on result when layering, otherwise the
      // user's original uploaded photo. Profiles created before this change
      // may have a stale demo-SVG avatarKey, which Gemini rejects as input —
      // the photo keys are always real.
      const baseKey =
        baseResultKey ?? profile.photoKeys[0] ?? profile.avatarKey!;
      const avatar = await storage.get(baseKey);
      if (!avatar) {
        throw new Error(
          "התמונות שלך לא נמצאו באחסון — עברו שוב את בניית הפרופיל והעלו תמונות מחדש"
        );
      }
      if (avatar.contentType.includes("svg")) {
        throw new Error(
          "הפרופיל נוצר במצב הדגמה — יש להעלות תמונות מחדש דרך עדכון פרופיל"
        );
      }

      // One image per garment, in order. Every garment must have an image —
      // dressing "blind" produces made-up clothes.
      const productImages: ImageInput[] = [];
      const garments: GarmentRef[] = [];
      for (const [i, product] of products.entries()) {
        const image = await fetchProductImage(
          product,
          i === 0 ? productImageIndex : 0,
          storage
        );
        if (!image) {
          throw new Error(
            `לא הצלחנו למשוך את התמונה של "${product.title}" — נסו להעלות צילום מסך של המוצר`
          );
        }
        productImages.push(image);
        garments.push({
          title: product.title,
          garmentType: product.garmentType,
          color: product.colors[0] ?? null,
        });
      }

      // The chosen size's chart row + the wearer's own measurements let the
      // prompt describe the exact fit instead of guessing.
      const chosenRow =
        sizeRec && sizedProduct
          ? (sizedProduct.sizeChart?.rows.find((r) => r.label === sizeRec.size)
              ?.values ?? null)
          : null;
      const userMeasurements: Partial<Record<string, number>> = {};
      for (const [key, value] of Object.entries({
        chest: profile.chestCm,
        waist: profile.waistCm,
        hips: profile.hipsCm,
        inseam: profile.inseamCm,
        shoulders: profile.shouldersCm,
        height: profile.heightCm,
      })) {
        if (value != null) userMeasurements[key] = value;
      }

      const result = await ai.generateTryOn(
        { data: avatar.data, mimeType: avatar.contentType },
        productImages,
        {
          garments,
          isLayered: baseResultKey !== null,
          size: sizeRec?.size ?? null,
          sizeGarmentTitle: sizedProduct?.title ?? null,
          sizeRow: chosenRow,
          userMeasurements: Object.keys(userMeasurements).length
            ? userMeasurements
            : null,
        }
      );

      const ext = MIME_TO_EXT[result.mimeType] ?? ".png";
      const resultKey = await storage.put(
        `${profile.uid}/tryons/${tryon.id}${ext}`,
        result.data,
        result.mimeType
      );

      await repos.tryons.update(tryon.id, { status: "ready", resultKey });
    } catch (err) {
      await repos.tryons.update(tryon.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  return { ok: true, tryon };
}
