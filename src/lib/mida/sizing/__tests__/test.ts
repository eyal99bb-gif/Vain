// Assert-based test script for the MIDA sizing engine (run: npm run test:mida).
import assert from "node:assert";
import { recommendSize } from "../recommend";
import { resolveMeasures } from "../estimate";
import { calibrationShiftCm } from "../calibrate";
import type { NormalizedSizeChart, Measurements } from "../../types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const chart: NormalizedSizeChart = {
  unit: "cm",
  rows: [
    { label: "S", values: { chest: { min: 88, max: 93 }, waist: { min: 72, max: 77 }, hips: { min: 88, max: 93 }, shoulders: { min: 42, max: 44 }, inseam: { min: 76, max: 78 } } },
    { label: "M", values: { chest: { min: 94, max: 99 }, waist: { min: 78, max: 83 }, hips: { min: 94, max: 99 }, shoulders: { min: 44, max: 46 }, inseam: { min: 78, max: 80 } } },
    { label: "L", values: { chest: { min: 100, max: 105 }, waist: { min: 84, max: 89 }, hips: { min: 100, max: 105 }, shoulders: { min: 46, max: 48 }, inseam: { min: 80, max: 82 } } },
  ],
};

// User whose chest says M but waist says L — garment type should decide.
const splitUser: Measurements = {
  heightCm: 178,
  weightKg: 78,
  chestCm: 96,
  waistCm: 86,
  hipsCm: 102,
  shouldersCm: 45,
  inseamCm: 79,
};

test("garment weighting flips the winner: top → M (chest-driven)", () => {
  const rec = recommendSize({
    measurements: splitUser,
    fitPreference: "regular",
    garmentType: "top",
    sizeChart: chart,
  });
  assert.ok(rec);
  assert.strictEqual(rec.size, "M");
});

test("garment weighting flips the winner: pants → L (waist/hips-driven)", () => {
  const rec = recommendSize({
    measurements: splitUser,
    fitPreference: "regular",
    garmentType: "pants",
    sizeChart: chart,
  });
  assert.ok(rec);
  assert.strictEqual(rec.size, "L");
});

test("fit preference nudges the pick: slim prefers the tighter size", () => {
  const between: Measurements = { ...splitUser, chestCm: 99.5, waistCm: 80, shouldersCm: 45.5 };
  const regular = recommendSize({ measurements: between, fitPreference: "regular", garmentType: "top", sizeChart: chart });
  const slim = recommendSize({ measurements: between, fitPreference: "slim", garmentType: "top", sizeChart: chart });
  assert.ok(regular && slim);
  const order = ["S", "M", "L"];
  assert.ok(
    order.indexOf(slim.size) <= order.indexOf(regular.size),
    `slim ${slim.size} should be <= regular ${regular.size}`
  );
  assert.strictEqual(slim.size, "M");
});

test("missing girths are estimated and lower confidence", () => {
  const full = recommendSize({ measurements: splitUser, fitPreference: "regular", garmentType: "top", sizeChart: chart });
  const sparse = recommendSize({
    measurements: { heightCm: 178, weightKg: 78 },
    fitPreference: "regular",
    garmentType: "top",
    sizeChart: chart,
  });
  assert.ok(full && sparse);
  assert.ok(sparse.perMeasure.some((p) => p.estimated), "sparse input should flag estimated measures");
  assert.ok(!full.perMeasure.some((p) => p.estimated), "full input should not estimate");
  assert.ok(sparse.warnings.length > 0, "estimation should add a warning");
});

test("llm chart source lowers confidence vs html-table", () => {
  const base = { measurements: splitUser, fitPreference: "regular" as const, garmentType: "top" as const, sizeChart: chart };
  const table = recommendSize({ ...base, sizeChartSource: "html-table" });
  const llm = recommendSize({ ...base, sizeChartSource: "llm" });
  assert.ok(table && llm);
  assert.ok(llm.confidence < table.confidence);
});

test("ambiguous fit (user exactly between two rows) yields lower confidence + warning", () => {
  const between: Measurements = { heightCm: 178, weightKg: 78, chestCm: 99.5, waistCm: 83.5, hipsCm: 99.5, shouldersCm: 46, inseamCm: 80 };
  const clear = recommendSize({ measurements: splitUser, fitPreference: "regular", garmentType: "pants", sizeChart: chart });
  const ambiguous = recommendSize({ measurements: between, fitPreference: "regular", garmentType: "pants", sizeChart: chart });
  assert.ok(clear && ambiguous);
  assert.ok(ambiguous.confidence < clear.confidence);
});

test("empty/null chart returns null", () => {
  assert.strictEqual(
    recommendSize({ measurements: splitUser, fitPreference: "regular", garmentType: "top", sizeChart: { unit: "cm", rows: [] } }),
    null
  );
});

test("unknown garment type still recommends using available columns", () => {
  const rec = recommendSize({ measurements: splitUser, fitPreference: "regular", garmentType: "unknown", sizeChart: chart });
  assert.ok(rec);
  assert.ok(["M", "L"].includes(rec.size));
});

test("explanation is Hebrew and mentions the chosen size", () => {
  const rec = recommendSize({ measurements: splitUser, fitPreference: "regular", garmentType: "top", sizeChart: chart });
  assert.ok(rec);
  assert.ok(rec.explanation.includes("M"), "explanation mentions size");
  assert.ok(/[֐-׿]/.test(rec.explanation), "explanation is in Hebrew");
});

test("estimates are anthropometrically plausible for 178cm/72kg", () => {
  const r = resolveMeasures({ heightCm: 178, weightKg: 72 });
  const v = r.values;
  assert.ok(v.chest! > 80 && v.chest! < 105, `chest ${v.chest}`);
  assert.ok(v.waist! > 65 && v.waist! < 95, `waist ${v.waist}`);
  assert.ok(v.hips! > 80 && v.hips! < 110, `hips ${v.hips}`);
  assert.ok(v.inseam! > 70 && v.inseam! < 90, `inseam ${v.inseam}`);
});

test("calibration shifts the target after 'ran small' reports", () => {
  const none = calibrationShiftCm([], "top");
  const small = calibrationShiftCm(
    [
      { garmentType: "top", verdict: "small" },
      { garmentType: "top", verdict: "small" },
    ],
    "top"
  );
  const large = calibrationShiftCm(
    [{ garmentType: "top", verdict: "large" }],
    "top"
  );
  assert.strictEqual(none, 0);
  assert.ok(small > 0, "repeated 'small' should aim bigger");
  assert.ok(large < 0, "'large' should aim smaller");
  // Same-category feedback counts double.
  assert.ok(
    calibrationShiftCm([{ garmentType: "top", verdict: "small" }], "top") >
      calibrationShiftCm([{ garmentType: "pants", verdict: "small" }], "top")
  );
  // And it is clamped so a run of reports cannot run away.
  const many = calibrationShiftCm(
    Array.from({ length: 20 }, () => ({ garmentType: "top", verdict: "small" as const })),
    "top"
  );
  assert.ok(many <= 4, `clamped, got ${many}`);
});

test("'fit' reports leave the recommendation unchanged", () => {
  const shift = calibrationShiftCm(
    [
      { garmentType: "top", verdict: "fit" },
      { garmentType: "pants", verdict: "fit" },
    ],
    "top"
  );
  assert.strictEqual(shift, 0);
});

test("calibration changes the recommended size for a borderline body", () => {
  const between: Measurements = { heightCm: 178, weightKg: 78, chestCm: 99, waistCm: 82, hipsCm: 99, shouldersCm: 45.5 };
  const base = { measurements: between, fitPreference: "regular" as const, garmentType: "top" as const, sizeChart: chart };
  const plain = recommendSize(base);
  const sizedUp = recommendSize({ ...base, calibrationCm: 4 });
  assert.ok(plain && sizedUp);
  const order = ["S", "M", "L"];
  assert.ok(
    order.indexOf(sizedUp.size) >= order.indexOf(plain.size),
    `calibrated ${sizedUp.size} should not be smaller than ${plain.size}`
  );
  assert.ok(sizedUp.explanation.includes("כיילנו"), "explains the calibration");
});

console.log(`\n${passed} sizing tests passed`);
