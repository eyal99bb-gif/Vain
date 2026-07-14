import type { Candle, Interval } from "./types";

/** Aggregate daily candles into weekly/monthly buckets (UTC boundaries). */
export function resample(daily: Candle[], interval: Interval): Candle[] {
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
