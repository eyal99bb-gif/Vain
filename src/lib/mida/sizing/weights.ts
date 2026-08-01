import type { GarmentType, MeasureKey } from "../types";

/**
 * Relative importance of each measure per garment type. Weights are
 * renormalized at scoring time over the measures actually present in both
 * the user's data and the chart, so they only need to be proportional.
 */
export const GARMENT_WEIGHTS: Record<
  Exclude<GarmentType, "unknown">,
  Partial<Record<MeasureKey, number>>
> = {
  top: { chest: 0.5, shoulders: 0.25, waist: 0.15, height: 0.1 },
  pants: { waist: 0.45, hips: 0.35, inseam: 0.2 },
  dress: { chest: 0.35, waist: 0.3, hips: 0.35 },
  outerwear: { chest: 0.5, shoulders: 0.25, waist: 0.15, height: 0.1 },
  skirt: { waist: 0.55, hips: 0.45 },
};

/** Fallback when garment type is unknown: use whatever the chart offers. */
export const UNKNOWN_WEIGHTS: Partial<Record<MeasureKey, number>> = {
  chest: 0.3,
  waist: 0.25,
  hips: 0.25,
  shoulders: 0.1,
  inseam: 0.05,
  height: 0.05,
};

/** Per-measure minimum tolerance in cm (half-width floor for narrow ranges). */
export const TOLERANCE_FLOOR_CM: Partial<Record<MeasureKey, number>> = {
  chest: 2,
  waist: 2,
  hips: 2,
  shoulders: 1.5,
  inseam: 2,
  height: 4,
};

/** Outerwear is worn over layers — deviations matter less. */
export const GARMENT_TOLERANCE_MULT: Record<GarmentType, number> = {
  top: 1,
  pants: 1,
  dress: 1,
  outerwear: 1.5,
  skirt: 1,
  unknown: 1.2,
};

export function weightsFor(
  garmentType: GarmentType
): Partial<Record<MeasureKey, number>> {
  return garmentType === "unknown"
    ? UNKNOWN_WEIGHTS
    : GARMENT_WEIGHTS[garmentType];
}
