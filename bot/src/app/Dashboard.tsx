"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, type Analysis } from "@/lib/quant/analyze";
import { EXIT, exitState } from "@/lib/quant/exits";
import { buildActionPlan } from "@/lib/quant/plan";
import { compareExitStyles, type TradeStyleReport } from "@/lib/quant/tradeBacktest";
import { ASSETS } from "@/lib/quant/config";
import { STATE_NAMES_HE } from "@/lib/quant/markov";
import { fetchSeries } from "@/lib/quant/fetchClient";
import type { BacktestReport, Interval, PriceSeries } from "@/lib/quant/types";

// palette — validated for dark surface with the dataviz checker:
// strategy blue #3987e5, benchmark yellow #c98500 (CVD ΔE > 78, contrast > 3:1)
const C = {
  strategy: "#3987e5",
  bench: "#c98500",
  long: "#199e70",
  short: "#e66767",
  flat: "#a8a29e",
  gold: "rgba(202,138,4,0.85)",
  card: "#151110",
  border: "rgba(255,255,255,0.08)",
};

const INTERVALS: { id: Interval; label: string }[] = [
  { id: "15m", label: "15 דק'" },
  { id: "1h", label: "שעתי" },
  { id: "1d", label: "יומי" },
  { id: "1w", label: "שבועי" },
  { id: "1M", label: "חודשי" },
];

const pctS = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const dateS = (t: number) =>
  new Date(t).toLocaleDateString("he-IL", { month: "short", year: "2-digit" });

export default function TradingDashboard() {
  const [assetId, setAssetId] = useState("BTC");
  const [interval, setIntervalTf] = useState<Interval>("1d");
  const [account, setAccount] = useState(10000);
  const [series, setSeries] = useState<PriceSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectAsset = (id: string) => {
    setAssetId(id);
    setLoading(true);
    setFetchError(null);
  };
  const selectInterval = (tf: Interval) => {
    setIntervalTf(tf);
    setLoading(true);
    setFetchError(null);
  };

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchSeries(assetId, interval)
        .then((data: PriceSeries) => {
          if (alive) {
            setSeries(data);
            setFetchError(null);
          }
        })
        .catch((e) => {
          if (alive) setFetchError(String(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    load();
    const timer = setInterval(load, 60_000); // live auto-refresh every minute
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [assetId, interval]);

  const [alertsOn, setAlertsOn] = useState(false);
  const [strongOnly, setStrongOnly] = useState(false);
  const lastDir = useRef<Record<string, number>>({});

  const toggleAlerts = useCallback(() => {
    if (!alertsOn && typeof Notification !== "undefined") {
      Notification.requestPermission().then((p) => setAlertsOn(p === "granted"));
    } else {
      setAlertsOn(false);
    }
  }, [alertsOn]);

  const analysis: Analysis | null = useMemo(() => {
    if (!series || series.candles.length < 60) return null;
    try {
      return analyze(series, account);
    } catch {
      return null; // label self-check refused to display — safer to show nothing
    }
  }, [series, account]);

  const shown: Analysis | null = useMemo(() => {
    if (!analysis) return null;
    if (!strongOnly || analysis.ensemble.direction === 0 || analysis.ensemble.conviction >= 0.35)
      return analysis;
    // selective mode: the signal is below the chosen bar — honest flat
    const ens = { ...analysis.ensemble, direction: 0 as const, positionFrac: 0, stop: null };
    return {
      ...analysis,
      ensemble: ens,
      plan: [
        {
          title: "מצב סלקטיבי: האות חלש מהסף (35%)",
          detail: `יש אות ${analysis.ensemble.direction > 0 ? "לונג" : "שורט"} אבל הביטחון (${(analysis.ensemble.conviction * 100).toFixed(0)}%) נמוך מהרף שבחרת — נשארים בחוץ. סבלנות היא פוזיציה.`,
        },
        ...buildActionPlan(ens, analysis.hitRate, analysis.cfg, account).slice(1),
      ],
    };
  }, [analysis, strongOnly, account]);

  useEffect(() => {
    if (!analysis || !alertsOn || typeof Notification === "undefined") return;
    const key = `${assetId}:${interval}`;
    const prev = lastDir.current[key];
    const dir = analysis.ensemble.direction;
    if (prev !== undefined && prev !== dir && Notification.permission === "granted") {
      const txt = dir > 0 ? "לונג ↑" : dir < 0 ? "שורט ↓" : "מחוץ לשוק";
      new Notification(`Vain Trading — ${assetId}`, {
        body: `האות התהפך: עכשיו ${txt}`,
      });
    }
    lastDir.current[key] = dir;
  }, [analysis, alertsOn, assetId, interval]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8 max-w-4xl mx-auto" dir="rtl">
      <header className="mb-6">
        <p className="text-xs tracking-[0.35em] uppercase mb-2" style={{ color: C.gold }}>
          Vain · Trading Advisor
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold"
          style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
        >
          יועץ המסחר
        </h1>
      </header>

      {/* honest-by-design disclaimer — always visible */}
      <div
        className="rounded-lg p-4 mb-6 text-sm leading-relaxed"
        style={{ background: "rgba(202,138,4,0.08)", border: `1px solid rgba(202,138,4,0.25)` }}
      >
        <strong>גילוי נאות:</strong> זה כלי ניתוח, לא ייעוץ השקעות ולא הבטחת רווח. כל
        האחוזים כאן הם היסטוריים, מוצגים עם טווח אי-ודאות, ובקטסטים תמיד מחמיאים.
        לפני כסף אמיתי — לפחות 10 עסקאות נייר.
      </div>

      {/* controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <label className="flex flex-col gap-1 text-xs text-white/50">
          נכס
          <select
            value={assetId}
            onChange={(e) => selectAsset(e.target.value)}
            className="rounded-md px-3 py-2 text-sm text-white"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            {ASSETS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind === "stock" ? `${a.label} — לא חי בגרסה זו` : a.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs text-white/50">
          טווח זמן
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            {INTERVALS.map((tf) => (
              <button
                key={tf.id}
                onClick={() => selectInterval(tf.id)}
                className="px-4 py-2 text-sm transition-colors"
                style={{
                  background: interval === tf.id ? "rgba(202,138,4,0.2)" : C.card,
                  color: interval === tf.id ? "#F0CC55" : "rgba(255,255,255,0.6)",
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          גודל תיק (לחישוב סכומים)
          <input
            type="number"
            min={100}
            value={account}
            onChange={(e) => setAccount(Math.max(100, Number(e.target.value) || 100))}
            className="rounded-md px-3 py-2 text-sm text-white w-32"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          />
        </label>
        <button
          onClick={toggleAlerts}
          className="rounded-md px-4 py-2 text-sm"
          style={{
            background: alertsOn ? "rgba(25,158,112,0.15)" : C.card,
            border: `1px solid ${alertsOn ? "rgba(25,158,112,0.5)" : C.border}`,
            color: alertsOn ? C.long : "rgba(255,255,255,0.6)",
          }}
        >
          {alertsOn ? "🔔 התראות פועלות" : "🔕 הפעל התראות"}
        </button>
        <button
          onClick={() => setStrongOnly((v) => !v)}
          className="rounded-md px-4 py-2 text-sm"
          style={{
            background: strongOnly ? "rgba(202,138,4,0.15)" : C.card,
            border: `1px solid ${strongOnly ? "rgba(202,138,4,0.5)" : C.border}`,
            color: strongOnly ? "#F0CC55" : "rgba(255,255,255,0.6)",
          }}
        >
          {strongOnly ? "🎯 אותות חזקים בלבד" : "🎯 סחור רק באותות חזקים"}
        </button>
      </div>

      {(interval === "15m" || interval === "1h") && (
        <div
          className="rounded-lg p-3 mb-4 text-xs leading-relaxed"
          style={{ background: "rgba(230,103,103,0.08)", border: "1px solid rgba(230,103,103,0.3)" }}
        >
          ⚠ <strong>מסחר תוך-יומי — זהירות כפולה:</strong> בטווחים קצרים הרעש גדל
          והעמלות נאכלות מהר (יותר עסקאות = יותר עלויות). לפני שאתה מתייחס לאות
          כאן, בדוק את שורת &quot;מבחן עמידות בעמלות כפולות&quot; — אם היתרון לא שורד שם,
          הוא לא קיים. וההיסטוריה קצרה: 1000 נרות של 15 דק&apos; הם ~10 ימים בלבד.
        </div>
      )}

      {/* data source status */}
      {series && (
        <div className="mb-6 text-xs text-white/40 flex flex-wrap gap-x-4 gap-y-1 items-center">
          <span>
            מקור נתונים:{" "}
            <span style={{ color: series.source === "fixture" ? C.short : C.long }}>
              {series.source === "binance"
                ? "Binance (חי)"
                : series.source === "coingecko"
                  ? "CoinGecko (חי)"
                  : series.source === "stooq"
                  ? "Stooq (חי)"
                  : series.source === "yahoo"
                    ? "Yahoo (חי)"
                    : "נתוני גיבוי — לא חיים!"}
            </span>
          </span>
          <span>{series.candles.length} נרות</span>
          <span>עדכון אחרון: {new Date(series.fetchedAt).toLocaleTimeString("he-IL")}</span>
          {series.source !== "fixture" && (
            <span className="flex items-center gap-1.5" style={{ color: C.long }}>
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ background: C.long }}
              />
              מתעדכן אוטומטית כל דקה
            </span>
          )}
        </div>
      )}
      {series?.source === "fixture" && (
        <div
          className="rounded-lg p-3 mb-6 text-sm"
          style={{ background: "rgba(230,103,103,0.1)", border: "1px solid rgba(230,103,103,0.4)" }}
        >
          ⚠ לא הצלחנו להגיע למקורות נתונים חיים — מוצגים נתוני גיבוי.{" "}
          {series.fixtureNote}
        </div>
      )}

      {loading && <p className="text-white/50 py-16 text-center">טוען נתונים ומחשב…</p>}
      {fetchError && !loading && (
        <p className="py-16 text-center" style={{ color: C.short }}>
          שגיאה בטעינת נתונים: {fetchError}
        </p>
      )}

      {!loading && shown && series && (
        <main className="flex flex-col gap-6">
          <SignalCard a={shown} series={series} />
          <PlanCard a={shown} />
          <SubSignalsCard a={shown} />
          <MatrixCard a={shown} />
          <BacktestCard a={shown} />
          <ExitStylesCard series={series} a={shown} strongOnly={strongOnly} />
          <PortfolioCard account={account} />
          <JournalCard a={shown} assetId={assetId} account={account} series={series} />
          <p className="text-xs text-white/30 text-center pb-8">
            בקטסטים מחמיאים. המטריצה המתוקנת מראה מספרים מכוערים יותר — אבל
            אמיתיים, ורק הם שווים מסחר.
          </p>
        </main>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl p-5"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <h2 className="text-sm font-semibold text-white/70 mb-4 tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function SignalCard({ a, series }: { a: Analysis; series: PriceSeries }) {
  const e = a.ensemble;
  const dirColor = e.direction > 0 ? C.long : e.direction < 0 ? C.short : C.flat;
  const dirText = e.direction > 0 ? "לונג ↑" : e.direction < 0 ? "שורט ↓" : "מחוץ לשוק —";
  const h = a.hitRate;
  const n = series.candles.length;
  const chg = n > 1 ? series.candles[n - 1].c / series.candles[n - 2].c - 1 : 0;
  return (
    <Card title="האות הנוכחי">
      <div className="mb-4 flex items-baseline gap-3" dir="ltr" style={{ justifyContent: "flex-end" }}>
        <span className="text-2xl font-bold text-white/90">
          ${e.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
        <span className="text-sm font-semibold" style={{ color: chg >= 0 ? C.long : C.short }}>
          {chg >= 0 ? "+" : ""}
          {(chg * 100).toFixed(2)}%
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-4xl font-bold" style={{ color: dirColor }}>
            {dirText}
          </div>
          <div className="text-xs text-white/40 mt-1">
            ביטחון: {pctS(e.conviction, 0)} · פוזיציה מוצעת: {pctS(Math.abs(e.positionFrac), 0)} מהתיק
          </div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <ScoreGauge score={e.score} />
        </div>
      </div>
      <div className="mt-4 text-sm text-white/70 leading-relaxed">
        הסתברות היסטורית לאות מהסוג הזה:{" "}
        <strong style={{ color: dirColor }}>{pctS(h.rate, 0)}</strong>{" "}
        <span className="text-white/40">
          (טווח ודאות 95%: {pctS(h.lo, 0)}–{pctS(h.hi, 0)}, על {h.n} מקרים דומים)
        </span>
        {h.smallSample && (
          <span className="block mt-1 text-xs" style={{ color: C.bench }}>
            ⚠ מדגם קטן ({h.n} מקרים) — האחוז הזה רועש. אל תתלה בו החלטה לבד.
          </span>
        )}
      </div>
    </Card>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const x = ((score + 1) / 2) * 100;
  return (
    <div dir="ltr">
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        {/* flat band */}
        <div
          className="absolute top-0 h-full"
          style={{ left: "42.5%", width: "15%", background: "rgba(255,255,255,0.1)" }}
        />
        <div
          className="absolute top-[-3px] w-[3px] h-[18px] rounded"
          style={{ left: `calc(${x}% - 1.5px)`, background: score > 0.15 ? C.long : score < -0.15 ? C.short : C.flat }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/30 mt-1">
        <span>דובי ‎-1</span>
        <span>ניטרלי</span>
        <span>שורי ‎+1</span>
      </div>
    </div>
  );
}

function PlanCard({ a }: { a: Analysis }) {
  return (
    <Card title="מה לעשות — צעד אחר צעד">
      <ol className="flex flex-col gap-4">
        {a.plan.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "rgba(202,138,4,0.15)", color: "#F0CC55" }}
            >
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-semibold text-white/90">{s.title}</div>
              <div className="text-sm text-white/50 leading-relaxed">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SubSignalsCard({ a }: { a: Analysis }) {
  return (
    <Card title="למה? פירוק האות לחמשת הרכיבים">
      <div className="flex flex-col gap-3">
        {a.ensemble.subSignals.map((s) => (
          <div key={s.id}>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/80 w-36 shrink-0">{s.name}</span>
              <VoteBar vote={s.vote} isVol={s.id === "vol"} mult={s.convictionMult} />
            </div>
            <p className="text-xs text-white/40 mt-1 mr-36 pr-3">{s.rationale}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function VoteBar({ vote, isVol, mult }: { vote: number; isVol: boolean; mult: number }) {
  if (isVol) {
    return (
      <span className="text-xs" style={{ color: mult < 0.95 ? C.bench : C.flat }}>
        מכפיל ביטחון ×{mult.toFixed(2)}
      </span>
    );
  }
  const w = Math.abs(vote) * 50;
  return (
    <div className="relative flex-1 h-2 rounded-full" dir="ltr" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: vote >= 0 ? "50%" : `${50 - w}%`,
          width: `${w}%`,
          background: vote >= 0 ? C.long : C.short,
        }}
      />
    </div>
  );
}

function MatrixCard({ a }: { a: Analysis }) {
  const m = a.ensemble.markov;
  const order = [1, 0, 2]; // display: BULL, SIDEWAYS, BEAR
  return (
    <Card title={`מטריצת המעברים (דגימה ללא חפיפה, ${m.nSamples} מעברים)`}>
      <div className="overflow-x-auto" dir="ltr">
        <table className="mx-auto text-center text-sm" dir="rtl">
          <thead>
            <tr>
              <th className="p-2 text-xs text-white/40 font-normal">מ ↓ אל ←</th>
              {order.map((j) => (
                <th key={j} className="p-2 text-xs text-white/60">{STATE_NAMES_HE[j]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((i) => (
              <tr key={i}>
                <td className="p-2 text-xs text-white/60">
                  {STATE_NAMES_HE[i]}
                  {m.currentState === i && <span style={{ color: C.gold }}> ●</span>}
                </td>
                {order.map((j) => (
                  <td key={j} className="p-1">
                    <div
                      className="rounded-md px-4 py-3 min-w-[72px] font-semibold"
                      style={{
                        background: `rgba(57,135,229,${(0.12 + m.matrix[i][j] * 0.75).toFixed(2)})`,
                        color: m.matrix[i][j] > 0.45 ? "#fff" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {pctS(m.matrix[i][j], 0)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/40 mt-3 leading-relaxed">
        כל שורה: בהינתן המצב הנוכחי (●), מה ההסתברות לכל מצב בחלון הבא. המטריצה
        נבנית רק ממעברים שאינם חופפים — הדרך הכנה סטטיסטית. אות המרקוב =
        P(שור) − P(דוב) בשורה הנוכחית.
      </p>
    </Card>
  );
}

function BacktestCard({ a }: { a: Analysis }) {
  const b = a.backtest;
  const rows: Array<[string, string]> = [
    ["אחוז הצלחה", pctS(b.winRate)],
    ["Profit Factor", b.profitFactor === Infinity ? "∞" : b.profitFactor.toFixed(2)],
    ["ירידה מקסימלית", pctS(b.maxDrawdown)],
    ["תשואה שנתית (CAGR)", pctS(b.cagr)],
    ["Sharpe", b.sharpe.toFixed(2)],
    ["זמן בשוק", pctS(b.exposure, 0)],
  ];
  return (
    <Card title={`בדיקה היסטורית הוגנת (walk-forward, ${b.bars} תקופות)`}>
      <EquityChart b={b} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-[11px] text-white/40">{k}</div>
            <div className="text-lg font-bold text-white/90">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg p-3 text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.04)" }}>
        <span className="text-white/70 font-semibold">מבחן עמידות בעמלות כפולות: </span>
        <span className="text-white/50">
          Profit Factor {a.stress.profitFactor === Infinity ? "∞" : a.stress.profitFactor.toFixed(2)} ·
          תשואה שנתית {pctS(a.stress.cagr)} —{" "}
          {a.stress.profitFactor > 1
            ? "האסטרטגיה שורדת גם בעלויות מסחר כפולות."
            : "בעלויות כפולות היתרון נעלם — סימן שהיתרון רגיש לעמלות. זהירות."}
        </span>
      </div>
      <p className="text-xs text-white/40 mt-3">
        המנוע לומד רק מהעבר של כל נקודה — אף פעם לא מהעתיד. העמלות כלולות. בלם
        חירום פעיל: בירידה של 15% מהשיא הפוזיציות נחתכות בחצי עד התאוששות.
        גודל הפוזיציה החי מוגבל גם לפי חצי-קלי ({(a.kelly.half * 100).toFixed(0)}% מהתיק כרגע).
      </p>
    </Card>
  );
}

function EquityChart({ b }: { b: BacktestReport }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const P = { top: 16, right: 88, bottom: 28, left: 16 };
  const iw = W - P.left - P.right;
  const ih = H - P.top - P.bottom;
  const n = b.equity.length;
  if (n < 2) return null;
  const all = [...b.equity, ...b.benchEquity];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const X = (i: number) => P.left + (i / (n - 1)) * iw;
  const Y = (v: number) => P.top + (1 - (v - lo) / (hi - lo || 1)) * ih;
  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");

  const ticks = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  return (
    <div dir="ltr" className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label="עקומת הון: האסטרטגיה מול קנייה והחזקה"
        onMouseMove={(ev) => {
          const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((ev.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - P.left) / iw) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={P.left}
            x2={P.left + iw}
            y1={P.top + f * ih}
            y2={P.top + f * ih}
            stroke="rgba(255,255,255,0.06)"
          />
        ))}
        {/* baseline at 1.0 */}
        {lo < 1 && hi > 1 && (
          <line x1={P.left} x2={P.left + iw} y1={Y(1)} y2={Y(1)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 4" />
        )}
        <path d={path(b.benchEquity)} fill="none" stroke={C.bench} strokeWidth={1.6} />
        <path d={path(b.equity)} fill="none" stroke={C.strategy} strokeWidth={2.2} />
        {/* direct labels at line ends */}
        <text x={P.left + iw + 6} y={Y(b.equity[n - 1]) + 4} fontSize={11} fill={C.strategy}>
          האסטרטגיה
        </text>
        <text x={P.left + iw + 6} y={Y(b.benchEquity[n - 1]) + 4} fontSize={11} fill={C.bench}>
          קנייה והחזקה
        </text>
        {/* x ticks */}
        {ticks.map((i) => (
          <text key={i} x={X(i)} y={H - 8} fontSize={10} fill="rgba(255,255,255,0.35)" textAnchor="middle">
            {dateS(b.dates[i])}
          </text>
        ))}
        {/* hover crosshair + tooltip */}
        {hover !== null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={P.top} y2={P.top + ih} stroke="rgba(255,255,255,0.25)" />
            <circle cx={X(hover)} cy={Y(b.equity[hover])} r={3.5} fill={C.strategy} stroke="#0C0A09" strokeWidth={1.5} />
            <circle cx={X(hover)} cy={Y(b.benchEquity[hover])} r={3.5} fill={C.bench} stroke="#0C0A09" strokeWidth={1.5} />
            <g transform={`translate(${Math.min(X(hover) + 8, W - 165)}, ${P.top + 4})`}>
              <rect width={155} height={52} rx={6} fill="#1d1917" stroke="rgba(255,255,255,0.12)" />
              <text x={8} y={16} fontSize={10} fill="rgba(255,255,255,0.5)">
                {dateS(b.dates[hover])}
              </text>
              <text x={8} y={31} fontSize={11} fill={C.strategy}>
                אסטרטגיה: {b.equity[hover].toFixed(2)}
              </text>
              <text x={8} y={45} fontSize={11} fill={C.bench}>
                קנייה והחזקה: {b.benchEquity[hover].toFixed(2)}
              </text>
            </g>
          </g>
        )}
      </svg>
      <div className="flex gap-5 text-xs mt-1" dir="rtl">
        <span className="flex items-center gap-1.5 text-white/60">
          <span className="inline-block w-4 h-[3px] rounded" style={{ background: C.strategy }} />
          האסטרטגיה
        </span>
        <span className="flex items-center gap-1.5 text-white/60">
          <span className="inline-block w-4 h-[2px] rounded" style={{ background: C.bench }} />
          קנייה והחזקה
        </span>
      </div>
    </div>
  );
}

// ─── PORTFOLIO OVERVIEW ──────────────────────────────────────────────────────

interface PortfolioRow {
  id: string;
  label: string;
  price: number;
  direction: number;
  conviction: number;
  size: number;
  live: boolean;
}

function PortfolioCard({ account }: { account: number }) {
  const [rows, setRows] = useState<PortfolioRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const cryptos = ASSETS.filter((a) => a.kind === "crypto");
    Promise.all(
      cryptos.map(async (asset): Promise<PortfolioRow | null> => {
        try {
          const series = await fetchSeries(asset.id, "1d");
          const a = analyze(series, account);
          return {
            id: asset.id,
            label: asset.label,
            price: a.ensemble.price,
            direction: a.ensemble.direction,
            conviction: a.ensemble.conviction,
            size: Math.abs(a.ensemble.positionFrac),
            live: series.source !== "fixture",
          };
        } catch {
          return null;
        }
      }),
    ).then((r) => {
      if (alive) setRows(r.filter((x): x is PortfolioRow => x !== null));
    });
    return () => {
      alive = false;
    };
  }, [account]);

  const totalReq = rows?.reduce((s, r) => s + (r.direction !== 0 ? r.size : 0), 0) ?? 0;
  const scale = totalReq > 1 ? 1 / totalReq : 1;

  return (
    <Card title="סקירת תיק — כל המטבעות (נרות יומיים)">
      {!rows && <p className="text-sm text-white/40">טוען ומנתח את כל המטבעות…</p>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="text-xs text-white/40">
                <th className="p-2 font-normal">נכס</th>
                <th className="p-2 font-normal">מחיר</th>
                <th className="p-2 font-normal">אות</th>
                <th className="p-2 font-normal">ביטחון</th>
                <th className="p-2 font-normal">הקצאה מוצעת</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="p-2 text-white/80">
                    {r.label}
                    {!r.live && <span style={{ color: C.short }}> ⚠ לא חי</span>}
                  </td>
                  <td className="p-2 text-white/60" dir="ltr">
                    ${r.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 font-semibold" style={{ color: r.direction > 0 ? C.long : r.direction < 0 ? C.short : C.flat }}>
                    {r.direction > 0 ? "לונג ↑" : r.direction < 0 ? "שורט ↓" : "בחוץ —"}
                  </td>
                  <td className="p-2 text-white/60">{pctS(r.conviction, 0)}</td>
                  <td className="p-2 text-white/80">
                    {r.direction === 0 ? "—" : `${(r.size * scale * 100).toFixed(0)}% (${(r.size * scale * account).toLocaleString("he-IL", { maximumFractionDigits: 0 })})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-white/40 mt-2">
            ההקצאות מוגבלות יחד ל-100% מהתיק{totalReq > 1 ? " (נורמלו כלפי מטה)" : ""}.
            כל נכס עובר את אותו ניתוח מלא: אות משולב, קלי, ובלם חירום.
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── PAPER-TRADE JOURNAL ─────────────────────────────────────────────────────

interface JournalTrade {
  id: number;
  asset: string;
  dir: number;
  entry: number;
  amount: number;
  openedAt: number;
  entryAtr?: number;
  partialPrice?: number;
  exit?: number;
  closedAt?: number;
}

const JOURNAL_KEY = "vain-trading-journal-v1";

function loadJournal(): JournalTrade[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function JournalCard({ a, assetId, account, series }: { a: Analysis; assetId: string; account: number; series: PriceSeries }) {
  const [trades, setTrades] = useState<JournalTrade[]>(loadJournal);
  const save = (next: JournalTrade[]) => {
    setTrades(next);
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
  };

  const openTrade = () => {
    const e = a.ensemble;
    if (e.direction === 0 || Math.abs(e.positionFrac) === 0) return;
    save([
      ...trades,
      {
        id: Date.now(),
        asset: assetId,
        dir: e.direction,
        entry: e.price,
        amount: account * Math.abs(e.positionFrac),
        openedAt: Date.now(),
        entryAtr: e.atr,
      },
    ]);
  };

  const takePartial = (id: number) => {
    save(
      trades.map((t) =>
        t.id === id && t.asset === assetId && t.partialPrice === undefined
          ? { ...t, partialPrice: a.ensemble.price }
          : t,
      ),
    );
  };

  const guidanceFor = (t: JournalTrade) => {
    if (t.exit !== undefined || t.asset !== assetId || !t.entryAtr) return null;
    const fromIdx = series.candles.findIndex((c) => c.t >= t.openedAt);
    return exitState({
      entry: t.entry,
      dir: t.dir > 0 ? 1 : -1,
      entryAtr: t.entryAtr,
      candles: series.candles,
      fromIdx: fromIdx === -1 ? series.candles.length - 1 : fromIdx,
      toIdx: series.candles.length - 1,
      tookPartial: t.partialPrice !== undefined,
    });
  };

  const closeTrade = (id: number) => {
    save(
      trades.map((t) =>
        t.id === id && t.asset === assetId
          ? { ...t, exit: a.ensemble.price, closedAt: Date.now() }
          : t,
      ),
    );
  };

  const pnl = (t: JournalTrade, price: number) => {
    if (t.partialPrice !== undefined) {
      const half = t.amount * EXIT.PARTIAL_FRAC;
      return half * ((t.partialPrice / t.entry - 1) * t.dir) + half * ((price / t.entry - 1) * t.dir);
    }
    return t.amount * ((price / t.entry - 1) * t.dir);
  };
  const closed = trades.filter((t) => t.exit !== undefined);
  const wins = closed.filter((t) => pnl(t, t.exit!) > 0).length;
  const totalPnl = closed.reduce((s, t) => s + pnl(t, t.exit!), 0);

  return (
    <Card title="יומן עסקאות נייר (נשמר בדפדפן שלך בלבד)">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={openTrade}
          disabled={a.ensemble.direction === 0 || Math.abs(a.ensemble.positionFrac) === 0}
          className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: "rgba(202,138,4,0.2)", color: "#F0CC55", border: "1px solid rgba(202,138,4,0.4)" }}
        >
          + פתח עסקת נייר לפי האות הנוכחי
        </button>
        {closed.length > 0 && (
          <span className="text-xs text-white/50">
            {closed.length} עסקאות סגורות · {wins} מנצחות ({((wins / closed.length) * 100).toFixed(0)}%) · רווח/הפסד מצטבר:{" "}
            <span style={{ color: totalPnl >= 0 ? C.long : C.short }}>
              {totalPnl >= 0 ? "+" : ""}
              {totalPnl.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
            </span>
          </span>
        )}
      </div>
      {trades.length === 0 && (
        <p className="text-sm text-white/40">
          עדיין אין עסקאות. הכלל של המקצוענים: 10 עסקאות נייר מתועדות לפני שקל אמיתי.
        </p>
      )}
      {trades.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="text-xs text-white/40">
                <th className="p-2 font-normal">נכס</th>
                <th className="p-2 font-normal">כיוון</th>
                <th className="p-2 font-normal">כניסה</th>
                <th className="p-2 font-normal">סכום</th>
                <th className="p-2 font-normal">רווח/הפסד</th>
                <th className="p-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {[...trades].reverse().map((t) => {
                const price = t.exit ?? (t.asset === assetId ? a.ensemble.price : null);
                const p = price !== null ? pnl(t, price) : null;
                return (
                  <tr key={t.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="p-2 text-white/80">{t.asset}</td>
                    <td className="p-2" style={{ color: t.dir > 0 ? C.long : C.short }}>
                      {t.dir > 0 ? "לונג" : "שורט"}
                    </td>
                    <td className="p-2 text-white/60" dir="ltr">${t.entry.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-white/60">{t.amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</td>
                    <td className="p-2 font-semibold" style={{ color: p === null ? C.flat : p >= 0 ? C.long : C.short }}>
                      {p === null ? "—" : `${p >= 0 ? "+" : ""}${p.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`}
                      {t.exit === undefined && p !== null && <span className="text-white/30"> (פתוחה)</span>}
                    </td>
                    <td className="p-2">
                      {t.exit === undefined &&
                        (t.asset === assetId ? (
                          <button onClick={() => closeTrade(t.id)} className="text-xs underline text-white/60">
                            סגור עכשיו
                          </button>
                        ) : (
                          <span className="text-[10px] text-white/30">החלף ל-{t.asset} כדי לסגור</span>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {trades
            .filter((t) => t.exit === undefined && t.asset === assetId)
            .map((t) => {
              const g = guidanceFor(t);
              if (!g) return null;
              const col = g.action === "exit_stop" ? C.short : g.action === "take_partial" ? "#F0CC55" : C.flat;
              return (
                <div
                  key={`g-${t.id}`}
                  className="mt-3 rounded-lg p-3 text-xs flex flex-wrap items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}
                >
                  <span className="font-semibold" style={{ color: col }}>
                    הנחיית יציאה ({t.asset}):
                  </span>
                  <span className="text-white/60">{g.hint}</span>
                  {g.action === "take_partial" && (
                    <button
                      onClick={() => takePartial(t.id)}
                      className="rounded px-3 py-1 font-semibold"
                      style={{ background: "rgba(202,138,4,0.2)", color: "#F0CC55" }}
                    >
                      קח חצי רווח עכשיו
                    </button>
                  )}
                  {g.action === "exit_stop" && (
                    <button
                      onClick={() => closeTrade(t.id)}
                      className="rounded px-3 py-1 font-semibold"
                      style={{ background: "rgba(230,103,103,0.15)", color: C.short }}
                    >
                      סגור לפי הסטופ
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}

// ─── EXIT-STYLE COMPARISON ───────────────────────────────────────────────────

const STYLE_NAMES: Record<string, string> = {
  "signal:0": "יציאה בהיפוך אות בלבד",
  "stop:0": "סטופ התחלתי + אות",
  "ladder:0": "הסולם המלא (איזון ← חצי ← גרירה)",
  "ladder:0.35": "הסולם + אותות חזקים בלבד",
};

function ExitStylesCard({ series, a, strongOnly }: { series: PriceSeries; a: Analysis; strongOnly: boolean }) {
  const rows: TradeStyleReport[] | null = useMemo(() => {
    try {
      return compareExitStyles(series.candles, a.cfg);
    } catch {
      return null;
    }
  }, [series, a.cfg]);
  if (!rows) return null;
  const highlight = strongOnly ? "ladder:0.35" : "ladder:0";
  return (
    <Card title="איזו שיטת יציאה באמת עובדת כאן? (בדיקה עסקה-אחר-עסקה)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="text-xs text-white/40">
              <th className="p-2 font-normal">שיטה</th>
              <th className="p-2 font-normal">עסקאות</th>
              <th className="p-2 font-normal">אחוז הצלחה</th>
              <th className="p-2 font-normal">R ממוצע</th>
              <th className="p-2 font-normal">Profit Factor</th>
              <th className="p-2 font-normal">ירידה מקס&apos;</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const key = `${r.style}:${r.minConviction}`;
              const hl = key === highlight;
              return (
                <tr
                  key={key}
                  style={{
                    borderTop: `1px solid ${C.border}`,
                    background: hl ? "rgba(202,138,4,0.08)" : undefined,
                  }}
                >
                  <td className="p-2 text-white/80">
                    {STYLE_NAMES[key]}
                    {hl && <span style={{ color: C.gold }}> ← פעיל</span>}
                  </td>
                  <td className="p-2 text-white/60">{r.trades}</td>
                  <td className="p-2 text-white/80">{pctS(r.winRate)}</td>
                  <td
                    className="p-2 font-semibold"
                    style={{ color: r.avgR >= 0 ? C.long : C.short }}
                  >
                    {r.avgR >= 0 ? "+" : ""}
                    {r.avgR.toFixed(2)}R
                  </td>
                  <td className="p-2 text-white/80">
                    {r.profitFactor === Infinity ? "∞" : r.profitFactor.toFixed(2)}
                  </td>
                  <td className="p-2 text-white/60">{pctS(r.maxDrawdown)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/40 mt-3 leading-relaxed">
        כל שורה היא אותם אותות כניסה בדיוק — רק היציאה שונה (בהנחת סיכון 1%
        מהתיק לעסקה, כולל עמלות). שים לב: אחוז הצלחה גבוה לא אומר רווחיות —
        R ממוצע ו-Profit Factor הם שקובעים. הסולם לרוב מעלה אחוז הצלחה אבל
        לפעמים מפסיד לגרירה חופשית בשוק שור חזק. המספרים כאן מוגבלים
        להיסטוריה שנטענה — לא הבטחה.
      </p>
    </Card>
  );
}
