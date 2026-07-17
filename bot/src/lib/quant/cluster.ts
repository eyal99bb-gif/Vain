// Enhanced regime states — deterministic k-means clustering on
// (20-bar return, ATR ratio, relative volume), so "violent bear" and
// "sleepy bear" become different states. Clusters are ranked by mean
// return and mapped to a directional vote. Fully deterministic
// (percentile-seeded centroids, fixed iterations) so walk-forward
// truncation invariance holds.

import { atr } from "./indicators";
import type { Candle, EngineConfig, SubSignal } from "./types";

const WINDOW_CAP = 400; // cluster on the most recent bars only (perf)

function standardize(rows: number[][]): number[][] {
  const d = rows[0].length;
  const mean = new Array(d).fill(0);
  const sd = new Array(d).fill(0);
  for (const r of rows) for (let j = 0; j < d; j++) mean[j] += r[j];
  for (let j = 0; j < d; j++) mean[j] /= rows.length;
  for (const r of rows) for (let j = 0; j < d; j++) sd[j] += (r[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j] / rows.length) || 1;
  return rows.map((r) => r.map((x, j) => (x - mean[j]) / sd[j]));
}

/** deterministic 3-means: centroids seeded at the 10th/50th/90th percentile
 * rows of the first feature (the return), 15 Lloyd iterations. */
function kmeans3(rows: number[][]): number[] {
  const order = rows
    .map((r, i) => [r[0], i] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const pick = (q: number) => rows[order[Math.floor(q * (order.length - 1))][1]];
  let cents = [pick(0.1), pick(0.5), pick(0.9)].map((r) => [...r]);
  const assign = new Array<number>(rows.length).fill(0);
  for (let iter = 0; iter < 15; iter++) {
    for (let i = 0; i < rows.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < 3; c++) {
        let d = 0;
        for (let j = 0; j < rows[i].length; j++) d += (rows[i][j] - cents[c][j]) ** 2;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    const sums = cents.map((c) => new Array(c.length).fill(0));
    const counts = [0, 0, 0];
    for (let i = 0; i < rows.length; i++) {
      counts[assign[i]]++;
      for (let j = 0; j < rows[i].length; j++) sums[assign[i]][j] += rows[i][j];
    }
    cents = cents.map((c, k) =>
      counts[k] > 0 ? sums[k].map((x) => x / counts[k]) : c,
    );
  }
  return assign;
}

/**
 * The enhanced-states sub-signal: cluster recent bars, rank clusters by mean
 * return, vote by which regime TODAY belongs to. Uses only candles[0..upto].
 */
export function clusterSignal(
  candles: Candle[],
  upto: number,
  cfg: EngineConfig,
): SubSignal {
  const w = cfg.window;
  const start = Math.max(w + 20, upto - WINDOW_CAP);
  if (upto - start < 60) {
    return {
      id: "cluster",
      name: "מצבים מועשרים (תנודתיות+נפח)",
      vote: 0,
      convictionMult: 1,
      rationale: "אין מספיק היסטוריה לאשכולות",
    };
  }
  const hasVol = candles.slice(start, upto + 1).some((c) => c.v > 0);
  const rows: number[][] = [];
  const rets: number[] = [];
  for (let i = start; i <= upto; i++) {
    const ret = candles[i].c / candles[i - w].c - 1;
    const a = (atr(candles, w, i) ?? 0) / candles[i].c;
    const row = [ret, a];
    if (hasVol) {
      let av = 0;
      const lb = Math.min(60, i);
      for (let j = i - lb + 1; j <= i; j++) av += candles[j].v;
      row.push(candles[i].v / (av / lb || 1));
    }
    rows.push(row);
    rets.push(ret);
  }
  const assign = kmeans3(standardize(rows));
  const meanRet = [0, 0, 0];
  const counts = [0, 0, 0];
  for (let i = 0; i < assign.length; i++) {
    meanRet[assign[i]] += rets[i];
    counts[assign[i]]++;
  }
  for (let k = 0; k < 3; k++) meanRet[k] = counts[k] ? meanRet[k] / counts[k] : 0;
  const rank = [0, 1, 2].sort((a, b) => meanRet[a] - meanRet[b]); // low..high
  const today = assign[assign.length - 1];
  const vote = today === rank[2] ? 0.6 : today === rank[0] ? -0.6 : 0;
  const nameHe = today === rank[2] ? "משטר שורי" : today === rank[0] ? "משטר דובי" : "משטר ביניים";
  return {
    id: "cluster",
    name: "מצבים מועשרים (תנודתיות+נפח)",
    vote,
    convictionMult: 1,
    rationale: `אשכול על תשואה+ATR${hasVol ? "+נפח" : ""}: היום ב${nameHe} (תשואת האשכול הממוצעת ${(meanRet[today] * 100).toFixed(1)}%)`,
  };
}
