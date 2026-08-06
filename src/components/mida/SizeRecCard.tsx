"use client";

import { motion } from "motion/react";
import type { SizeRecommendation } from "@/lib/mida/types";

const MEASURE_HE: Record<string, string> = {
  chest: "חזה",
  waist: "מותניים",
  hips: "ירכיים",
  inseam: "רגל פנימית",
  shoulders: "כתפיים",
  height: "גובה",
};

const VERDICT_HE: Record<string, string> = {
  fit: "מתאים",
  tight: "צמוד",
  loose: "רחב",
};

const CONFIDENCE_HE: Record<string, string> = {
  high: "ביטחון גבוה",
  medium: "ביטחון בינוני",
  low: "ביטחון נמוך",
};

export default function SizeRecCard({ rec }: { rec: SizeRecommendation }) {
  return (
    <section
      aria-label="המלצת מידה"
      className="flex flex-col gap-4 rounded-2xl border border-mida-line bg-mida-surface p-5"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-mida-accent font-display text-3xl font-bold text-white">
          {rec.size}
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-mida-ink">
            {CONFIDENCE_HE[rec.confidenceLabel]}
          </span>
          <div
            role="meter"
            aria-valuenow={Math.round(rec.confidence * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="מד ביטחון"
            dir="ltr"
            className="h-2 w-full overflow-hidden rounded-full bg-mida-line"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(rec.confidence * 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${
                rec.confidenceLabel === "high"
                  ? "bg-emerald-500"
                  : rec.confidenceLabel === "medium"
                    ? "bg-amber-500"
                    : "bg-mida-accent"
              }`}
            />
          </div>
        </div>
      </div>

      <p className="leading-relaxed text-mida-ink">{rec.explanation}</p>

      {rec.perMeasure.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {rec.perMeasure.map((m) => (
            <li
              key={m.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                m.verdict === "fit"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {MEASURE_HE[m.key] ?? m.key}: {VERDICT_HE[m.verdict]}
              {m.estimated && " (הערכה)"}
            </li>
          ))}
        </ul>
      )}

      {rec.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-mida-line pt-3">
          {rec.warnings.map((w) => (
            <li key={w} className="text-xs leading-relaxed text-mida-muted">
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
