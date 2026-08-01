// OpenGraph / meta-tag fallback extraction.
import type { CheerioAPI } from "cheerio";
import type { ScrapedProduct } from "../types";

export function parseOg($: CheerioAPI): Partial<ScrapedProduct> {
  const meta = (prop: string) =>
    $(`meta[property="${prop}"], meta[name="${prop}"]`).attr("content")?.trim();

  const result: Partial<ScrapedProduct> = {};

  const title = meta("og:title") ?? $("title").first().text().trim();
  if (title) result.title = title;

  const image = meta("og:image");
  if (image?.startsWith("http")) result.images = [image];

  const rawPrice =
    meta("product:price:amount") ?? meta("og:price:amount");
  if (rawPrice) {
    const price = parseFloat(rawPrice);
    if (Number.isFinite(price)) result.price = price;
  }

  const currency =
    meta("product:price:currency") ?? meta("og:price:currency");
  if (currency) result.currency = currency;

  return result;
}
