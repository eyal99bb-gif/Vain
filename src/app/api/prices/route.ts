// GET /api/prices?asset=BTC&interval=1d
// Fetches candles from free, keyless sources server-side (Binance for crypto,
// stooq → Yahoo for stocks) and normalizes to Candle[]. On total failure the
// bundled fixture is returned with source:"fixture" — the client shows a
// warning banner; fixture data is never silently passed off as live.

import { ASSETS } from "@/lib/quant/config";
import { fixtureFor } from "@/lib/quant/fixtures";
import type { Candle, Interval, PriceSeries } from "@/lib/quant/types";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: PriceSeries }>();

const INTERVALS: Interval[] = ["1d", "1w", "1M"];

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (VainTradingAdvisor)" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (VainTradingAdvisor)" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

async function fromBinance(symbol: string, interval: Interval): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
  const rows = (await fetchJson(url)) as unknown[][];
  return rows.map((r) => ({
    t: Number(r[0]),
    o: Number(r[1]),
    h: Number(r[2]),
    l: Number(r[3]),
    c: Number(r[4]),
    v: Number(r[5]),
  }));
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
        : // ISO week key
          `${d.getUTCFullYear()}-w${Math.floor((c.t / 86400000 + 4) / 7)}`;
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

async function fromStooq(symbol: string, interval: Interval): Promise<Candle[]> {
  const text = await fetchText(`https://stooq.com/q/d/l/?s=${symbol}&i=d`);
  const lines = text.trim().split("\n").slice(1);
  if (lines.length < 100) throw new Error("stooq: empty/short response");
  const daily: Candle[] = lines
    .map((ln) => ln.split(","))
    .filter((p) => p.length >= 5 && !Number.isNaN(Number(p[4])))
    .map((p) => ({
      t: Date.parse(p[0]),
      o: Number(p[1]),
      h: Number(p[2]),
      l: Number(p[3]),
      c: Number(p[4]),
      v: Number(p[5] ?? 0),
    }));
  return resample(daily.slice(-2600), interval);
}

interface YahooChart {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> };
    }>;
  };
}

async function fromYahoo(symbol: string, interval: Interval): Promise<Candle[]> {
  const yi = interval === "1M" ? "1mo" : interval === "1w" ? "1wk" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=10y&interval=${yi}`;
  const data = (await fetchJson(url)) as YahooChart;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("asset") ?? "BTC";
  const interval = (url.searchParams.get("interval") ?? "1d") as Interval;
  const asset = ASSETS.find((a) => a.id === assetId);
  if (!asset || !INTERVALS.includes(interval)) {
    return Response.json({ error: "unknown asset or interval" }, { status: 400 });
  }

  const key = `${assetId}:${interval}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.data);

  const errors: string[] = [];
  let candles: Candle[] | null = null;
  let source: PriceSeries["source"] = "fixture";

  if (asset.kind === "crypto" && asset.binance) {
    try {
      candles = await fromBinance(asset.binance, interval);
      source = "binance";
    } catch (e) {
      errors.push(String(e));
    }
  } else {
    if (asset.stooq) {
      try {
        candles = await fromStooq(asset.stooq, interval);
        source = "stooq";
      } catch (e) {
        errors.push(String(e));
      }
    }
    if (!candles && asset.yahoo) {
      try {
        candles = await fromYahoo(asset.yahoo, interval);
        source = "yahoo";
      } catch (e) {
        errors.push(String(e));
      }
    }
  }

  let series: PriceSeries;
  if (candles && candles.length > 50) {
    series = {
      symbol: asset.id,
      kind: asset.kind,
      interval,
      candles,
      source,
      fetchedAt: Date.now(),
    };
  } else {
    series = fixtureFor(asset.id, interval);
    series.fixtureNote = `${series.fixtureNote ?? ""} (מקורות חיים לא זמינים: ${errors.join(" | ") || "no data"})`;
  }

  cache.set(key, { at: Date.now(), data: series });
  return Response.json(series);
}
