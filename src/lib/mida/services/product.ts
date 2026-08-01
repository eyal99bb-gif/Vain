import { createHash } from "node:crypto";
import { getRepos } from "../adapters/db";
import { scrapeProduct } from "../scraper";
import type { Product } from "../types";

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
  const url = normalizeUrl(rawUrl);
  const urlHash = createHash("sha256").update(url).digest("hex");

  const repos = await getRepos();
  const cached = await repos.products.getByUrlHash(urlHash);
  // Serve the cache only for real products; a cached fixture means an earlier
  // scrape failed, so retry it (e.g. after a scraper fix or a transient block).
  if (cached && !isFixture(cached)) return cached;

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
