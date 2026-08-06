// Quant engine test suite — run with: npm run test:quant
// Plain asserts, no framework. Exits non-zero on first failure.

import { backtestMarkovOnly } from "../backtest";
import { configFor } from "../config";
import { ensembleAt } from "../ensemble";
import { btcMonthlyFixture, syntheticDailyFixture } from "../fixtures";
import {
  BEAR,
  BULL,
  SIDEWAYS,
  labelStates,
  selfCheckLabels,
  transitionMatrix,
} from "../markov";
import { wilson } from "../probability";
import { kellyFraction } from "../risk";
import { EXIT, exitState } from "../exits";
import { compareExitStyles } from "../tradeBacktest";
import { hmacSign, longOnlyTarget, rebalanceDelta, roundStep, TESTNET_BASE } from "../testnet";
import { ALPACA_PAPER_BASE, isPaperKey } from "../alpaca";
import { mergeEquityCurve } from "../botState";
import { resample } from "../resample";
import { walkForward } from "../backtest";

let passed = 0;
function assert(cond: boolean, name: string, detail = "") {
  if (!cond) {
    console.error(`✗ FAIL: ${name} ${detail}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${name}`);
}
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── 1. Markov core ──────────────────────────────────────────────────────────
{
  // hand-built: states B B S S B B, stride 2 → samples at 0,2: (B→S), (S→B)
  const states = [BULL, BULL, SIDEWAYS, SIDEWAYS, BULL, BULL];
  const { matrix, nSamples } = transitionMatrix(states, 2);
  assert(nSamples === 2, "stride sampling counts non-overlapping transitions only");
  assert(matrix[BULL][SIDEWAYS] === 1, "hand-built matrix: BULL→SIDEWAYS = 1");
  assert(matrix[SIDEWAYS][BULL] === 1, "hand-built matrix: SIDEWAYS→BULL = 1");
  for (const row of matrix) {
    const s = row[0] + row[1] + row[2];
    assert(close(s, 1, 1e-12), "matrix rows sum to 1");
  }
}

{
  // label thresholds and encoding
  const closes = [100, 100, 111, 100, 89];
  const st = labelStates(closes, 1, 0.1, -0.1);
  assert(st[0] === null, "first `window` labels are null");
  assert(st[1] === SIDEWAYS, "0% return labels SIDEWAYS");
  assert(st[2] === BULL, "+11% labels BULL");
  assert(st[3] === SIDEWAYS, "-9.9% (inside band) labels SIDEWAYS");
  assert(st[4] === BEAR, "-11% labels BEAR");
}

// ── 2. FIX 2: self-check passes on real data, throws on a swapped mapping ──
{
  const fix = btcMonthlyFixture();
  const closes = fix.candles.map((c) => c.c);
  const st = labelStates(closes, 1, 0.1, -0.1);
  selfCheckLabels(closes, st, 1, 0.1, -0.1);
  assert(true, "selfCheckLabels passes on the BTC fixture");

  const swapped = st.map((s) => (s === BULL ? BEAR : s === BEAR ? BULL : s));
  let threw = false;
  try {
    selfCheckLabels(closes, swapped, 1, 0.1, -0.1);
  } catch {
    threw = true;
  }
  assert(threw, "selfCheckLabels THROWS when bull/bear are swapped");
}

// ── 3. No look-ahead: signal at bar t ignores bars after t ─────────────────
{
  const series = syntheticDailyFixture("TEST", 4, 42);
  const cfg = configFor("crypto", "1d");
  cfg.warmup = 400;
  const t = 700;
  const full = ensembleAt(series.candles, t, cfg);
  const truncated = ensembleAt(series.candles.slice(0, t + 1), t, cfg);
  assert(
    close(full.score, truncated.score, 1e-12) &&
      close(full.positionFrac, truncated.positionFrac, 1e-12),
    "no look-ahead: truncating future bars does not change the signal",
  );
}

// ── 4. Python parity pin: BTC monthly fixture, markov-only STANDALONE ──────
// Reference values from the validated Python run (markov2.py --csv
// BTC-USD-monthly.csv --window 1 --bull 0.10 --bear -0.10 --warmup 36 --ppy 12):
// win_rate 54.1%, profit_factor 1.61, max_drawdown -16.4%, cagr 8.5%,
// sharpe 0.56, exposure 90.2%
{
  const fix = btcMonthlyFixture();
  const cfg = configFor("crypto", "1M");
  cfg.costBps = 2; // the Python reference run used 2 bps
  cfg.warmup = 36;
  const r = backtestMarkovOnly(fix.candles, cfg);
  assert(close(r.winRate, 0.541, 0.005), "parity: win rate ≈ 54.1%", `got ${r.winRate}`);
  assert(close(r.profitFactor, 1.61, 0.02), "parity: profit factor ≈ 1.61", `got ${r.profitFactor}`);
  assert(close(r.maxDrawdown, -0.164, 0.005), "parity: max drawdown ≈ -16.4%", `got ${r.maxDrawdown}`);
  assert(close(r.cagr, 0.085, 0.005), "parity: CAGR ≈ 8.5%", `got ${r.cagr}`);
  assert(close(r.sharpe, 0.56, 0.01), "parity: Sharpe ≈ 0.56", `got ${r.sharpe}`);
  assert(close(r.exposure, 0.902, 0.005), "parity: exposure ≈ 90.2%", `got ${r.exposure}`);
}

// ── 5. Wilson interval sanity ───────────────────────────────────────────────
{
  const { lo, hi } = wilson(22, 41);
  assert(lo > 0.38 && lo < 0.4, "Wilson lower bound for 22/41 ≈ 0.39", `got ${lo}`);
  assert(hi > 0.67 && hi < 0.69, "Wilson upper bound for 22/41 ≈ 0.68", `got ${hi}`);
  const z = wilson(0, 0);
  assert(z.lo === 0 && z.hi === 1, "Wilson with n=0 returns the full interval");
}

// ── 6. Kelly sizing ─────────────────────────────────────────────────────────
{
  // p=0.55, PF=1.5 → payoff R = 1.5*0.45/0.55 ≈ 1.227; f* = 0.55-0.45/1.227 ≈ 0.183
  const k = kellyFraction(0.55, 1.5, 1.0);
  assert(close(k.full, 0.1833, 0.002), "Kelly full fraction for p=0.55, PF=1.5", `got ${k.full}`);
  assert(close(k.half, 0.0917, 0.002), "half-Kelly is half, clipped to cap");
  const noEdge = kellyFraction(0.5, 0.9, 1.0);
  assert(noEdge.half === 0, "no measured edge → suggested size 0", `got ${noEdge.half}`);
}

// ── 7. Drawdown circuit breaker ─────────────────────────────────────────────
{
  const series = syntheticDailyFixture("DD", 4, 11);
  const cfg = configFor("crypto", "1d");
  cfg.warmup = 300;
  const alwaysLong = () => 1;
  const off = walkForward(series.candles, { ...cfg, ddGuard: false }, alwaysLong);
  const on = walkForward(series.candles, { ...cfg, ddGuard: true }, alwaysLong);
  assert(
    on.maxDrawdown >= off.maxDrawdown,
    "dd guard never deepens max drawdown for an always-long strategy",
    `on ${on.maxDrawdown} off ${off.maxDrawdown}`,
  );
  assert(off.exposure === 1 && on.bars === off.bars, "guard changes size, not the test window");
}

// ── 8. Weekly resample ──────────────────────────────────────────────────────
{
  const series = syntheticDailyFixture("RS", 2, 3);
  const weekly = resample(series.candles, "1w");
  assert(
    weekly.length > 90 && weekly.length < 120,
    "2y of daily bars resample to ~104 weekly bars",
    `got ${weekly.length}`,
  );
  const last = weekly[weekly.length - 1];
  assert(
    close(last.c, series.candles[series.candles.length - 1].c, 1e-9),
    "resampled last close equals the last daily close",
  );
}

// ── 9. Exit ladder state machine ────────────────────────────────────────────
{
  const mk = (closes: number[]) =>
    closes.map((c, i) => ({ t: i, o: c, h: c * 1.001, l: c * 0.999, c, v: 0 }));
  // entry 100, ATR 10 → R unit = 25, BE at 125, partial at 150, trail dist 30
  const base = { entry: 100, dir: 1 as const, entryAtr: 10, tookPartial: false };

  const s0 = exitState({ ...base, candles: mk([100]), fromIdx: 0, toIdx: 0 });
  assert(s0.action === "hold" && close(s0.stop, 75, 1e-9),
    "at entry the stop is entry-2.5*ATR");

  const s1 = exitState({ ...base, candles: mk([100, 120]), fromIdx: 0, toIdx: 1 });
  assert(s1.action === "hold" && !s1.breakeven && close(s1.stop, 90, 1e-9),
    "below +1R the chandelier already trails (120-3*ATR=90)");

  const s2 = exitState({ ...base, candles: mk([100, 120, 130]), fromIdx: 0, toIdx: 2 });
  assert(s2.breakeven && close(s2.stop, 100, 1e-9), "at +1R the stop moves to breakeven");

  const s3 = exitState({ ...base, candles: mk([100, 120, 130, 180]), fromIdx: 0, toIdx: 3 });
  assert(s3.shouldPartial && s3.action === "take_partial", "at +2R a partial is recommended");
  assert(close(s3.stop, 150, 1e-9), "chandelier trails to highest close - 3*ATR");

  const s4 = exitState({ ...base, tookPartial: true, candles: mk([100, 120, 130, 180, 160, 140]), fromIdx: 0, toIdx: 5 });
  assert(s4.exited && s4.action === "exit_stop" && s4.exitIdx === 5,
    "close under the trailed stop exits the trade");

  const s5 = exitState({ ...base, candles: mk([100, 70]), fromIdx: 0, toIdx: 1 });
  assert(s5.exited && close(s5.stop, 75, 1e-9), "immediate drop exits at the initial stop");

  const sShort = exitState({ entry: 100, dir: -1, entryAtr: 10, tookPartial: false,
    candles: mk([100, 80, 70, 50]), fromIdx: 0, toIdx: 3 });
  assert(sShort.shouldPartial && sShort.breakeven, "short side mirrors the ladder");
}

// ── 10. Trade backtest: sanity + no look-ahead ─────────────────────────────
{
  const series = syntheticDailyFixture("TB", 4, 5);
  const cfg = configFor("crypto", "1d");
  cfg.warmup = 400;
  const rows = compareExitStyles(series.candles, cfg);
  assert(rows.length === 4 && rows.every((r) => isFinite(r.avgR)), "four styles, finite stats");
  assert(rows[2].trades > 0, "ladder style actually trades", `got ${rows[2].trades}`);
  assert(rows[3].trades <= rows[2].trades, "selective entries trade less or equal");
  const rows2 = compareExitStyles(series.candles, cfg);
  assert(JSON.stringify(rows) === JSON.stringify(rows2), "trade backtest is deterministic");
  assert(EXIT.PARTIAL_FRAC > 0 && EXIT.PARTIAL_FRAC < 1, "partial fraction sane");
}

// ── 11. Testnet trading helpers ─────────────────────────────────────────────
{
  assert(TESTNET_BASE === "https://testnet.binance.vision",
    "execution endpoint is hard-coded to the TESTNET");
  assert(roundStep(0.123456, 0.001) === 0.123, "quantity rounds DOWN to lot step");
  assert(roundStep(1.9999999, 0.01) <= 2.0, "rounding never rounds up past the value");
  assert(longOnlyTarget(1, 0.4) === 0.4 && longOnlyTarget(-1, 0.4) === 0 && longOnlyTarget(0, 0.4) === 0,
    "spot is long-only: short/flat signals target 0");
  assert(rebalanceDelta(0.4, 0.38) === 0, "small drift inside the band does not trade");
  assert(close(rebalanceDelta(0.4, 0.2), 0.2, 1e-12), "large drift trades the difference");
  const sig = hmacSign("secret", "a=1&b=2");
  assert(sig.length === 64 && sig === hmacSign("secret", "a=1&b=2"),
    "HMAC signature is deterministic 64-hex");
  assert(ALPACA_PAPER_BASE === "https://paper-api.alpaca.markets",
    "Alpaca endpoint is hard-coded to the PAPER environment");
  assert(isPaperKey("PKABC123") && !isPaperKey("AKABC123"),
    "live Alpaca keys (AK...) are rejected, only paper keys (PK...) pass");
}

// ── 12. Equity-curve merge (one point per UTC day) ─────────────────────────
{
  const d0 = Date.UTC(2026, 0, 1, 10);
  const d0b = Date.UTC(2026, 0, 1, 22);
  const d1 = Date.UTC(2026, 0, 2, 9);
  let c = mergeEquityCurve([], 100000, d0);
  assert(c.length === 1 && c[0].v === 100000, "first equity point appended");
  c = mergeEquityCurve(c, 100500, d0b);
  assert(c.length === 1 && c[0].v === 100500, "same UTC day replaces, not appends");
  c = mergeEquityCurve(c, 101000, d1);
  assert(c.length === 2 && c[1].v === 101000, "new day appends a fresh point");
  let big = [] as { t: number; v: number }[];
  for (let i = 0; i < 500; i++) big = mergeEquityCurve(big, i, Date.UTC(2025, 0, 1) + i * 86400000);
  assert(big.length === 400 && big[399].v === 499, "curve is capped to the last 400 days");
  assert(mergeEquityCurve(undefined as never, 5, d0).length === 1, "missing prev curve is tolerated");
}

console.log(`\nAll ${passed} checks passed.`);
