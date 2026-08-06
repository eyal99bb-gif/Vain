import { getAi } from "../adapters/ai";
import type { GarmentRef, ImageInput } from "../adapters/ai";
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import type { StorageAdapter } from "../adapters/storage";
import { normalizeImage } from "../images";
import { BROWSER_HEADERS, safeFetch } from "../net";
import { logError, logWarn } from "../log";
import { runJob } from "../jobs";
import { recommendSize } from "../sizing/recommend";
import { calibrationShiftCm } from "../sizing/calibrate";
import type { Product, Profile, TryOn } from "../types";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export interface TryOnView {
  id: string;
  status: TryOn["status"];
  resultUrl: string | null;
  sizeRec: TryOn["sizeRec"];
  error: string | null;
}

/** A job killed mid-flight (platform timeout) never runs its own catch. */
const STUCK_AFTER_MS = 3 * 60 * 1000;

/**
 * Mark abandoned jobs failed on read. Serverless functions can be killed
 * while `after()` work is still running, which would otherwise leave the row
 * spinning in `processing` forever.
 */
export async function reapIfStuck(tryon: TryOn): Promise<TryOn> {
  if (tryon.status !== "processing") return tryon;
  const startedAt = Date.parse(tryon.processingStartedAt ?? tryon.updatedAt);
  if (Number.isNaN(startedAt) || Date.now() - startedAt < STUCK_AFTER_MS) {
    return tryon;
  }
  const repos = await getRepos();
  logWarn("tryon.stuck", { tryonId: tryon.id });
  return (
    (await repos.tryons.update(tryon.id, {
      status: "failed",
      error: "ההדמיה נקטעה באמצע — נסו שוב.",
    })) ?? tryon
  );
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
      // safeFetch blocks private addresses: these URLs come from scraped
      // pages and from the model, so they are not trusted input.
      const res = await safeFetch(imageUrl, {
        timeoutMs: 10_000,
        maxBytes: 8 * 1024 * 1024,
        headers: {
          ...BROWSER_HEADERS,
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          Referer: product.url || imageUrl,
        },
      });
      if (res.ok && res.body.length > 0) {
        return await normalizeImage(res.body);
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
  // Past "it ran small/large" reports shift the target for this profile.
  const history = await repos.feedback.listByProfile(profile.id);
  const calibrationCm = sizedProduct
    ? calibrationShiftCm(history, sizedProduct.garmentType)
    : 0;
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
          calibrationCm,
        })
      : null;

  const tryon = await repos.tryons.create({
    profileId: profile.id,
    productId: products[0].id,
    productIds: products.map((p) => p.id),
    status: "pending",
    productImageIndex,
    isFavorite: false,
    processingStartedAt: null,
    resultKey: null,
    error: null,
    sizeRec,
  });

  runJob(`tryon:${tryon.id}`, async () => {
    try {
      await repos.tryons.update(tryon.id, {
        status: "processing",
        processingStartedAt: new Date().toISOString(),
      });
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
      // Cap the billed pixels: model input is priced by image size.
      const baseImage = await normalizeImage(avatar.data);

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
        baseImage,
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
      const message = err instanceof Error ? err.message : "unknown";
      // Hebrew messages are written for the user; anything else is internal
      // and must not leak provider/connection details to the client.
      const userSafe = /[\u0590-\u05FF]/.test(message);
      const errorId = logError("tryon.job", err, { tryonId: tryon.id });
      await repos.tryons.update(tryon.id, {
        status: "failed",
        error: userSafe
          ? message
          : `ההדמיה נכשלה. קוד שגיאה: ${errorId}`,
      });
    }
  });

  return { ok: true, tryon };
}
