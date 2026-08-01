import { getAi } from "../adapters/ai";
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import { runJob } from "../jobs";
import { recommendSize } from "../sizing/recommend";
import type { Profile, TryOn } from "../types";

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
 * Create a try-on: the size recommendation is computed synchronously (pure
 * function — the size answer never waits on Gemini); image generation runs
 * as a post-response job.
 */
export async function startTryOn(
  profile: Profile,
  productId: string,
  productImageIndex: number
): Promise<{ ok: true; tryon: TryOn } | { ok: false; error: string }> {
  const repos = await getRepos();

  if (profile.avatarStatus !== "ready" || !profile.avatarKey) {
    return { ok: false, error: "no_avatar" };
  }
  const product = await repos.products.getById(productId);
  if (!product) return { ok: false, error: "product_not_found" };

  const sizeRec =
    product.sizeChart && profile.heightCm && profile.weightKg
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
          garmentType: product.garmentType,
          sizeChart: product.sizeChart,
          sizeChartSource: product.sizeChartSource,
        })
      : null;

  const tryon = await repos.tryons.create({
    profileId: profile.id,
    productId,
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

      const avatar = await storage.get(profile.avatarKey!);
      if (!avatar) throw new Error("avatar missing from storage");

      // Product images are remote URLs; demo fixture products have none.
      let productImage: { data: Buffer; mimeType: string } | null = null;
      const imageUrl = product.images[productImageIndex] ?? product.images[0];
      if (imageUrl) {
        const res = await fetch(imageUrl, {
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          productImage = {
            data: Buffer.from(await res.arrayBuffer()),
            mimeType: res.headers.get("content-type") ?? "image/jpeg",
          };
        }
      }

      const result = await ai.generateTryOn(
        { data: avatar.data, mimeType: avatar.contentType },
        productImage ?? { data: avatar.data, mimeType: avatar.contentType },
        {
          productTitle: product.title,
          garmentType: product.garmentType,
          size: sizeRec?.size ?? null,
          color: product.colors[0] ?? null,
        }
      );

      const ext = MIME_TO_EXT[result.mimeType] ?? ".png";
      const resultKey = `${profile.uid}/tryons/${tryon.id}${ext}`;
      await storage.put(resultKey, result.data, result.mimeType);

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
