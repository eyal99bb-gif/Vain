"use client";

import { useEffect, useMemo, useState } from "react";
import type { BotState } from "@/lib/quant/botState";

// published by the trader to gh-pages, served alongside the site
const STATE_URL = "/Vain/bot-state.json";

const C = {
  equity: "#3987e5",
  long: "#199e70",
  short: "#e66767",
  flat: "#8a8578",
  gold: "#F0CC55",
  card: "#151110",
  border: "rgba(255,255,255,0.08)",
  soft: "rgba(255,255,255,0.04)",
};

const money = (x: number, digits = 0) =>
  `$${x.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
const signPct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
const signMoney = (x: number) => `${x >= 0 ? "+" : "−"}${money(Math.abs(x))}`;
const timeHe = (iso: string) =>
  iso ? new Date(iso).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";

export default function LivePortfolio() {
  const [state, setState] = useState<BotState | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "ok">("loading");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${STATE_URL}?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("404"))))
        .then((d: BotState) => {
          if (alive) {
            setState(d);
            setStatus("ok");
          }
        })
        .catch(() => {
          if (alive && status !== "ok") setStatus("waiting");
        });
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") {
    return <Shell><p className="text-white/40 py-8 text-center">טוען את מצב הבוט…</p></Shell>;
  }
  if (status === "waiting" || !state) {
    return (
      <Shell>
        <p className="text-white/60 py-6 text-center text-sm leading-relaxed">
          ⏳ מחכה לריצה הראשונה של הבוט. ברגע שהוא ירוץ (עד ~30 דק&apos;), התיק החי
          יופיע כאן: שווי, עקומת הון, פוזיציות ועסקאות.
        </p>
      </Shell>
    );
  }
  if (!state.live) {
    return (
      <Shell>
        <p className="py-6 text-center text-sm" style={{ color: C.gold }}>
          {state.note || "הבוט לא סוחר כרגע."}
        </p>
        <p className="text-center text-xs text-white/30 mt-1">עודכן {timeHe(state.updatedAt)}</p>
      </Shell>
    );
  }
  return <PortfolioBody state={state} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: `linear-gradient(160deg, #1b1512, ${C.card})`, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white/90">התיק החי שלי</h2>
        <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: C.gold }}>
          Alpaca Paper
        </span>
      </div>
      {children}
    </section>
  );
}

function PortfolioBody({ state }: { state: BotState }) {
  const totalPnl = state.equity - state.startEquity;
  const totalPnlPct = state.startEquity ? totalPnl / state.startEquity : 0;
  const curve = state.equityCurve;
  const dayPnl = useMemo(() => {
    if (curve.length < 2) return 0;
    // last point vs the most recent point from a previous calendar day
    const lastDay = Math.floor(curve[curve.length - 1].t / 86400000);
    for (let i = curve.length - 2; i >= 0; i--) {
      if (Math.floor(curve[i].t / 86400000) < lastDay) return state.equity - curve[i].v;
    }
    return state.equity - curve[0].v;
  }, [curve, state.equity]);

  return (
    <Shell>
      {/* hero numbers */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 mb-5" dir="ltr">
        <div>
          <div className="text-[11px] text-white/40" dir="rtl">שווי התיק</div>
          <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
            {money(state.equity)}
          </div>
        </div>
        <Metric label="רווח/הפסד כולל" value={signMoney(totalPnl)} sub={signPct(totalPnlPct)} up={totalPnl >= 0} />
        <Metric label="שינוי יומי" value={signMoney(dayPnl)} up={dayPnl >= 0} />
        <div className="ml-auto text-right" dir="rtl">
          <div className="text-[11px] text-white/40">מזומן פנוי</div>
          <div className="text-lg font-semibold text-white/80 tabular-nums">{money(state.cash)}</div>
        </div>
      </div>

      <EquityChart curve={curve} baseline={state.startEquity} />

      <div className="grid gap-4 mt-5 sm:grid-cols-2">
        <Positions state={state} />
        <Trades state={state} />
      </div>

      <Scanner state={state} />

      <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-white/30">
        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: C.long }} />
        חי · עודכן {timeHe(state.updatedAt)} · מתעדכן אוטומטית
      </div>
    </Shell>
  );
}

function Metric({ label, value, sub, up }: { label: string; value: string; sub?: string; up: boolean }) {
  const col = up ? C.long : C.short;
  return (
    <div dir="rtl">
      <div className="text-[11px] text-white/40">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: col }} dir="ltr">
        {value}
        {sub && <span className="text-sm font-medium mr-2">{sub}</span>}
      </div>
    </div>
  );
}

function EquityChart({ curve, baseline }: { curve: BotState["equityCurve"]; baseline: number }) {
  if (curve.length < 2) {
    return (
      <div className="rounded-lg p-4 text-center text-xs text-white/40" style={{ background: C.soft }}>
        עקומת ההון תיבנה ככל שיצטברו ימי מסחר (נקודה ליום).
      </div>
    );
  }
  const W = 720;
  const H = 150;
  const P = { t: 12, r: 60, b: 16, l: 8 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const vals = curve.map((p) => p.v).concat(baseline);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const n = curve.length;
  const X = (i: number) => P.l + (i / (n - 1)) * iw;
  const Y = (v: number) => P.t + (1 - (v - lo) / span) * ih;
  const last = curve[n - 1];
  const up = last.v >= baseline;
  const col = up ? C.long : C.short;
  const line = curve.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const area = `${line} L${X(n - 1).toFixed(1)},${(P.t + ih).toFixed(1)} L${X(0).toFixed(1)},${(P.t + ih).toFixed(1)} Z`;
  const fmtDay = (t: number) => new Date(t).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });

  return (
    <div dir="ltr" className="overflow-hidden rounded-lg" style={{ background: C.soft }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="עקומת ההון של הבוט">
        <defs>
          <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.28" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={P.l} x2={P.l + iw} y1={Y(baseline)} y2={Y(baseline)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" />
        <text x={P.l + iw + 6} y={Y(baseline) + 3} fontSize="10" fill="rgba(255,255,255,0.35)">
          {money(baseline)}
        </text>
        <path d={area} fill="url(#eqfill)" />
        <path d={line} fill="none" stroke={col} strokeWidth={2} />
        <circle cx={X(n - 1)} cy={Y(last.v)} r={3.5} fill={col} stroke="#0c0a09" strokeWidth={1.5} />
        <text x={X(n - 1) + 6} y={Y(last.v) + 3} fontSize="11" fill={col} fontWeight="bold">
          {money(last.v)}
        </text>
        <text x={P.l} y={H - 3} fontSize="9" fill="rgba(255,255,255,0.3)">{fmtDay(curve[0].t)}</text>
        <text x={P.l + iw} y={H - 3} fontSize="9" fill="rgba(255,255,255,0.3)" textAnchor="end">{fmtDay(last.t)}</text>
      </svg>
    </div>
  );
}

function Positions({ state }: { state: BotState }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.soft }}>
      <div className="text-xs font-semibold text-white/60 mb-2">פוזיציות פתוחות</div>
      {state.positions.length === 0 ? (
        <p className="text-xs text-white/35 py-2">אין פוזיציות — הבוט בחוץ, במזומן מלא.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {state.positions.map((p) => (
            <div key={p.symbol} className="flex items-center justify-between text-sm">
              <span className="text-white/80">{p.label}</span>
              <span className="flex items-center gap-3 tabular-nums" dir="ltr">
                <span className="text-white/50 text-xs">{money(p.value)}</span>
                <span style={{ color: p.pnl >= 0 ? C.long : C.short }}>
                  {signMoney(p.pnl)} ({signPct(p.pnlPct)})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Trades({ state }: { state: BotState }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.soft }}>
      <div className="text-xs font-semibold text-white/60 mb-2">עסקאות אחרונות</div>
      {state.trades.length === 0 ? (
        <p className="text-xs text-white/35 py-2">עדיין לא בוצעו עסקאות.</p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {state.trades.map((t, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span style={{ color: t.side === "buy" ? C.long : C.short }}>
                  {t.side === "buy" ? "קנייה" : "מכירה"}
                </span>
                <span className="text-white/70">{t.symbol}</span>
              </span>
              <span className="tabular-nums text-white/50 text-xs" dir="ltr">
                {money(t.value)} · {new Date(t.at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Scanner({ state }: { state: BotState }) {
  const sorted = [...state.signals].sort(
    (a, b) => Number(b.tradable) - Number(a.tradable) || b.conviction - a.conviction,
  );
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold text-white/60 mb-2">סורק השוק — כל הנכסים</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sorted.map((s) => {
          const col = s.direction > 0 ? C.long : s.direction < 0 ? C.short : C.flat;
          const arrow = s.direction > 0 ? "↑" : s.direction < 0 ? "↓" : "—";
          return (
            <div
              key={s.id}
              className="rounded-lg px-3 py-2"
              style={{ background: C.soft, border: `1px solid ${s.tradable ? "rgba(25,158,112,0.35)" : C.border}` }}
              title={s.why}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/85 truncate">{s.label}</span>
                <span className="text-sm font-bold" style={{ color: col }}>{arrow}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-white/40">ביטחון {(s.conviction * 100).toFixed(0)}%</span>
                {s.tradable && <span className="text-[10px]" style={{ color: C.long }}>🤖 סחיר</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
