// TypeScript port of the validated Python implementation in
// .claude/skills/markov-2-hedge-fund-method/scripts/markov2.py.
// Semantics are kept bit-for-bit compatible (state encoding, NaN compression,
// stride sampling, uniform rows for unseen states) so the parity test can pin
// this port to the Python results on the same fixture.

export const SIDEWAYS = 0;
export const BULL = 1;
export const BEAR = 2;
export const STATE_NAMES_HE = ["דשדוש", "שור", "דוב"] as const;

/**
 * Label each bar by trailing `window`-bar cumulative return.
 * null for the first `window` bars (insufficient history).
 */
export function labelStates(
  closes: number[],
  window: number,
  bullThr: number,
  bearThr: number,
): (number | null)[] {
  return closes.map((c, i) => {
    if (i - window < 0) return null;
    const r = c / closes[i - window] - 1;
    if (r >= bullThr) return BULL;
    if (r <= bearThr) return BEAR;
    return SIDEWAYS;
  });
}

/**
 * FIX 1 — stride-sampled transition matrix. Transitions are counted between
 * bars `stride` apart, sampled every `stride` bars, over the null-compressed
 * state sequence (matches the Python `s[~isnan]` + arange(0, n-stride, stride)).
 * Rows with no observations become uniform (1/3).
 */
export function transitionMatrix(
  states: (number | null)[],
  stride: number,
): { matrix: number[][]; nSamples: number } {
  const s = states.filter((x): x is number => x !== null);
  const counts = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let n = 0;
  for (let i = 0; i < s.length - stride; i += stride) {
    counts[s[i]][s[i + stride]]++;
    n++;
  }
  const matrix = counts.map((row) => {
    const sum = row[0] + row[1] + row[2];
    return sum > 0 ? row.map((x) => x / sum) : [1 / 3, 1 / 3, 1 / 3];
  });
  return { matrix, nSamples: n };
}

/** stationary distribution via power iteration (rows sum to 1, so this converges) */
export function stationary(matrix: number[][]): number[] {
  let v = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 200; iter++) {
    const next = [0, 0, 0];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) next[j] += v[i] * matrix[i][j];
    const diff = Math.abs(next[0] - v[0]) + Math.abs(next[1] - v[1]) + Math.abs(next[2] - v[2]);
    v = next;
    if (diff < 1e-12) break;
  }
  return v;
}

/** the Markov signal: P(bull next window) − P(bear next window) */
export function signalFrom(matrix: number[][], currentState: number): number {
  return matrix[currentState][BULL] - matrix[currentState][BEAR];
}

/**
 * FIX 2 — label verification. Throws if the extreme periods of the series are
 * mislabeled (best window-return must be BULL, worst BEAR, flattest SIDEWAYS).
 * Call before displaying any matrix or state to a user.
 */
export function selfCheckLabels(
  closes: number[],
  states: (number | null)[],
  window: number,
  bullThr: number,
  bearThr: number,
): void {
  let iMax = -1,
    iMin = -1,
    iFlat = -1;
  let rMax = -Infinity,
    rMin = Infinity,
    rFlat = Infinity;
  for (let i = window; i < closes.length; i++) {
    const r = closes[i] / closes[i - window] - 1;
    if (r > rMax) [rMax, iMax] = [r, i];
    if (r < rMin) [rMin, iMin] = [r, i];
    if (Math.abs(r) < rFlat) [rFlat, iFlat] = [Math.abs(r), i];
  }
  // expected labels recomputed here, independently of labelStates' code path
  const expect = (r: number) => (r >= bullThr ? BULL : r <= bearThr ? BEAR : SIDEWAYS);
  const checks: Array<[string, number, number | null]> = [
    ["best window-return", expect(rMax), states[iMax]],
    ["worst window-return", expect(rMin), states[iMin]],
    ["flattest window-return", SIDEWAYS, states[iFlat]],
  ];
  for (const [name, expected, got] of checks) {
    if (got !== expected)
      throw new Error(
        `LABEL SELF-CHECK FAILED (${name}): expected state ${expected}, got ${got}`,
      );
  }
}
