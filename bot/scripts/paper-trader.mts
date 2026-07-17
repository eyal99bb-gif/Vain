// Alpaca PAPER auto-trader — GitHub Actions, every ~30 min. FAKE MONEY ONLY
// (paper endpoint hard-coded + PK-key gate). v2 upgrades:
//   • 10-crypto universe (long-only) + SPY/QQQ stocks (long AND short)
//   • per-asset cap 25% of equity; buys bounded by free cash
//   • BTC-leader filter: alt longs halved while BTC signals bear
//   • exchange-resting stop orders refreshed every cycle (gap protection)
//   • kelly-capped sizing, 5% rebalance band — unchanged
// Outputs: actions.json (orders → journal comments) + status.json (heartbeat).

import { writeFileSync } from "node:fs";
import { analyze, type Analysis } from "../src/lib/quant/analyze";
import { ASSETS } from "../src/lib/quant/config";
import { fetchSeries } from "../src/lib/quant/fetchClient";
import { fetchStockServer, SERVER_STOCKS } from "../src/lib/quant/fetchServer";
import { isPaperKey, makeAlpaca, type AlpacaClient } from "../src/lib/quant/alpaca";
import { longOnlyTarget, rebalanceDelta } from "../src/lib/quant/testnet";
import type { PriceSeries } from "../src/lib/quant/types";

const MIN_CONVICTION = 0.35;
const MIN_NOTIONAL_USD = 10;
const PER_ASSET_CAP = 0.25;

const orderSymbol = (id: string, kind: string) => (kind === "crypto" ? `${id}/USD` : id);
const posSymbol = (id: string, kind: string) => (kind === "crypto" ? `${id}USD` : id);

interface Action {
  line: string;
}

const status: string[] = [];
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const usd = (x: number) => `$${x.toFixed(0)}`;

function writeOut(actions: Action[]) {
  writeFileSync("actions.json", JSON.stringify(actions, null, 2));
  writeFileSync(
    "status.json",
    JSON.stringify({ updatedAt: new Date().toISOString(), lines: status }, null, 2),
  );
  for (const l of status) console.log(l);
}

async function cancelOurStops(client: AlpacaClient, ourSymbols: Set<string>) {
  const open = (await client.get("/v2/orders?status=open&limit=500")) as Array<{
    id: string;
    symbol: string;
    type: string;
  }>;
  for (const o of open) {
    if (o.type.includes("stop") && ourSymbols.has(o.symbol.replace("/", ""))) {
      try {
        await client.del(`/v2/orders/${o.id}`);
      } catch {
        /* already filled/canceled */
      }
    }
  }
}

async function main() {
  const key = (process.env.ALPACA_KEY ?? "").trim();
  const secret = (process.env.ALPACA_SECRET ?? "").trim();
  if (!key || !secret) {
    status.push(
      "⚠️ אין מפתחות Alpaca מוגדרים (Secrets בשם ALPACA_KEY / ALPACA_SECRET) — הבוט לא סוחר.",
    );
    writeOut([]);
    return;
  }
  const shape = /^[A-Za-z0-9\-_]{8,}$/;
  if (!shape.test(key) || !shape.test(secret)) {
    const which = !shape.test(key) ? "ALPACA_KEY" : "ALPACA_SECRET";
    const bad = (!shape.test(key) ? key : secret)
      .split("")
      .findIndex((c) => !/[A-Za-z0-9\-_]/.test(c));
    status.push(
      `⚠️ המפתח ${which} מכיל תו לא חוקי (במיקום ${bad + 1}) — כנראה שגיאת העתקה. העתק שוב בכפתור ההעתקה בלבד.`,
    );
    writeOut([]);
    return;
  }
  if (!isPaperKey(key)) {
    status.push(
      "🛑 המפתח שהוזן אינו מפתח Paper (מפתחות מדומים מתחילים ב-PK). הבוט מסרב לגעת בחשבון אמיתי.",
    );
    writeOut([]);
    return;
  }

  const client = makeAlpaca(key, secret);
  const actions: Action[] = [];

  // 🧪 one-shot pipeline test
  if (process.env.TEST_TRADE === "true") {
    await client.post("/v2/orders", {
      symbol: "BTC/USD",
      notional: "10",
      side: "buy",
      type: "market",
      time_in_force: "gtc",
    });
    let filled = false;
    for (let i = 0; i < 10 && !filled; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const pos = (await client.get("/v2/positions/BTCUSD")) as { qty: string };
        filled = parseFloat(pos.qty) > 0;
      } catch {
        /* not visible yet */
      }
    }
    if (!filled) throw new Error("test buy did not fill within 30s");
    await client.del("/v2/positions/BTCUSD");
    const l1 = "🧪 עסקת ניסיון: קנייה של $10 ביטקוין — בוצעה ואושרה";
    const l2 = "🧪 עסקת ניסיון: הפוזיציה נסגרה — צינור הביצוע עובד! ✅";
    actions.push({ line: l1 }, { line: l2 });
    status.push(l1, l2);
    writeOut(actions);
    return;
  }

  // ── market data: crypto from Binance, stocks from stooq/yahoo ──
  const universe = ASSETS.filter(
    (a) => (a.kind === "crypto" && a.binance) || SERVER_STOCKS.includes(a.id),
  );
  const seriesMap = new Map<string, PriceSeries>();
  for (const a of universe) {
    try {
      const s =
        a.kind === "crypto" ? await fetchSeries(a.id, "1d") : await fetchStockServer(a.id, "1d");
      if (s.source !== "fixture") seriesMap.set(a.id, s);
    } catch {
      status.push(`▫️ ${a.id}: אין נתונים חיים בסבב הזה`);
    }
  }
  if (seriesMap.size === 0) {
    status.push("⚠️ אין נתוני שוק חיים כרגע — הבוט לא סוחר בסבב הזה.");
    writeOut([]);
    return;
  }

  const account = (await client.get("/v2/account")) as { equity: string; cash: string };
  const equity = parseFloat(account.equity);
  let cash = parseFloat(account.cash);
  if (!(equity > 0)) throw new Error("paper equity is zero");

  const positions = (await client.get("/v2/positions")) as Array<{
    symbol: string;
    qty: string;
  }>;
  const posQty = new Map(positions.map((p) => [p.symbol, parseFloat(p.qty)]));
  const price = new Map<string, number>();
  for (const [id, s] of seriesMap) price.set(id, s.candles[s.candles.length - 1].c);

  status.push(`💼 שווי תיק מדומה (Alpaca Paper): ~${usd(equity)} (מזומן פנוי: ${usd(cash)})`);

  // clear old resting stops before rebalancing (avoid qty reservations)
  const ourSyms = new Set(universe.map((a) => posSymbol(a.id, a.kind)));
  await cancelOurStops(client, ourSyms);

  // BTC leads the crypto market: analyze everything, read BTC first
  const analyses = new Map<string, Analysis>();
  for (const a of universe) {
    const s = seriesMap.get(a.id);
    if (s) analyses.set(a.id, analyze(s, equity));
  }
  const btcDir = analyses.get("BTC")?.ensemble.direction ?? 0;

  interface StopPlan {
    a: (typeof universe)[number];
    qty: number;
    stop: number;
  }
  const stopPlans: StopPlan[] = [];

  for (const a of universe) {
    const an = analyses.get(a.id);
    const p = price.get(a.id);
    if (!an || !p) continue;
    const e = an.ensemble;
    const sym = posSymbol(a.id, a.kind);
    const qty = posQty.get(sym) ?? 0;
    const strong = e.conviction >= MIN_CONVICTION && an.kelly.half > 0;

    let target = 0;
    let leaderNote = "";
    if (strong) {
      if (a.kind === "crypto") {
        target = longOnlyTarget(e.direction, e.positionFrac);
        if (a.id !== "BTC" && btcDir < 0 && target > 0) {
          target *= 0.5;
          leaderNote = " (חצי גודל — ביטקוין דובי)";
        }
      } else {
        target = e.direction * Math.abs(e.positionFrac); // stocks: shorts allowed
      }
    }
    target = Math.max(-PER_ASSET_CAP, Math.min(PER_ASSET_CAP, target));

    const curFrac = (qty * p) / equity;
    const delta = rebalanceDelta(target, curFrac);

    const why =
      e.direction < 0
        ? a.kind === "crypto"
          ? "אות שורט — קריפטו לונג בלבד, נשארים בחוץ"
          : strong
            ? `אות שורט, יעד ${pct(Math.abs(target))} בחסר`
            : "אות שורט חלש — בחוץ"
        : e.direction === 0
          ? "אין אות כיווני"
          : !strong
            ? `אות לונג אבל ${e.conviction < MIN_CONVICTION ? `הביטחון נמוך (${pct(e.conviction)})` : "אין יתרון מדוד (קלי 0)"}`
            : `אות לונג, יעד ${pct(target)}${leaderNote}`;

    if (delta === 0) {
      status.push(
        `▫️ ${a.id}: מוחזק ${pct(curFrac)} | ${why}${target !== 0 ? " — בתוך רצועת האיזון" : ""}`,
      );
    } else if (a.kind === "crypto") {
      if (delta > 0) {
        const notional = Math.min(delta * equity, cash);
        if (notional >= MIN_NOTIONAL_USD) {
          await client.post("/v2/orders", {
            symbol: orderSymbol(a.id, a.kind),
            notional: notional.toFixed(2),
            side: "buy",
            type: "market",
            time_in_force: "gtc",
          });
          cash -= notional;
          posQty.set(sym, qty + notional / p);
          const line = `🟢 קנייה (מדומה): ${a.id} ב-${usd(notional)} — יעד ${pct(target)}${leaderNote} (ביטחון ${pct(e.conviction)})`;
          actions.push({ line });
          status.push(line);
        } else status.push(`▫️ ${a.id}: ${why} — הפער קטן מהמינימום`);
      } else {
        const notional = Math.min(-delta * equity, qty * p);
        if (notional >= MIN_NOTIONAL_USD) {
          await client.post("/v2/orders", {
            symbol: orderSymbol(a.id, a.kind),
            notional: notional.toFixed(2),
            side: "sell",
            type: "market",
            time_in_force: "gtc",
          });
          cash += notional;
          posQty.set(sym, qty - notional / p);
          const line = `🔴 מכירה (מדומה): ${a.id} ב-${usd(notional)} — ${target === 0 ? `יציאה: ${why}` : `הקטנה ליעד ${pct(target)}`}`;
          actions.push({ line });
          status.push(line);
        } else status.push(`▫️ ${a.id}: מוחזק ${pct(curFrac)} | הפער קטן מהמינימום`);
      }
    } else {
      // stocks: whole shares, long or short, day orders (queued off-hours)
      const shares = Math.floor((Math.abs(delta) * equity) / p);
      if (shares < 1) {
        status.push(`▫️ ${a.id}: ${why} — הפער קטן ממניה אחת`);
      } else {
        await client.post("/v2/orders", {
          symbol: a.id,
          qty: String(shares),
          side: delta > 0 ? "buy" : "sell",
          type: "market",
          time_in_force: "day",
        });
        posQty.set(sym, qty + (delta > 0 ? shares : -shares));
        const line = `${delta > 0 ? "🟢 קנייה" : "🔴 מכירה/שורט"} (מדומה): ${shares} מניות ${a.id} (~${usd(shares * p)}) — ${why}`;
        actions.push({ line });
        status.push(line);
      }
    }

    // plan a fresh resting stop for whatever we now hold
    const newQty = posQty.get(sym) ?? 0;
    if (newQty !== 0 && e.stop !== null && Math.abs(newQty * p) >= MIN_NOTIONAL_USD) {
      stopPlans.push({ a, qty: newQty, stop: e.stop });
    }
  }

  // ── resting stops on the exchange: protection even between cycles ──
  for (const sp of stopPlans) {
    try {
      const crypto = sp.a.kind === "crypto";
      const long = sp.qty > 0;
      const stopPx = sp.stop;
      if (crypto) {
        await client.post("/v2/orders", {
          symbol: orderSymbol(sp.a.id, sp.a.kind),
          qty: Math.abs(sp.qty).toFixed(6),
          side: "sell",
          type: "stop_limit",
          stop_price: stopPx.toFixed(2),
          limit_price: (stopPx * 0.995).toFixed(2),
          time_in_force: "gtc",
        });
      } else {
        await client.post("/v2/orders", {
          symbol: sp.a.id,
          qty: String(Math.floor(Math.abs(sp.qty))),
          side: long ? "sell" : "buy",
          type: "stop",
          stop_price: stopPx.toFixed(2),
          time_in_force: "gtc",
        });
      }
      status.push(`🛡 ${sp.a.id}: סטופ מוגן בבורסה ב-${usd(stopPx)}`);
    } catch (err) {
      status.push(`▫️ ${sp.a.id}: לא הצלחתי להציב סטופ בבורסה (${String(err).slice(0, 80)})`);
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
