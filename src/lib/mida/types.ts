// Domain types shared across MIDA modules.

export type FitPreference = "slim" | "regular" | "loose";

export type GarmentType =
  | "top"
  | "pants"
  | "dress"
  | "outerwear"
  | "skirt"
  | "unknown";

export type MeasureKey =
  | "chest"
  | "waist"
  | "hips"
  | "inseam"
  | "shoulders"
  | "height";

/** User measurements in cm (weight in kg). */
export interface Measurements {
  heightCm: number;
  weightKg: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  inseamCm?: number;
  shouldersCm?: number;
}

export type AvatarStatus = "none" | "pending" | "ready" | "failed";

export interface Profile {
  id: string;
  uid: string;
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  inseamCm: number | null;
  shouldersCm: number | null;
  fitPreference: FitPreference;
  photoKeys: string[];
  avatarKey: string | null;
  avatarStatus: AvatarStatus;
  avatarError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single measure column range within one size row, in cm. */
export interface MeasureRange {
  min: number;
  max: number;
}

export interface SizeChartRow {
  label: string;
  values: Partial<Record<MeasureKey, MeasureRange>>;
}

export interface NormalizedSizeChart {
  unit: "cm";
  rows: SizeChartRow[];
}

export type SizeChartSource = "jsonld" | "html-table" | "llm" | "none";

export interface Product {
  id: string;
  url: string;
  urlHash: string;
  store: string;
  title: string;
  price: number | null;
  currency: string | null;
  images: string[];
  colors: string[];
  garmentType: GarmentType;
  sizeChart: NormalizedSizeChart | null;
  sizeChartSource: SizeChartSource;
  warnings: string[];
  createdAt: string;
}

/** Product data as extracted by the scraper, before persistence. */
export interface ScrapedProduct {
  title: string;
  price: number | null;
  currency: string | null;
  images: string[];
  colors: string[];
  garmentType: GarmentType;
  sizeChart: NormalizedSizeChart | null;
  sizeChartSource: SizeChartSource;
  warnings: string[];
}

export type TryOnStatus = "pending" | "processing" | "ready" | "failed";

export type MeasureVerdict = "fit" | "tight" | "loose";

export interface PerMeasureResult {
  key: MeasureKey;
  userValue: number;
  estimated: boolean;
  rowRange: MeasureRange;
  verdict: MeasureVerdict;
}

export type ConfidenceLabel = "high" | "medium" | "low";

export interface SizeRecommendation {
  size: string;
  runnerUp: string | null;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  perMeasure: PerMeasureResult[];
  explanation: string;
  warnings: string[];
}

export interface TryOn {
  id: string;
  profileId: string;
  /** Primary product (first item); kept for compatibility and FKs. */
  productId: string;
  /** All products dressed in this try-on, in order (1-3 items). */
  productIds: string[];
  status: TryOnStatus;
  productImageIndex: number;
  resultKey: string | null;
  error: string | null;
  sizeRec: SizeRecommendation | null;
  createdAt: string;
  updatedAt: string;
}
