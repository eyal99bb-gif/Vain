import type { Metadata } from "next";
import EraseAllButton from "@/components/mida/EraseAllButton";

export const metadata: Metadata = {
  title: "פרטיות",
  description: "מה MIDA שומרת, לכמה זמן, ואיך מוחקים הכול.",
};

const SECTIONS = [
  {
    title: "מה נשמר",
    body: "התמונות שהעליתם, המידות שהזנתם, שם הפרופיל, והמוצרים והמדידות שביצעתם. אין צורך בהרשמה ואיננו מבקשים אימייל, שם מלא או טלפון.",
  },
  {
    title: "מה נעשה בתמונות",
    body: "התמונה שלכם נשלחת למודל של Google (Gemini) יחד עם תמונת הבגד, כדי לייצר את ההדמיה. נתוני מיקום (EXIF) נמחקים מהתמונה לפני כל שימוש. התמונות אינן משמשות לאימון מודלים ואינן מוצגות למשתמשים אחרים.",
  },
  {
    title: "מי יכול לראות",
    body: "רק אתם. הגישה לקבצים מוגבלת למכשיר שיצר את הפרופיל, באמצעות מזהה חתום בעוגייה. קישור לתמונה לבדו אינו מספיק כדי לצפות בה.",
  },
  {
    title: "לכמה זמן",
    body: "עד שתמחקו. אין מחיקה אוטומטית, ואפשר למחוק פרופיל בודד או את כל הנתונים בכל רגע — המחיקה כוללת גם את קבצי התמונות עצמם, לא רק את הרישום.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <h1 className="font-display text-3xl font-bold text-mida-ink">פרטיות</h1>
      <p className="leading-relaxed text-mida-muted">
        תמונות גוף הן מידע רגיש. הנה בדיוק מה קורה איתן.
      </p>

      <dl className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-mida-line bg-mida-surface p-4"
          >
            <dt className="font-semibold text-mida-ink">{s.title}</dt>
            <dd className="pt-1 text-sm leading-relaxed text-mida-muted">
              {s.body}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto pt-4">
        <EraseAllButton />
      </div>
    </div>
  );
}
