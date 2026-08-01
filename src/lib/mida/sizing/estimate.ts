import type { MeasureKey, Measurements } from "../types";
import type { ResolvedMeasures } from "./types";

/**
 * Resolve the user's per-measure values in cm, estimating missing girths
 * from height/weight. Estimates use simple anthropometric approximations —
 * rough by design; each estimated measure is flagged so confidence drops.
 *
 * Approximation basis: girths scale primarily with BMI and secondarily with
 * height. Coefficients tuned to land in plausible adult ranges
 * (BMI 18-35, height 150-200cm), not to be precise.
 */
export function resolveMeasures(m: Measurements): ResolvedMeasures {
  const values: Partial<Record<MeasureKey, number>> = {
    height: m.heightCm,
  };
  const estimated = new Set<MeasureKey>();

  const bmi = m.weightKg / (m.heightCm / 100) ** 2;

  const put = (key: MeasureKey, given: number | undefined, est: number) => {
    if (given && given > 0) {
      values[key] = given;
    } else {
      values[key] = Math.round(est * 10) / 10;
      estimated.add(key);
    }
  };

  put("chest", m.chestCm, 2.6 * bmi + 0.18 * m.heightCm);
  put("waist", m.waistCm, 2.8 * bmi + 0.08 * m.heightCm);
  put("hips", m.hipsCm, 2.4 * bmi + 0.22 * m.heightCm);
  put("inseam", m.inseamCm, 0.45 * m.heightCm);
  put("shoulders", m.shouldersCm, 0.23 * m.heightCm + 0.4 * bmi);

  return { values, estimated };
}
