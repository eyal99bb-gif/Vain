import Link from "next/link";
import { getActiveProfile } from "@/lib/mida/services/profile";
import { getRepos } from "@/lib/mida/adapters/db";
import { getStorage } from "@/lib/mida/adapters/storage";

export default async function HomePage() {
  const profile = await getActiveProfile();
  const hasAvatar = profile?.avatarStatus === "ready";

  // Recent looks for the active profile — the seed of the virtual closet.
  let recentLooks: { id: string; url: string }[] = [];
  if (profile) {
    const repos = await getRepos();
    const storage = await getStorage();
    recentLooks = (await repos.tryons.listByProfile(profile.id, 6))
      .filter((t) => t.status === "ready" && t.resultKey)
      .map((t) => ({ id: t.id, url: storage.url(t.resultKey!) }));
  }

  const ctaHref = hasAvatar ? "/tryon" : "/onboarding";
  const ctaLabel = hasAvatar ? "למדידה חדשה" : "בונים לך דמות";

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-8">
      <section className="flex flex-col gap-4">
        {profile && hasAvatar ? (
          <p className="text-sm font-medium text-mida-accent-deep">
            היי, {profile.name} 👋
          </p>
        ) : null}
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

      {recentLooks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-mida-ink">
              המדידות האחרונות של {profile!.name}
            </h2>
            <Link
              href="/closet"
              className="text-xs font-medium text-mida-accent-deep underline-offset-4 hover:underline"
            >
              לארון המלא
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentLooks.map((look) => (
              <Link
                key={look.id}
                href="/closet"
                className="h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-mida-line bg-mida-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={look.url}
                  alt="מדידה שמורה"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {[
            { title: "פרופיל גוף אישי", text: "תמונה + מידות, פעם אחת בלבד" },
            { title: "הדמיה עליך", text: "רואים את הבגד על הדמות שלך תוך שניות" },
            { title: "המלצת מידה חכמה", text: "הצלבה בין המידות שלך לטבלת החנות" },
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
      )}

      <section className="flex flex-col gap-3">
        <Link
          href={ctaHref}
          className="flex h-13 min-h-12 cursor-pointer items-center justify-center rounded-full bg-mida-accent px-8 text-lg font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
        >
          {ctaLabel}
        </Link>
        <div className="flex items-center justify-center gap-4 text-sm text-mida-muted">
          <Link
            href="/profiles"
            className="underline-offset-4 hover:underline"
          >
            {profile ? "החלפת פרופיל" : "ניהול פרופילים"}
          </Link>
          <Link href="/closet" className="underline-offset-4 hover:underline">
            הארון שלי
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            פרטיות
          </Link>
        </div>
      </section>
    </div>
  );
}
