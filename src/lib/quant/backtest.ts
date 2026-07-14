// Walk-forward backtester — a faithful port of walk_forward() from the
// validated Python skill (markov2.py). The engine never sees the bars it is
// trading: everything at bar t is computed from candles[0..t] only.

import { maxDrawdown } from "./indicators";
import { labelStates, signalFrom, transitionMatrix } from "./markov";
import { ensembleAt } from "./ensemble";
import type { BacktestReport, Candle, EngineConfig } from "./types";

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Generic walk-forward loop. `positionAt(t)` must return the position held
 * from bar t's close to bar t+1's close, using only information up to t.
 */
export function walkForward(
  candles: Candle[],
  cfg: EngineConfig,
  positionAt: (t: number) => number,
): BacktestReport {
  const px = candles.map((c) => c.c);
  const n = px.length;
  const barRet: number[] = [];
  for (let i = 0; i < n - 1; i++) barRet.push(px[i + 1] / px[i] - 1);

  const pos = new Array<number>(n).fill(0);
  for (let t = cfg.warmup; t < n - 1; t++) pos[t] = positionAt(t);

  const cost = cfg.costBps / 1e4;
  const stratFull: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dPos = Math.abs(pos[i] - (i > 0 ? pos[i - 1] : 0));
    stratFull.push(pos[i] * barRet[i] - dPos * cost);
  }
  const strat = stratFull.slice(cfg.warmup);
  const bench = barRet.slice(cfg.warmup);

  const equity: number[] = [];
  const benchEquity: number[] = [];
  let e = 1;
  let b = 1;
  for (let i = 0; i < strat.length; i++) {
    e *= 1 + strat[i];
    b *= 1 + bench[i];
    equity.push(e);
    benchEquity.push(b);
  }

  const active = strat.filter((_, i) => pos[cfg.warmup + i] !== 0);
  const gains = active.filter((x) => x > 0).reduce((a, x) => a + x, 0);
  const losses = -active.filter((x) => x < 0).reduce((a, x) => a + x, 0);
  const years = strat.length / cfg.ppy;
  const mean = strat.reduce((a, x) => a + x, 0) / (strat.length || 1);
  const sd = Math.sqrt(
    strat.reduce((a, x) => a + (x - mean) ** 2, 0) / (strat.length || 1),
  );

  return {
    winRate: active.length ? active.filter((x) => x > 0).length / active.length : 0,
    profitFactor: losses > 0 ? gains / losses : gains > 0 ? Infinity : 0,
    maxDrawdown: maxDrawdown(equity),
    cagr: years > 0 && equity.length ? equity[equity.length - 1] ** (1 / years) - 1 : 0,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(cfg.ppy) : 0,
    exposure: strat.length
      ? strat.filter((_, i) => pos[cfg.warmup + i] !== 0).length / strat.length
      : 0,
    equity,
    benchEquity,
    dates: candles.slice(cfg.warmup + 1).map((c) => c.t),
    bars: strat.length,
  };
}

/**
 * Markov-only STANDALONE strategy — the exact Python skill behaviour
 * (signal_ref 0.5, matrix refit every `window` bars, stride sampling).
 * Used by the parity test that pins this port to the Python results.
 */
export function backtestMarkovOnly(candles: Candle[], cfg: EngineConfig): BacktestReport {
  const closes = candles.map((c) => c.c);
  const states = labelStates(closes, cfg.window, cfg.bullThr, cfg.bearThr);
  let mat: number[][] | null = null;
  return walkForward(candles, cfg, (t) => {
    if (mat === null || (t - cfg.warmup) % cfg.window === 0)
      mat = transitionMatrix(states.slice(0, t + 1), cfg.window).matrix;
    const s = states[t];
    if (s === null) return 0;
    return clip(signalFrom(mat, s) / 0.5, -1, 1) * cfg.cap;
  });
}

/** The full ensemble strategy — what the dashboard trades on paper. */
export function backtestEnsemble(candles: Candle[], cfg: EngineConfig): BacktestReport {
  return walkForward(candles, cfg, (t) => ensembleAt(candles, t, cfg).positionFrac);
}
