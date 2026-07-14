import { realizedVol } from "./indicators";
import {
  currentAtr,
  markovSignal,
  meanRevSignal,
  momentumSignal,
  trendSignal,
  volSignal,
} from "./signals";
import type { Candle, EngineConfig, EnsembleResult } from "./types";

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** direction dead-zone: |score| below this is FLAT — "no trade" is a signal */
export const FLAT_BAND = 0.15;

/**
 * Combine the sub-signals at bar `upto`, using ONLY candles[0..upto].
 * Equal weights for the four directional signals (weights are data we don't
 * have enough of — v1 refuses to pretend otherwise); the volatility signal
 * only scales conviction and position size.
 */
export function ensembleAt(
  candles: Candle[],
  upto: number,
  cfg: EngineConfig,
): EnsembleResult {
  const closes = candles.map((c) => c.c);
  const { sub: markov, report } = markovSignal(closes, upto, cfg);
  const subs = [
    markov,
    momentumSignal(closes, upto, cfg),
    trendSignal(closes, upto, cfg),
    meanRevSignal(closes, upto, cfg),
    volSignal(closes, upto, cfg),
  ];
  const directional = subs.filter((s) => s.id !== "vol");
  const score = directional.reduce((a, s) => a + s.vote, 0) / directional.length;
  const volMult = subs.find((s) => s.id === "vol")!.convictionMult;
  const conviction = clip(Math.abs(score) * volMult, 0, 1);
  const direction: -1 | 0 | 1 = score > FLAT_BAND ? 1 : score < -FLAT_BAND ? -1 : 0;

  // vol targeting: aim the position's annualized vol at cfg.targetVol
  const look = cfg.interval === "1M" ? 6 : 20;
  const rv = realizedVol(closes, Math.min(look, upto), cfg.ppy, upto);
  const volScale = rv && rv > 0 ? clip(cfg.targetVol / rv, 0, 1) : 0.5;
  const positionFrac = direction === 0 ? 0 : direction * clip(conviction * volScale, 0, cfg.cap);

  const price = closes[upto];
  const a = currentAtr(candles, upto, cfg);
  const stop =
    direction === 0 ? null : direction > 0 ? price - 2.5 * a : price + 2.5 * a;

  return {
    direction,
    score,
    conviction,
    positionFrac,
    subSignals: subs,
    markov: report,
    price,
    atr: a,
    stop,
  };
}

/**
 * Walk the history and return the ensemble score + position at every bar from
 * cfg.warmup on, each computed strictly from data up to that bar (no
 * look-ahead). Used by both the backtest and the honest hit-rate estimate.
 */
export function ensembleHistory(
  candles: Candle[],
  cfg: EngineConfig,
): { index: number[]; scores: number[]; positions: number[] } {
  const index: number[] = [];
  const scores: number[] = [];
  const positions: number[] = [];
  for (let t = cfg.warmup; t < candles.length; t++) {
    const e = ensembleAt(candles, t, cfg);
    index.push(t);
    scores.push(e.score);
    positions.push(e.positionFrac);
  }
  return { index, scores, positions };
}
