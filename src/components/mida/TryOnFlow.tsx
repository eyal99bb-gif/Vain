"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Product, SizeRecommendation, TryOnStatus } from "@/lib/mida/types";
import SizeRecCard from "./SizeRecCard";
import { compressImage } from "./imageUtils";

type Phase =
  | { name: "idle" }
  | { name: "busy"; text: string }
  | { name: "itemReady"; product: Product }
  | { name: "processing"; product: Product; tryonId: string }
  | {
      name: "ready";
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
  const [url, setUrl] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  // The look built so far: items already dressed + the try-on whose result
  // the next item will be layered onto.
  const [wornItems, setWornItems] = useState<Product[]>([]);
  const [lastTryOnId, setLastTryOnId] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Surface server misconfiguration: without a Gemini key every result is
    // a canned demo image, which otherwise looks like a silent failure.
    fetch("/api/mida/health")
      .then((res) => res.json())
      .then((data) => setDemoMode(data.aiMode === "demo"))
      .catch(() => {});
  }, []);

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
      setUrl("");
      setPhase({ name: "itemReady", product: data.product });
    } catch {
      setPhase({
        name: "failed",
        product: null,
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
      setPhase({ name: "itemReady", product: data.product });
    } catch {
      setPhase({ name: "failed", product: null, message: "העלאת צילום המסך נכשלה — נסו שוב." });
    }
  };

  const startTryOn = async (product: Product) => {
    try {
      const res = await fetch("/api/mida/tryons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          // Layer onto the current look when one exists.
          ...(lastTryOnId ? { baseTryOnId: lastTryOnId } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhase({ name: "processing", product, tryonId: data.tryon.id });
    } catch {
      setPhase({ name: "failed", product, message: "המדידה לא יצאה לדרך — נסו שוב." });
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
              wornItems={wornItems}
            />
          )}

          {phase.name === "busy" && <CenteredStatus text={phase.text} />}

          {phase.name === "itemReady" && (
            <ItemCard
              product={phase.product}
              isAddition={wornItems.length > 0}
              onTryOn={() => startTryOn(phase.product)}
              onCancel={() => setPhase({ name: "idle" })}
            />
          )}

          {phase.name === "processing" && (
            <ProcessingView
              tryonId={phase.tryonId}
              onReady={(resultUrl, sizeRec) => {
                setWornItems((prev) =>
                  prev.some((p) => p.id === phase.product.id)
                    ? prev
                    : [...prev, phase.product]
                );
                setLastTryOnId(phase.tryonId);
                setPhase({ name: "ready", resultUrl, sizeRec });
              }}
              onFailed={(message) =>
                setPhase({ name: "failed", product: phase.product, message })
              }
            />
          )}

          {phase.name === "ready" && (
            <ResultView
              wornItems={wornItems}
              resultUrl={phase.resultUrl}
              sizeRec={phase.sizeRec}
              onAddItem={() => setPhase({ name: "idle" })}
              onReset={() => {
                setWornItems([]);
                setLastTryOnId(null);
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
              {phase.product ? (
                <button
                  type="button"
                  onClick={() => startTryOn(phase.product!)}
                  className={primaryBtnCls}
                >
                  ניסיון נוסף
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => screenshotRef.current?.click()}
                  className={primaryBtnCls}
                >
                  העלאת צילום מסך של המוצר
                </button>
              )}
              <button
                type="button"
                onClick={() => setPhase({ name: "idle" })}
                className={secondaryBtnCls}
              >
                חזרה
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
  wornItems,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onSubmit: () => void;
  onScreenshot: () => void;
  wornItems: Product[];
}) {
  const valid = /^https?:\/\/.+\..+/.test(url.trim());
  const isAddition = wornItems.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="font-display text-3xl font-bold text-mida-ink">
        {isAddition ? "מוסיפים פריט ללוק" : "מה מודדים היום?"}
      </h1>

      {isAddition && (
        <p className="text-sm leading-relaxed text-mida-muted">
          כבר עליך: {wornItems.map((p) => p.title).join(" · ")}
          <br />
          הפריט הבא יולבש מעל הלוק הקיים.
        </p>
      )}
      {!isAddition && (
        <p className="leading-relaxed text-mida-muted">
          מדביקים קישור למוצר מכל חנות אונליין — או מעלים צילום מסך שלו. אחרי
          כל פריט אפשר להוסיף עוד: מכנס, נעליים, שעון…
        </p>
      )}

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

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <button
          type="button"
          disabled={!valid}
          onClick={onSubmit}
          className={primaryBtnCls}
        >
          בדיקת המוצר
        </button>
        <button type="button" onClick={onScreenshot} className={secondaryBtnCls}>
          העלאת צילום מסך במקום
        </button>
      </div>
    </div>
  );
}

function ItemCard({
  product,
  isAddition,
  onTryOn,
  onCancel,
}: {
  product: Product;
  isAddition: boolean;
  onTryOn: () => void;
  onCancel: () => void;
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
          אין תמונת מוצר — העלו צילום מסך במקום
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
        {product.sizeChart ? (
          <p className="pt-1 text-xs text-emerald-700">
            ✓ נמצאה טבלת מידות — תקבלו המלצת מידה
          </p>
        ) : (
          <p className="pt-1 text-xs text-mida-muted">
            לא נמצאה טבלת מידות — ההדמיה תעבוד, בלי המלצת מידה
          </p>
        )}
        {product.warnings.includes("scrape_failed_demo_data") && (
          <p className="pt-1 text-xs text-mida-gold">
            לא הצלחנו לקרוא את החנות הזו — מציגים מוצר הדגמה.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <button
          type="button"
          disabled={product.images.length === 0}
          onClick={onTryOn}
          className={primaryBtnCls}
        >
          {isAddition ? "הוספה ללוק" : "מדוד עליי"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryBtnCls}>
          ביטול
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
  wornItems,
  resultUrl,
  sizeRec,
  onAddItem,
  onReset,
}: {
  wornItems: Product[];
  resultUrl: string | null;
  sizeRec: SizeRecommendation | null;
  onAddItem: () => void;
  onReset: () => void;
}) {
  const buyable = wornItems.filter((p) => /^https?:\/\//.test(p.url));
  const canAddMore = wornItems.length < 6;

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
            alt={`הלוק עליך: ${wornItems.map((p) => p.title).join(", ")}`}
            className="w-full"
          />
        </motion.div>
      )}

      {wornItems.length > 1 && (
        <p className="text-sm leading-relaxed text-mida-muted">
          בלוק: {wornItems.map((p) => p.title).join(" · ")}
        </p>
      )}

      {sizeRec ? (
        <SizeRecCard rec={sizeRec} />
      ) : (
        <p className="rounded-2xl border border-mida-line bg-mida-surface p-4 text-sm leading-relaxed text-mida-muted">
          לפריט הזה לא נמצאה טבלת מידות, ולכן אין המלצת מידה.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {canAddMore && (
          <button type="button" onClick={onAddItem} className={primaryBtnCls}>
            הוספת פריט נוסף ללוק
          </button>
        )}
        {resultUrl && (
          <a href={resultUrl} download="mida-look.png" className={secondaryBtnCls}>
            שמירת הלוק
          </a>
        )}
        {buyable.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtnCls}
          >
            {buyable.length === 1 ? "לרכישה בחנות" : `לרכישה: ${p.title.slice(0, 30)}`}
          </a>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="flex h-11 w-full cursor-pointer items-center justify-center rounded-full text-sm font-medium text-mida-muted transition-colors duration-200 hover:text-mida-ink"
        >
          מדידה חדשה מאפס
        </button>
      </div>
    </div>
  );
}
