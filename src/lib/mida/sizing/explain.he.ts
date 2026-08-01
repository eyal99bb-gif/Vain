import type {
  ConfidenceLabel,
  MeasureKey,
  MeasureVerdict,
  PerMeasureResult,
} from "../types";

export const MEASURE_NAMES_HE: Record<MeasureKey, string> = {
  chest: "היקף החזה",
  waist: "היקף המותניים",
  hips: "היקף הירכיים",
  inseam: "אורך הרגל הפנימי",
  shoulders: "רוחב הכתפיים",
  height: "הגובה",
};

export const CONFIDENCE_LABELS_HE: Record<ConfidenceLabel, string> = {
  high: "ביטחון גבוה",
  medium: "ביטחון בינוני",
  low: "ביטחון נמוך",
};

const VERDICT_HE: Record<MeasureVerdict, string> = {
  fit: "תשב עליך מצוין",
  tight: "תהיה מעט צמודה",
  loose: "תהיה מעט רחבה",
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Builds the main Hebrew recommendation sentence. */
export function buildExplanation(args: {
  size: string;
  runnerUp: string | null;
  perMeasure: PerMeasureResult[];
  fitPreference: "slim" | "regular" | "loose";
}): string {
  const { size, runnerUp, perMeasure } = args;
  const parts: string[] = [];

  const primary = perMeasure[0];
  if (primary) {
    parts.push(
      `לפי ${MEASURE_NAMES_HE[primary.key]} שלך (${fmt(primary.userValue)} ס"מ) מידה ${size} ${VERDICT_HE[primary.verdict]}`
    );
  } else {
    parts.push(`לפי המידות שלך, מידה ${size} היא ההתאמה הטובה ביותר`);
  }

  const offMeasure = perMeasure.find(
    (p) => p !== primary && p.verdict !== "fit"
  );
  if (offMeasure) {
    parts.push(
      `ב${MEASURE_NAMES_HE[offMeasure.key].replace(/^ה/, "")} היא ${
        offMeasure.verdict === "tight" ? "מעט צמודה" : "מעט רחבה"
      }`
    );
  }

  let sentence = parts.join("; ") + ".";

  if (runnerUp) {
    const tighterRunner = offMeasure?.verdict === "loose";
    sentence += ` אם ${
      args.fitPreference === "slim"
        ? "אתם מעדיפים גזרה צמודה"
        : args.fitPreference === "loose"
          ? "אתם מעדיפים גזרה משוחררת"
          : tighterRunner
            ? "אתם מעדיפים התאמה מדויקת יותר"
            : "אתם מתלבטים"
    }, שקלו גם ${runnerUp}.`;
  }

  return sentence;
}

export const WARNINGS_HE = {
  estimatedMeasures:
    'חלק מהמדדים חושבו כהערכה לפי גובה ומשקל — למדידה מדויקת מומלץ למלא את ההיקפים בפרופיל.',
  llmChart:
    "טבלת המידות חולצה אוטומטית מהעמוד וייתכנו אי-דיוקים.",
  narrowChart:
    "טבלת המידות של החנות חלקית, ולכן ההמלצה מבוססת על פחות מדדים.",
  ambiguous:
    "שתי מידות קרובות מאוד זו לזו — שווה לבדוק את שתיהן.",
} as const;
