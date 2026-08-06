// The learning loop from the spec: after a purchase the user tells us
// whether the recommended size actually fit, and future recommendations
// shift accordingly. Deterministic and pure — no model involved.
import type { GarmentType } from "../types";

export interface FeedbackEntry {
  garmentType: string;
  verdict: "fit" | "small" | "large";
}

/** One report moves the target by this much; the total is clamped. */
const STEP_CM = 1.5;
const MAX_SHIFT_CM = 4;

/**
 * Positive means "treat the wearer as larger" — i.e. they reported the
 * recommendation ran small and should size up. Feedback for the same
 * garment type counts double, since fit problems are category-specific.
 */
export function calibrationShiftCm(
  history: FeedbackEntry[],
  garmentType: GarmentType
): number {
  let score = 0;
  for (const entry of history) {
    if (entry.verdict === "fit") continue;
    const weight = entry.garmentType === garmentType ? 2 : 1;
    // "small" = the garment was too small ⇒ aim bigger next time.
    score += (entry.verdict === "small" ? 1 : -1) * weight;
  }
  const shift = score * (STEP_CM / 2);
  return Math.max(-MAX_SHIFT_CM, Math.min(MAX_SHIFT_CM, shift));
}

/** Hebrew note appended to the explanation when calibration is active. */
export function calibrationNote(shiftCm: number): string | null {
  if (Math.abs(shiftCm) < 0.5) return null;
  return shiftCm > 0
    ? "כיילנו לפי הפידבק שלך — בעבר המידות שהמלצנו יצאו קטנות מדי."
    : "כיילנו לפי הפידבק שלך — בעבר המידות שהמלצנו יצאו גדולות מדי.";
}
