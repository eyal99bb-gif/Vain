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

      // Base image: prefer the user's original uploaded photo. Profiles
      // created before this change may have a stale demo-SVG avatarKey,
      // which Gemini rejects as input — the photo keys are always real.
      const baseKey = profile.photoKeys[0] ?? profile.avatarKey!;
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

      // Product images are remote URLs (demo fixture products have none).
      // Store CDNs may bot-block plain fetches, so send browser-like headers
      // and fall back across the product's images.
      let productImage: { data: Buffer; mimeType: string } | null = null;
      const candidates = [
        product.images[productImageIndex],
        ...product.images,
      ].filter((u): u is string => !!u);
      for (const imageUrl of [...new Set(candidates)].slice(0, 3)) {
        try {
          const res = await fetch(imageUrl, {
            signal: AbortSignal.timeout(10_000),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
              Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
              Referer: product.url,
            },
          });
          const type = res.headers.get("content-type") ?? "";
          if (res.ok && type.startsWith("image/") && !type.includes("svg")) {
            productImage = {
              data: Buffer.from(await res.arrayBuffer()),
              mimeType: type,
            };
            break;
          }
        } catch {
          // try the next image
        }
      }
      if (!productImage && product.images.length > 0) {
        throw new Error(
          "לא הצלחנו למשוך את תמונת המוצר מהחנות — נסו מוצר אחר"
        );
      }

      // The chosen size's chart row + the wearer's own measurements let the
      // prompt describe the exact fit instead of guessing.
      const chosenRow = sizeRec
        ? (product.sizeChart?.rows.find((r) => r.label === sizeRec.size)
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
        productImage ?? { data: avatar.data, mimeType: avatar.contentType },
        {
          productTitle: product.title,
          garmentType: product.garmentType,
          size: sizeRec?.size ?? null,
          color: product.colors[0] ?? null,
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
