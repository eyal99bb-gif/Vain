import { EXIT } from "./exits";
import type { KellyResult } from "./risk";
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
  kelly?: KellyResult,
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

  if (kelly && kelly.half === 0) {
    steps.push({
      title: "עצירה: אין יתרון היסטורי מדוד — הגודל המוצע הוא 0",
      detail:
        "יש אות כיווני, אבל נוסחת קלי על הבדיקה ההיסטורית של הנכס הזה לא מוצאת יתרון שמצדיק סיכון כסף. משקיע מקצועי לא נכנס לעסקה כזו — וזו בדיוק ההגנה שהבוט נותן לך.",
    });
    steps.push({
      title: "מה כן לעשות",
      detail: `לעקוב על נייר בלבד, ולבדוק שוב בסגירת ה${intervalName(cfg.interval)} הבא.`,
    });
    return steps;
  }

  steps.push({
    title: `כיוון: ${dirWord}`,
    detail: `האות המשולב הוא ${e.score > 0 ? "+" : ""}${e.score.toFixed(2)} (סקאלה של ‎-1 עד ‎+1), עם ביטחון של ${(e.conviction * 100).toFixed(0)}%.`,
  });
  steps.push({
    title: "כמה להשקיע (גודל פוזיציה)",
    detail: `${(Math.abs(e.positionFrac) * 100).toFixed(0)}% מהתיק — ${fmt(amount)} על תיק של ${fmt(accountSize)}. הגודל הוא הנמוך מבין יעד-תנודתיות וחצי-קלי${kelly ? ` (קלי מלא: ${(kelly.full * 100).toFixed(0)}%)` : ""} — כפול שיטת ניהול סיכונים, כמו בקרנות מקצועיות.`,
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
  {
    const rUnit = EXIT.STOP_ATR * e.atr;
    const be = e.price + e.direction * rUnit;
    const partial = e.price + e.direction * 2 * rUnit;
    steps.push({
      title: "מתי לוקחים רווח — סולם, לא ניחוש",
      detail: `כשהמחיר מגיע ל-${fmt(be)} (רווח של 1R): מזיזים את הסטופ לנקודת הכניסה — מעכשיו העסקה לא יכולה להפסיד. כשהמחיר מגיע ל-${fmt(partial)} (רווח של 2R): מוכרים חצי (רווח של ~${fmt(amount * EXIT.PARTIAL_AT_R * (rUnit / e.price) * EXIT.PARTIAL_FRAC)}) וגוררים סטופ על היתרה במרחק ${fmt(EXIT.TRAIL_ATR * e.atr)} מהשיא. בלי יעד קבוע — יעד קבוע חותך את העסקאות הגדולות שמממנות את כל הקטנות.`,
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
