import { createHash } from "node:crypto";
import { getRepos } from "../adapters/db";
import { scrapeProduct } from "../scraper";
import type { Product } from "../types";

function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  // Strip common tracking params so the cache hits across shares.
  for (const p of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|ref$|mc_)/.test(p)) url.searchParams.delete(p);
  }
  return url.toString();
}

export async function ingestProduct(rawUrl: string): Promise<Product> {
  const url = normalizeUrl(rawUrl);
  const urlHash = createHash("sha256").update(url).digest("hex");

  const repos = await getRepos();
  const cached = await repos.products.getByUrlHash(urlHash);
  if (cached) return cached;

  const scraped = await scrapeProduct(url);
  return repos.products.create({
    url,
    urlHash,
    store: new URL(url).hostname.replace(/^www\./, ""),
    ...scraped,
  });
}
