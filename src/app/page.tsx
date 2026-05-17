"use client";

import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";

// ─── EARRING SVGs ────────────────────────────────────────────────────────────

function CrystalDropEarring({ pid, w = 70 }: { pid: string; w?: number }) {
  const h = Math.round(w * 2.45);
  return (
    <svg viewBox="0 0 70 172" width={w} height={h} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${pid}-hook`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9E79F" />
          <stop offset="45%" stopColor="#D4AC0D" />
          <stop offset="100%" stopColor="#7D6608" />
        </linearGradient>
        <linearGradient id={`${pid}-cry`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#E0EEF6" />
          <stop offset="35%" stopColor="#A8C8DA" />
          <stop offset="100%" stopColor="#3A6A80" />
        </linearGradient>
        <linearGradient id={`${pid}-lt`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`${pid}-dk`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#12293A" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#091520" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${pid}-ac`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9DCFEE" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#4E9DBF" stopOpacity="0.35" />
        </linearGradient>
        <filter id={`${pid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hook */}
      <path
        d="M35 10 Q48 10 48 25 Q48 36 35 38"
        stroke={`url(#${pid}-hook)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${pid}-glow)`}
      />
      <circle cx="35" cy="10" r="5" fill={`url(#${pid}-hook)`} filter={`url(#${pid}-glow)`} />

      {/* Connector rod */}
      <rect x="33" y="38" width="4" height="14" rx="2" fill={`url(#${pid}-hook)`} />

      {/* Crystal diamond body */}
      <polygon points="35,52 60,99 35,156 10,99" fill={`url(#${pid}-cry)`} />

      {/* Facets for 3D realism */}
      <polygon points="35,52 60,99 35,108" fill={`url(#${pid}-lt)`} />
      <polygon points="35,52 10,99 35,108" fill={`url(#${pid}-dk)`} />
      <polygon points="35,108 60,99 35,156" fill={`url(#${pid}-ac)`} />
      <polygon points="35,108 10,99 35,156" fill={`url(#${pid}-dk)`} opacity="0.5" />

      {/* Sparkle highlights */}
      <ellipse cx="29" cy="67" rx="4.2" ry="6.5" fill="white" opacity="0.58" transform="rotate(-22 29 67)" />
      <circle cx="42" cy="57" r="2.2" fill="white" opacity="0.72" />
      <circle cx="27" cy="59" r="1.1" fill="white" opacity="0.5" />
    </svg>
  );
}

function GoldHoopEarring({ pid, w = 90 }: { pid: string; w?: number }) {
  const h = Math.round(w * 1.27);
  return (
    <svg viewBox="0 0 90 114" width={w} height={h} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${pid}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F7DC6F" />
          <stop offset="28%" stopColor="#D4AC0D" />
          <stop offset="62%" stopColor="#B8860B" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id={`${pid}-hook`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9E79F" />
          <stop offset="100%" stopColor="#D4AC0D" />
        </linearGradient>
        <filter id={`${pid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hook */}
      <path
        d="M45 8 Q57 8 57 21 Q57 30 45 30"
        stroke={`url(#${pid}-hook)`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="45" cy="8" r="4.2" fill={`url(#${pid}-hook)`} />

      {/* Main hoop */}
      <circle cx="45" cy="72" r="34" stroke={`url(#${pid}-gold)`} strokeWidth="9.5" fill="none" filter={`url(#${pid}-glow)`} />

      {/* Metallic sheen */}
      <path d="M17 58 Q11 72 17 86" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.38" fill="none" />
      <path d="M71 62 Q76 72 73 83" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.18" fill="none" />
    </svg>
  );
}

function GeometricDropEarring({ pid, w = 55 }: { pid: string; w?: number }) {
  const h = Math.round(w * 3.7);
  return (
    <svg viewBox="0 0 55 203" width={w} height={h} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${pid}-gold`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7D6608" />
          <stop offset="32%" stopColor="#D4AC0D" />
          <stop offset="60%" stopColor="#F0CC55" />
          <stop offset="100%" stopColor="#7D6608" />
        </linearGradient>
        <linearGradient id={`${pid}-hook`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9E79F" />
          <stop offset="100%" stopColor="#D4AC0D" />
        </linearGradient>
        <linearGradient id={`${pid}-gem`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0E0A0" />
          <stop offset="50%" stopColor="#C8A020" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <filter id={`${pid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Stud */}
      <circle cx="27.5" cy="9" r="5.5" fill={`url(#${pid}-hook)`} filter={`url(#${pid}-glow)`} />
      <rect x="24.5" y="14.5" width="6" height="20" rx="3" fill={`url(#${pid}-hook)`} />

      {/* Bar stack */}
      <rect x="5" y="34" width="45" height="11" rx="5.5" fill={`url(#${pid}-gold)`} />
      <rect x="24.5" y="45" width="6" height="18" rx="3" fill={`url(#${pid}-hook)`} />
      <rect x="12" y="63" width="31" height="9" rx="4.5" fill={`url(#${pid}-gold)`} />
      <rect x="24.5" y="72" width="6" height="16" rx="3" fill={`url(#${pid}-hook)`} />

      {/* Circle pendant */}
      <circle cx="27.5" cy="110" r="22" fill="none" stroke={`url(#${pid}-gold)`} strokeWidth="6" filter={`url(#${pid}-glow)`} />
      <circle cx="27.5" cy="110" r="13" fill={`url(#${pid}-gem)`} />
      <ellipse cx="22" cy="103" rx="3.5" ry="5.5" fill="white" opacity="0.45" transform="rotate(-20 22 103)" />

      {/* Connector */}
      <rect x="24.5" y="132" width="6" height="14" rx="3" fill={`url(#${pid}-hook)`} />

      {/* Bottom diamond gem */}
      <polygon points="27.5,146 43,165 27.5,186 12,165" fill={`url(#${pid}-gem)`} />
      <polygon points="27.5,146 43,165 27.5,167" fill="white" opacity="0.42" />
      <polygon points="27.5,167 43,165 27.5,186" fill="black" opacity="0.2" />
      <circle cx="33" cy="153" r="1.8" fill="white" opacity="0.6" />
    </svg>
  );
}

// ─── FLOATING EARRING WRAPPER ─────────────────────────────────────────────────

interface FloatingEarringProps {
  type: "crystal" | "hoop" | "geometric";
  pid: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width: number;
  floatDelay?: number;
  floatDuration?: number;
  swayDuration?: number;
  tiltDuration?: number;
  blur?: number;
  opacity?: number;
  baseRotate?: number;
}

function FloatingEarring({
  type,
  pid,
  top,
  bottom,
  left,
  right,
  width,
  floatDelay = 0,
  floatDuration = 4.5,
  swayDuration = 6,
  tiltDuration = 7,
  blur = 0,
  opacity = 1,
  baseRotate = 0,
}: FloatingEarringProps) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{
        top,
        bottom,
        left,
        right,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        opacity,
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(212,172,13,0.14) 0%, transparent 68%)",
          transform: "scale(2.2)",
        }}
      />

      {/* Float + sway */}
      <motion.div
        animate={{
          y: [0, -24, 0],
          rotate: [baseRotate - 5, baseRotate + 5, baseRotate - 5],
        }}
        transition={{
          y: { repeat: Infinity, duration: floatDuration, ease: "easeInOut", delay: floatDelay },
          rotate: { repeat: Infinity, duration: swayDuration, ease: "easeInOut", delay: floatDelay + 0.4 },
        }}
      >
        {/* Perspective container for 3D tilt */}
        <div style={{ perspective: "520px" }}>
          <motion.div
            animate={{ rotateY: [-22, 22, -22] }}
            transition={{
              repeat: Infinity,
              duration: tiltDuration,
              ease: "easeInOut",
              delay: floatDelay + 1.1,
            }}
          >
            {type === "crystal" && <CrystalDropEarring pid={pid} w={width} />}
            {type === "hoop" && <GoldHoopEarring pid={pid} w={width} />}
            {type === "geometric" && <GeometricDropEarring pid={pid} w={width} />}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── CONTENT DATA ─────────────────────────────────────────────────────────────

const services = [
  {
    num: "01",
    title: "עיצוב אתרים",
    en: "Website Design",
    desc: "חוויות ויזואליות שמשאירות רושם. כל פיקסל מחושב, כל אנימציה מכוונת למטרה אחת — לגרום למשתמש להישאר.",
  },
  {
    num: "02",
    title: "מיתוג דיגיטלי",
    en: "Digital Branding",
    desc: "זהות ויזואלית שמספרת את הסיפור שלכם לפני שנאמרת מילה אחת. לוגו, פלטת צבעים, שפה עיצובית.",
  },
  {
    num: "03",
    title: "אנימציה ותנועה",
    en: "Motion & Animation",
    desc: "תנועה שמוסיפה עומק ואופי. אפקטים שהופכים גלישה רגילה לחוויה בלתי נשכחת.",
  },
  {
    num: "04",
    title: "חנויות אונליין",
    en: "E-Commerce",
    desc: "פלטפורמות מכירה שממירות מבקרים ללקוחות. עיצוב שמגביר אמון ומוביל לרכישה.",
  },
];

const portfolio = [
  { id: 1, label: "קמפיין אופנה", en: "Fashion Campaign", aspect: "tall" },
  { id: 2, label: "מסחר אלקטרוני", en: "E-Commerce", aspect: "wide" },
  { id: 3, label: "בוטיק לוקאלי", en: "Boutique", aspect: "square" },
  { id: 4, label: "דף נחיתה", en: "Landing Page", aspect: "tall" },
  { id: 5, label: "אפליקציית מובייל", en: "Mobile App", aspect: "wide" },
  { id: 6, label: "מיתוג מלא", en: "Full Branding", aspect: "square" },
];

const steps = [
  {
    step: "01",
    title: "גילוי",
    desc: "ניפגש, נשמע לעומק, ונבין את החזון, הקהל, והמטרות שלכם לפני שמתחילים לצייר פיקסל אחד.",
  },
  {
    step: "02",
    title: "עיצוב",
    desc: "נבנה פתרון ויזואלי שמדויק לקהל שלכם — עם נקודות חיכוך מזוהות ומוסרות.",
  },
  {
    step: "03",
    title: "השקה",
    desc: "נעלה לאוויר, נמדוד תוצאות, ונשפר באופן מתמיד. הפרויקט לא נגמר בהשקה.",
  },
];

// ─── PARALLAX HELPER ──────────────────────────────────────────────────────────

function ParallaxSection({ children, offset = 60 }: { children: React.ReactNode; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-offset, offset]);
  const springY = useSpring(y, { stiffness: 80, damping: 22 });
  return (
    <div ref={ref}>
      <motion.div style={{ y: springY }}>{children}</motion.div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [hoveredService, setHoveredService] = useState<number | null>(null);

  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroBgY = useTransform(heroScroll, [0, 1], ["0%", "45%"]);
  const heroOpacity = useTransform(heroScroll, [0, 0.72], [1, 0]);
  const heroScale = useTransform(heroScroll, [0, 1], [1, 1.07]);

  return (
    <div className="bg-[#0C0A09] text-white overflow-x-hidden" dir="rtl">

      {/* ── NAV ── */}
      <motion.nav
        className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-8 py-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <span className="text-xs tracking-[0.25em] text-white/90 font-semibold uppercase">
          Studio Vain
        </span>

        <div className="hidden sm:flex gap-8 text-xs tracking-widest text-white/40 uppercase">
          {(
            [
              ["עבודות", "work"],
              ["שירותים", "services"],
              ["תהליך", "process"],
              ["צור קשר", "contact"],
            ] as [string, string][]
          ).map(([label, id]) => (
            <motion.a
              key={id}
              href={`#${id}`}
              className="hover:text-white transition-colors duration-200 cursor-pointer"
              whileHover={{ y: -1 }}
            >
              {label}
            </motion.a>
          ))}
        </div>

        <motion.a
          href="#contact"
          className="text-xs tracking-widest uppercase border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black transition-colors duration-200 cursor-pointer"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          דברו איתנו
        </motion.a>
      </motion.nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative h-screen flex items-center px-8 sm:px-16 overflow-hidden">
        {/* Parallax background */}
        <motion.div className="absolute inset-0" style={{ y: heroBgY, scale: heroScale }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#1C1410] via-[#0C0A09] to-[#090808]" />
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 65% 55% at 72% 50%, rgba(202,138,4,0.07) 0%, transparent 72%)",
            }}
          />
        </motion.div>

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px",
          }}
        />

        {/* ── FLOATING EARRINGS ── */}
        {/* Large crystal — main focal piece */}
        <FloatingEarring
          type="crystal" pid="e1" width={90}
          top="10%" right="7%"
          floatDelay={0} floatDuration={4.3} swayDuration={5.5} tiltDuration={7.2}
        />
        {/* Gold hoop — left side upper */}
        <FloatingEarring
          type="hoop" pid="e2" width={108}
          top="16%" left="3%"
          floatDelay={0.85} floatDuration={5.1} swayDuration={6.6} tiltDuration={8.4}
          baseRotate={-6}
        />
        {/* Geometric — right lower, medium */}
        <FloatingEarring
          type="geometric" pid="e3" width={50}
          top="54%" right="13%"
          floatDelay={1.6} floatDuration={3.9} swayDuration={5.2} tiltDuration={6.5}
          opacity={0.82} blur={0.6}
        />
        {/* Crystal — small, bottom-left, depth blur */}
        <FloatingEarring
          type="crystal" pid="e4" width={52}
          top="62%" left="9%"
          floatDelay={2.1} floatDuration={4.9} swayDuration={7.1} tiltDuration={9}
          opacity={0.62} blur={1.2} baseRotate={9}
        />
        {/* Hoop — large, background top, very blurred */}
        <FloatingEarring
          type="hoop" pid="e5" width={135}
          top="-10%" right="29%"
          floatDelay={0.4} floatDuration={6.2} swayDuration={8.3} tiltDuration={10.5}
          opacity={0.22} blur={3.5}
        />
        {/* Geometric — tiny accent mid-right */}
        <FloatingEarring
          type="geometric" pid="e6" width={34}
          top="36%" right="27%"
          floatDelay={2.6} floatDuration={4.1} swayDuration={5.7} tiltDuration={7.8}
          opacity={0.52} blur={0.6} baseRotate={-11}
        />

        {/* Hero text */}
        <motion.div className="relative z-10 max-w-2xl" style={{ opacity: heroOpacity }}>
          <motion.p
            className="text-xs tracking-[0.42em] uppercase mb-6"
            style={{ color: "rgba(202,138,4,0.65)" }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            סוכנות עיצוב דיגיטלי פרימיום
          </motion.p>

          {(["עיצוב", "שמדבר", "בשבילך"] as const).map((word, i) => (
            <div key={word} className="overflow-hidden">
              <motion.h1
                className="leading-none tracking-tight"
                style={{
                  fontFamily: "var(--font-frank-ruhl), serif",
                  fontSize: "clamp(3.2rem,10.5vw,9rem)",
                  fontWeight: 700,
                  color:
                    i === 0
                      ? "#FFFFFF"
                      : i === 1
                      ? "rgba(202,138,4,0.88)"
                      : "rgba(255,255,255,0.13)",
                }}
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.95, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
              </motion.h1>
            </div>
          ))}

          <motion.p
            className="mt-8 text-base text-white/40 max-w-sm leading-relaxed"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68, duration: 0.75 }}
          >
            יוצרים חוויות ויזואליות שעוצרות גלילה, מעוררות רגש, ומניעות לפעולה.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.88, duration: 0.75 }}
          >
            <motion.a
              href="#work"
              className="px-7 py-3.5 text-sm font-semibold tracking-wide rounded-full cursor-pointer text-white"
              style={{ backgroundColor: "rgba(202,138,4,0.9)" }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              צפו בעבודות
            </motion.a>
            <motion.a
              href="#contact"
              className="px-7 py-3.5 border border-white/20 text-white/55 text-sm tracking-wide rounded-full hover:border-white/40 hover:text-white/80 transition-colors duration-200 cursor-pointer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              צרו קשר
            </motion.a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute left-8 bottom-10 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="w-px h-14 bg-gradient-to-b from-white/30 to-transparent"
            style={{ originY: "0%" }}
            animate={{ scaleY: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 2.1, ease: "easeInOut" }}
          />
          <span className="text-[10px] tracking-[0.32em] uppercase text-white/20">גלול</span>
        </motion.div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="border-y border-white/5 py-4 overflow-hidden">
        <motion.div
          className="flex gap-16 whitespace-nowrap text-xs tracking-[0.32em] uppercase text-white/24"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 28, ease: "linear" }}
          dir="ltr"
        >
          {Array(4)
            .fill(null)
            .map((_, i) => (
              <span key={i}>
                עיצוב אתרים &nbsp;◆&nbsp; מיתוג &nbsp;◆&nbsp; אנימציה &nbsp;◆&nbsp; Studio
                Vain &nbsp;◆&nbsp; חנויות אונליין &nbsp;◆&nbsp; חוויות מרהיבות &nbsp;◆&nbsp;
              </span>
            ))}
        </motion.div>
      </div>

      {/* ── SERVICES ── */}
      <section id="services" className="py-32 px-8 max-w-6xl mx-auto">
        <ParallaxSection offset={30}>
          <p className="text-xs tracking-[0.38em] uppercase mb-3" style={{ color: "rgba(202,138,4,0.55)" }}>
            מה אנחנו עושים
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold text-white mb-16"
            style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
          >
            שירותים
          </h2>
        </ParallaxSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5">
          {services.map((s, i) => (
            <motion.div
              key={s.num}
              className="bg-[#0C0A09] p-8 relative overflow-hidden cursor-pointer"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.65 }}
              onHoverStart={() => setHoveredService(i)}
              onHoverEnd={() => setHoveredService(null)}
            >
              <AnimatePresence>
                {hoveredService === i && (
                  <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      background: "radial-gradient(ellipse at 35% 50%, rgba(202,138,4,0.07) 0%, transparent 72%)",
                    }}
                  />
                )}
              </AnimatePresence>

              <span
                className="block text-xs tracking-widest mb-6"
                style={{ color: "rgba(202,138,4,0.45)" }}
              >
                {s.num}
              </span>

              <h3
                className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
              >
                {s.title}
              </h3>
              <p className="text-xs tracking-widest text-white/25 uppercase mb-5">{s.en}</p>
              <p className="text-sm text-white/42 leading-relaxed">{s.desc}</p>

              <motion.div
                className="mt-8 flex items-center gap-2 text-xs tracking-widest"
                style={{ color: "rgba(202,138,4,0.5)" }}
                animate={{ x: hoveredService === i ? -4 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <span>←</span>
                <span>גלו עוד</span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── WORK ── */}
      <section id="work" className="py-32 px-8 max-w-6xl mx-auto">
        <ParallaxSection offset={40}>
          <p className="text-xs tracking-[0.38em] uppercase mb-3" style={{ color: "rgba(202,138,4,0.55)" }}>
            פורטפוליו
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold text-white mb-16"
            style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
          >
            עבודות נבחרות
          </h2>
        </ParallaxSection>

        <div className="columns-2 sm:columns-3 gap-3 space-y-3">
          {portfolio.map((item, i) => (
            <motion.div
              key={item.id}
              className="break-inside-avoid relative overflow-hidden group cursor-pointer rounded-sm"
              style={{
                height: item.aspect === "tall" ? 320 : item.aspect === "wide" ? 200 : 260,
                background: "linear-gradient(135deg, #1a1a1a, #0a0a0a)",
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
            >
              {/* Per-card gold accent */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at ${18 + i * 14}% ${22 + i * 13}%, rgba(202,138,4,0.08) 0%, transparent 55%)`,
                }}
              />
              {/* Subtle grid */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              {/* Hover reveal */}
              <motion.div
                className="absolute inset-0 flex items-end p-5"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78), transparent)" }}
                />
                <div className="relative z-10">
                  <p className="text-xs tracking-widest uppercase text-white/50 mb-0.5">{item.en}</p>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section id="process" className="py-32 px-8 max-w-6xl mx-auto border-t border-white/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-16 items-start">
          <ParallaxSection offset={50}>
            <p className="text-xs tracking-[0.38em] uppercase mb-3" style={{ color: "rgba(202,138,4,0.55)" }}>
              איך עובדים
            </p>
            <h2
              className="text-4xl sm:text-5xl font-bold text-white leading-tight"
              style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
            >
              התהליך
              <br />
              שלנו
            </h2>
            <p className="mt-6 text-sm text-white/38 leading-relaxed max-w-xs">
              שלושה שלבים. מרעיון לתוצאה. בלי בירוקרטיה, בלי הפתעות.
            </p>
          </ParallaxSection>

          <div className="flex flex-col divide-y divide-white/5">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                className="py-8 flex gap-6"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
              >
                <span
                  className="text-3xl font-bold leading-none pt-1 shrink-0"
                  style={{
                    fontFamily: "var(--font-frank-ruhl), serif",
                    color: "rgba(202,138,4,0.22)",
                  }}
                >
                  {s.step}
                </span>
                <div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHILOSOPHY STRIP ── */}
      <div className="py-28 overflow-hidden border-y border-white/5">
        <ParallaxSection offset={18}>
          <p
            className="text-center font-light text-white/7 tracking-widest"
            style={{
              fontFamily: "var(--font-frank-ruhl), serif",
              fontSize: "clamp(1.3rem,4.2vw,3.4rem)",
            }}
          >
            כל פיקסל הוא כוונה. כל אנימציה היא שיחה.
          </p>
        </ParallaxSection>
      </div>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-40 px-8 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 44 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-xs tracking-[0.38em] uppercase mb-6" style={{ color: "rgba(202,138,4,0.55)" }}>
            מוכנים?
          </p>
          <h2
            className="text-5xl sm:text-7xl font-bold text-white mb-6 leading-none"
            style={{ fontFamily: "var(--font-frank-ruhl), serif" }}
          >
            בואו נייצר
            <br />
            <span style={{ color: "rgba(202,138,4,0.88)" }}>משהו מדהים</span>
          </h2>
          <p className="text-white/38 text-sm max-w-xs mx-auto mb-12 leading-relaxed">
            פרויקט חדש? שאלה? רעיון? אנחנו כאן להקשיב ולהפוך חזון למציאות.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href="mailto:hello@studiovain.co.il"
              className="px-9 py-4 text-sm font-semibold tracking-wide rounded-full cursor-pointer text-white"
              style={{ backgroundColor: "rgba(202,138,4,0.9)" }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              hello@studiovain.co.il
            </motion.a>
            <motion.a
              href="tel:+97250000000"
              className="px-9 py-4 border border-white/15 text-white/50 text-sm tracking-wide rounded-full hover:border-white/32 hover:text-white/75 transition-colors duration-200 cursor-pointer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              +972 50-000-0000
            </motion.a>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs tracking-[0.22em] uppercase text-white/20">Studio Vain © 2025</span>
        <span className="text-xs text-white/10">תל אביב, ישראל</span>
        <div className="flex gap-6 text-xs tracking-widest text-white/20 uppercase">
          {["Instagram", "Behance", "LinkedIn"].map((s) => (
            <motion.a
              key={s}
              href="#"
              className="hover:text-white/44 transition-colors duration-200 cursor-pointer"
              whileHover={{ y: -1 }}
            >
              {s}
            </motion.a>
          ))}
        </div>
      </footer>
    </div>
  );
}
