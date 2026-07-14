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
  const ppy = interval === "1d" ? (crypto ? 365 : 252) : interval === "1w" ? 52 : 12;
  const window = interval === "1d" ? 20 : interval === "1w" ? 4 : 1;
  const bullThr = crypto ? 0.1 : 0.05;
  // ~3 years of warmup, but never more than leaves too little to trade
  const warmup = interval === "1d" ? 500 : interval === "1w" ? 120 : 36;
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
