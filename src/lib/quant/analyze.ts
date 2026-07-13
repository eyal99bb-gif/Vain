// Orchestrator: one call takes a PriceSeries and returns everything the
// dashboard renders. Pure — safe to run in the browser.

import { backtestEnsemble } from "./backtest";
import { configFor } from "./config";
import { ensembleAt, ensembleHistory, FLAT_BAND } from "./ensemble";
import { buildActionPlan, type ActionStep } from "./plan";
import { hitRateForCurrentSignal } from "./probability";
import type { BacktestReport, EngineConfig, EnsembleResult, HitRate, PriceSeries } from "./types";

export interface Analysis {
  cfg: EngineConfig;
  ensemble: EnsembleResult;
  hitRate: HitRate;
  backtest: BacktestReport;
  plan: ActionStep[];
  /** true when there is too little history for a meaningful analysis */
  thinData: boolean;
}

export function analyze(series: PriceSeries, accountSize: number): Analysis {
  const cfg = configFor(series.kind, series.interval);
  const { candles } = series;
  // adapt warmup when the series is shorter than ideal, but keep a floor
  const minWarmup = cfg.window * 8;
  if (candles.length < cfg.warmup + 20) {
    cfg.warmup = Math.max(minWarmup, Math.floor(candles.length / 2));
  }
  const last = candles.length - 1;
  const ensemble = ensembleAt(candles, last, cfg);

  const hist = ensembleHistory(candles, cfg);
  const nextReturns: (number | null)[] = hist.index.map((t) =>
    t + 1 < candles.length ? candles[t + 1].c / candles[t].c - 1 : null,
  );
  const hitRate = hitRateForCurrentSignal(hist.scores, nextReturns, ensemble.score, FLAT_BAND);

  const backtest = backtestEnsemble(candles, cfg);
  const plan = buildActionPlan(ensemble, hitRate, cfg, accountSize);

  return {
    cfg,
    ensemble,
    hitRate,
    backtest,
    plan,
    thinData: candles.length < cfg.warmup + 30 || hitRate.smallSample,
  };
}
