// Demo AI adapter (no GEMINI_API_KEY): canned images after a realistic delay
// so the async job flow and progress UI behave like the real thing.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScrapedProduct } from "../../types";
import type { AiAdapter, GeneratedImage } from "./types";

const FIXTURES_DIR = path.join(
  process.cwd(),
  "src/lib/mida/adapters/ai/fixtures"
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fixture(name: string): Promise<GeneratedImage> {
  const data = await readFile(path.join(FIXTURES_DIR, name));
  return { data, mimeType: "image/svg+xml" };
}

export const DEMO_PRODUCT: ScrapedProduct = {
  title: "חולצת טי בייסיק — כותנה אורגנית",
  price: 89.9,
  currency: "ILS",
  images: [],
  colors: ["לבן", "שחור", "כחול נייבי"],
  garmentType: "top",
  sizeChart: {
    unit: "cm",
    rows: [
      { label: "S", values: { chest: { min: 88, max: 93 }, waist: { min: 72, max: 77 }, shoulders: { min: 42, max: 44 } } },
      { label: "M", values: { chest: { min: 94, max: 99 }, waist: { min: 78, max: 83 }, shoulders: { min: 44, max: 46 } } },
      { label: "L", values: { chest: { min: 100, max: 105 }, waist: { min: 84, max: 89 }, shoulders: { min: 46, max: 48 } } },
      { label: "XL", values: { chest: { min: 106, max: 112 }, waist: { min: 90, max: 97 }, shoulders: { min: 48, max: 50 } } },
    ],
  },
  sizeChartSource: "html-table",
  warnings: [],
};

export function createDemoAdapter(): AiAdapter {
  return {
    async generateAvatar() {
      await sleep(2500);
      return fixture("avatar.svg");
    },
    async generateTryOn() {
      await sleep(3500);
      return fixture("tryon.svg");
    },
    async extractProduct() {
      // Demo mode has no LLM; the scraper falls back to the fixture product.
      return {};
    },
    async extractProductFromUrl() {
      return {};
    },
    async describeGarmentImage() {
      return {};
    },
  };
}
