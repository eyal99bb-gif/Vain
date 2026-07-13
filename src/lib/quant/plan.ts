import type { EngineConfig, EnsembleResult, HitRate } from "./types";

export interface ActionStep {
  title: string;
  detail: string;
}

const fmt = (x: number) =>
  x >= 1000
    ? x.toLocaleString("he-IL", { maximumFractionDigits: 0 })
    : x.toLocaleString("he-IL", { maximumFractionDigits: 2 });

const intervalName = (i: EngineConfig["interval"]) =>
  i === "1d" ? "יום" : i === "1w" ? "שבוע" : "חודש";

/**
 * Turn an ensemble result into numbered, plain-Hebrew steps. Educational
 * guidance only — no execution. Always ends with the paper-trade reminder.
 */
export function buildActionPlan(
  e: EnsembleResult,
  hit: HitRate,
  cfg: EngineConfig,
  accountSize: number,
): ActionStep[] {
  const steps: ActionStep[] = [];
  const period = intervalName(cfg.interval);

  if (e.direction === 0) {
    steps.push({
      title: "אין עסקה — וזה אות לכל דבר",
      detail:
        "האות המשולב נמצא באזור הניטרלי. הפעולה הנכונה היא להישאר בחוץ ולשמור על הכסף. רוב ההפסדים של סוחרים מתחילים נולדים מהצורך 'לעשות משהו'.",
    });
    steps.push({
      title: "מתי לבדוק שוב",
      detail: `בסגירת ה${period} הבא. האות מתעדכן פעם ב${period} — לבדוק יותר מזה רק מייצר רעש ופיתוי.`,
    });
    return steps;
  }

  const dirWord = e.direction > 0 ? "לונג (קנייה)" : "שורט (מכירה בחסר)";
  const amount = accountSize * Math.abs(e.positionFrac);

  steps.push({
    title: `כיוון: ${dirWord}`,
    detail: `האות המשולב הוא ${e.score > 0 ? "+" : ""}${e.score.toFixed(2)} (סקאלה של ‎-1 עד ‎+1), עם ביטחון של ${(e.conviction * 100).toFixed(0)}%.`,
  });
  steps.push({
    title: "כמה להשקיע (גודל פוזיציה)",
    detail: `${(Math.abs(e.positionFrac) * 100).toFixed(0)}% מהתיק — ${fmt(amount)} על תיק של ${fmt(accountSize)}. הגודל נקבע לפי יעד תנודתיות: כשהשוק סוער, הפוזיציה קטנה אוטומטית.`,
  });
  steps.push({
    title: "אזור כניסה",
    detail: `סביב המחיר הנוכחי (${fmt(e.price)}), עדיף בפקודת לימיט. אין צורך לרדוף — אם המחיר ברח יותר מ-${fmt(e.atr * 0.5)} (חצי ATR), לחכות לנגיעה חוזרת.`,
  });
  if (e.stop !== null) {
    steps.push({
      title: "סטופ-לוס — לא אופציונלי",
      detail: `${fmt(e.stop)} (2.5 ATR מהכניסה). מציבים את הפקודה מיד עם הכניסה. אם המחיר מגיע לשם — יוצאים, בלי ויכוח עם השוק. הפסד מקסימלי מתוכנן: ~${fmt(amount * 2.5 * (e.atr / e.price))}.`,
    });
  }
  steps.push({
    title: "מתי לבדוק שוב",
    detail: `בסגירת ה${period} הבא, או אם הסטופ נפגע — המוקדם מביניהם. לא מזיזים סטופ נגד הכיוון, לעולם.`,
  });
  steps.push({
    title: "לפני כסף אמיתי: נייר",
    detail: `ההסתברות ההיסטורית לאות כזה היא ${(hit.rate * 100).toFixed(0)}% (רווח בטווח ${(hit.lo * 100).toFixed(0)}%–${(hit.hi * 100).toFixed(0)}%, על ${hit.n} מקרים${hit.smallSample ? " — מדגם קטן!" : ""}). תעד לפחות 10 עסקאות נייר לפני שקל אחד אמיתי.`,
  });
  return steps;
}
