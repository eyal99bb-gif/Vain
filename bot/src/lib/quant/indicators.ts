import type { Candle } from "./types";

/** simple return over `k` bars ending at index i: p[i]/p[i-k] - 1 */
export function kBarReturn(closes: number[], i: number, k: number): number | null {
  if (i - k < 0) return null;
  return closes[i] / closes[i - k] - 1;
}

export function sma(values: number[], period: number, i: number): number | null {
  if (i - period + 1 < 0) return null;
  let s = 0;
  for (let j = i - period + 1; j <= i; j++) s += values[j];
  return s / period;
}

export function stdev(values: number[], from: number, to: number): number {
  // population std (ddof=0), matching numpy's default
  const n = to - from + 1;
  if (n <= 0) return 0;
  let mean = 0;
  for (let j = from; j <= to; j++) mean += values[j];
  mean /= n;
  let ss = 0;
  for (let j = from; j <= to; j++) ss += (values[j] - mean) ** 2;
  return Math.sqrt(ss / n);
}

/** average true range over `period` bars ending at i, as a PRICE (not %) */
export function atr(candles: Candle[], period: number, i: number): number | null {
  if (i - period + 1 < 1) return null;
  let s = 0;
  for (let j = i - period + 1; j <= i; j++) {
    const tr = Math.max(
      candles[j].h - candles[j].l,
      Math.abs(candles[j].h - candles[j - 1].c),
      Math.abs(candles[j].l - candles[j - 1].c),
    );
    s += tr;
  }
  return s / period;
}

/** annualized realized volatility of the `lookback` bars ending at i */
export function realizedVol(
  closes: number[],
  lookback: number,
  ppy: number,
  i: number,
): number | null {
  if (i - lookback < 0) return null;
  const rets: number[] = [];
  for (let j = i - lookback + 1; j <= i; j++) rets.push(closes[j] / closes[j - 1] - 1);
  const sd = stdev(rets, 0, rets.length - 1);
  return sd * Math.sqrt(ppy);
}

/** z-score of closes[i] against the mean/std of the `period` bars ending at i */
export function zScore(closes: number[], period: number, i: number): number | null {
  const m = sma(closes, period, i);
  if (m === null) return null;
  const sd = stdev(closes, i - period + 1, i);
  if (sd === 0) return 0;
  return (closes[i] - m) / sd;
}

export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = e / peak - 1;
    if (dd < worst) worst = dd;
  }
  return worst;
}
