import { atr, kBarReturn, realizedVol, sma, zScore } from "./indicators";
import {
  BEAR,
  BULL,
  STATE_NAMES_HE,
  labelStates,
  selfCheckLabels,
  signalFrom,
  stationary,
  transitionMatrix,
} from "./markov";
import type { Candle, EngineConfig, MarkovReport, SubSignal } from "./types";

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

/** momentum lookbacks (in bars) per interval — ~1/3/6/12 months */
function momentumLookbacks(cfg: EngineConfig): number[] {
  if (cfg.interval === "1d") return [21, 63, 126, 252];
  if (cfg.interval === "1w") return [4, 13, 26, 52];
  return [1, 3, 6, 12];
}

/** long trend SMA period per interval (~10 months, the classic timing filter) */
function trendPeriod(cfg: EngineConfig): number {
  if (cfg.interval === "1d") return 200;
  if (cfg.interval === "1w") return 40;
  return 10;
}

export function markovSignal(
  closes: number[],
  upto: number,
  cfg: EngineConfig,
): { sub: SubSignal; report: MarkovReport } {
  const slice = closes.slice(0, upto + 1);
  const states = labelStates(slice, cfg.window, cfg.bullThr, cfg.bearThr);
  selfCheckLabels(slice, states, cfg.window, cfg.bullThr, cfg.bearThr);
  const { matrix, nSamples } = transitionMatrix(states, cfg.window);
  const cur = states[states.length - 1];
  const report: MarkovReport = {
    matrix,
    stationary: stationary(matrix),
    currentState: cur ?? 0,
    signal: cur === null ? 0 : signalFrom(matrix, cur),
    nSamples,
  };
  const vote = cur === null ? 0 : clip(report.signal / 0.5, -1, 1);
  const row = matrix[report.currentState];
  return {
    report,
    sub: {
      id: "markov",
      name: "משטר מרקוב 2.0",
      vote,
      convictionMult: 1,
      rationale:
        cur === null
          ? "אין מספיק היסטוריה לזיהוי משטר"
          : `המצב הנוכחי: ${STATE_NAMES_HE[report.currentState]}. לפי ${nSamples} מעברים היסטוריים (דגימה ללא חפיפה): שור ${pct(row[BULL])} מול דוב ${pct(row[BEAR])} בחלון הבא`,
    },
  };
}

export function momentumSignal(closes: number[], upto: number, cfg: EngineConfig): SubSignal {
  const lbs = momentumLookbacks(cfg);
  let sum = 0;
  let n = 0;
  let pos = 0;
  for (const k of lbs) {
    const r = kBarReturn(closes, upto, k);
    if (r === null) continue;
    sum += Math.sign(r);
    if (r > 0) pos++;
    n++;
  }
  const vote = n === 0 ? 0 : sum / n;
  return {
    id: "momentum",
    name: "מומנטום רב-אופקי",
    vote,
    convictionMult: 1,
    rationale:
      n === 0
        ? "אין מספיק היסטוריה למומנטום"
        : `${pos} מתוך ${n} אופקי זמן (חודש עד שנה) חיוביים`,
  };
}

export function trendSignal(closes: number[], upto: number, cfg: EngineConfig): SubSignal {
  const period = trendPeriod(cfg);
  const m = sma(closes, period, upto);
  if (m === null)
    return {
      id: "trend",
      name: "מסנן מגמה ארוכה",
      vote: 0,
      convictionMult: 1,
      rationale: "אין מספיק היסטוריה לממוצע הנע הארוך",
    };
  const dist = closes[upto] / m - 1;
  const vote = clip(dist / 0.05, -1, 1);
  return {
    id: "trend",
    name: "מסנן מגמה ארוכה",
    vote,
    convictionMult: 1,
    rationale: `המחיר ${dist >= 0 ? "מעל" : "מתחת"} לממוצע הנע (${period} תקופות) ב-${pct(Math.abs(dist))}`,
  };
}

export function meanRevSignal(closes: number[], upto: number, cfg: EngineConfig): SubSignal {
  const period = cfg.interval === "1M" ? 6 : 20;
  const z = zScore(closes, period, upto);
  if (z === null)
    return {
      id: "meanrev",
      name: "חזרה לממוצע",
      vote: 0,
      convictionMult: 1,
      rationale: "אין מספיק היסטוריה לציון-z",
    };
  const vote = clip(-z / 2.5, -1, 1);
  return {
    id: "meanrev",
    name: "חזרה לממוצע",
    vote,
    convictionMult: 1,
    rationale: `ציון-z קצר-טווח ${z.toFixed(1)} — ${
      Math.abs(z) < 1 ? "אין מתיחה מהותית" : z > 0 ? "המחיר מתוח כלפי מעלה, מרסן רדיפה" : "המחיר מתוח כלפי מטה, תומך בכניסה הדרגתית"
    }`,
  };
}

export function volSignal(closes: number[], upto: number, cfg: EngineConfig): SubSignal {
  const look = cfg.interval === "1M" ? 6 : 20;
  const cur = realizedVol(closes, look, cfg.ppy, upto);
  // long-run vol: same estimator over up to 5x the lookback
  const long = realizedVol(closes, Math.min(look * 5, upto), cfg.ppy, upto);
  if (cur === null || long === null || long === 0)
    return {
      id: "vol",
      name: "משטר תנודתיות",
      vote: 0,
      convictionMult: 1,
      rationale: "אין מספיק היסטוריה למדידת תנודתיות",
    };
  const ratio = cur / long;
  // high current vol shrinks conviction; calm vol restores it. Never directional.
  const mult = clip(1 / ratio, 0.5, 1.1);
  return {
    id: "vol",
    name: "משטר תנודתיות",
    vote: 0,
    convictionMult: mult,
    rationale:
      ratio > 1.2
        ? `תנודתיות נוכחית (${pct(cur)}) גבוהה מהרגיל פי ${ratio.toFixed(1)} — הביטחון מוקטן בהתאם`
        : `תנודתיות נוכחית (${pct(cur)}) בטווח הרגיל — אין הקטנת ביטחון`,
  };
}

/** ATR of the last bars, used for stops and entry zones */
export function currentAtr(candles: Candle[], upto: number, cfg: EngineConfig): number {
  const period = cfg.interval === "1M" ? 6 : 14;
  return atr(candles, period, upto) ?? candles[upto].c * 0.05;
}
