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

console.log(`\nAll ${passed} checks passed.`);
