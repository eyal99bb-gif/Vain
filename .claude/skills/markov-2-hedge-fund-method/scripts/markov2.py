#!/usr/bin/env python3
"""Markov 2.0 — Hedge Fund Method (corrected).

Regime detection via a 3-state Markov chain on price data, with the three
2.0 fixes baked in:

  FIX 1 — stride sampling: transition matrices are counted between
          NON-overlapping windows (stride = window length). The legacy
          overlapping matrix is also computed, but only for the side-by-side
          warning display: it fakes persistence because consecutive 20-day
          windows share 19 days.
  FIX 2 — label verification: state labels are programmatically self-checked
          against extreme historical periods before anything is displayed.
  FIX 3 — two explicit modes: FILTER (regime gates an external strategy) and
          STANDALONE (trade the bull-bear differential directly, sized by
          |signal| with a cap).

State encoding (fixed, verified by self_check_labels):
  0 = SIDEWAYS, 1 = BULL, 2 = BEAR

Usage:
  python3 markov2.py --csv prices.csv               # CSV with Date,Close
  python3 markov2.py --ticker SPY --years 10        # fetch (stooq -> yahoo)
  python3 markov2.py --synthetic --years 10         # labeled synthetic demo
Options:
  --mode {standalone,filter}   trading mode (default: standalone)
  --cap FLOAT                  max |position| as fraction of equity (default 1.0)
  --threshold FLOAT            FILTER-mode gate on signal (default 0.10)
  --window INT                 state window in bars (default 20)
  --bull FLOAT --bear FLOAT    state thresholds (default +0.05 / -0.05)
  --hmm                        also fit a label-free HMM and cross-check
  --enhanced                   cluster on return+ATR+relative volume states
  --plot PATH                  write equity-curve PNG
"""

import argparse
import io
import json
import sys
import urllib.request

import numpy as np
import pandas as pd

STATE_NAMES = {0: "SIDEWAYS", 1: "BULL", 2: "BEAR"}
SIDEWAYS, BULL, BEAR = 0, 1, 2


# ---------------------------------------------------------------- data ----

def fetch_prices(ticker: str, years: int) -> pd.DataFrame:
    """Fetch daily OHLCV. Tries stooq, then Yahoo. Raises on total failure."""
    errors = []
    try:
        url = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&i=d"
        raw = urllib.request.urlopen(url, timeout=30).read().decode()
        df = pd.read_csv(io.StringIO(raw), parse_dates=["Date"]).set_index("Date")
        if len(df) > 100:
            return df.tail(int(years * 252)).rename(columns=str.title)
        errors.append("stooq: empty response")
    except Exception as e:  # noqa: BLE001 - fall through to next source
        errors.append(f"stooq: {e}")
    try:
        url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
               f"?range={years}y&interval=1d")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=30).read())
        res = data["chart"]["result"][0]
        quote = res["indicators"]["quote"][0]
        df = pd.DataFrame(
            {"Open": quote["open"], "High": quote["high"], "Low": quote["low"],
             "Close": quote["close"], "Volume": quote["volume"]},
            index=pd.to_datetime(res["timestamp"], unit="s").normalize(),
        ).dropna()
        return df
    except Exception as e:  # noqa: BLE001
        errors.append(f"yahoo: {e}")
    raise RuntimeError("all data sources failed: " + "; ".join(errors))


def synthetic_prices(years: int, seed: int = 7,
                     profile: str = "equity") -> pd.DataFrame:
    """Regime-switching GBM stand-in for when market data is unreachable.

    SYNTHETIC — results on this series demonstrate the machinery, not any
    real asset's performance. Callers must label output accordingly.
    profile='crypto' calibrates regimes to coin-like drift/vol (~3-4x equity).
    """
    rng = np.random.default_rng(seed)
    n = int(years * 252)
    if profile == "crypto":
        mu = {BULL: 1.20 / 252, BEAR: -0.90 / 252, SIDEWAYS: 0.0}
        sig = {BULL: 0.55 / 16, BEAR: 0.85 / 16, SIDEWAYS: 0.45 / 16}
        stay = {BULL: 0.990, BEAR: 0.982, SIDEWAYS: 0.988}
    else:
        # daily drift/vol per hidden regime: bull, bear, sideways
        mu = {BULL: 0.12 / 252, BEAR: -0.25 / 252, SIDEWAYS: 0.02 / 252}
        sig = {BULL: 0.12 / 16, BEAR: 0.28 / 16, SIDEWAYS: 0.14 / 16}
        # sticky hidden chain: mean regime length ~4-6 months
        stay = {BULL: 0.992, BEAR: 0.985, SIDEWAYS: 0.990}
    state, states = BULL, []
    for _ in range(n):
        if rng.random() > stay[state]:
            state = rng.choice([s for s in (BULL, BEAR, SIDEWAYS) if s != state])
        states.append(state)
    rets = np.array([rng.normal(mu[s], sig[s]) for s in states])
    close = 100 * np.exp(np.cumsum(rets))
    idx = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n)
    vol = rng.lognormal(18, 0.3, n) * np.where(np.array(states) == BEAR, 1.6, 1.0)
    df = pd.DataFrame({
        "Open": close * (1 + rng.normal(0, 0.002, n)),
        "High": close * (1 + np.abs(rng.normal(0, 0.006, n))),
        "Low": close * (1 - np.abs(rng.normal(0, 0.006, n))),
        "Close": close, "Volume": vol,
    }, index=idx)
    df.attrs["synthetic"] = True
    df.attrs["true_states"] = np.array(states)
    return df


# -------------------------------------------------------------- states ----

def label_states(close: pd.Series, window: int = 20,
                 bull_thr: float = 0.05, bear_thr: float = -0.05) -> pd.Series:
    """0=SIDEWAYS, 1=BULL (>= bull_thr), 2=BEAR (<= bear_thr) on trailing
    `window`-bar cumulative return. First `window` bars are NaN."""
    ret = close / close.shift(window) - 1
    states = pd.Series(np.where(ret >= bull_thr, BULL,
                       np.where(ret <= bear_thr, BEAR, SIDEWAYS)),
                       index=close.index, dtype=float)
    states[ret.isna()] = np.nan
    return states


def enhanced_states(df: pd.DataFrame, window: int = 20) -> pd.Series:
    """Cluster on (window return, ATR ratio, relative volume) via k-means so
    'bear and violent' != 'bear and asleep'. Clusters are mapped onto the
    0/1/2 encoding by mean return so downstream code stays identical."""
    from sklearn.cluster import KMeans
    ret = df["Close"] / df["Close"].shift(window) - 1
    tr = np.maximum(df["High"] - df["Low"],
                    np.maximum((df["High"] - df["Close"].shift()).abs(),
                               (df["Low"] - df["Close"].shift()).abs()))
    atr = (tr.rolling(window).mean() / df["Close"])
    rvol = df["Volume"] / df["Volume"].rolling(window * 3).mean()
    feats = pd.concat([ret, atr, rvol], axis=1).dropna()
    z = (feats - feats.mean()) / feats.std()
    km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(z)
    lab = pd.Series(km.labels_, index=feats.index)
    # map cluster ids -> BULL/BEAR/SIDEWAYS by mean window-return
    means = {c: ret.loc[lab.index][lab == c].mean() for c in range(3)}
    order = sorted(means, key=means.get)  # low..high
    remap = {order[0]: BEAR, order[1]: SIDEWAYS, order[2]: BULL}
    out = pd.Series(np.nan, index=df.index)
    out.loc[lab.index] = lab.map(remap).astype(float)
    return out


def self_check_labels(close: pd.Series, states: pd.Series, window: int = 20,
                      known_periods=None) -> list:
    """FIX 2: verify the 0/1/2 mapping against extreme periods before display.

    Data-driven checks (work on any series): the window with the maximum
    trailing return must be BULL, the minimum must be BEAR, the smallest
    |return| must be SIDEWAYS. Optional `known_periods` adds named history
    checks, e.g. [("2020-03-23", BEAR, "COVID crash trough")].
    Returns a list of (check, expected, got, pass) tuples; raises on failure.
    """
    ret = (close / close.shift(window) - 1).dropna()
    checks = [
        ("max trailing return day", BULL, int(states.loc[ret.idxmax()])),
        ("min trailing return day", BEAR, int(states.loc[ret.idxmin()])),
        ("flattest trailing return day", SIDEWAYS,
         int(states.loc[ret.abs().idxmin()])),
    ]
    for date, expected, name in (known_periods or []):
        ts = pd.Timestamp(date)
        if ts in states.index and not np.isnan(states.loc[ts]):
            checks.append((name, expected, int(states.loc[ts])))
    results = [(name, STATE_NAMES[exp], STATE_NAMES[got], exp == got)
               for name, exp, got in checks]
    failed = [r for r in results if not r[3]]
    if failed:
        raise AssertionError(f"LABEL SELF-CHECK FAILED — do not display: {failed}")
    return results


# ------------------------------------------------------------- matrices ----

def transition_matrix(states: np.ndarray, stride: int = 1) -> np.ndarray:
    """Row-stochastic 3x3 matrix from state[t] -> state[t+stride] transitions
    sampled every `stride` bars. stride=1 reproduces the flawed legacy
    overlapping count; stride=window gives the honest FIX-1 matrix."""
    s = states[~np.isnan(states)].astype(int)
    counts = np.zeros((3, 3))
    idx = np.arange(0, len(s) - stride, stride)
    for i in idx:
        counts[s[i], s[i + stride]] += 1
    rows = counts.sum(axis=1, keepdims=True)
    with np.errstate(invalid="ignore", divide="ignore"):
        mat = np.where(rows > 0, counts / rows, 1 / 3)
    return mat


def stationary(mat: np.ndarray) -> np.ndarray:
    vals, vecs = np.linalg.eig(mat.T)
    v = np.real(vecs[:, np.argmin(np.abs(vals - 1))])
    return v / v.sum()


def signal_from(mat: np.ndarray, current_state: int) -> float:
    """P(bull next window) - P(bear next window) from the current state's row."""
    row = mat[current_state]
    return float(row[BULL] - row[BEAR])


def fmt_matrix(mat: np.ndarray, title: str) -> str:
    hdr = "            " + "".join(f"{STATE_NAMES[j]:>10}" for j in range(3))
    lines = [title, hdr]
    for i in range(3):
        lines.append(f"  {STATE_NAMES[i]:>9} " +
                     "".join(f"{mat[i, j]:>10.3f}" for j in range(3)))
    diag = ", ".join(f"{STATE_NAMES[i]} {mat[i, i]:.1%}" for i in range(3))
    lines.append(f"  stickiness (diagonal): {diag}")
    return "\n".join(lines)


# ------------------------------------------------------------- backtest ----

def walk_forward(close: pd.Series, states: pd.Series, *, stride: int,
                 mode: str = "standalone", cap: float = 1.0,
                 threshold: float = 0.10, signal_ref: float = 0.5,
                 min_signal: float = 0.0,
                 warmup: int = 756, cost_bps: float = 2.0, ppy: int = 252,
                 legacy_overlap: bool = False,
                 base_strategy=None) -> dict:
    """Walk-forward backtest: the matrix is refit every `stride` bars using
    ONLY data seen so far (never the bars being traded).

    STANDALONE: position = clip(signal / signal_ref, -1, 1) * cap; with
    min_signal > 0 the position is 0 unless |signal| >= min_signal (the
    conviction gate: trade less, only when the matrix actually leans).
    FILTER: base strategy position (default: always long 1.0) allowed long
    only when signal > threshold, short only when signal < -threshold,
    flat otherwise.
    legacy_overlap=True uses the flawed stride-1 matrix (for the before-fix
    comparison only).
    """
    s = states.values
    px = close.values
    daily_ret = np.diff(px) / px[:-1]
    n = len(px)
    pos = np.zeros(n)
    mat = None
    fit_stride = 1 if legacy_overlap else stride
    for t in range(warmup, n - 1):
        if mat is None or (t - warmup) % stride == 0:
            mat = transition_matrix(s[:t + 1], stride=fit_stride)
        if np.isnan(s[t]):
            pos[t] = 0.0
            continue
        sig = signal_from(mat, int(s[t]))
        if mode == "standalone":
            if abs(sig) < min_signal:
                pos[t] = 0.0
            else:
                pos[t] = float(np.clip(sig / signal_ref, -1, 1)) * cap
        else:  # filter
            base = base_strategy(t) if base_strategy else 1.0
            if sig > threshold:
                pos[t] = max(base, 0.0) * cap
            elif sig < -threshold:
                pos[t] = min(base, 0.0) * cap
            else:
                pos[t] = 0.0
    strat = pos[:-1] * daily_ret - np.abs(np.diff(pos, prepend=0.0))[:-1] * cost_bps / 1e4
    strat = strat[warmup:]
    bench = daily_ret[warmup:]
    equity = np.cumprod(1 + strat)
    peak = np.maximum.accumulate(equity)
    active = strat[pos[warmup:-1] != 0]
    gains, losses = active[active > 0].sum(), -active[active < 0].sum()
    yrs = len(strat) / ppy
    return {
        "index": close.index[warmup + 1:],
        "equity": equity,
        "bench_equity": np.cumprod(1 + bench),
        "win_rate": float((active > 0).mean()) if len(active) else 0.0,
        "profit_factor": float(gains / losses) if losses > 0 else float("inf"),
        "max_drawdown": float((equity / peak - 1).min()),
        "cagr": float(equity[-1] ** (1 / yrs) - 1),
        "sharpe": float(strat.mean() / strat.std() * np.sqrt(ppy)) if strat.std() else 0.0,
        "exposure": float((pos[warmup:-1] != 0).mean()),
    }


# ------------------------------------------------------------------ hmm ----

def hmm_crosscheck(close: pd.Series, states: pd.Series, window: int = 20):
    """Optional: fit a 3-state Gaussian HMM on daily log returns with NO
    hand-made labels; map HMM states to BULL/BEAR/SIDEWAYS by mean return and
    report agreement with the threshold labels. Agreement = green light."""
    from hmmlearn.hmm import GaussianHMM
    lr = np.log(close / close.shift()).dropna().values.reshape(-1, 1)
    hmm = GaussianHMM(n_components=3, covariance_type="full",
                      n_iter=200, random_state=0).fit(lr)
    hidden = hmm.predict(lr)
    means = hmm.means_.ravel()
    order = np.argsort(means)  # low..high mean return
    remap = {order[0]: BEAR, order[1]: SIDEWAYS, order[2]: BULL}
    hmm_states = pd.Series([remap[h] for h in hidden], index=close.index[1:])
    both = pd.concat([states, hmm_states], axis=1, keys=["thr", "hmm"]).dropna()
    agree = float((both["thr"] == both["hmm"]).mean())
    per_state = {STATE_NAMES[k]: float((both["hmm"] == k)[both["thr"] == k].mean())
                 for k in range(3)}
    return {"agreement": agree, "per_state": per_state}


# ----------------------------------------------------------------- main ----

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--csv")
    src.add_argument("--ticker")
    src.add_argument("--synthetic", action="store_true")
    ap.add_argument("--years", type=int, default=10)
    ap.add_argument("--profile", choices=["equity", "crypto"], default="equity",
                    help="synthetic-data calibration only")
    ap.add_argument("--mode", choices=["standalone", "filter"], default="standalone")
    ap.add_argument("--cap", type=float, default=1.0)
    ap.add_argument("--min-signal", type=float, default=0.0,
                    help="standalone conviction gate: flat when |signal| below this")
    ap.add_argument("--threshold", type=float, default=0.10)
    ap.add_argument("--warmup", type=int, default=756,
                    help="bars reserved for the initial matrix fit")
    ap.add_argument("--ppy", type=int, default=252,
                    help="bars per year for annualization (12 for monthly data)")
    ap.add_argument("--window", type=int, default=20)
    ap.add_argument("--bull", type=float, default=0.05)
    ap.add_argument("--bear", type=float, default=-0.05)
    ap.add_argument("--hmm", action="store_true")
    ap.add_argument("--enhanced", action="store_true")
    ap.add_argument("--plot")
    args = ap.parse_args()

    if args.csv:
        df = pd.read_csv(args.csv, parse_dates=[0], index_col=0)
        df.columns = [c.title() for c in df.columns]
    elif args.ticker:
        df = fetch_prices(args.ticker, args.years)
    else:
        df = synthetic_prices(args.years, profile=args.profile)
        print("=" * 68)
        print("SYNTHETIC DATA — regime-switching simulation, NOT a real asset.")
        print("Numbers below demonstrate the machinery only.")
        print("=" * 68)

    close = df["Close"]
    if args.enhanced:
        states = enhanced_states(df, args.window)
        base_states = label_states(close, args.window, args.bull, args.bear)
    else:
        states = label_states(close, args.window, args.bull, args.bear)
        base_states = None

    # FIX 2 — verify before displaying anything
    known = []
    if args.ticker and args.ticker.upper() == "SPY":
        known = [("2020-03-23", BEAR, "COVID crash trough (2020-03-23)"),
                 ("2021-11-05", BULL, "2021 bull run (2021-11-05)"),
                 ("2015-10-30", SIDEWAYS, "flat stretch (2015-10-30)")]
    for name, exp, got, ok in self_check_labels(close, states, args.window, known):
        print(f"  label check | {name}: expected {exp}, got {got} — "
              f"{'PASS' if ok else 'FAIL'}")

    # FIX 1 — both matrices, side by side, with the warning
    legacy = transition_matrix(states.values, stride=1)
    true_m = transition_matrix(states.values, stride=args.window)
    print()
    print(fmt_matrix(legacy, "LEGACY matrix (overlapping windows — FLAWED)"))
    print()
    print(fmt_matrix(true_m, f"STRIDE-SAMPLED matrix (stride={args.window} — honest)"))
    print("\n⚠ Only the stride-sampled matrix is statistically honest: "
          "consecutive overlapping windows share "
          f"{args.window - 1}/{args.window} days, faking diagonal persistence.")

    # multi-day forecasts and stationary convergence
    pi = stationary(true_m)
    print(f"\nStationary distribution: " +
          ", ".join(f"{STATE_NAMES[i]} {pi[i]:.1%}" for i in range(3)))
    for k in (1, 3, 6, 12):
        mk = np.linalg.matrix_power(true_m, k)
        drift = np.abs(mk - pi).max()
        print(f"  P^{k} ({k * args.window} bars ahead): max deviation from "
              f"stationary = {drift:.3f}")
    print("  -> long-horizon forecasts converge to the stationary distribution "
          "and carry no signal.")

    if args.enhanced and base_states is not None:
        both = pd.concat([base_states, states], axis=1).dropna()
        agree = float((both.iloc[:, 0] == both.iloc[:, 1]).mean())
        po = transition_matrix(base_states.values, stride=args.window)
        print(f"\nEnhanced vs price-only states: {agree:.0%} agreement; "
              f"stickiness diagonal shift: " +
              ", ".join(f"{STATE_NAMES[i]} {po[i, i]:.2f}->{true_m[i, i]:.2f}"
                        for i in range(3)))

    if args.hmm:
        try:
            res = hmm_crosscheck(close, states, args.window)
            print(f"\nHMM cross-check (no hand-made labels): "
                  f"{res['agreement']:.0%} overall agreement; per state: " +
                  ", ".join(f"{k} {v:.0%}" for k, v in res["per_state"].items()))
            print("  -> agreement is the green light; disagreement means the "
                  "thresholds are fighting the data.")
        except ImportError:
            print("\nHMM mode skipped: pip install hmmlearn")

    # walk-forward, before-fix vs after-fix
    kw = dict(stride=args.window, mode=args.mode, cap=args.cap,
              threshold=args.threshold, min_signal=args.min_signal,
              warmup=args.warmup, ppy=args.ppy)
    fixed = walk_forward(close, states, **kw)
    broken = walk_forward(close, states, legacy_overlap=True, **kw)
    print(f"\nWalk-forward backtest ({args.mode.upper()} mode, cap {args.cap:g}x, "
          f"3y warmup, matrix refit every {args.window} bars, 2bps costs):")
    hdr = f"  {'':24}{'BEFORE fix (overlap)':>22}{'AFTER fix (stride)':>22}"
    print(hdr)
    for key, fmt in [("win_rate", "{:.1%}"), ("profit_factor", "{:.2f}"),
                     ("max_drawdown", "{:.1%}"), ("cagr", "{:.1%}"),
                     ("sharpe", "{:.2f}"), ("exposure", "{:.1%}")]:
        print(f"  {key:<24}{fmt.format(broken[key]):>22}{fmt.format(fixed[key]):>22}")

    if args.plot:
        plot_equity(fixed, broken, args.plot,
                    synthetic=bool(df.attrs.get("synthetic")))
        print(f"\nEquity curve written to {args.plot}")

    print('\n"Backtests flatter. The fixed matrix shows uglier, truer numbers — '
          'those are the only ones worth trading."')
    return fixed, broken


def plot_equity(fixed: dict, broken: dict, path: str, synthetic: bool = False):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    ink, faint = "#121A2B", "#5A6472"
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=150)
    ax.plot(fixed["index"], fixed["bench_equity"], color="#4a3aa7", lw=1.2,
            label="Buy & hold")
    ax.plot(broken["index"], broken["equity"], color="#eda100", lw=1.4,
            label="Before fix (overlapping matrix)")
    ax.plot(fixed["index"], fixed["equity"], color="#2a78d6", lw=1.8,
            label="After fix (stride-sampled matrix)")
    ax.set_yscale("log")
    ax.set_ylabel("Growth of $1 (log scale)", color=ink)
    title = "Markov 2.0 walk-forward equity"
    if synthetic:
        title += "  —  SYNTHETIC DATA (machinery demo, not a real asset)"
    ax.set_title(title, color=ink, loc="left", fontsize=12, fontweight="bold")
    ax.legend(frameon=False, loc="upper left", fontsize=9)
    ax.grid(axis="y", color="#E4E7EB", lw=0.6)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(faint)
    ax.tick_params(colors=faint, labelsize=9)
    fig.tight_layout()
    fig.savefig(path, facecolor="white")
    plt.close(fig)


if __name__ == "__main__":
    main()
