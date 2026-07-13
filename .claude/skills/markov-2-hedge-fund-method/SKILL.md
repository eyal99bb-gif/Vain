---
name: markov-2-hedge-fund-method
description: >
  Markov 2.0 — Hedge Fund Method (corrected). Regime detection for any ticker
  or strategy: label BULL/BEAR/SIDEWAYS states from 20-day returns, build a
  stride-sampled transition matrix, trade the P(bull)−P(bear) differential.
  Use when the user asks to run the Markov method, regime-filter a strategy,
  compute a transition matrix / regime signal, or backtest regime switching
  on a ticker. Invocable as /markov-2-hedge-fund-method [TICKER|CSV] [flags].
---

# Markov 2.0 — Hedge Fund Method (corrected)

Run `scripts/markov2.py` (same directory as this file) — it implements the
whole method. Do not re-derive the math by hand; the script is the source of
truth.

```bash
python3 scripts/markov2.py --ticker SPY --years 10 --plot equity.png   # live data
python3 scripts/markov2.py --csv prices.csv                           # user CSV
python3 scripts/markov2.py --synthetic                                # no-network demo
```

Requires: numpy, pandas, matplotlib (hmmlearn for `--hmm`, scikit-learn for
`--enhanced`). Install on demand with pip.

## The method

1. **States** — 20-day cumulative return ≥ +5% = BULL, ≤ −5% = BEAR, else
   SIDEWAYS. Encoding is fixed: `0=SIDEWAYS, 1=BULL, 2=BEAR`.
2. **Transition matrix** — count state→state transitions, rows normalized to
   probabilities. Report stickiness (the diagonal).
3. **Signal** — `P(bull next) − P(bear next)` from the current state's row.
   Sign = direction, magnitude = conviction.
4. **Multi-day forecasts** — matrix powers; always note convergence to the
   stationary distribution (long-horizon forecasts carry no signal).
5. **HMM mode** (`--hmm`, optional) — fit a Gaussian HMM with no hand-made
   labels; agreement with the threshold labels is the green light.

## The three fixes (non-negotiable — never skip these)

1. **Stride sampling.** NEVER build the matrix from overlapping rolling
   windows — consecutive 20-day windows share 19 days and fake diagonal
   persistence. Count transitions between NON-overlapping windows
   (stride = window length). Always show BOTH matrices side by side with a
   one-line warning that only the stride-sampled one is statistically honest.
   The script does this by default.
2. **Label verification.** Before showing any table, chart, or matrix,
   self-check the 0/1/2 mapping against extreme periods (the script's
   `self_check_labels` raises on failure; for SPY it also checks the 2020
   COVID trough = BEAR, 2021 = BULL, late-2015 = SIDEWAYS). If a rendered
   display disagrees with the data, fix it before the user sees it.
3. **Two explicit modes — never leave ambiguous.** Ask or confirm which one:
   - **FILTER**: the signal gates the user's own strategy — longs only when
     signal > threshold (default 0.10), shorts only when below −threshold,
     flat in chop. Their strategy stays theirs; Markov 2.0 decides WHEN.
   - **STANDALONE**: trade the differential directly; position =
     clip(signal/0.5, ±1) × cap.

   **This user's saved default: STANDALONE, cap 1.0×, price-only states**
   (chosen at onboarding 2026-07-13). Confirm before switching.

## Optional richer states (offer, don't force)

`--enhanced` clusters on 20-day return + ATR + relative volume so "bear and
violent" ≠ "bear and asleep" (needs scikit-learn). Report how the matrix and
signal change vs price-only — the script prints the agreement and stickiness
shift.

## Reporting rules — proof, not promises

- Backtests are walk-forward only: the matrix is refit as you walk and never
  sees the bars being traded. Report win rate, profit factor, max drawdown,
  CAGR, Sharpe, exposure, and the equity-curve image; always show
  before-fix vs after-fix side by side.
- If live data sources are unreachable, `--synthetic` runs a clearly-labeled
  regime-switching simulation — always tell the user those numbers
  demonstrate machinery, not a real asset.
- End every backtest report with exactly this caveat:
  "Backtests flatter. The fixed matrix shows uglier, truer numbers — those
  are the only ones worth trading."
- Offer to re-run on any ticker the user names.
