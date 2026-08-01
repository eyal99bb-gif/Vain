"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Product, SizeRecommendation, TryOnStatus } from "@/lib/mida/types";
import SizeRecCard from "./SizeRecCard";
import { compressImage } from "./imageUtils";

type Phase =
  | { name: "idle" }
  | { name: "busy"; text: string }
  | { name: "processing"; tryonId: string }
  | { name: "ready"; resultUrl: string | null; sizeRec: SizeRecommendation | null }
  | { name: "failed"; message: string };

const MAX_ITEMS = 3;

const PROGRESS_LINES = [
  "מנתחים את הפריטים…",
  "מודדים מול הפרופיל שלך…",
  "מלבישים אותך…",
  "עוד רגע קטן…",
];

const POLL_MS = 2000;
const TIMEOUT_MS = 90_000;

const primaryBtnCls =
  "flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-mida-accent text-lg font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent";

const secondaryBtnCls =
  "flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-mida-line bg-mida-surface text-base font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent";

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
  const [items, setItems] = useState<Product[]>([]);
  const [url, setUrl] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const screenshotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Surface server misconfiguration: without a Gemini key every result is
    // a canned demo image, which otherwise looks like a silent failure.
    fetch("/api/mida/health")
      .then((res) => res.json())
      .then((data) => setDemoMode(data.aiMode === "demo"))
      .catch(() => {});
  }, []);

  const addItem = (product: Product) => {
    setItems((prev) =>
      prev.some((p) => p.id === product.id)
        ? prev
        : [...prev, product].slice(0, MAX_ITEMS)
    );
  };

  const ingest = async () => {
    setPhase({ name: "busy", text: "קוראים את עמוד המוצר…" });
    try {
      const res = await fetch("/api/mida/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      addItem(data.product);
      setUrl("");
      setPhase({ name: "idle" });
    } catch {
      setPhase({
        name: "failed",
        message: "לא הצלחנו לקרוא את העמוד — בדקו את הקישור, או העלו צילום מסך של המוצר.",
      });
    }
  };

  const uploadScreenshot = async (file: File | null) => {
    if (!file) return;
    setPhase({ name: "busy", text: "מעבדים את צילום המסך…" });
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("image", compressed);
      const res = await fetch("/api/mida/products/screenshot", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      addItem(data.product);
      setPhase({ name: "idle" });
    } catch {
      setPhase({
        name: "failed",
        message: "העלאת צילום המסך נכשלה — נסו שוב.",
      });
    }
  };

  const startTryOn = async () => {
    try {
      const res = await fetch("/api/mida/tryons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: items.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhase({ name: "processing", tryonId: data.tryon.id });
    } catch {
      setPhase({ name: "failed", message: "המדידה לא יצאה לדרך — נסו שוב." });
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
      <input
        ref={screenshotRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          uploadScreenshot(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
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
              onSubmit={ingest}
              onScreenshot={() => screenshotRef.current?.click()}
              items={items}
              onRemove={(id) => setItems((prev) => prev.filter((p) => p.id !== id))}
              onTryOn={startTryOn}
            />
          )}

          {phase.name === "busy" && <CenteredStatus text={phase.text} />}

          {phase.name === "processing" && (
            <ProcessingView
              tryonId={phase.tryonId}
              onReady={(resultUrl, sizeRec) =>
                setPhase({ name: "ready", resultUrl, sizeRec })
              }
              onFailed={(message) => setPhase({ name: "failed", message })}
            />
          )}

          {phase.name === "ready" && (
            <ResultView
              items={items}
              resultUrl={phase.resultUrl}
              sizeRec={phase.sizeRec}
              onAnother={() => {
                setItems([]);
                setUrl("");
                setPhase({ name: "idle" });
              }}
            />
          )}

          {phase.name === "failed" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p role="alert" className="leading-relaxed text-mida-ink">
                {phase.message}
              </p>
              <button
                type="button"
                onClick={() => setPhase({ name: "idle" })}
                className={primaryBtnCls}
              >
                חזרה
              </button>
              <button
                type="button"
                onClick={() => screenshotRef.current?.click()}
                className={secondaryBtnCls}
              >
                העלאת צילום מסך של המוצר
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
  onSubmit,
  onScreenshot,
  items,
  onRemove,
  onTryOn,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onSubmit: () => void;
  onScreenshot: () => void;
  items: Product[];
  onRemove: (id: string) => void;
  onTryOn: () => void;
}) {
  const valid = /^https?:\/\/.+\..+/.test(url.trim());
  const canAdd = items.length < MAX_ITEMS;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="font-display text-3xl font-bold text-mida-ink">
        {items.length === 0 ? "מה מודדים היום?" : "הלוק שלך"}
      </h1>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-mida-line bg-mida-surface p-3"
            >
              {p.images[0] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.images[0]}
                  alt={p.title}
                  className="h-16 w-12 shrink-0 rounded-lg border border-mida-line object-cover"
                />
              ) : (
                <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-mida-line text-[10px] text-mida-muted">
                  אין תמונה
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mida-ink">
                  {p.title}
                </p>
                <p className="text-xs text-mida-muted">
                  {p.price != null && (
                    <span dir="ltr">
                      {p.price.toFixed(2)} {p.currency === "ILS" ? "₪" : (p.currency ?? "")}
                    </span>
                  )}{" "}
                  {p.store}
                </p>
                {p.images.length === 0 && (
                  <p className="pt-0.5 text-xs text-mida-gold">
                    בלי תמונה אי אפשר להלביש — העלו צילום מסך
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`הסרת ${p.title}`}
                onClick={() => onRemove(p.id)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-mida-muted transition-colors duration-200 hover:bg-mida-accent-soft hover:text-mida-accent-deep"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <>
          <p className="text-sm leading-relaxed text-mida-muted">
            {items.length === 0
              ? "מדביקים קישור למוצר מכל חנות אונליין — או מעלים צילום מסך שלו."
              : "אפשר להוסיף עוד פריט ללוק (עד 3)."}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-mida-ink">קישור למוצר</span>
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
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!valid}
              onClick={onSubmit}
              className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-mida-accent text-sm font-semibold text-mida-accent-deep transition-colors duration-200 hover:bg-mida-accent-soft disabled:cursor-default disabled:opacity-40"
            >
              הוספה מקישור
            </button>
            <button
              type="button"
              onClick={onScreenshot}
              className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-mida-line text-sm font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent"
            >
              העלאת צילום מסך
            </button>
          </div>
        </>
      )}

      <div className="mt-auto pt-4">
        <button
          type="button"
          disabled={items.length === 0 || items.some((p) => p.images.length === 0)}
          onClick={onTryOn}
          className={primaryBtnCls}
        >
          {items.length > 1 ? `מדוד עליי ${items.length} פריטים` : "מדוד עליי"}
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
            const detail: string | null = data.tryon.error;
            onFailed(
              detail && /[֐-׿]/.test(detail)
                ? detail // server already produced a Hebrew message
                : `ההדמיה נכשלה הפעם — נסו שוב.${detail ? ` (${detail})` : ""}`
            );
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
  items,
  resultUrl,
  sizeRec,
  onAnother,
}: {
  items: Product[];
  resultUrl: string | null;
  sizeRec: SizeRecommendation | null;
  onAnother: () => void;
}) {
  const buyable = items.filter((p) => /^https?:\/\//.test(p.url));
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
          <img
            src={resultUrl}
            alt={`הלוק עליך: ${items.map((p) => p.title).join(", ")}`}
            className="w-full"
          />
        </motion.div>
      )}

      {sizeRec ? (
        <SizeRecCard rec={sizeRec} />
      ) : (
        <p className="rounded-2xl border border-mida-line bg-mida-surface p-4 text-sm leading-relaxed text-mida-muted">
          לא נמצאה טבלת מידות בעמוד המוצר, ולכן אין המלצת מידה לפריטים האלה.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {buyable.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buyable.length === 1 ? primaryBtnCls : secondaryBtnCls}
          >
            {buyable.length === 1 ? "לרכישה בחנות" : `לרכישה: ${p.title.slice(0, 30)}`}
          </a>
        ))}
        <button type="button" onClick={onAnother} className={secondaryBtnCls}>
          מדידה חדשה
        </button>
      </div>
    </div>
  );
}
