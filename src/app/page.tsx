"use client";

import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";

const services = [
  {
    title: "Tattoo",
    subtitle: "Custom & Flash",
    desc: "From minimalist linework to full-sleeve masterpieces. Every piece is designed uniquely for you.",
    icon: "✦",
  },
  {
    title: "Piercing",
    subtitle: "Precision & Care",
    desc: "Professional body piercing with implant-grade titanium. Nose, ear, lip, brow — all styles.",
    icon: "◈",
  },
  {
    title: "Touch-Up",
    subtitle: "Free for Life",
    desc: "We stand behind our work. All tattoos include a free touch-up within 6 months.",
    icon: "◇",
  },
];

const gallery = [
  { id: 1, label: "Blackwork", aspect: "tall" },
  { id: 2, label: "Fine Line", aspect: "wide" },
  { id: 3, label: "Japanese", aspect: "square" },
  { id: 4, label: "Geometric", aspect: "tall" },
  { id: 5, label: "Neo-Trad", aspect: "wide" },
  { id: 6, label: "Realism", aspect: "square" },
];

const artists = [
  { name: "Maya R.", role: "Blackwork & Dotwork", years: "8y" },
  { name: "Eli K.", role: "Japanese & Neo-Trad", years: "11y" },
  { name: "Noa S.", role: "Fine Line & Botanical", years: "5y" },
];

function ParallaxText({ children, speed = 0.4 }: { children: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", `${speed * 100}%`]);
  return (
    <div ref={ref} className="overflow-hidden">
      <motion.p
        className="text-[clamp(2.5rem,8vw,7rem)] font-bold text-white/5 whitespace-nowrap tracking-tight"
        style={{ y }}
      >
        {children}
      </motion.p>
    </div>
  );
}

function ParallaxSection({ children, offset = 80 }: { children: React.ReactNode; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-offset, offset]);
  const springY = useSpring(y, { stiffness: 80, damping: 20 });
  return (
    <div ref={ref}>
      <motion.div style={{ y: springY }}>{children}</motion.div>
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeService, setActiveService] = useState<number | null>(null);

  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroBgY = useTransform(heroScroll, [0, 1], ["0%", "40%"]);
  const heroTextY = useTransform(heroScroll, [0, 1], ["0%", "60%"]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0]);
  const heroScale = useTransform(heroScroll, [0, 1], [1, 1.08]);

  return (
    <div className="bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <span className="text-sm font-semibold tracking-[0.2em] uppercase text-white/90">Studio Vain</span>
        <div className="hidden sm:flex gap-8 text-xs tracking-widest text-white/40 uppercase">
          {["Work", "Services", "Artists", "Book"].map((item) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="hover:text-white transition-colors"
              whileHover={{ y: -1 }}
            >
              {item}
            </motion.a>
          ))}
        </div>
        <motion.a
          href="#book"
          className="text-xs tracking-widest uppercase border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black transition-colors"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          Book Now
        </motion.a>
      </motion.nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative h-screen flex items-end pb-24 px-8 overflow-hidden">
        {/* Parallax background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-[#0f0f0f] to-[#0a0a0a]"
          style={{ y: heroBgY, scale: heroScale }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px",
          }}
        />

        {/* Decorative line */}
        <motion.div
          className="absolute top-1/3 right-0 w-px h-48 bg-gradient-to-b from-transparent via-white/20 to-transparent"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.8, duration: 1.2 }}
        />

        {/* Hero text */}
        <motion.div
          className="relative z-10 max-w-5xl"
          style={{ y: heroTextY, opacity: heroOpacity }}
        >
          <motion.p
            className="text-xs tracking-[0.4em] uppercase text-white/30 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Tel Aviv · Est. 2016
          </motion.p>

          <div className="overflow-hidden">
            <motion.h1
              className="text-[clamp(3rem,12vw,10rem)] font-bold leading-none tracking-tight text-white"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              Studio
            </motion.h1>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              className="text-[clamp(3rem,12vw,10rem)] font-bold leading-none tracking-tight text-white/20"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              Vain
            </motion.h1>
          </div>

          <motion.p
            className="mt-8 text-base text-white/40 max-w-sm leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
          >
            Tattoo & Piercing. Where ink meets identity.
          </motion.p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute right-8 bottom-24 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/20 rotate-90 mb-2">Scroll</span>
          <motion.div
            className="w-px h-16 bg-gradient-to-b from-white/30 to-transparent"
            animate={{ scaleY: [1, 0.4, 1], originY: 0 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="border-y border-white/5 py-4 overflow-hidden">
        <motion.div
          className="flex gap-12 whitespace-nowrap text-xs tracking-[0.3em] uppercase text-white/20"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        >
          {Array(6).fill(null).map((_, i) => (
            <span key={i}>
              Tattoo &nbsp;✦&nbsp; Piercing &nbsp;✦&nbsp; Custom Art &nbsp;✦&nbsp; Studio Vain &nbsp;✦&nbsp; Tel Aviv &nbsp;✦&nbsp;
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── SERVICES ── */}
      <section id="services" className="py-32 px-8 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-16">
          <ParallaxSection offset={30}>
            <p className="text-xs tracking-[0.3em] uppercase text-white/30 mb-3">What we do</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white">Services</h2>
          </ParallaxSection>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              className="bg-[#0a0a0a] p-8 cursor-pointer relative overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              onHoverStart={() => setActiveService(i)}
              onHoverEnd={() => setActiveService(null)}
            >
              <AnimatePresence>
                {activeService === i && (
                  <motion.div
                    className="absolute inset-0 bg-white/[0.03]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <span className="text-2xl text-white/20 mb-6 block">{s.icon}</span>
              <h3 className="text-xl font-bold text-white mb-1">{s.title}</h3>
              <p className="text-xs tracking-widest text-white/30 uppercase mb-4">{s.subtitle}</p>
              <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>

              <motion.div
                className="mt-8 flex items-center gap-2 text-xs tracking-widest text-white/30 uppercase"
                animate={{ x: activeService === i ? 4 : 0 }}
              >
                <span>Learn more</span>
                <span>→</span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section id="work" className="py-32 px-8 max-w-6xl mx-auto">
        <div className="mb-16">
          <ParallaxSection offset={40}>
            <p className="text-xs tracking-[0.3em] uppercase text-white/30 mb-3">Portfolio</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white">Our Work</h2>
          </ParallaxSection>
        </div>

        <div className="columns-2 sm:columns-3 gap-3 space-y-3">
          {gallery.map((item, i) => (
            <motion.div
              key={item.id}
              className="break-inside-avoid relative overflow-hidden group cursor-pointer bg-zinc-900 rounded-sm"
              style={{
                height: item.aspect === "tall" ? "320px" : item.aspect === "wide" ? "200px" : "260px",
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
            >
              {/* Placeholder image with gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `radial-gradient(circle at ${20 + i * 15}% ${30 + i * 10}%, rgba(255,255,255,0.08) 0%, transparent 60%)`,
                }}
              />

              {/* Hover overlay */}
              <motion.div
                className="absolute inset-0 bg-black/60 flex items-end p-4"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-xs tracking-widest uppercase text-white/70">{item.label}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── ARTISTS ── */}
      <section id="artists" className="py-32 px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-16 items-start">
          <ParallaxSection offset={50}>
            <p className="text-xs tracking-[0.3em] uppercase text-white/30 mb-3">The Team</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Artists &<br />Piercers
            </h2>
            <p className="mt-6 text-white/40 text-sm leading-relaxed max-w-xs">
              Our artists bring years of specialized experience to every appointment. Book a free consultation to find your match.
            </p>
          </ParallaxSection>

          <div className="flex flex-col divide-y divide-white/5">
            {artists.map((a, i) => (
              <motion.div
                key={a.name}
                className="py-6 flex items-center justify-between group cursor-pointer"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                whileHover={{ x: 4 }}
              >
                <div>
                  <p className="font-semibold text-white group-hover:text-white/80 transition-colors">{a.name}</p>
                  <p className="text-xs text-white/30 tracking-wide mt-0.5">{a.role}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white/20 tracking-widest">{a.years}</span>
                  <motion.span
                    className="text-white/20 group-hover:text-white/60 transition-colors"
                    animate={{ x: 0 }}
                    whileHover={{ x: 4 }}
                  >
                    →
                  </motion.span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARALLAX QUOTE ── */}
      <section className="py-32 px-8 overflow-hidden border-y border-white/5">
        <ParallaxText speed={-0.15}>
          {"Ink is permanent. Make it meaningful. — Studio Vain — Tel Aviv —"}
        </ParallaxText>
      </section>

      {/* ── BOOK ── */}
      <section id="book" className="py-40 px-8 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-xs tracking-[0.3em] uppercase text-white/30 mb-6">Ready?</p>
          <h2 className="text-5xl sm:text-7xl font-bold text-white mb-8 leading-none">
            Book Your<br />Session
          </h2>
          <p className="text-white/40 text-sm max-w-xs mx-auto mb-12 leading-relaxed">
            Free consultation included. Bring references or let us design something from scratch.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href="mailto:book@studiovain.com"
              className="px-8 py-4 bg-white text-black text-sm font-semibold tracking-wide rounded-full"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              book@studiovain.com
            </motion.a>
            <motion.a
              href="tel:+972000000000"
              className="px-8 py-4 border border-white/10 text-white/60 text-sm tracking-wide rounded-full hover:border-white/30 transition-colors"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              +972 00-000-0000
            </motion.a>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs tracking-[0.2em] uppercase text-white/20">Studio Vain © 2024</span>
        <span className="text-xs text-white/10">Tel Aviv, Israel</span>
        <div className="flex gap-6 text-xs tracking-widest text-white/20 uppercase">
          {["Instagram", "TikTok", "WhatsApp"].map((s) => (
            <motion.a key={s} href="#" className="hover:text-white/40 transition-colors" whileHover={{ y: -1 }}>
              {s}
            </motion.a>
          ))}
        </div>
      </footer>
    </div>
  );
}
