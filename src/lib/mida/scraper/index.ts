// Product ingestion pipeline: fetch → store parser → JSON-LD → OG →
// size-chart tables → LLM fallback → demo fixture (never dead-ends).
import * as cheerio from "cheerio";
import { getAi } from "../adapters/ai";
import { midaEnv } from "../env";
import type { ScrapedProduct } from "../types";
import { classifyGarment } from "./garment-type";
import { fetchPage } from "./fetch";
import { parseJsonLd } from "./jsonld";
import { parseOg } from "./og";
import { parseSizeChart } from "./sizechart";
import { matchStore } from "./stores/registry";

function emptyProduct(): ScrapedProduct {
  return {
    title: "",
    price: null,
    currency: null,
    images: [],
    colors: [],
    garmentType: "unknown",
    sizeChart: null,
    sizeChartSource: "none",
    warnings: [],
  };
}

function merge(base: ScrapedProduct, patch: Partial<ScrapedProduct>): void {
  if (patch.title && !base.title) base.title = patch.title;
  if (patch.price != null && base.price == null) base.price = patch.price;
  if (patch.currency && !base.currency) base.currency = patch.currency;
  if (patch.images?.length) {
    base.images = [...new Set([...base.images, ...patch.images])];
  }
  if (patch.colors?.length && base.colors.length === 0) {
    base.colors = patch.colors;
  }
  if (patch.garmentType && patch.garmentType !== "unknown" && base.garmentType === "unknown") {
    base.garmentType = patch.garmentType;
  }
  if (patch.sizeChart && !base.sizeChart) {
    base.sizeChart = patch.sizeChart;
    base.sizeChartSource = patch.sizeChartSource ?? "html-table";
  }
}

async function demoFixture(warning: string): Promise<ScrapedProduct> {
  const { DEMO_PRODUCT } = await import("../adapters/ai/demo");
  return {
    ...DEMO_PRODUCT,
    sizeChart: DEMO_PRODUCT.sizeChart
      ? { ...DEMO_PRODUCT.sizeChart, rows: [...DEMO_PRODUCT.sizeChart.rows] }
      : null,
    warnings: [warning],
  };
}

/** Strip heavy tags and truncate HTML for the LLM fallback. */
function htmlForLlm(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .slice(0, 30_000);
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const outcome = await fetchPage(url);

  // Direct fetch blocked/failed (common on bot-walled Israeli stores): have
  // Gemini fetch the page itself via URL-context before giving up.
  if (!outcome.ok) {
    if (midaEnv.aiMode === "real") {
      const product = emptyProduct();
      try {
        const ai = await getAi();
        merge(product, await ai.extractProductFromUrl(url));
      } catch {
        // fall through to fixture below
      }
      if (product.title) {
        if (product.garmentType === "unknown") {
          product.garmentType = classifyGarment(product.title);
        }
        if (!product.sizeChart) product.warnings.push("no_size_chart");
        return product;
      }
    }
    return demoFixture("scrape_failed_demo_data");
  }

  const $ = cheerio.load(outcome.html);
  const product = emptyProduct();
  const hostname = new URL(url).hostname;

  const storeParser = matchStore(hostname);
  if (storeParser) merge(product, storeParser.parse($, url));

  merge(product, parseJsonLd($));
  merge(product, parseOg($));

  const chart = parseSizeChart($);
  if (chart) {
    merge(product, { sizeChart: chart, sizeChartSource: "html-table" });
  }

  if (product.garmentType === "unknown" && product.title) {
    product.garmentType = classifyGarment(
      `${product.title} ${$("nav, .breadcrumb, [class*=breadcrumb]").text()}`
    );
  }

  // LLM fallback fills whatever structured parsing missed (real mode only).
  const needsLlm =
    !product.title || product.images.length === 0 || !product.sizeChart;
  if (needsLlm && midaEnv.aiMode === "real") {
    try {
      const ai = await getAi();
      merge(product, await ai.extractProduct(htmlForLlm(outcome.html), url));
      // If HTML parsing still found no image (lazy-loaded/JS galleries),
      // let the model fetch the page directly for the real image URLs.
      if (product.images.length === 0) {
        merge(product, await ai.extractProductFromUrl(url));
      }
    } catch {
      product.warnings.push("llm_extraction_failed");
    }
  }

  if (!product.title) {
    return demoFixture("scrape_failed_demo_data");
  }
  if (!product.sizeChart) {
    product.warnings.push("no_size_chart");
  }
  return product;
}
