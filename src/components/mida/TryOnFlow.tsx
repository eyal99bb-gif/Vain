"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Product, SizeRecommendation, TryOnStatus } from "@/lib/mida/types";
import SizeRecCard from "./SizeRecCard";

type Phase =
  | { name: "idle" }
  | { name: "ingesting" }
  | { name: "productReady"; product: Product }
  | { name: "processing"; product: Product; tryonId: string }
  | {
      name: "ready";
      product: Product;
      resultUrl: string | null;
      sizeRec: SizeRecommendation | null;
    }
  | { name: "failed"; product: Product | null; message: string };

const PROGRESS_LINES = [
  "מנתחים את הפריט…",
  "מודדים מול הפרופיל שלך…",
  "מלבישים אותך…",
  "עוד רגע קטן…",
];

const POLL_MS = 2000;
const TIMEOUT_MS = 90_000;

const primaryBtnCls =
  "flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-mida-accent text-lg font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent";

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function TryOnFlow() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [url, setUrl] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Surface server misconfiguration: without a Gemini key every result is
    // a canned demo image, which otherwise looks like a silent failure.
    fetch("/api/mida/health")
      .then((res) => res.json())
      .then((data) => setDemoMode(data.aiMode === "demo"))
      .catch(() => {});
  }, []);

  const ingest = async () => {
    setPhase({ name: "ingesting" });
    try {
      const res = await fetch("/api/mida/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhase({ name: "productReady", product: data.product });
    } catch {
      setPhase({
        name: "failed",
        product: null,
        message: "לא הצלחנו לקרוא את העמוד — בדקו את הקישור ונסו שוב.",
      });
    }
  };

  const startTryOn = async (product: Product) => {
    try {
      const res = await fetch("/api/mida/tryons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhase({ name: "processing", product, tryonId: data.tryon.id });
    } catch {
      setPhase({
        name: "failed",
        product,
        message: "המדידה לא יצאה לדרך — נסו שוב.",
      });
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      // clipboard access denied — user can paste manually
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      {demoMode && (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800"
        >
          השרת רץ ללא מפתח Gemini — התוצאות שתראו הן הדגמה בלבד. יש להגדיר את
          GEMINI_API_KEY בהגדרות השרת ולפרוס מחדש.
        </p>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex flex-1 flex-col gap-5"
        >
          {phase.name === "idle" && (
            <IdleView
              url={url}
              onUrlChange={setUrl}
              onPaste={pasteFromClipboard}
              onSubmit={ingest}
            />
          )}

          {phase.name === "ingesting" && (
            <CenteredStatus text="קוראים את עמוד המוצר…" />
          )}

          {phase.name === "productReady" && (
            <ProductCard
              product={phase.product}
              onTryOn={() => startTryOn(phase.product)}
            />
          )}

          {phase.name === "processing" && (
            <ProcessingView
              tryonId={phase.tryonId}
              onReady={(resultUrl, sizeRec) =>
                setPhase({
                  name: "ready",
                  product: phase.product,
                  resultUrl,
                  sizeRec,
                })
              }
              onFailed={(message) =>
                setPhase({ name: "failed", product: phase.product, message })
              }
            />
          )}

          {phase.name === "ready" && (
            <ResultView
              product={phase.product}
              resultUrl={phase.resultUrl}
              sizeRec={phase.sizeRec}
              onAnother={() => {
                setUrl("");
                setPhase({ name: "idle" });
              }}
            />
          )}

          {phase.name === "failed" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p role="alert" className="text-mida-ink">
                {phase.message}
              </p>
              <button
                type="button"
                onClick={() =>
                  phase.product
                    ? startTryOn(phase.product)
                    : setPhase({ name: "idle" })
                }
                className={primaryBtnCls}
              >
                ניסיון נוסף
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function IdleView({
  url,
  onUrlChange,
  onPaste,
  onSubmit,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onPaste: () => void;
  onSubmit: () => void;
}) {
  const valid = /^https?:\/\/.+\..+/.test(url.trim());
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="font-display text-3xl font-bold text-mida-ink">
        מה מודדים היום?
      </h1>
      <p className="leading-relaxed text-mida-muted">
        מדביקים קישור למוצר מכל חנות אונליין — ורואים אותו עליכם.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-mida-ink">קישור למוצר</span>
        <div className="flex gap-2">
          <input
            dir="ltr"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && valid && onSubmit()}
            className="h-12 w-full rounded-xl border border-mida-line bg-mida-surface px-4 text-start text-base text-mida-ink placeholder:text-mida-muted/60 focus:border-mida-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={onPaste}
            aria-label="הדבקה מהלוח"
            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-mida-line bg-mida-surface text-mida-muted transition-colors duration-200 hover:border-mida-accent hover:text-mida-accent"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <rect x="8" y="4" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M4 8v10a2 2 0 0 0 2 2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </label>

      <div className="mt-auto pt-4">
        <button
          type="button"
          disabled={!valid}
          onClick={onSubmit}
          className={primaryBtnCls}
        >
          בדיקת המוצר
        </button>
      </div>
    </div>
  );
}

function CenteredStatus({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mida-accent-soft text-mida-accent">
        <Spinner />
      </div>
      <p className="text-lg font-medium text-mida-ink">{text}</p>
    </div>
  );
}

function ProductCard({
  product,
  onTryOn,
}: {
  product: Product;
  onTryOn: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  return (
    <div className="flex flex-1 flex-col gap-4">
      {product.images.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-mida-line bg-mida-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[imageIndex]}
              alt={product.title}
              className="h-full w-full object-contain"
            />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.slice(0, 6).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`תמונה ${i + 1}`}
                  onClick={() => setImageIndex(i)}
                  className={`h-16 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors duration-200 ${
                    i === imageIndex ? "border-mida-accent" : "border-mida-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-mida-line bg-mida-surface text-sm text-mida-muted">
          אין תמונת מוצר
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold leading-snug text-mida-ink">
          {product.title}
        </h1>
        <div className="flex items-center gap-3 text-mida-muted">
          {product.price != null && (
            <span className="text-lg font-medium text-mida-ink" dir="ltr">
              {product.price.toFixed(2)}{" "}
              {product.currency === "ILS" ? "₪" : (product.currency ?? "")}
            </span>
          )}
          <span className="text-sm">{product.store}</span>
        </div>
        {product.warnings.includes("scrape_failed_demo_data") && (
          <p className="pt-1 text-xs text-mida-gold">
            לא הצלחנו לקרוא את החנות הזו — מציגים מוצר הדגמה.
          </p>
        )}
      </div>

      <div className="mt-auto pt-4">
        <button type="button" onClick={onTryOn} className={primaryBtnCls}>
          מדוד עליי
        </button>
      </div>
    </div>
  );
}

function ProcessingView({
  tryonId,
  onReady,
  onFailed,
}: {
  tryonId: string;
  onReady: (resultUrl: string | null, sizeRec: SizeRecommendation | null) => void;
  onFailed: (message: string) => void;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(
      () => setLineIndex((i) => (i + 1) % PROGRESS_LINES.length),
      2600
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    startedAt.current ??= Date.now();

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/mida/tryons/${tryonId}`);
        if (res.ok) {
          const data = await res.json();
          const status: TryOnStatus = data.tryon.status;
          if (status === "ready") {
            onReady(data.tryon.resultUrl, data.tryon.sizeRec);
            return;
          }
          if (status === "failed") {
            onFailed("ההדמיה נכשלה הפעם — נסו שוב.");
            return;
          }
        }
      } catch {
        // transient error — keep polling
      }
      if (Date.now() - (startedAt.current ?? 0) > TIMEOUT_MS) {
        onFailed("זה לוקח יותר מדי זמן — נסו שוב בעוד רגע.");
        return;
      }
      setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryonId]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-mida-accent-soft text-mida-accent">
        <Spinner />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={lineIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-lg font-medium text-mida-ink"
        >
          {PROGRESS_LINES[lineIndex]}
        </motion.p>
      </AnimatePresence>
      <p className="text-sm text-mida-muted">בדרך כלל לוקח 10–20 שניות</p>
    </div>
  );
}

function ResultView({
  product,
  resultUrl,
  sizeRec,
  onAnother,
}: {
  product: Product;
  resultUrl: string | null;
  sizeRec: SizeRecommendation | null;
  onAnother: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {resultUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="overflow-hidden rounded-3xl border border-mida-line bg-mida-surface shadow-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt={`את/ה לובש/ת ${product.title}`} className="w-full" />
        </motion.div>
      )}

      {sizeRec ? (
        <SizeRecCard rec={sizeRec} />
      ) : (
        <p className="rounded-2xl border border-mida-line bg-mida-surface p-4 text-sm leading-relaxed text-mida-muted">
          לא נמצאה טבלת מידות בעמוד המוצר, ולכן אין המלצת מידה לפריט הזה.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryBtnCls}
        >
          לרכישה בחנות
        </a>
        <button
          type="button"
          onClick={onAnother}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-mida-line bg-mida-surface text-lg font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent"
        >
          מדידה נוספת
        </button>
      </div>
    </div>
  );
}
