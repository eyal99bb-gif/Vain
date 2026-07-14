// Core data types for the Vain Trading Advisor quant engine.
// All engine code is pure functions over these types — no I/O — so the same
// logic runs in tests (fixtures), on the server (route handlers) and in the
// browser.

export interface Candle {
  /** open time, ms epoch */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type AssetKind = "crypto" | "stock";
export type Interval = "15m" | "1h" | "1d" | "1w" | "1M";
export type DataSource = "binance" | "coingecko" | "stooq" | "yahoo" | "fixture";

export interface PriceSeries {
  symbol: string;
  kind: AssetKind;
  interval: Interval;
  candles: Candle[];
  source: DataSource;
  fetchedAt: number;
  /** present only when source === "fixture" */
  fixtureNote?: string;
}

/** Engine parameters derived from asset kind + interval. */
export interface EngineConfig {
  kind: AssetKind;
  interval: Interval;
  /** bars per year, for annualization */
  ppy: number;
  /** state window in bars (Markov FIX-1 stride = this) */
  window: number;
  /** BULL threshold on window-return */
  bullThr: number;
  /** BEAR threshold (negative) */
  bearThr: number;
  /** bars reserved before the first signal */
  warmup: number;
  /** round-trip transaction cost in basis points */
  costBps: number;
  /** annualized volatility target for position sizing */
  targetVol: number;
  /** max position as fraction of account */
  cap: number;
  /** gate daily signals with the weekly trend (multi-timeframe confluence) */
  confluence?: boolean;
  /** enable the drawdown circuit breaker in backtests */
  ddGuard?: boolean;
}

export interface SubSignal {
  id: "markov" | "momentum" | "trend" | "meanrev" | "vol" | "htf";
  name: string; // Hebrew display name
  /** directional vote in [-1, +1]; the vol signal always votes 0 */
  vote: number;
  /** conviction multiplier (only the vol signal sets ≠ 1) */
  convictionMult: number;
  rationale: string; // Hebrew explanation of WHY
}

export interface MarkovReport {
  /** row-stochastic 3x3, states 0=SIDEWAYS 1=BULL 2=BEAR, stride-sampled */
  matrix: number[][];
  stationary: number[];
  currentState: number;
  /** P(bull next window) − P(bear next window) */
  signal: number;
  /** stride-sampled transitions the matrix was estimated from */
  nSamples: number;
}

export interface EnsembleResult {
  direction: -1 | 0 | 1;
  /** raw combined score in [-1, +1] */
  score: number;
  /** |score| × vol multiplier, in [0, 1] */
  conviction: number;
  /** signed suggested position as fraction of account, |x| ≤ cap */
  positionFrac: number;
  subSignals: SubSignal[];
  markov: MarkovReport;
  price: number;
  atr: number;
  /** suggested stop price (null when direction === 0) */
  stop: number | null;
}

export interface HitRate {
  n: number;
  wins: number;
  rate: number;
  /** Wilson 95% interval */
  lo: number;
  hi: number;
  smallSample: boolean;
}

export interface BacktestReport {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  cagr: number;
  sharpe: number;
  exposure: number;
  /** per-bar equity of the strategy, starting at 1 */
  equity: number[];
  /** buy & hold equity over the same bars */
  benchEquity: number[];
  /** ms epoch per equity point */
  dates: number[];
  bars: number;
}
