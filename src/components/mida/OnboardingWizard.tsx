"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

type Step = "photos" | "measurements" | "avatar";
const STEPS: Step[] = ["photos", "measurements", "avatar"];

const STEP_TITLES: Record<Step, string> = {
  photos: "תמונות גוף מלא",
  measurements: "המידות שלך",
  avatar: "הדמות שלך",
};

// RTL: "forward" visually moves left, so enter from the left (negative x).
const slide = {
  initial: { opacity: 0, x: -32 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 32 },
};

const inputCls =
  "h-12 w-full rounded-xl border border-mida-line bg-mida-surface px-4 text-base text-mida-ink placeholder:text-mida-muted/60 focus:border-mida-accent focus:outline-none";

const primaryBtnCls =
  "flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-mida-accent text-lg font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent";

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function OnboardingWizard() {
  const [step, setStep] = useState<Step>("photos");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <ol className="flex items-center gap-2" aria-label="שלבי ההרשמה">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              STEPS.indexOf(step) >= i ? "bg-mida-accent" : "bg-mida-line"
            }`}
          />
        ))}
      </ol>
      <h1 className="font-display text-3xl font-bold text-mida-ink">
        {STEP_TITLES[step]}
      </h1>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-mida-accent-soft px-4 py-3 text-sm text-mida-accent-deep"
        >
          {error}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="flex flex-1 flex-col"
          transition={{ duration: 0.25, ease: "easeOut" }}
          {...slide}
        >
          {step === "photos" && (
            <PhotoStep
              onDone={() => {
                setError(null);
                setStep("measurements");
              }}
              onError={setError}
            />
          )}
          {step === "measurements" && (
            <MeasurementsStep
              onDone={() => {
                setError(null);
                setStep("avatar");
              }}
              onError={setError}
            />
          )}
          {step === "avatar" && <AvatarStep onError={setError} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Downscale + re-encode a photo to JPEG (max 1600px long edge). Keeps
 * uploads well under serverless body limits (Vercel: 4.5MB) and converts
 * iPhone HEIC to a universally supported format. Falls back to the original
 * file if the browser can't decode it.
 */
async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function PhotoStep({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [items, setItems] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const itemsRef = useRef<{ file: File; preview: string }[]>([]);

  // Track latest items + revoke all preview URLs on unmount.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.preview));
    };
  }, []);

  const pick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const compressed = await Promise.all(
      Array.from(list).map((file) => compressPhoto(file))
    );
    setItems((prev) => {
      const added = compressed.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      const next = [...prev, ...added];
      next.slice(3).forEach((it) => URL.revokeObjectURL(it.preview));
      return next.slice(0, 3);
    });
  };

  const removeAt = (index: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, j) => j !== index);
    });
  };

  const upload = async () => {
    setUploading(true);
    try {
      const form = new FormData();
      items.forEach((it) => form.append("photos", it.file));
      const res = await fetch("/api/mida/profile/photos", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `HTTP ${res.status}`);
      }
      onDone();
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : "";
      onError(
        `העלאת התמונות נכשלה — נסו שוב.${detail ? ` (${detail})` : ""}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="leading-relaxed text-mida-muted">
        1–3 תמונות גוף מלא: רקע נקי, בגדים צמודים, תאורה טובה. התמונות פרטיות
        ומשמשות רק ליצירת הדמות שלך.
      </p>

      <div className="grid grid-cols-3 gap-3">
        {items.map((it, i) => (
          <div
            key={it.preview}
            className="relative aspect-[3/4] overflow-hidden rounded-xl border border-mida-line bg-mida-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.preview}
              alt={`תמונה ${i + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              aria-label={`הסרת תמונה ${i + 1}`}
              onClick={() => removeAt(i)}
              className="absolute end-1 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-mida-ink/70 text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {items.length < 3 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mida-line text-mida-muted transition-colors duration-200 hover:border-mida-accent hover:text-mida-accent"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-xs">הוספת תמונה</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      <div className="mt-auto pt-4">
        <button
          type="button"
          disabled={items.length === 0 || uploading}
          onClick={upload}
          className={primaryBtnCls}
        >
          {uploading ? <Spinner /> : "המשך"}
        </button>
      </div>
    </div>
  );
}

interface NumField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
}

const REQUIRED_FIELDS: NumField[] = [
  { key: "heightCm", label: 'גובה (ס"מ)', placeholder: "170", required: true },
  { key: "weightKg", label: 'משקל (ק"ג)', placeholder: "70", required: true },
];

const OPTIONAL_FIELDS: NumField[] = [
  { key: "chestCm", label: 'היקף חזה (ס"מ)', placeholder: "96" },
  { key: "waistCm", label: 'היקף מותניים (ס"מ)', placeholder: "80" },
  { key: "hipsCm", label: 'היקף ירכיים (ס"מ)', placeholder: "98" },
  { key: "inseamCm", label: 'אורך רגל פנימי (ס"מ)', placeholder: "78" },
  { key: "shouldersCm", label: 'רוחב כתפיים (ס"מ)', placeholder: "45" },
];

const FIT_OPTIONS = [
  { value: "slim", label: "צמוד" },
  { value: "regular", label: "רגיל" },
  { value: "loose", label: "אוברסייז" },
] as const;

function MeasurementsStep({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [fit, setFit] = useState<string>("regular");
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const valid =
    parseFloat(values.heightCm ?? "") > 0 && parseFloat(values.weightKg ?? "") > 0;

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { fitPreference: fit };
      for (const f of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
        const n = parseFloat(values[f.key] ?? "");
        if (Number.isFinite(n)) body[f.key] = n;
      }
      const res = await fetch("/api/mida/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      const gen = await fetch("/api/mida/avatar", { method: "POST" });
      if (!gen.ok) throw new Error();
      onDone();
    } catch {
      onError("שמירת המידות נכשלה — בדקו את הערכים ונסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: NumField) => (
    <label key={f.key} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-mida-ink">
        {f.label}
        {f.required && <span className="text-mida-accent"> *</span>}
      </span>
      <input
        dir="ltr"
        inputMode="decimal"
        type="number"
        min={0}
        placeholder={f.placeholder}
        value={values[f.key] ?? ""}
        onChange={(e) => set(f.key, e.target.value)}
        className={`${inputCls} text-start`}
      />
    </label>
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {REQUIRED_FIELDS.map(renderField)}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-mida-ink">גזרה מועדפת</span>
        <div
          role="radiogroup"
          aria-label="גזרה מועדפת"
          className="grid grid-cols-3 gap-2"
        >
          {FIT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={fit === o.value}
              onClick={() => setFit(o.value)}
              className={`h-11 cursor-pointer rounded-xl border text-sm font-medium transition-colors duration-200 ${
                fit === o.value
                  ? "border-mida-accent bg-mida-accent-soft text-mida-accent-deep"
                  : "border-mida-line bg-mida-surface text-mida-muted hover:border-mida-accent/50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        aria-expanded={showOptional}
        className="flex cursor-pointer items-center gap-2 text-sm font-medium text-mida-accent-deep"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform duration-200 ${showOptional ? "rotate-180" : ""}`}
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        מדידות מדויקות (מומלץ)
      </button>

      <AnimatePresence initial={false}>
        {showOptional && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 pb-1">
              {OPTIONAL_FIELDS.map(renderField)}
            </div>
            <p className="pt-2 text-xs leading-relaxed text-mida-muted">
              אין סרט מדידה? אפשר לדלג — נעריך את ההיקפים לפי הגובה והמשקל,
              וההמלצות יסומנו בהתאם.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto pt-4">
        <button
          type="button"
          disabled={!valid || saving}
          onClick={save}
          className={primaryBtnCls}
        >
          {saving ? <Spinner /> : "יצירת הדמות שלי"}
        </button>
      </div>
    </div>
  );
}

const AVATAR_POLL_MS = 2000;
const AVATAR_TIMEOUT_MS = 90_000;

function AvatarStep({ onError }: { onError: (msg: string) => void }) {
  const [status, setStatus] = useState<"pending" | "ready" | "failed">(
    "pending"
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/mida/avatar");
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ready") {
          setAvatarUrl(data.avatarUrl);
          setStatus("ready");
          return;
        }
        if (data.status === "failed") {
          setStatus("failed");
          onError("יצירת הדמות נכשלה — נסו שוב.");
          return;
        }
      } catch {
        // transient network error — keep polling
      }
      if (Date.now() - startedAt > AVATAR_TIMEOUT_MS) {
        setStatus("failed");
        onError("זה לוקח יותר מדי זמן — נסו שוב.");
        return;
      }
      setTimeout(poll, AVATAR_POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  const retry = async () => {
    setStatus("pending");
    await fetch("/api/mida/avatar", { method: "POST" });
    window.location.reload();
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {status === "pending" && (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-mida-accent-soft text-mida-accent">
            <Spinner />
          </div>
          <div>
            <p className="text-lg font-semibold text-mida-ink">
              בונים את הדמות שלך…
            </p>
            <p className="text-sm text-mida-muted">בדרך כלל לוקח עד חצי דקה</p>
          </div>
        </>
      )}

      {status === "ready" && avatarUrl && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-56 overflow-hidden rounded-3xl border border-mida-line bg-mida-surface shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="הדמות שלך" className="w-full" />
          </motion.div>
          <p className="text-lg font-semibold text-mida-ink">
            הדמות שלך מוכנה!
          </p>
          <Link href="/tryon" className={primaryBtnCls}>
            למדידה הראשונה
          </Link>
        </>
      )}

      {status === "failed" && (
        <button type="button" onClick={retry} className={primaryBtnCls}>
          ניסיון נוסף
        </button>
      )}
    </div>
  );
}
