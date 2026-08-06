// Locate "size guide" links on a product page — most stores keep the size
// chart behind a click (modal or separate page).
import type { CheerioAPI } from "cheerio";

const GUIDE_RE =
  /מדריך\s*מידות|טבלת\s*המידות|טבלת\s*מידות|size\s*guide|size\s*chart|sizing\s*(guide|chart)|fit\s*guide|measurement\s*(guide|chart)/i;

const MULTI_PART_SUFFIXES =
  /\.(co|com|net|org|ac|gov|muni|idf|k12)\.[a-z]{2}$/i;

/** Registrable domain: example.co.il -> example.co.il, not co.il. */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split(".");
  const take = MULTI_PART_SUFFIXES.test(hostname) ? 3 : 2;
  return labels.slice(-take).join(".");
}

function sameSite(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}

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
      // Multi-part public suffixes (co.il, com.au…) need three labels, or
      // "example.co.il" collapses to "co.il" and matches every Israeli store.
      if (!sameSite(base.hostname, abs.hostname)) return;
      abs.hash = "";
      found.add(abs.toString());
    } catch {
      // unparsable href — skip
    }
  });

  return [...found].slice(0, 3);
}
