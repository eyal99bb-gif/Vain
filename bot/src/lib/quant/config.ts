import type { AssetKind, EngineConfig, Interval } from "./types";

export interface AssetDef {
  /** id used in the API and UI */
  id: string;
  label: string; // Hebrew
  kind: AssetKind;
  /** Binance symbol (crypto) */
  binance?: string;
  /** stooq symbol (stocks) */
  stooq?: string;
  /** Yahoo symbol (stocks fallback) */
  yahoo?: string;
}

export const ASSETS: AssetDef[] = [
  { id: "BTC", label: "ביטקוין", kind: "crypto", binance: "BTCUSDT" },
  { id: "ETH", label: "את'ריום", kind: "crypto", binance: "ETHUSDT" },
  { id: "SOL", label: "סולאנה", kind: "crypto", binance: "SOLUSDT" },
  { id: "SPY", label: "S&P 500 (SPY)", kind: "stock", stooq: "spy.us", yahoo: "SPY" },
  { id: "QQQ", label: "נאסד\"ק 100 (QQQ)", kind: "stock", stooq: "qqq.us", yahoo: "QQQ" },
];

/**
 * Engine parameters per asset kind + interval. Crypto thresholds are wider
 * (~3-4x equity volatility) and crypto trades 365 days a year.
 */
export function configFor(kind: AssetKind, interval: Interval): EngineConfig {
  const crypto = kind === "crypto";
  const PPY: Record<Interval, number> = {
    "15m": crypto ? 35040 : 6552,
    "1h": crypto ? 8760 : 1638,
    "1d": crypto ? 365 : 252,
    "1w": 52,
    "1M": 12,
  };
  const ppy = PPY[interval];
  const window = interval === "1w" ? 4 : interval === "1M" ? 1 : 20;
  // state thresholds scale with the window's typical move length
  const THR: Record<Interval, number> = {
    "15m": crypto ? 0.015 : 0.008,
    "1h": crypto ? 0.03 : 0.015,
    "1d": crypto ? 0.1 : 0.05,
    "1w": crypto ? 0.1 : 0.05,
    "1M": crypto ? 0.1 : 0.05,
  };
  const bullThr = THR[interval];
  // ~3 years of warmup on daily; half the series on shorter frames
  const warmup =
    interval === "1w" ? 120 : interval === "1M" ? 36 : 500;
  return {
    kind,
    interval,
    ppy,
    window,
    bullThr,
    bearThr: -bullThr,
    warmup,
    costBps: crypto ? 10 : 2,
    targetVol: crypto ? 0.2 : 0.1,
    cap: 1.0,
  };
}
