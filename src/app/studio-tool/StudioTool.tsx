"use client";

import { motion, AnimatePresence, animate, useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── SHARED STYLES ───────────────────────────────────────────────────────────

const BTN_PRIMARY =
  "inline-block cursor-pointer rounded-full bg-gradient-to-b from-violet-500 to-violet-700 px-7 py-3 font-semibold text-white shadow-[0_10px_30px_-8px_rgba(124,58,237,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-200 hover:shadow-[0_14px_36px_-6px_rgba(139,92,246,0.8),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: EASE },
};

// ─── ATMOSPHERE ──────────────────────────────────────────────────────────────

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Grain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: NOISE }}
    />
  );
}

const STYLE_TAGS = [
  "Fine line",
  "Blackwork",
  "Neo-traditional",
  "Realism",
  "Script",
  "Geometric",
  "Irezumi",
  "Dotwork",
  "Ornamental",
  "Old school",
];

function StyleMarquee() {
  const row = (key: string, hidden: boolean) => (
    <div
      key={key}
      aria-hidden={hidden}
      className="flex shrink-0 items-center gap-10 pr-10"
    >
      {STYLE_TAGS.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-10 whitespace-nowrap font-[family-name:var(--font-display)] text-sm italic tracking-wide text-stone-500"
        >
          {tag}
          <svg viewBox="0 0 8 8" className="h-1.5 w-1.5 text-violet-500/60" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="4" r="4" />
          </svg>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-stone-950 py-3.5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-[marquee_38s_linear_infinite]">
        {row("a", false)}
        {row("b", true)}
      </div>
    </div>
  );
}

// ─── ROSE LINE-ART (shared between the "design" and "stencil" layers) ────────

function RoseArt({
  stroke,
  shaded,
  pid,
}: {
  stroke: string;
  shaded: boolean;
  pid: string;
}) {
  return (
    <svg viewBox="0 0 300 380" className="h-full w-full" aria-hidden="true">
      {shaded && (
        <defs>
          <radialGradient id={`${pid}-petal`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#7f1d1d" />
            <stop offset="60%" stopColor="#450a0a" />
            <stop offset="100%" stopColor="#1c0505" />
          </radialGradient>
          <linearGradient id={`${pid}-leaf`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14532d" />
            <stop offset="100%" stopColor="#052e16" />
          </linearGradient>
        </defs>
      )}
      <g
        fill={shaded ? `url(#${pid}-petal)` : "none"}
        stroke={stroke}
        strokeWidth={shaded ? 2 : 2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M150 40 C 96 46, 62 90, 66 140 C 70 196, 112 228, 150 232 C 188 228, 230 196, 234 140 C 238 90, 204 46, 150 40 Z" />
        <path d="M150 62 C 112 66, 88 98, 92 138 C 96 182, 122 208, 150 212 C 178 208, 204 182, 208 138 C 212 98, 188 66, 150 62 Z" />
        <path d="M150 86 C 124 90, 110 112, 114 138 C 118 168, 134 186, 150 188 C 166 186, 182 168, 186 138 C 190 112, 176 90, 150 86 Z" />
        <path d="M150 108 C 134 112, 128 126, 132 142 C 136 160, 142 168, 150 170 C 158 168, 164 160, 168 142 C 172 126, 166 112, 150 108 Z" />
        <path d="M150 128 C 142 132, 140 140, 143 148 C 146 156, 148 158, 150 158 C 152 158, 154 156, 157 148 C 160 140, 158 132, 150 128 Z" />
      </g>
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={shaded ? 1.4 : 1.8}
        strokeLinecap="round"
        opacity={0.9}
      >
        <path d="M92 138 C 104 120, 118 108, 138 100" />
        <path d="M208 138 C 196 120, 182 108, 162 100" />
        <path d="M112 190 C 100 176, 92 160, 92 142" />
        <path d="M188 190 C 200 176, 208 160, 208 142" />
      </g>
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={shaded ? 2.2 : 2.6}
        strokeLinecap="round"
      >
        <path d="M150 232 C 152 268, 144 306, 148 348" />
        <path d="M158 232 C 160 268, 152 306, 156 348" />
        <path d="M149 270 L 138 264 L 150 282" />
        <path d="M155 310 L 166 304 L 156 322" />
      </g>
      <g
        fill={shaded ? `url(#${pid}-leaf)` : "none"}
        stroke={stroke}
        strokeWidth={shaded ? 2 : 2.4}
        strokeLinejoin="round"
      >
        <path d="M147 288 C 118 278, 96 284, 82 302 C 100 316, 128 314, 147 296 Z" />
        <path d="M157 258 C 186 248, 208 254, 222 272 C 204 286, 176 284, 157 266 Z" />
      </g>
      <g fill="none" stroke={stroke} strokeWidth={1.4} opacity={0.85}>
        <path d="M144 292 C 126 290, 110 294, 96 300" />
        <path d="M160 262 C 178 260, 194 264, 208 270" />
      </g>
      {shaded && (
        <g fill="none" stroke="#fca5a5" strokeWidth={1.1} opacity={0.5}>
          <path d="M118 96 C 130 84, 142 78, 152 76" />
          <path d="M126 128 C 132 118, 140 112, 148 110" />
        </g>
      )}
    </svg>
  );
}

// ─── BEFORE / AFTER STENCIL SLIDER ───────────────────────────────────────────

function Tape({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute z-20 h-7 w-24 bg-stone-200/25 shadow-sm backdrop-blur-[1px] ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12))",
      }}
    />
  );
}

function StencilSlider() {
  const [pos, setPos] = useState(52);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  return (
    <div className="group relative -rotate-1 transition-transform duration-500 ease-out hover:rotate-0">
      <Tape className="-top-3 left-8 -rotate-6 rounded-sm" />
      <Tape className="-top-3 right-8 rotate-3 rounded-sm" />
      <div
        ref={ref}
        role="slider"
        aria-label="Compare original design with generated stencil"
        aria-valuenow={Math.round(pos)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          update(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && update(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
          if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
        }}
        className="relative aspect-[3/4] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl border border-stone-600/40 shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400"
      >
        {/* stencil side (under) — thermal transfer paper */}
        <div className="absolute inset-0 bg-[#f6f3ee]">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(120,100,180,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120,100,180,0.07) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="absolute inset-0 p-8">
            <RoseArt stroke="#4c1d95" shaded={false} pid="stencil" />
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-violet-900/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-100">
            Stencil
          </span>
          <span className="absolute bottom-3 right-3 font-mono text-[10px] tracking-wider text-stone-400">
            21.0 cm · 600 dpi
          </span>
        </div>
        {/* design side (over, clipped) */}
        <div
          className="absolute inset-0 bg-stone-950"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(88,28,135,0.25), transparent 65%)",
            }}
          />
          <div className="absolute inset-0 p-8">
            <RoseArt stroke="#e7e5e4" shaded pid="design" />
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-stone-800/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-300">
            Design
          </span>
        </div>
        {/* divider handle */}
        <div
          className="absolute inset-y-0 z-10 w-px bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.5)]"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-900 shadow-lg transition-transform duration-200 group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SMALL BUILDING BLOCKS ───────────────────────────────────────────────────

function CountStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, value, {
      duration: 1.6,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString("en-US") + suffix;
      },
    });
    return () => controls.stop();
  }, [inView, value, suffix]);

  return (
    <div>
      <div className="font-[family-name:var(--font-display)] text-[28px] font-semibold tabular-nums text-stone-100">
        <span ref={ref}>0{suffix}</span>
      </div>
      <div className="mt-1 text-[13px] tracking-wide text-stone-500">{label}</div>
    </div>
  );
}

function SectionHeading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <motion.div {...fadeUp} className="mx-auto mb-16 max-w-2xl text-center">
      <p className="mb-4 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.32em] text-violet-400">
        <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-transparent to-violet-500/60" />
        {kicker}
        <span aria-hidden="true" className="h-px w-8 bg-gradient-to-l from-transparent to-violet-500/60" />
      </p>
      <h2 className="text-balance font-[family-name:var(--font-display)] text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-tight text-stone-50">
        {title}
      </h2>
      {sub && <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-stone-400">{sub}</p>}
    </motion.div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 drop-shadow-[0_2px_8px_rgba(124,58,237,0.5)]" aria-hidden="true">
        <defs>
          <linearGradient id="logo-v" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-v)" />
        <path d="M8 9l8 15 8-15" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-stone-100">
        Vain&rsquo;s Studio Tool
      </span>
    </span>
  );
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const NAV = [
  { label: "Studio", href: "/studio-tool/app" },
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const STEPS = [
  {
    n: "01",
    title: "Upload your design",
    body: "Drop in a photo, sketch, painting or digital piece — color, greyscale, even a napkin doodle shot on your phone.",
  },
  {
    n: "02",
    title: "AI extracts the lines",
    body: "Our model separates true linework from shading and noise, then rebuilds it as crisp, high-contrast strokes at print resolution.",
  },
  {
    n: "03",
    title: "Print & transfer",
    body: "Export a stencil sized to the placement, ready for thermal transfer paper. Adjust line weight and detail before you print.",
  },
];

const FEATURES = [
  {
    title: "High-contrast line extraction",
    body: "Clean black-and-white output with no grey mush — lines that survive thermal paper and read clearly on skin.",
    icon: "M4 17c4-8 6-8 8 0s4 8 8 0",
  },
  {
    title: "Detail dial",
    body: "Slide between a loose guide and a full detail map. Keep every whisker or strip it down to structure only.",
    icon: "M4 12h10m4 0h2M14 8v8",
  },
  {
    title: "Sized for placement",
    body: "Set the real-world size in centimeters or inches and export at exact scale — no printer guesswork.",
    icon: "M4 4h16v16H4zM4 9h5V4m10 10h-5v5",
  },
  {
    title: "Shading maps",
    body: "Generate a second layer that marks value zones, so your shading plan travels with the stencil.",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 0v18",
  },
  {
    title: "Batch conversion",
    body: "Queue a full day of appointments at once. Every client design comes back stencil-ready in one pass.",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  {
    title: "Your art stays yours",
    body: "Uploads are private, never used for training, and deletable with one click. Client work is client work.",
    icon: "M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z",
  },
];

const PLANS = [
  {
    name: "Guest Spot",
    price: "$0",
    period: "forever",
    tagline: "Try the workflow on your own pieces.",
    features: ["10 stencils per month", "Standard resolution export", "Detail dial", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Resident",
    price: "$19",
    period: "per month",
    tagline: "For working artists with a full book.",
    features: [
      "Unlimited stencils",
      "Print-resolution export at exact scale",
      "Shading maps",
      "Batch conversion",
      "Priority processing",
    ],
    cta: "Start 7-day trial",
    featured: true,
  },
  {
    name: "Studio",
    price: "$49",
    period: "per month",
    tagline: "Every chair in the shop, one bill.",
    features: [
      "Everything in Resident",
      "5 artist seats included",
      "Shared client library",
      "Studio branding on exports",
      "Dedicated support",
    ],
    cta: "Talk to us",
    featured: false,
  },
];

const FAQS = [
  {
    q: "What file types can I upload?",
    a: "JPG, PNG, HEIC and PDF. Phone photos of paper sketches work fine — the model was tuned on exactly that kind of messy input.",
  },
  {
    q: "Does it work with color references?",
    a: "Yes. The line extractor ignores hue and reads structure, so a full-color painting comes back as clean single-weight linework.",
  },
  {
    q: "Can I edit the stencil after it's generated?",
    a: "You can re-run any conversion with a different detail level and line weight, and export as SVG to fine-tune in Procreate or Photoshop.",
  },
  {
    q: "Is my clients' artwork private?",
    a: "Always. Uploads are encrypted, visible only to your account, never used to train models, and you can permanently delete them at any time.",
  },
  {
    q: "What do I print the stencil on?",
    a: "Any standard thermal transfer paper. Exports are calibrated for common thermal copiers and inkjet stencil workflows alike.",
  },
];

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function StudioTool() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div dir="ltr" className="min-h-screen bg-stone-950 font-sans text-stone-200 selection:bg-violet-600/40">
      <Grain />

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-stone-950/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" aria-label="Vain's Studio Tool — home" className="cursor-pointer">
            <Logo />
          </a>
          <div className="hidden items-center gap-8 text-sm text-stone-400 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="cursor-pointer transition-colors duration-200 hover:text-stone-100">
                {item.label}
              </a>
            ))}
          </div>
          <a href="/studio-tool/app" className={`${BTN_PRIMARY} px-5 py-2 text-sm`}>
            Try it free
          </a>
        </nav>
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-violet-700/25 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-120px] top-40 h-[340px] w-[340px] rounded-full bg-fuchsia-800/15 blur-[110px]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
              </span>
              AI stencils, built for tattoo artists
            </p>
            <h1 className="text-balance font-[family-name:var(--font-display)] text-[clamp(2.5rem,5.2vw,4rem)] font-medium leading-[1.06] tracking-[-0.01em] text-stone-50">
              From any design to a{" "}
              <em className="bg-gradient-to-r from-violet-300 via-violet-400 to-fuchsia-400 bg-clip-text italic text-transparent">
                transfer-ready stencil
              </em>{" "}
              in seconds
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-stone-400">
              Vain&rsquo;s Studio Tool reads your reference — photo, sketch or full-color
              painting — and returns clean, high-contrast linework calibrated for thermal
              transfer paper. No tracing. No lightbox. No lost afternoon.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <a href="/studio-tool/app" className={BTN_PRIMARY}>
                Generate your first stencil
              </a>
              <a
                href="#how"
                className="group cursor-pointer px-1 py-3 font-medium text-stone-300 transition-colors duration-200 hover:text-white"
              >
                See how it works{" "}
                <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>
            <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-500">
              Free plan included
              <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-stone-600" />
              No credit card
              <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-stone-600" />
              Your art is never used for training
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotate: 1 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
            className="mx-auto w-full max-w-[400px]"
          >
            <StencilSlider />
            <p className="mt-5 text-center text-xs tracking-wide text-stone-500">
              Drag the handle — original design vs. generated stencil
            </p>
          </motion.div>
        </div>

        <StyleMarquee />

        {/* stats strip */}
        <div className="border-b border-white/5 bg-white/[0.02]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-10 text-center sm:grid-cols-4">
            <CountStat value={120} suffix="k+" label="stencils generated" />
            <CountStat value={4200} suffix="+" label="artists on board" />
            <div>
              <div className="font-[family-name:var(--font-display)] text-[28px] font-semibold tabular-nums text-stone-100">
                &lt;9s
              </div>
              <div className="mt-1 text-[13px] tracking-wide text-stone-500">average conversion</div>
            </div>
            <CountStat value={600} suffix=" dpi" label="print-ready export" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
        <SectionHeading
          kicker="How it works"
          title="Three steps between reference and skin"
          sub="The workflow you already have — minus the hour of tracing in the middle of it."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.12 }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-3 -top-7 font-[family-name:var(--font-display)] text-[7rem] font-bold leading-none text-white/[0.04]"
              >
                {step.n}
              </span>
              <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.24em] text-violet-400">
                {step.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-stone-50">{step.title}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-stone-400">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-20 border-y border-white/5 bg-white/[0.02] py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            kicker="Features"
            title="Everything the stencil stage needs"
            sub="Purpose-built for tattooing — not a generic photo filter with the contrast cranked up."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.1 }}
                className="group relative rounded-2xl border border-white/[0.06] bg-stone-950/70 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-[0_20px_50px_-20px_rgba(109,40,217,0.4)]"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-violet-500/25 to-violet-700/10 text-violet-300 ring-1 ring-inset ring-violet-400/20 transition-colors duration-300 group-hover:text-violet-200">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-stone-50">{f.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-stone-400">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="relative mx-auto max-w-3xl px-5 py-28 text-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 font-[family-name:var(--font-display)] text-[11rem] leading-none text-violet-500/[0.08]"
        >
          &ldquo;
        </span>
        <motion.figure {...fadeUp} className="relative">
          <blockquote className="text-balance font-[family-name:var(--font-display)] text-[clamp(1.4rem,2.6vw,1.85rem)] font-medium italic leading-relaxed text-stone-100">
            &ldquo;I used to lose evenings redrawing references for the next day&rsquo;s
            appointments. Now the stencils are done before my coffee is.&rdquo;
          </blockquote>
          <figcaption className="mt-8 flex items-center justify-center gap-3 text-[13px] tracking-wide text-stone-500">
            <span aria-hidden="true" className="h-px w-10 bg-stone-700" />
            Resident artist, private studio — beta user since day one
            <span aria-hidden="true" className="h-px w-10 bg-stone-700" />
          </figcaption>
        </motion.figure>
      </section>

      {/* PRICING */}
      <section id="pricing" className="scroll-mt-20 border-t border-white/5 bg-white/[0.02] py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            kicker="Pricing"
            title="Plans that scale with your book"
            sub="Start free, upgrade when the queue does. Cancel anytime."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  plan.featured
                    ? "border border-transparent bg-stone-950 shadow-[0_30px_80px_-30px_rgba(109,40,217,0.55)] [background:linear-gradient(#131017,#131017)_padding-box,linear-gradient(160deg,rgba(167,139,250,0.7),rgba(109,40,217,0.15)_45%,rgba(217,70,239,0.4))_border-box] lg:-my-3 lg:py-11"
                    : "border border-white/[0.06] bg-stone-950/70"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-violet-900/50">
                    Most popular
                  </span>
                )}
                <h3 className="font-semibold tracking-wide text-stone-100">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-[family-name:var(--font-display)] text-[2.6rem] font-semibold tabular-nums text-stone-50">
                    {plan.price}
                  </span>
                  <span className="text-sm text-stone-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-stone-400">{plan.tagline}</p>
                <ul className="mt-7 flex-1 space-y-3.5 text-sm text-stone-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-inset ring-violet-400/25">
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-violet-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 12l5 5L20 6" />
                        </svg>
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href="/studio-tool/app"
                  className={
                    plan.featured
                      ? `${BTN_PRIMARY} mt-8 py-3 text-center text-sm`
                      : "mt-8 cursor-pointer rounded-full border border-white/10 py-3 text-center text-sm font-semibold text-stone-200 transition-colors duration-200 hover:border-violet-400/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                  }
                >
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-28">
        <SectionHeading kicker="FAQ" title="Questions artists actually ask" />
        <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          {FAQS.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left font-medium text-stone-100 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-400"
              >
                {item.q}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                    openFaq === i
                      ? "rotate-45 border-violet-400/50 bg-violet-500/15 text-violet-300"
                      : "border-white/10 text-stone-400"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-6 text-[14.5px] leading-relaxed text-stone-400">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-white/5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 left-1/2 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-violet-700/25 blur-[120px]"
        />
        <motion.div {...fadeUp} className="relative mx-auto max-w-3xl px-5 py-28 text-center">
          <h2 className="text-balance font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.8vw,2.8rem)] font-medium leading-tight text-stone-50">
            Spend the time on the tattoo,
            <br />
            <em className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text italic text-transparent">
              not the tracing
            </em>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-stone-400">
            Upload one design and see the stencil for yourself. The free plan is free for
            good — no card, no countdown.
          </p>
          <a href="/studio-tool/app" className={`${BTN_PRIMARY} mt-9 px-9 py-3.5`}>
            Try Vain&rsquo;s Studio Tool free
          </a>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row">
          <Logo />
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[13px] text-stone-500">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="cursor-pointer transition-colors duration-200 hover:text-stone-200">
                {item.label}
              </a>
            ))}
          </div>
          <p className="text-xs text-stone-600">© {new Date().getFullYear()} Studio Vain. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
