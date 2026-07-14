// Institutional-grade risk management: Kelly sizing and a drawdown
// circuit breaker. Both are honesty mechanisms — they translate MEASURED
// edge into size, and measured pain into de-risking. No measured edge → 0.

export interface KellyResult {
  /** full Kelly fraction (can be ≤ 0 when there is no measured edge) */
  full: number;
  /** half-Kelly, clipped to [0, cap] — the size we actually suggest */
  half: number;
  /** average win / average loss ratio implied by the backtest */
  payoff: number;
}

/**
 * Kelly fraction from a backtest's win rate and profit factor.
 * payoff R = avgWin/avgLoss = PF·(1−p)/p;  f* = p − (1−p)/R.
 * We suggest half-Kelly (industry practice — full Kelly is too violent),
 * and never a negative size: no edge → 0.
 */
export function kellyFraction(winRate: number, profitFactor: number, cap: number): KellyResult {
  if (
    winRate <= 0 ||
    winRate >= 1 ||
    !isFinite(profitFactor) ||
    profitFactor <= 0
  ) {
    const degenerate = winRate >= 1 || profitFactor === Infinity;
    return { full: degenerate ? cap : 0, half: degenerate ? cap : 0, payoff: NaN };
  }
  const payoff = (profitFactor * (1 - winRate)) / winRate;
  const full = payoff > 0 ? winRate - (1 - winRate) / payoff : 0;
  const half = Math.min(cap, Math.max(0, full / 2));
  return { full, half, payoff };
}

export interface DrawdownGuard {
  /** start de-risking at this drawdown (e.g. -0.15) */
  trigger: number;
  /** restore full size when drawdown recovers above this (e.g. -0.075) */
  release: number;
  /** position multiplier while triggered */
  scale: number;
}

export const DEFAULT_DD_GUARD: DrawdownGuard = {
  trigger: -0.15,
  release: -0.075,
  scale: 0.5,
};
