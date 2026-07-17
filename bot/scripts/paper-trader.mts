// Alpaca PAPER auto-trader — runs on GitHub Actions every 30 min.
// FAKE MONEY ONLY: the endpoint is hard-coded to paper-api.alpaca.markets
// AND the key must be a paper key (starts with PK). Strategy: follow the
// ensemble signal long-only per crypto asset, sized by the same
// kelly-capped fraction the dashboard shows, rebalancing only when the
// drift exceeds 5% of equity. No signal / no measured edge → flat.
//
// Outputs: actions.json (executed orders → journal issue comments, which
// notify) and status.json (the heartbeat, always written).

import { writeFileSync } from "node:fs";
import { analyze } from "../src/lib/quant/analyze";
import { ASSETS } from "../src/lib/quant/config";
import { fetchSeries } from "../src/lib/quant/fetchClient";
import { isPaperKey, makeAlpaca } from "../src/lib/quant/alpaca";
import { longOnlyTarget, rebalanceDelta } from "../src/lib/quant/testnet";

const MIN_CONVICTION = 0.35;
const MIN_NOTIONAL_USD = 10;

// dashboard asset id → Alpaca order symbol / position symbol
const ORDER_SYMBOL: Record<string, string> = {
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  SOL: "SOL/USD",
};
const POS_SYMBOL: Record<string, string> = {
  BTC: "BTCUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
};

interface Action {
  line: string;
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
  const key = (process.env.ALPACA_KEY ?? "").trim();
  const secret = (process.env.ALPACA_SECRET ?? "").trim();
  if (!key || !secret) {
    status.push(
      "⚠️ אין מפתחות Alpaca מוגדרים (Secrets בשם ALPACA_KEY / ALPACA_SECRET) — הבוט לא סוחר. הרשמה חינם: alpaca.markets → Paper Trading → API Keys.",
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
      "🛑 המפתח שהוזן אינו מפתח Paper (מפתחות מדומים מתחילים ב-PK). הבוט מסרב לגעת בחשבון אמיתי — צור מפתח מסביבת ה-Paper Trading בלבד.",
    );
    writeOut([]);
    return;
  }

  const client = makeAlpaca(key, secret);
  const actions: Action[] = [];

  // 🧪 one-shot pipeline test: buy $10 of BTC, confirm the position exists,
  // close it immediately. Proves keys, orders, fills, journal + alerts.
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
        /* position not visible yet */
      }
    }
    if (!filled) throw new Error("test buy did not fill within 30s — check the Orders page on Alpaca");
    await client.del("/v2/positions/BTCUSD");
    const line1 = "🧪 עסקת ניסיון: קנייה של $10 ביטקוין — בוצעה ואושרה";
    const line2 = "🧪 עסקת ניסיון: הפוזיציה נסגרה מיד — סיבוב מלא הושלם. צינור הביצוע עובד! ✅";
    actions.push({ line: line1 }, { line: line2 });
    status.push(line1, line2);
    writeOut(actions);
    return;
  }

  const cryptos = ASSETS.filter((a) => a.kind === "crypto" && ORDER_SYMBOL[a.id]);

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

  const account = (await client.get("/v2/account")) as { equity: string; cash: string };
  const equity = parseFloat(account.equity);
  let cash = parseFloat(account.cash);
  if (!(equity > 0)) throw new Error("paper equity is zero");

  const positions = (await client.get("/v2/positions")) as Array<{
    symbol: string;
    market_value: string;
  }>;
  const posValue = new Map(positions.map((p) => [p.symbol, parseFloat(p.market_value)]));

  status.push(
    `💼 שווי תיק מדומה (Alpaca Paper): ~$${equity.toFixed(0)} (מזומן פנוי: $${cash.toFixed(0)})`,
  );

  for (const a of cryptos) {
    const s = seriesMap.get(a.id);
    if (!s) {
      status.push(`▫️ ${a.id}: אין נתונים חיים בסבב הזה`);
      continue;
    }
    const an = analyze(s, equity);
    const e = an.ensemble;

    const strong = e.conviction >= MIN_CONVICTION && an.kelly.half > 0;
    const target = strong ? longOnlyTarget(e.direction, e.positionFrac) : 0;
    const curVal = posValue.get(POS_SYMBOL[a.id]) ?? 0;
    const curFrac = curVal / equity;
    const delta = rebalanceDelta(target, curFrac);

    const why =
      e.direction < 0
        ? "אות שורט — גרסת הקריפטו לונג בלבד, נשארים בחוץ"
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
      const notional = Math.min(delta * equity, cash);
      if (notional < MIN_NOTIONAL_USD) {
        status.push(`▫️ ${a.id}: ${why} — הפער קטן מהמינימום, אין פעולה`);
        continue;
      }
      await client.post("/v2/orders", {
        symbol: ORDER_SYMBOL[a.id],
        notional: notional.toFixed(2),
        side: "buy",
        type: "market",
        time_in_force: "gtc",
      });
      cash -= notional;
      const line = `🟢 קנייה (מדומה): ${a.id} ב-$${notional.toFixed(0)} — יעד ${pct(target)} מהתיק (ביטחון ${pct(e.conviction)}, קלי ${pct(an.kelly.half)})`;
      actions.push({ line });
      status.push(line);
    } else {
      const notional = Math.min(-delta * equity, curVal);
      if (notional < MIN_NOTIONAL_USD) {
        status.push(`▫️ ${a.id}: מוחזק ${pct(curFrac)} | הפער קטן מהמינימום, אין פעולה`);
        continue;
      }
      await client.post("/v2/orders", {
        symbol: ORDER_SYMBOL[a.id],
        notional: notional.toFixed(2),
        side: "sell",
        type: "market",
        time_in_force: "gtc",
      });
      const line = `🔴 מכירה (מדומה): ${a.id} ב-$${notional.toFixed(0)} — ${target === 0 ? `יציאה: ${why}` : `הקטנה ליעד ${pct(target)}`}`;
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
