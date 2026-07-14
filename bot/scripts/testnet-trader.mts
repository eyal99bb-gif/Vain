// Binance SPOT TESTNET auto-trader — runs on GitHub Actions every 30 min.
// FAKE MONEY ONLY: the execution endpoint is hard-coded to the testnet.
// Strategy: follow the ensemble signal long-only per asset, sized by the
// same kelly-capped fraction the dashboard shows, rebalancing only when
// the drift exceeds 5% of equity. No signal / no measured edge → flat.
//
// Outputs:
//   actions.json — executed orders only (the workflow comments them on the
//                  journal issue → the owner gets a notification)
//   status.json  — ALWAYS written: the heartbeat (equity, holdings, and the
//                  decision taken per asset) that the workflow writes into
//                  the "📊 מצב הבוט" issue body without notifying.

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
  line: string;
}

interface BinanceBalance {
  asset: string;
  free: string;
}

const status: string[] = [];
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function writeOut(actions: Action[]) {
  writeFileSync("actions.json", JSON.stringify(actions, null, 2));
  writeFileSync(
    "status.json",
    JSON.stringify({ updatedAt: new Date().toISOString(), lines: status }, null, 2),
  );
  for (const l of status) console.log(l);
}

async function main() {
  const key = process.env.BINANCE_TESTNET_KEY;
  const secret = process.env.BINANCE_TESTNET_SECRET;
  if (!key || !secret) {
    status.push(
      "⚠️ אין מפתחות Testnet מוגדרים (Secrets בשם BINANCE_TESTNET_KEY / BINANCE_TESTNET_SECRET) — הבוט לא סוחר.",
    );
    writeOut([]);
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
    status.push("⚠️ אין נתוני שוק חיים כרגע — הבוט לא סוחר בסבב הזה.");
    writeOut([]);
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
  if (equity <= 0)
    throw new Error("testnet equity is zero — generate funds at testnet.binance.vision");

  status.push(
    `💼 שווי תיק Testnet: ~$${equity.toFixed(0)} (מזה USDT פנוי: $${(free.get("USDT") ?? 0).toFixed(0)})`,
  );

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
    if (!s) {
      status.push(`▫️ ${a.id}: אין נתונים חיים בסבב הזה`);
      continue;
    }
    const an = analyze(s, equity);
    const e = an.ensemble;
    const p = price.get(a.id)!;
    const base = a.binance!.replace("USDT", "");

    const strong = e.conviction >= MIN_CONVICTION && an.kelly.half > 0;
    const target = strong ? longOnlyTarget(e.direction, e.positionFrac) : 0;
    const curFrac = ((free.get(base) ?? 0) * p) / equity;
    const delta = rebalanceDelta(target, curFrac);

    const why =
      e.direction < 0
        ? "אות שורט — חשבון spot לא מוכר בחסר, נשארים בחוץ"
        : e.direction === 0
          ? "אין אות כיווני"
          : !strong
            ? `אות לונג אבל ${e.conviction < MIN_CONVICTION ? `הביטחון נמוך (${pct(e.conviction)})` : "אין יתרון מדוד (קלי 0)"}`
            : `אות לונג, יעד ${pct(target)}`;

    if (delta === 0) {
      status.push(
        `▫️ ${a.id}: מוחזק ${pct(curFrac)} | ${why}${target > 0 ? " — בתוך רצועת האיזון, אין פעולה" : ""}`,
      );
      continue;
    }

    if (delta > 0) {
      const quote = Math.min(delta * equity, free.get("USDT") ?? 0);
      if (quote < MIN_NOTIONAL_USDT) {
        status.push(`▫️ ${a.id}: ${why} — הפער קטן מהמינימום, אין פעולה`);
        continue;
      }
      await client.post("/api/v3/order", {
        symbol: a.binance!,
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: quote.toFixed(2),
      });
      const line = `🟢 קנייה: ${a.id} בכ-$${quote.toFixed(0)} — יעד ${pct(target)} מהתיק (ביטחון ${pct(e.conviction)}, קלי ${pct(an.kelly.half)})`;
      actions.push({ line });
      status.push(line);
    } else {
      const qty = roundStep((-delta * equity) / p, stepOf.get(a.binance!) ?? 0);
      if (qty * p < MIN_NOTIONAL_USDT) {
        status.push(`▫️ ${a.id}: מוחזק ${pct(curFrac)} | הפער קטן מהמינימום, אין פעולה`);
        continue;
      }
      await client.post("/api/v3/order", {
        symbol: a.binance!,
        side: "SELL",
        type: "MARKET",
        quantity: String(qty),
      });
      const line = `🔴 מכירה: ${qty} ${a.id} (~$${(qty * p).toFixed(0)}) — ${target === 0 ? `יציאה: ${why}` : `הקטנה ליעד ${pct(target)}`}`;
      actions.push({ line });
      status.push(line);
    }
  }

  writeOut(actions);
}

main().catch((e) => {
  status.push(`❌ שגיאה בסבב הזה: ${String(e).slice(0, 200)}`);
  try {
    writeOut([]);
  } catch {
    /* ignore */
  }
  console.error(e);
  process.exit(1);
});
