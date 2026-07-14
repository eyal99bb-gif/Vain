// Offline fallback data. NEVER shown as live — every series carries
// source: "fixture" and the UI renders a warning banner.

import type { Candle, Interval, PriceSeries } from "./types";

/**
 * Real BTC-USD month-open prices, Feb 2020 – Jul 2026, transcribed from the
 * user's Yahoo Finance screenshots (verified across overlapping screenshots).
 * Same series as .claude/skills/markov-2-hedge-fund-method/data/BTC-USD-monthly.csv.
 */
const BTC_MONTHLY: Array<[string, number]> = [
  ["2020-02-01", 9346.36], ["2020-03-01", 8599.76], ["2020-04-01", 6437.32],
  ["2020-05-01", 8672.78], ["2020-06-01", 9463.61], ["2020-07-01", 9145.99],
  ["2020-08-01", 11322.57], ["2020-09-01", 11679.32], ["2020-10-01", 10795.25],
  ["2020-11-01", 13781.0], ["2020-12-01", 19633.77], ["2021-01-01", 28994.01],
  ["2021-02-01", 33114.58], ["2021-03-01", 45159.5], ["2021-04-01", 58926.56],
  ["2021-05-01", 57714.66], ["2021-06-01", 37293.79], ["2021-07-01", 35035.98],
  ["2021-08-01", 41460.84], ["2021-09-01", 47099.77], ["2021-10-01", 43816.74],
  ["2021-11-01", 61320.45], ["2021-12-01", 56907.96], ["2022-01-01", 46311.75],
  ["2022-02-01", 38481.77], ["2022-03-01", 43194.5], ["2022-04-01", 45554.16],
  ["2022-05-01", 37713.27], ["2022-06-01", 31792.55], ["2022-07-01", 19820.47],
  ["2022-08-01", 23336.72], ["2022-09-01", 20050.5], ["2022-10-01", 19431.11],
  ["2022-11-01", 20494.9], ["2022-12-01", 17168.0], ["2023-01-01", 16547.91],
  ["2023-02-01", 23137.84], ["2023-03-01", 23150.93], ["2023-04-01", 28473.33],
  ["2023-05-01", 29227.1], ["2023-06-01", 27218.41], ["2023-07-01", 30471.85],
  ["2023-08-01", 29230.87], ["2023-09-01", 25934.02], ["2023-10-01", 26967.4],
  ["2023-11-01", 34657.27], ["2023-12-01", 37718.01], ["2024-01-01", 42280.23],
  ["2024-02-01", 42569.76], ["2024-03-01", 61168.06], ["2024-04-01", 71333.48],
  ["2024-05-01", 60609.5], ["2024-06-01", 67489.61], ["2024-07-01", 62673.61],
  ["2024-08-01", 64625.84], ["2024-09-01", 58969.8], ["2024-10-01", 63335.61],
  ["2024-11-01", 70216.9], ["2024-12-01", 96461.34], ["2025-01-01", 93425.1],
  ["2025-02-01", 102402.8], ["2025-03-01", 84373.87], ["2025-04-01", 82551.92],
  ["2025-05-01", 94212.86], ["2025-06-01", 104637.3], ["2025-07-01", 107144.38],
  ["2025-08-01", 115738.95], ["2025-09-01", 108228.75], ["2025-10-01", 114057.59],
  ["2025-11-01", 109558.63], ["2025-12-01", 90389.11], ["2026-01-01", 87508.05],
  ["2026-02-01", 78626.13], ["2026-03-01", 67005.88], ["2026-04-01", 68232.89],
  ["2026-05-01", 76305.05], ["2026-06-01", 73580.21], ["2026-07-01", 58562.45],
];

export function btcMonthlyFixture(): PriceSeries {
  const candles: Candle[] = BTC_MONTHLY.map(([d, p], i) => {
    const next = BTC_MONTHLY[i + 1]?.[1] ?? p;
    return {
      t: Date.parse(d),
      o: p,
      h: Math.max(p, next),
      l: Math.min(p, next),
      c: p,
      v: 0,
    };
  });
  return {
    symbol: "BTC",
    kind: "crypto",
    interval: "1M",
    candles,
    source: "fixture",
    fetchedAt: Date.now(),
    fixtureNote:
      "נתוני ביטקוין חודשיים אמיתיים (פברואר 2020–יולי 2026), לא עדכניים לרגע זה",
  };
}

/** deterministic PRNG (mulberry32) so fixtures are reproducible */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from a uniform PRNG */
function gaussian(rng: () => number) {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Synthetic regime-switching daily series (port of the skill's
 * synthetic_prices, crypto profile). CLEARLY a simulation — for offline
 * demo and tests only.
 */
export function syntheticDailyFixture(symbol: string, years = 6, seed = 7): PriceSeries {
  const rng = mulberry32(seed);
  const n = Math.round(years * 365);
  const mu = [0.0, 1.2 / 365, -0.9 / 365]; // sideways, bull, bear (daily)
  const sig = [0.45 / 19, 0.55 / 19, 0.85 / 19];
  const stay = [0.988, 0.99, 0.982];
  let state = 1;
  const candles: Candle[] = [];
  let price = 30000;
  const dayMs = 86400000;
  const start = Date.now() - n * dayMs;
  for (let i = 0; i < n; i++) {
    if (rng() > stay[state]) {
      const others = [0, 1, 2].filter((s) => s !== state);
      state = others[Math.floor(rng() * 2)];
    }
    const r = mu[state] + sig[state] * gaussian(rng);
    const o = price;
    price = price * Math.exp(r);
    const h = Math.max(o, price) * (1 + Math.abs(gaussian(rng)) * 0.004);
    const l = Math.min(o, price) * (1 - Math.abs(gaussian(rng)) * 0.004);
    candles.push({ t: start + i * dayMs, o, h, l, c: price, v: 1e9 * (0.7 + rng()) });
  }
  return {
    symbol,
    kind: "crypto",
    interval: "1d",
    candles,
    source: "fixture",
    fetchedAt: Date.now(),
    fixtureNote: "סימולציה סינתטית — לא נתוני שוק אמיתיים",
  };
}

export function fixtureFor(symbol: string, interval: Interval): PriceSeries {
  if (symbol === "BTC" && interval === "1M") return btcMonthlyFixture();
  const s = syntheticDailyFixture(symbol);
  s.interval = interval;
  return s;
}
