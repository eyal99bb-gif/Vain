// Event-driven, trade-by-trade backtest — the honest way to compare EXIT
// styles and entry selectivity. Signals are precomputed walk-forward
// (prefix-only ensembleAt calls), so nothing here can look ahead.
// Equity assumes a fixed 1% of account risked per trade (1R = 1%), the
// standard way to compare trade quality independent of sizing.

import { ensembleAt } from "./ensemble";
import { EXIT } from "./exits";
import { currentAtr } from "./signals";
import { maxDrawdown } from "./indicators";
import type { Candle, EngineConfig } from "./types";

export type ExitStyle = "signal" | "stop" | "ladder";

export interface TradeStyleReport {
  style: ExitStyle;
  minConviction: number;
  trades: number;
  winRate: number;
  avgR: number;
  profitFactor: number;
  maxDrawdown: number;
}

interface Sig {
  dir: -1 | 0 | 1;
  conviction: number;
}

/** walk-forward signal series, computed once and shared across styles */
export function signalSeries(candles: Candle[], cfg: EngineConfig): Sig[] {
  const out: Sig[] = [];
  for (let t = cfg.warmup; t < candles.length; t++) {
    const e = ensembleAt(candles, t, cfg);
    out.push({ dir: e.direction, conviction: e.conviction });
  }
  return out;
}

export function tradeBacktest(
  candles: Candle[],
  cfg: EngineConfig,
  sigs: Sig[],
  style: ExitStyle,
  minConviction = 0,
): TradeStyleReport {
  const n = candles.length;
  // round-trip cost in R units per unit traded (entry+exit fills)
  const rs: number[] = [];
  let open: {
    entry: number;
    dir: 1 | -1;
    rUnit: number;
    stop: number;
    best: number;
    breakeven: boolean;
    partialR: number | null;
  } | null = null;

  const costR = (entry: number, rUnit: number) =>
    ((cfg.costBps / 1e4) * 2 * entry) / rUnit;

  const closeTrade = (exitR: number) => {
    if (!open) return;
    const frac = open.partialR !== null ? 1 - EXIT.PARTIAL_FRAC : 1;
    const partial = open.partialR !== null ? EXIT.PARTIAL_FRAC * open.partialR : 0;
    rs.push(partial + frac * exitR - costR(open.entry, open.rUnit));
    open = null;
  };

  for (let t = cfg.warmup; t < n; t++) {
    const sig = sigs[t - cfg.warmup];
    const c = candles[t].c;

    if (open) {
      const r = (open.dir * (c - open.entry)) / open.rUnit;
      const hitStop =
        style !== "signal" && open.dir * (c - open.stop) <= 0;
      const flipped =
        style === "ladder" ? sig.dir === -open.dir : sig.dir !== open.dir;
      if (hitStop) {
        closeTrade((open.dir * (open.stop - open.entry)) / open.rUnit);
      } else if (flipped) {
        closeTrade(r);
      } else if (style === "ladder") {
        if (open.dir * (c - open.best) > 0) open.best = c;
        if (!open.breakeven && r >= EXIT.BE_AT_R) {
          open.breakeven = true;
          open.stop =
            open.dir > 0 ? Math.max(open.stop, open.entry) : Math.min(open.stop, open.entry);
        }
        if (open.partialR === null && r >= EXIT.PARTIAL_AT_R) open.partialR = r;
        const trail = open.best - open.dir * EXIT.TRAIL_ATR * (open.rUnit / EXIT.STOP_ATR);
        open.stop = open.dir > 0 ? Math.max(open.stop, trail) : Math.min(open.stop, trail);
      }
    }

    if (!open && sig.dir !== 0 && sig.conviction >= minConviction && t < n - 1) {
      const a = currentAtr(candles, t, cfg);
      if (a > 0) {
        open = {
          entry: c,
          dir: sig.dir,
          rUnit: EXIT.STOP_ATR * a,
          stop: c - sig.dir * EXIT.STOP_ATR * a,
          best: c,
          breakeven: false,
          partialR: null,
        };
      }
    }
  }
  if (open !== null) {
    const o: { entry: number; dir: 1 | -1; rUnit: number } = open;
    const c = candles[n - 1].c;
    closeTrade((o.dir * (c - o.entry)) / o.rUnit);
  }

  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);
  const equity: number[] = [];
  let e = 1;
  for (const r of rs) {
    e *= 1 + 0.01 * r; // 1% of account risked per trade
    equity.push(e);
  }
  return {
    style,
    minConviction,
    trades: rs.length,
    winRate: rs.length ? wins.length / rs.length : 0,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
    profitFactor:
      losses.length && wins.length
        ? wins.reduce((a, b) => a + b, 0) / -losses.reduce((a, b) => a + b, 0)
        : wins.length
          ? Infinity
          : 0,
    maxDrawdown: equity.length ? maxDrawdown(equity) : 0,
  };
}

/** the honest comparison table: three exit styles + selective-entry ladder */
export function compareExitStyles(candles: Candle[], cfg: EngineConfig): TradeStyleReport[] {
  const sigs = signalSeries(candles, cfg);
  return [
    tradeBacktest(candles, cfg, sigs, "signal", 0),
    tradeBacktest(candles, cfg, sigs, "stop", 0),
    tradeBacktest(candles, cfg, sigs, "ladder", 0),
    tradeBacktest(candles, cfg, sigs, "ladder", 0.35),
  ];
}
