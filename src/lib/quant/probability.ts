import type { HitRate } from "./types";

/** Wilson 95% score interval — honest uncertainty for a binomial rate */
export function wilson(wins: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 1 };
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/**
 * The honest percentage: of all past bars whose ensemble score fell in the
 * same bucket as today's, how often was the NEXT bar profitable in the
 * signal's direction? Buckets: strong-long (score ≥ 0.4), long, flat band,
 * short, strong-short. Returns rate + Wilson CI + sample size.
 *
 * scores[i] is the walk-forward ensemble score at bar index[i]; nextReturns[i]
 * is the return of bar index[i]+1 (undefined for the final bar).
 */
export function hitRateForCurrentSignal(
  scores: number[],
  nextReturns: (number | null)[],
  currentScore: number,
  flatBand: number,
): HitRate {
  const bucket = (s: number): number => {
    if (s >= 0.4) return 2;
    if (s > flatBand) return 1;
    if (s <= -0.4) return -2;
    if (s < -flatBand) return -1;
    return 0;
  };
  const target = bucket(currentScore);
  let n = 0;
  let wins = 0;
  for (let i = 0; i < scores.length; i++) {
    const r = nextReturns[i];
    if (r === null || bucket(scores[i]) !== target) continue;
    n++;
    // flat bucket "wins" when staying out was right (the move was small or down)
    const dir = Math.sign(scores[i]);
    if (target === 0 ? Math.abs(r) < 0.02 || r < 0 : dir * r > 0) wins++;
  }
  const { lo, hi } = wilson(wins, n);
  return {
    n,
    wins,
    rate: n ? wins / n : 0,
    lo,
    hi,
    smallSample: n < 30,
  };
}
