"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Scene, { type Placement } from "./Scene";
import { anchorById, ANCHORS } from "./anchors";
import { DESIGNS, METALS, designById, type Design, type MetalId } from "./catalog";

/* ─── Small SVG previews for the catalog cards ────────────────────────────── */

function DesignPreview({ design, metal }: { design: Design; metal: MetalId }) {
  const m = METALS[metal].swatch;
  const gem = "#cfe0ff";
  switch (design.kind) {
    case "ring":
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
          <circle cx="24" cy="26" r="13" fill="none" stroke={m} strokeWidth="4" />
          {design.id === "bead-ring" && <circle cx="24" cy="39" r="4.5" fill={m} />}
          {design.id === "pave-ring" &&
            [0, 1, 2, 3, 4].map((i) => {
              const a = Math.PI * (0.3 + i * 0.1);
              return (
                <circle
                  key={i}
                  cx={24 + Math.cos(a + Math.PI / 2) * 13}
                  cy={26 + Math.sin(a + Math.PI / 2) * 13}
                  r="2.2"
                  fill={gem}
                />
              );
            })}
        </svg>
      );
    case "dangle":
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
          <circle cx="24" cy="8" r="4" fill={m} />
          <line x1="24" y1="12" x2="24" y2="24" stroke={m} strokeWidth="2.5" />
          <polygon points="24,24 32,33 24,44 16,33" fill={gem} stroke="#9db8e8" strokeWidth="1" />
        </svg>
      );
    default: {
      const fill =
        design.id === "pearl"
          ? "#f3ede2"
          : design.id === "ball"
            ? m
            : design.id === "sapphire"
              ? "#5b84f0"
              : gem;
      if (design.id === "trinity")
        return (
          <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
            <circle cx="24" cy="17" r="6" fill={fill} stroke={m} strokeWidth="1.5" />
            <circle cx="17" cy="29" r="6" fill={fill} stroke={m} strokeWidth="1.5" />
            <circle cx="31" cy="29" r="6" fill={fill} stroke={m} strokeWidth="1.5" />
          </svg>
        );
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
          <circle cx="24" cy="24" r="10" fill={fill} stroke={m} strokeWidth="2" />
          {design.id !== "ball" && design.id !== "pearl" && (
            <path d="M18 20 L24 14 L30 20" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
          )}
        </svg>
      );
    }
  }
}

/* ─── Studio page ─────────────────────────────────────────────────────────── */

export default function TryOnStudio() {
  const [metal, setMetal] = useState<MetalId>("gold");
  const [selectedSpot, setSelectedSpot] = useState<string | null>("lobe");
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  // this component is loaded with ssr:false, so window exists on first render
  const [debug] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug")
  );

  const selectedAnchor = selectedSpot ? anchorById(selectedSpot) : null;

  const total = useMemo(
    () =>
      Object.values(placements).reduce(
        (sum, p) => sum + designById(p.designId).price,
        0
      ),
    [placements]
  );

  function placeDesign(design: Design) {
    if (!selectedSpot || !selectedAnchor) return;
    if (!selectedAnchor.allowed.includes(design.kind)) return;
    setPlacements((prev) => {
      const cur = prev[selectedSpot];
      // clicking the same design again removes it
      if (cur && cur.designId === design.id && cur.metal === metal) {
        const next = { ...prev };
        delete next[selectedSpot];
        return next;
      }
      return { ...prev, [selectedSpot]: { designId: design.id, metal } };
    });
  }

  function removePlacement(spotId: string) {
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[spotId];
      return next;
    });
  }

  function switchMetal(id: MetalId) {
    setMetal(id);
    // restyle the earring on the active spot, if any
    if (selectedSpot) {
      setPlacements((prev) =>
        prev[selectedSpot]
          ? { ...prev, [selectedSpot]: { ...prev[selectedSpot], metal: id } }
          : prev
      );
    }
  }

  return (
    <div dir="rtl" className="h-dvh flex flex-col bg-[#0C0A09] text-stone-100 overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs tracking-[0.25em] font-semibold uppercase">Studio Vain</span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span className="hidden sm:inline text-xs tracking-widest text-[#e8b64a] uppercase">
            Virtual Try-On
          </span>
        </div>
        <Link
          href="/"
          className="text-xs tracking-widest uppercase border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black transition-colors duration-200"
        >
          ← חזרה לאתר
        </Link>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* ── 3D viewport ── */}
        <main className="relative flex-1 min-h-[46dvh]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,#231a12_0%,#0C0A09_65%)]" />
          <div className="absolute inset-0">
            <Scene
              placements={placements}
              selectedSpot={selectedSpot}
              onSelectSpot={(id) => setSelectedSpot(id)}
              debug={debug}
            />
          </div>

          {/* hint */}
          <div className="pointer-events-none absolute bottom-4 right-0 left-0 flex justify-center px-4">
            <p className="text-[11px] tracking-wider text-white/45 bg-black/40 backdrop-blur px-4 py-2 rounded-full">
              לחצו על נקודה זהובה באוזן · גררו לסיבוב · גלגלת לזום
            </p>
          </div>

          {/* active spot chip */}
          {selectedAnchor && (
            <div className="absolute top-4 right-4 sm:right-6 text-xs bg-black/50 backdrop-blur border border-[#e8b64a]/40 text-[#e8b64a] px-4 py-2 rounded-full tracking-wider">
              נקודה נבחרת: {selectedAnchor.name}
            </div>
          )}
        </main>

        {/* ── Catalog sidebar ── */}
        <aside className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-s border-white/10 flex flex-col min-h-0 bg-[#100e0c]">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* metal selector */}
            <section>
              <h2 className="text-[11px] tracking-[0.2em] uppercase text-white/40 mb-3">מתכת</h2>
              <div className="flex gap-2">
                {(Object.keys(METALS) as MetalId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => switchMetal(id)}
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded-full border transition-colors ${
                      metal === id
                        ? "border-[#e8b64a] text-white bg-white/5"
                        : "border-white/15 text-white/50 hover:text-white"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block"
                      style={{ background: METALS[id].swatch }}
                    />
                    {METALS[id].label}
                  </button>
                ))}
              </div>
            </section>

            {/* piercing spots */}
            <section>
              <h2 className="text-[11px] tracking-[0.2em] uppercase text-white/40 mb-3">
                נקודת פירסינג
              </h2>
              <div className="flex flex-wrap gap-2">
                {ANCHORS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedSpot(a.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedSpot === a.id
                        ? "border-[#e8b64a] text-[#e8b64a] bg-[#e8b64a]/10"
                        : placements[a.id]
                          ? "border-white/30 text-white/80"
                          : "border-white/15 text-white/50 hover:text-white"
                    }`}
                  >
                    {a.name}
                    {placements[a.id] && <span className="ms-1.5 text-[#e8b64a]">●</span>}
                  </button>
                ))}
              </div>
            </section>

            {/* designs */}
            <section>
              <h2 className="text-[11px] tracking-[0.2em] uppercase text-white/40 mb-3">
                עגילים {selectedAnchor && <span className="text-white/25">· ל{selectedAnchor.name}</span>}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {DESIGNS.map((d) => {
                  const allowed = !selectedAnchor || selectedAnchor.allowed.includes(d.kind);
                  const active =
                    !!selectedSpot && placements[selectedSpot]?.designId === d.id;
                  return (
                    <button
                      key={d.id}
                      disabled={!allowed}
                      onClick={() => placeDesign(d)}
                      className={`group flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all text-center ${
                        active
                          ? "border-[#e8b64a] bg-[#e8b64a]/10"
                          : allowed
                            ? "border-white/10 hover:border-white/30 bg-white/[0.02]"
                            : "border-white/5 opacity-30 cursor-not-allowed"
                      }`}
                    >
                      <DesignPreview design={d} metal={metal} />
                      <span className="text-xs text-white/85">{d.name}</span>
                      <span className="text-[11px] text-[#e8b64a]/90">₪{d.price}</span>
                    </button>
                  );
                })}
              </div>
              {selectedAnchor && (
                <p className="mt-2 text-[11px] text-white/30 leading-relaxed">
                  {selectedAnchor.allowed.includes("dangle")
                    ? "בנקודה זו ניתן לענוד סטאדים, חישוקים ועגילים משתלשלים."
                    : selectedAnchor.allowed.includes("ring")
                      ? "בנקודה זו ניתן לענוד סטאדים וחישוקים."
                      : "בנקודה זו ניתן לענוד סטאדים בלבד."}
                </p>
              )}
            </section>

            {/* placed list */}
            {Object.keys(placements).length > 0 && (
              <section>
                <h2 className="text-[11px] tracking-[0.2em] uppercase text-white/40 mb-3">
                  הלוק שלך
                </h2>
                <ul className="space-y-1.5">
                  {Object.entries(placements).map(([spotId, p]) => {
                    const d = designById(p.designId);
                    return (
                      <li
                        key={spotId}
                        className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2"
                      >
                        <span className="text-white/80">
                          {anchorById(spotId).name} · {d.name}{" "}
                          <span className="text-white/35">({METALS[p.metal].label})</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-[#e8b64a]">₪{d.price}</span>
                          <button
                            onClick={() => removePlacement(spotId)}
                            className="text-white/35 hover:text-red-400 transition-colors"
                            aria-label={`הסרת ${d.name}`}
                          >
                            ✕
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          {/* total */}
          <div className="shrink-0 border-t border-white/10 p-5 sm:p-6 flex items-center justify-between">
            <div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-white/40">סה״כ</div>
              <div className="text-xl font-semibold text-[#e8b64a]">₪{total}</div>
            </div>
            <button
              disabled={total === 0}
              className="text-xs tracking-widest uppercase border border-[#e8b64a]/60 text-[#e8b64a] px-5 py-2.5 rounded-full hover:bg-[#e8b64a] hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              קביעת תור לפירסינג
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
