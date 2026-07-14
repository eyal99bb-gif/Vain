// Browser-side data fetching for the static (GitHub Pages) build.
// Crypto is LIVE: Binance's public API allows cross-origin requests with no
// key; CoinGecko is the fallback. Stocks have no CORS-friendly free source,
// so on this static build they return the fixture immediately — with the
// explicit source:"fixture" flag the dashboard turns into a red banner.

import { ASSETS } from "./config";
import { fixtureFor } from "./fixtures";
import type { Candle, Interval, PriceSeries } from "./types";

const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://data-api.binance.vision",
];

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function resample(daily: Candle[], interval: Interval): Candle[] {
  if (interval === "1d") return daily;
  const out: Candle[] = [];
  let bucket: Candle | null = null;
  let key = "";
  for (const c of daily) {
    const d = new Date(c.t);
    const k =
      interval === "1M"
        ? `${d.getUTCFullYear()}-${d.getUTCMonth()}`
        : `${d.getUTCFullYear()}-w${Math.floor((c.t / 86400000 + 4) / 7)}`;
    if (k !== key) {
      if (bucket) out.push(bucket);
      bucket = { ...c };
      key = k;
    } else if (bucket) {
      bucket.h = Math.max(bucket.h, c.h);
      bucket.l = Math.min(bucket.l, c.l);
      bucket.c = c.c;
      bucket.v += c.v;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

async function fromBinance(symbol: string, interval: Interval): Promise<Candle[]> {
  let lastErr: unknown;
  for (const host of BINANCE_HOSTS) {
    try {
      const rows = (await getJson(
        `${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`,
      )) as unknown[][];
      return rows.map((r) => ({
        t: Number(r[0]),
        o: Number(r[1]),
        h: Number(r[2]),
        l: Number(r[3]),
        c: Number(r[4]),
        v: Number(r[5]),
      }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function fromCoinGecko(assetId: string, interval: Interval): Promise<Candle[]> {
  const id = COINGECKO_IDS[assetId];
  if (!id) throw new Error("no coingecko id");
  // 365 daily OHLC points, no volume (the engine does not use volume)
  const rows = (await getJson(
    `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=365`,
  )) as number[][];
  const daily: Candle[] = rows.map((r) => ({
    t: r[0],
    o: r[1],
    h: r[2],
    l: r[3],
    c: r[4],
    v: 0,
  }));
  return resample(daily, interval);
}

export async function fetchSeries(assetId: string, interval: Interval): Promise<PriceSeries> {
  const asset = ASSETS.find((a) => a.id === assetId);
  if (!asset) throw new Error("unknown asset");

  if (asset.kind === "stock") {
    const fix = fixtureFor(asset.id, interval);
    fix.fixtureNote =
      "מניות ומדדים דורשים שרת ואינם חיים בגרסה הסטטית — הנתונים כאן הם דוגמה בלבד";
    return fix;
  }

  const errors: string[] = [];
  if (asset.binance) {
    try {
      const candles = await fromBinance(asset.binance, interval);
      if (candles.length > 50)
        return {
          symbol: asset.id,
          kind: asset.kind,
          interval,
          candles,
          source: "binance",
          fetchedAt: Date.now(),
        };
      errors.push("binance: short response");
    } catch (e) {
      errors.push(`binance: ${e}`);
    }
  }
  try {
    const candles = await fromCoinGecko(asset.id, interval);
    if (candles.length > 50)
      return {
        symbol: asset.id,
        kind: asset.kind,
        interval,
        candles,
        // typed as yahoo-slot reuse would lie; extend union instead
        source: "coingecko",
        fetchedAt: Date.now(),
      };
    errors.push("coingecko: short response");
  } catch (e) {
    errors.push(`coingecko: ${e}`);
  }

  const fix = fixtureFor(asset.id, interval);
  fix.fixtureNote = `${fix.fixtureNote ?? ""} (מקורות חיים לא זמינים: ${errors.join(" | ")})`;
  return fix;
}
