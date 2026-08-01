// Locate "size guide" links on a product page — most stores keep the size
// chart behind a click (modal or separate page).
import type { CheerioAPI } from "cheerio";

const GUIDE_RE =
  /מדריך\s*מידות|טבלת\s*המידות|טבלת\s*מידות|size\s*guide|size\s*chart|sizing\s*(guide|chart)|fit\s*guide|measurement\s*(guide|chart)/i;

export function findSizeGuideLinks($: CheerioAPI, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const found = new Set<string>();

  $("a[href], [data-href], link[href]").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") ?? $el.attr("data-href") ?? "";
    const text = `${$el.text()} ${$el.attr("title") ?? ""} ${$el.attr("aria-label") ?? ""}`;
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (!GUIDE_RE.test(text) && !GUIDE_RE.test(href)) return;
    try {
      const abs = new URL(href, base);
      if (!/^https?:$/.test(abs.protocol)) return;
      // Same site only (subdomains allowed) — guides never live off-site.
      const root = base.hostname.split(".").slice(-2).join(".");
      if (!abs.hostname.endsWith(root)) return;
      abs.hash = "";
      found.add(abs.toString());
    } catch {
      // unparsable href — skip
    }
  });

  return [...found].slice(0, 3);
}
