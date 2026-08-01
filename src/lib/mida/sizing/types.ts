import type {
  FitPreference,
  GarmentType,
  MeasureKey,
  Measurements,
  NormalizedSizeChart,
  SizeChartSource,
  SizeRecommendation,
} from "../types";

export interface RecommendInput {
  measurements: Measurements;
  fitPreference: FitPreference;
  garmentType: GarmentType;
  sizeChart: NormalizedSizeChart;
  sizeChartSource?: SizeChartSource;
}

/** User girth values in cm, keyed by chart measure, with estimation flags. */
export interface ResolvedMeasures {
  values: Partial<Record<MeasureKey, number>>;
  estimated: Set<MeasureKey>;
}

export type { SizeRecommendation };
