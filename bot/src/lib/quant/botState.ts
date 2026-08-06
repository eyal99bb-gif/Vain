// The shared contract between the bot (which publishes it every run) and the
// dashboard (which reads it). The trader writes bot-state.json; the workflow
// pushes it to gh-pages; the static site fetches /Vain/bot-state.json and
// renders the live portfolio. Pure types + pure helpers — safe in the browser.

export interface EquityPoint {
  t: number; // ms epoch
  v: number; // account equity in USD
}

export interface StatePosition {
  symbol: string; // e.g. BTCUSD, SPY, BITI
  label: string; // Hebrew display label
  qty: number;
  value: number; // market value in USD
  pnl: number; // unrealized P&L in USD
  pnlPct: number; // unrealized P&L fraction
  side: "long" | "short";
}

export interface StateSignal {
  id: string;
  label: string; // Hebrew
  kind: "crypto" | "stock";
  direction: -1 | 0 | 1;
  conviction: number; // 0..1
  price: number;
  why: string; // Hebrew one-liner
  tradable: boolean; // will the bot act on it?
}

export interface StateTrade {
  at: number; // ms epoch (filled)
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  value: number;
}

export interface BotState {
  updatedAt: string; // ISO
  live: boolean; // false when no keys / no market data
  note: string; // Hebrew status line when not live (or empty)
  equity: number;
  cash: number;
  startEquity: number; // baseline for total-return (Alpaca paper = 100k)
  positions: StatePosition[];
  signals: StateSignal[];
  trades: StateTrade[];
  equityCurve: EquityPoint[];
}

export const EMPTY_STATE: BotState = {
  updatedAt: "",
  live: false,
  note: "",
  equity: 0,
  cash: 0,
  startEquity: 100000,
  positions: [],
  signals: [],
  trades: [],
  equityCurve: [],
};

const DAY = 86400000;
const dayIndex = (t: number) => Math.floor(t / DAY);

/**
 * Append today's equity to the curve, one point per UTC day (the last point
 * of each day wins), keeping the most recent `cap` days.
 */
export function mergeEquityCurve(
  prev: EquityPoint[],
  equity: number,
  now = Date.now(),
  cap = 400,
): EquityPoint[] {
  const out = Array.isArray(prev) ? [...prev] : [];
  const last = out[out.length - 1];
  if (last && dayIndex(last.t) === dayIndex(now)) {
    out[out.length - 1] = { t: now, v: equity };
  } else {
    out.push({ t: now, v: equity });
  }
  return out.slice(-cap);
}
