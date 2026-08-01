// Per-store parser seam. Dedicated parsers slot in here for sites whose
// markup defeats the generic pipeline (bot walls, JS-only size charts).
//
// TODO parsers (Phase 2+): zara.com, asos.com, shein.com, terminalx.com,
// factory54.co.il, next.co.il, castro.com, fox.co.il
import type { CheerioAPI } from "cheerio";
import type { ScrapedProduct } from "../../types";

export interface StoreParser {
  /** e.g. "zara.com" — matched against the end of the hostname. */
  host: string;
  parse($: CheerioAPI, url: string): Partial<ScrapedProduct>;
}

const PARSERS: StoreParser[] = [];

export function matchStore(hostname: string): StoreParser | null {
  return PARSERS.find((p) => hostname.endsWith(p.host)) ?? null;
}
