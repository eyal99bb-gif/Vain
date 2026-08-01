import Link from "next/link";
import { readUid } from "@/lib/mida/uid";
import { getProfile } from "@/lib/mida/services/profile";

export default async function HomePage() {
  const uid = await readUid();
  const profile = uid ? await getProfile(uid) : null;
  const hasAvatar = profile?.avatarStatus === "ready";

  const ctaHref = hasAvatar ? "/tryon" : "/onboarding";
  const ctaLabel = hasAvatar ? "למדידה חדשה" : "בונים לך דמות";

  return (
    <div className="flex flex-1 flex-col justify-center gap-10 py-8">
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-bold leading-tight text-mida-ink">
          תמדוד לפני
          <br />
          <span className="text-mida-accent">שאתה קונה.</span>
        </h1>
        <p className="text-lg leading-relaxed text-mida-muted">
          מדביקים קישור לבגד מכל חנות אונליין, רואים אותו עליכם, ומקבלים המלצת
          מידה מדויקת — לפני שהכרטיס יוצא מהארנק.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        {[
          {
            title: "פרופיל גוף אישי",
            text: "תמונה + מידות, פעם אחת בלבד",
          },
          {
            title: "הדמיה עליך",
            text: "רואים את הבגד על הדמות שלך תוך שניות",
          },
          {
            title: "המלצת מידה חכמה",
            text: "הצלבה בין המידות שלך לטבלת החנות",
          },
        ].map((f, i) => (
          <div
            key={f.title}
            className="flex items-center gap-4 rounded-2xl border border-mida-line bg-mida-surface p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mida-accent-soft font-display text-base font-bold text-mida-accent-deep">
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold text-mida-ink">{f.title}</h2>
              <p className="text-sm text-mida-muted">{f.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <Link
          href={ctaHref}
          className="flex h-13 min-h-12 cursor-pointer items-center justify-center rounded-full bg-mida-accent px-8 text-lg font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
        >
          {ctaLabel}
        </Link>
        {hasAvatar && (
          <Link
            href="/onboarding"
            className="text-center text-sm text-mida-muted underline-offset-4 hover:underline"
          >
            עדכון פרופיל ומידות
          </Link>
        )}
      </section>
    </div>
  );
}
