// Binance SPOT TESTNET auto-trader — runs on GitHub Actions every 30 min.
// FAKE MONEY ONLY: the execution endpoint is hard-coded to the testnet.
// Strategy: follow the ensemble signal long-only per asset, sized by the
// same kelly-capped fraction the dashboard shows, rebalancing only when
// the drift exceeds 5% of equity. No signal / no measured edge → flat.
// Writes actions.json for the workflow to post into the journal issue.

import { writeFileSync } from "node:fs";
import { analyze } from "../src/lib/quant/analyze";
import { ASSETS } from "../src/lib/quant/config";
import { fetchSeries } from "../src/lib/quant/fetchClient";
import {
  longOnlyTarget,
  makeClient,
  rebalanceDelta,
  roundStep,
} from "../src/lib/quant/testnet";

const MIN_CONVICTION = 0.35;
const MIN_NOTIONAL_USDT = 11;

interface Action {
  line: string; // Hebrew journal line
}

interface BinanceBalance {
  asset: string;
  free: string;
}

async function main() {
  const key = process.env.BINANCE_TESTNET_KEY;
  const secret = process.env.BINANCE_TESTNET_SECRET;
  if (!key || !secret) {
    console.log(
      "No testnet keys configured (BINANCE_TESTNET_KEY / BINANCE_TESTNET_SECRET repo secrets). Skipping.",
    );
    writeFileSync("actions.json", "[]");
    return;
  }
  const client = makeClient(key, secret);
  const actions: Action[] = [];
  const cryptos = ASSETS.filter((a) => a.kind === "crypto" && a.binance);

  // production data for signals; testnet only for balances + orders
  const seriesMap = new Map<string, Awaited<ReturnType<typeof fetchSeries>>>();
  for (const a of cryptos) {
    const s = await fetchSeries(a.id, "1d");
    if (s.source !== "fixture") seriesMap.set(a.id, s);
  }
  if (seriesMap.size === 0) {
    console.log("no live market data — not trading");
    writeFileSync("actions.json", "[]");
    return;
  }

  const account = (await client.get("/api/v3/account")) as { balances: BinanceBalance[] };
  const free = new Map(account.balances.map((b) => [b.asset, parseFloat(b.free)]));

  const price = new Map<string, number>();
  for (const [id, s] of seriesMap) price.set(id, s.candles[s.candles.length - 1].c);

  let equity = free.get("USDT") ?? 0;
  for (const a of cryptos) {
    const base = a.binance!.replace("USDT", "");
    equity += (free.get(base) ?? 0) * (price.get(a.id) ?? 0);
  }
  if (equity <= 0) throw new Error("testnet equity is zero — generate funds at testnet.binance.vision");

  // exchange filters for sell rounding
  const info = (await fetch(
    `https://testnet.binance.vision/api/v3/exchangeInfo?symbols=${encodeURIComponent(JSON.stringify(cryptos.map((a) => a.binance)))}`,
    { signal: AbortSignal.timeout(15000) },
  ).then((r) => r.json())) as {
    symbols: Array<{ symbol: string; filters: Array<{ filterType: string; stepSize?: string }> }>;
  };
  const stepOf = new Map<string, number>();
  for (const sym of info.symbols) {
    const lot = sym.filters.find((f) => f.filterType === "LOT_SIZE");
    stepOf.set(sym.symbol, parseFloat(lot?.stepSize ?? "0"));
  }

  for (const a of cryptos) {
    const s = seriesMap.get(a.id);
    if (!s) continue;
    const an = analyze(s, equity);
    const e = an.ensemble;
    const p = price.get(a.id)!;
    const base = a.binance!.replace("USDT", "");

    const strong = e.conviction >= MIN_CONVICTION && an.kelly.half > 0;
    const target = strong ? longOnlyTarget(e.direction, e.positionFrac) : 0;
    const curFrac = ((free.get(base) ?? 0) * p) / equity;
    const delta = rebalanceDelta(target, curFrac);
    if (delta === 0) {
      console.log(`${a.id}: hold (target ${(target * 100).toFixed(0)}%, current ${(curFrac * 100).toFixed(0)}%)`);
      continue;
    }

    if (delta > 0) {
      const quote = Math.min(delta * equity, free.get("USDT") ?? 0);
      if (quote < MIN_NOTIONAL_USDT) continue;
      await client.post("/api/v3/order", {
        symbol: a.binance!,
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: quote.toFixed(2),
      });
      actions.push({
        line: `🟢 קנייה (Testnet): ${a.id} בכ-$${quote.toFixed(0)} — יעד ${(target * 100).toFixed(0)}% מהתיק (ביטחון ${(e.conviction * 100).toFixed(0)}%, קלי ${(an.kelly.half * 100).toFixed(0)}%)`,
      });
    } else {
      const qty = roundStep((-delta * equity) / p, stepOf.get(a.binance!) ?? 0);
      if (qty * p < MIN_NOTIONAL_USDT) continue;
      await client.post("/api/v3/order", {
        symbol: a.binance!,
        side: "SELL",
        type: "MARKET",
        quantity: String(qty),
      });
      actions.push({
        line: `🔴 מכירה (Testnet): ${qty} ${a.id} (~$${(qty * p).toFixed(0)}) — ${target === 0 ? "יציאה: אין אות/אין יתרון מדוד" : `הקטנה ליעד ${(target * 100).toFixed(0)}%`}`,
      });
    }
  }

  actions.push({
    line: `💼 שווי תיק Testnet: ~$${equity.toFixed(0)} | USDT פנוי: $${(free.get("USDT") ?? 0).toFixed(0)}`,
  });
  // the equity line alone is not worth a notification — only real orders are
  if (actions.length === 1) {
    console.log("no orders this cycle;", actions[0].line);
    writeFileSync("actions.json", "[]");
    return;
  }
  writeFileSync("actions.json", JSON.stringify(actions, null, 2));
  for (const x of actions) console.log(x.line);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
