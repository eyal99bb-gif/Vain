"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { compressImage } from "./imageUtils";
import { Banner, Button, LiveStatus, Spinner } from "./ui";
import { usePolling } from "./usePolling";

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
  "h-12 w-full rounded-xl border border-mida-line bg-mida-surface px-4 text-base text-mida-ink placeholder:text-mida-placeholder focus:border-mida-accent focus:outline-none";

interface ExistingProfile {
  name: string;
  photoCount: number;
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  inseamCm: number | null;
  shouldersCm: number | null;
  fitPreference: string;
}

export default function OnboardingWizard() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>("photos");
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingProfile | null>(null);

  // Focus the new step heading: AnimatePresence unmounts the focused
  // control, which otherwise drops focus to <body> with no announcement.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // Editing an existing profile: prefill values and allow keeping photos.
  useEffect(() => {
    fetch("/api/mida/profile")
      .then((res) => res.json())
      .then((data) => setExisting(data.profile ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <ol className="flex items-center gap-2" aria-label="שלבי ההרשמה">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? "step" : undefined}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              STEPS.indexOf(step) >= i ? "bg-mida-accent" : "bg-mida-line"
            }`}
          >
            <span className="sr-only">
              {`שלב ${i + 1} מתוך ${STEPS.length}: ${STEP_TITLES[s]}`}
              {s === step ? " (נוכחי)" : ""}
            </span>
          </li>
        ))}
      </ol>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-3xl font-bold text-mida-ink outline-none"
      >
        {STEP_TITLES[step]}
      </h1>

      {error && <Banner tone="error">{error}</Banner>}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="flex flex-1 flex-col"
          transition={{ duration: 0.25, ease: "easeOut" }}
          {...slide}
        >
          {step === "photos" && (
            <PhotoStep
              existingPhotoCount={existing?.photoCount ?? 0}
              onDone={() => {
                setError(null);
                setStep("measurements");
              }}
              onError={setError}
            />
          )}
          {step === "measurements" && (
            <MeasurementsStep
              existing={existing}
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

function PhotoStep({
  existingPhotoCount,
  onDone,
  onError,
}: {
  existingPhotoCount: number;
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
      Array.from(list).map((file) => compressImage(file))
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
              className="absolute end-0 top-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mida-ink/70">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
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

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button
          disabled={items.length === 0}
          loading={uploading}
          onClick={upload}
        >
          המשך
        </Button>
        {existingPhotoCount > 0 && items.length === 0 && (
          <button
            type="button"
            onClick={onDone}
            className="flex h-11 w-full cursor-pointer items-center justify-center rounded-full text-sm font-medium text-mida-muted transition-colors duration-200 hover:text-mida-ink"
          >
            להשאיר את התמונות הקיימות ({existingPhotoCount})
          </button>
        )}
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
  existing,
  onDone,
  onError,
}: {
  existing: ExistingProfile | null;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  // Prefill lazily from the profile being edited: this step mounts after the
  // photos step, by which point the profile fetch has resolved.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    if (existing) {
      for (const key of ["heightCm","weightKg","chestCm","waistCm","hipsCm","inseamCm","shouldersCm"] as const) {
        const v = existing[key];
        if (v != null) next[key] = String(v);
      }
    }
    return next;
  });
  const [name, setName] = useState(() =>
    existing && existing.name !== "הפרופיל שלי" ? existing.name : ""
  );
  const [fit, setFit] = useState<string>(
    () => existing?.fitPreference || "regular"
  );
  const [showOptional, setShowOptional] = useState(
    () => !!(existing?.chestCm || existing?.waistCm)
  );
  const [saving, setSaving] = useState(false);

  const set = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const valid =
    parseFloat(values.heightCm ?? "") > 0 && parseFloat(values.weightKg ?? "") > 0;

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { fitPreference: fit };
      if (name.trim()) body.name = name.trim();
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
        {f.required && <span className="text-mida-accent-deep"> *</span>}
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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-mida-ink">שם הפרופיל</span>
        <input
          type="text"
          placeholder="למשל: שלי, גיל, אמא…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className={inputCls}
        />
      </label>
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
          {FIT_OPTIONS.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={fit === o.value}
              // Radio-group contract: one stop in the tab order, arrows move.
              tabIndex={fit === o.value ? 0 : -1}
              onKeyDown={(e) => {
                const dir =
                  e.key === "ArrowLeft" || e.key === "ArrowDown"
                    ? 1
                    : e.key === "ArrowRight" || e.key === "ArrowUp"
                      ? -1
                      : 0;
                if (!dir) return;
                e.preventDefault();
                const next =
                  FIT_OPTIONS[
                    (i + dir + FIT_OPTIONS.length) % FIT_OPTIONS.length
                  ];
                setFit(next.value);
                document
                  .querySelector<HTMLButtonElement>(`[data-fit="${next.value}"]`)
                  ?.focus();
              }}
              data-fit={o.value}
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
        className="flex h-11 cursor-pointer items-center gap-2 self-start text-sm font-medium text-mida-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
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
        <Button disabled={!valid} loading={saving} onClick={save}>
          שמירה והמשך
        </Button>
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
          <LiveStatus>מכינים את הדמות שלך</LiveStatus>
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
          <Link
            href="/tryon"
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-mida-accent px-6 text-base font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
          >
            למדידה הראשונה
          </Link>
        </>
      )}

      {status === "failed" && (
        <Button onClick={retry}>ניסיון נוסף</Button>
      )}
    </div>
  );
}
