// Exit ladder — the profit-taking discipline that separates a system from
// a hunch. Evaluated on bar CLOSES only (conservative: no intrabar
// guessing). All distances derive from ATR at entry, so the whole ladder
// is fixed the moment the trade opens and cannot be curve-fit afterwards.
//
//   1R = STOP_ATR × ATR(entry)  — the initial risk unit
//   +1R  → stop moves to breakeven (a winner never becomes a loser)
//   +2R  → take PARTIAL_FRAC off; trail the rest
//   trail: highest close since entry − TRAIL_ATR × ATR(entry), never down
//   close crosses the stop → exit

import type { Candle } from "./types";

export const EXIT = {
  BE_AT_R: 1,
  PARTIAL_AT_R: 2,
  PARTIAL_FRAC: 0.5,
  TRAIL_ATR: 3,
  STOP_ATR: 2.5,
} as const;

export type ExitAction = "hold" | "take_partial" | "exit_stop";

export interface ExitState {
  /** current open profit in R units (risk multiples) */
  rMultiple: number;
  /** the stop as it stands now (initial / breakeven / trailing — the highest) */
  stop: number;
  breakeven: boolean;
  /** reached +2R and a partial has not been taken yet */
  shouldPartial: boolean;
  /** a close has crossed the stop — the trade is over */
  exited: boolean;
  /** index of the bar that triggered the exit (for backtests) */
  exitIdx: number | null;
  action: ExitAction;
  hint: string; // Hebrew guidance for the journal
}

export function exitState(opts: {
  entry: number;
  dir: 1 | -1;
  entryAtr: number;
  candles: Candle[];
  fromIdx: number;
  toIdx: number;
  tookPartial: boolean;
}): ExitState {
  const { entry, dir, entryAtr, candles, fromIdx, toIdx, tookPartial } = opts;
  const rUnit = EXIT.STOP_ATR * entryAtr;
  const trailDist = EXIT.TRAIL_ATR * entryAtr;
  let stop = entry - dir * rUnit;
  let best = entry; // best close in the trade's favour
  let breakeven = false;
  let exited = false;
  let exitIdx: number | null = null;
  let r = 0;

  for (let i = fromIdx; i <= toIdx; i++) {
    const c = candles[i].c;
    r = (dir * (c - entry)) / rUnit;
    if (!exited && dir * (c - stop) <= 0) {
      exited = true;
      exitIdx = i;
      break;
    }
    if (dir * (c - best) > 0) best = c;
    if (!breakeven && r >= EXIT.BE_AT_R) {
      breakeven = true;
      stop = dir > 0 ? Math.max(stop, entry) : Math.min(stop, entry);
    }
    const trail = best - dir * trailDist;
    stop = dir > 0 ? Math.max(stop, trail) : Math.min(stop, trail);
  }

  const shouldPartial = !exited && !tookPartial && r >= EXIT.PARTIAL_AT_R;
  const action: ExitAction = exited ? "exit_stop" : shouldPartial ? "take_partial" : "hold";
  const fmt = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const hint = exited
    ? `המחיר חצה את הסטופ (${fmt(stop)}) — לצאת מהעסקה`
    : shouldPartial
      ? `+${r.toFixed(1)}R — הגיע הזמן לקחת ${EXIT.PARTIAL_FRAC * 100}% רווח ולהמשיך לגרור את היתרה`
      : breakeven
        ? `+${r.toFixed(1)}R — הסטופ בנקודת איזון (${fmt(stop)}); העסקה כבר לא יכולה להפסיד`
        : `${r >= 0 ? "+" : ""}${r.toFixed(1)}R — מחזיקים; הסטופ ב-${fmt(stop)}`;

  return { rMultiple: r, stop, breakeven, shouldPartial, exited, exitIdx, action, hint };
}
