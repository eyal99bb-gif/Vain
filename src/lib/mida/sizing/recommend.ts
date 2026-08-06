import type {
  MeasureKey,
  MeasureRange,
  PerMeasureResult,
  SizeRecommendation,
} from "../types";
import type { RecommendInput } from "./types";
import { resolveMeasures } from "./estimate";
import {
  GARMENT_TOLERANCE_MULT,
  TOLERANCE_FLOOR_CM,
  weightsFor,
} from "./weights";
import {
  buildExplanation,
  CONFIDENCE_LABELS_HE,
  WARNINGS_HE,
} from "./explain.he";
import { calibrationNote } from "./calibrate";

/** Girth measures shifted by fit preference (not lengths). */
const GIRTH_KEYS: ReadonlySet<MeasureKey> = new Set(["chest", "waist", "hips"]);

const FIT_SHIFT_CM = { slim: -2, regular: 0, loose: 2 } as const;

interface RowScore {
  label: string;
  score: number;
  perMeasure: PerMeasureResult[];
}

/**
 * Deterministic size recommendation: weighted L1 distance between the user's
 * (possibly estimated) measures and each chart row's range midpoints,
 * normalized per measure by range half-width with a tolerance floor.
 * No I/O, no randomness.
 */
export function recommendSize(input: RecommendInput): SizeRecommendation | null {
  const { sizeChart, garmentType, fitPreference } = input;
  if (!sizeChart || sizeChart.rows.length === 0) return null;

  const calibrationCm = input.calibrationCm ?? 0;
  const resolved = resolveMeasures(input.measurements);
  const weights = weightsFor(garmentType);
  const tolMult = GARMENT_TOLERANCE_MULT[garmentType];

  const scored: RowScore[] = [];

  for (const row of sizeChart.rows) {
    let weightSum = 0;
    let distSum = 0;
    const perMeasure: PerMeasureResult[] = [];

    for (const [key, weight] of Object.entries(weights) as [
      MeasureKey,
      number,
    ][]) {
      const range = row.values[key];
      const userValue = resolved.values[key];
      if (!range || userValue === undefined) continue;

      let target = userValue;
      if (GIRTH_KEYS.has(key)) {
        // Fit preference plus what past feedback taught us about this user.
        target += FIT_SHIFT_CM[fitPreference] + calibrationCm;
      }

      const mid = (range.min + range.max) / 2;
      const halfWidth = Math.max(
        (range.max - range.min) / 2,
        (TOLERANCE_FLOOR_CM[key] ?? 2) * tolMult
      );
      const deviation = (target - mid) / halfWidth;

      weightSum += weight;
      distSum += weight * Math.abs(deviation);

      perMeasure.push({
        key,
        userValue,
        estimated: resolved.estimated.has(key),
        rowRange: range,
        verdict: verdictFor(userValue, range, key, tolMult),
      });
    }

    if (weightSum === 0) continue;

    // Sort each row's measures by their weight so explanation leads with the
    // dominant measure for this garment type.
    perMeasure.sort((a, b) => (weights[b.key] ?? 0) - (weights[a.key] ?? 0));
    scored.push({ label: row.label, score: distSum / weightSum, perMeasure });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  const runnerUp = scored[1] ?? null;

  const warnings: string[] = [];

  // Confidence: how decisively the best row beats the runner-up.
  let confidence: number;
  if (!runnerUp) {
    confidence = 0.6; // single-row chart: fit known, but no alternative to compare
    warnings.push(WARNINGS_HE.narrowChart);
  } else {
    const margin = runnerUp.score - best.score;
    confidence = Math.min(1, 0.45 + margin * 0.55);
    if (margin < 0.15) warnings.push(WARNINGS_HE.ambiguous);
  }

  const usedEstimated = best.perMeasure.some((p) => p.estimated);
  if (usedEstimated) {
    confidence *= 0.85;
    warnings.push(WARNINGS_HE.estimatedMeasures);
  }
  if (input.sizeChartSource === "llm") {
    confidence *= 0.9;
    warnings.push(WARNINGS_HE.llmChart);
  }
  if (best.perMeasure.length === 1 && runnerUp) {
    confidence *= 0.9;
    if (!warnings.includes(WARNINGS_HE.narrowChart))
      warnings.push(WARNINGS_HE.narrowChart);
  }

  confidence = Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100;
  const confidenceLabel =
    confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";

  return {
    size: best.label,
    runnerUp: runnerUp?.label ?? null,
    confidence,
    confidenceLabel: confidenceLabel,
    perMeasure: best.perMeasure,
    explanation: [
      buildExplanation({
        size: best.label,
        runnerUp: runnerUp?.label ?? null,
        perMeasure: best.perMeasure,
        fitPreference,
      }),
      calibrationNote(calibrationCm),
    ]
      .filter(Boolean)
      .join(" "),
    warnings,
  };
}

function verdictFor(
  userValue: number,
  range: MeasureRange,
  key: MeasureKey,
  tolMult: number
): PerMeasureResult["verdict"] {
  const tol = (TOLERANCE_FLOOR_CM[key] ?? 2) * tolMult;
  if (userValue > range.max + tol) return "tight";
  if (userValue < range.min - tol) return "loose";
  return "fit";
}

export { CONFIDENCE_LABELS_HE };
