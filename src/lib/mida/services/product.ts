import { createHash } from "node:crypto";
import { getAi } from "../adapters/ai";
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import { huntSizeChart, scrapeProduct } from "../scraper";
import { assertPublicUrl } from "../net";
import type { GarmentType, Product } from "../types";

function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  // Strip ad/tracking params so the cache hits across shares and ad links.
  for (const p of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|gbraid|wbraid|gad_|ref$|mc_|_branch)/.test(p)) {
      url.searchParams.delete(p);
    }
  }
  return url.toString();
}

/** A product returned as the demo fixture rather than a real scrape. */
function isFixture(product: Product): boolean {
  return product.warnings.includes("scrape_failed_demo_data");
}

export async function ingestProduct(rawUrl: string): Promise<Product> {
  // Reject internal/private targets before any work: this URL is fully
  // user-controlled and the server would otherwise proxy into the network.
  await assertPublicUrl(rawUrl);
  const url = normalizeUrl(rawUrl);
  const urlHash = createHash("sha256").update(url).digest("hex");

  const repos = await getRepos();
  const cached = await repos.products.getByUrlHash(urlHash);
  // Serve the cache only for real products; a cached fixture means an earlier
  // scrape failed, so retry it (e.g. after a scraper fix or a transient block).
  if (cached && !isFixture(cached)) {
    // A saved product without a size chart gets one more hunt per paste —
    // charts usually hide behind a "size guide" click and may appear now.
    if (!cached.sizeChart) {
      const hunted = await huntSizeChart(cached.url, []);
      if (hunted) {
        const updated = await repos.products.update(cached.id, {
          sizeChart: hunted.chart,
          sizeChartSource: hunted.source,
          warnings: cached.warnings.filter((w) => w !== "no_size_chart"),
        });
        return updated ?? cached;
      }
    }
    return cached;
  }

  const scraped = await scrapeProduct(url);

  if (cached) {
    // Refresh the existing fixture row in place so its id stays stable.
    const updated = await repos.products.update(cached.id, {
      store: new URL(url).hostname.replace(/^www\./, ""),
      ...scraped,
    });
    return updated ?? cached;
  }

  return repos.products.create({
    url,
    urlHash,
    store: new URL(url).hostname.replace(/^www\./, ""),
    ...scraped,
  });
}

/**
 * Create a product from a user-uploaded screenshot — the fallback when a
 * store can't be scraped. The screenshot itself is the garment reference
 * image; Gemini (when available) names and classifies it.
 */
export async function createProductFromScreenshot(
  uid: string,
  image: { data: Buffer; mimeType: string; ext: string },
  sourceUrl: string | null
): Promise<Product> {
  const storage = await getStorage();
  const repos = await getRepos();
  const ai = await getAi();

  const key = await storage.put(
    `${uid}/products/${crypto.randomUUID()}${image.ext}`,
    image.data,
    image.mimeType
  );

  const described = await ai
    .describeGarmentImage({ data: image.data, mimeType: image.mimeType })
    .catch(() => ({}) as { title?: string; garmentType?: string; colors?: string[] });

  return repos.products.create({
    url: sourceUrl ?? "",
    // Screenshot uploads are never cache-shared across users.
    urlHash: `screenshot:${crypto.randomUUID()}`,
    store: sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "צילום מסך",
    title: described.title ?? "פריט מצילום מסך",
    price: null,
    currency: null,
    images: [storage.url(key)],
    colors: described.colors ?? [],
    garmentType: (described.garmentType as GarmentType) ?? "unknown",
    sizeChart: null,
    sizeChartSource: "none",
    warnings: [],
  });
}
