// Server-side (Node/GitHub Actions) data fetching for STOCKS — stooq CSV
// with a Yahoo chart fallback. The browser build cannot use these (CORS);
// the scanner and trader run on Actions runners where both work.

import { resample } from "./resample";
import type { Candle, Interval, PriceSeries } from "./types";

const STOOQ: Record<string, string> = { SPY: "spy.us", QQQ: "qqq.us" };
const YAHOO: Record<string, string> = { SPY: "SPY", QQQ: "QQQ" };

async function text(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (VainTradingBot)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fromStooq(sym: string): Promise<Candle[]> {
  const csv = await text(`https://stooq.com/q/d/l/?s=${sym}&i=d`);
  const lines = csv.trim().split("\n").slice(1);
  if (lines.length < 100) throw new Error("stooq: short response");
  return lines
    .map((ln) => ln.split(","))
    .filter((p) => p.length >= 5 && !Number.isNaN(Number(p[4])))
    .map((p) => ({
      t: Date.parse(p[0]),
      o: Number(p[1]),
      h: Number(p[2]),
      l: Number(p[3]),
      c: Number(p[4]),
      v: Number(p[5] ?? 0),
    }))
    .slice(-2600);
}

interface YahooChart {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }>;
      };
    }>;
  };
}

async function fromYahoo(sym: string): Promise<Candle[]> {
  const data = JSON.parse(
    await text(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=10y&interval=1d`),
  ) as YahooChart;
  const r = data.chart.result[0];
  const q = r.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.close[i] == null) continue;
    out.push({
      t: r.timestamp[i] * 1000,
      o: q.open[i],
      h: q.high[i],
      l: q.low[i],
      c: q.close[i],
      v: q.volume[i] ?? 0,
    });
  }
  return out;
}

/** live daily (or resampled) stock series; throws if all sources fail */
export async function fetchStockServer(assetId: string, interval: Interval): Promise<PriceSeries> {
  let candles: Candle[] | null = null;
  let source: PriceSeries["source"] = "stooq";
  try {
    candles = await fromStooq(STOOQ[assetId]);
  } catch {
    candles = await fromYahoo(YAHOO[assetId]);
    source = "yahoo";
  }
  return {
    symbol: assetId,
    kind: "stock",
    interval,
    candles: resample(candles, interval),
    source,
    fetchedAt: Date.now(),
  };
}

export const SERVER_STOCKS = Object.keys(STOOQ);
