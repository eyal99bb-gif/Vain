"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarStatus: string;
  heightCm: number | null;
}

const primaryBtnCls =
  "flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-mida-accent text-lg font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep disabled:cursor-default disabled:opacity-50";

export default function ProfileManager() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/mida/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfiles(data.profiles ?? []);
        setActiveId(data.profile?.id ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const select = async (profileId: string) => {
    await fetch("/api/mida/profiles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setActiveId(profileId);
    router.refresh();
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/mida/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        // A fresh profile has no photos/measurements — go build it.
        router.push("/onboarding");
        return;
      }
    } finally {
      setCreating(false);
    }
  };

  const editActive = async (profileId: string) => {
    if (activeId !== profileId) await select(profileId);
    router.push("/onboarding");
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <h1 className="font-display text-3xl font-bold text-mida-ink">
        הפרופילים שלך
      </h1>
      <p className="text-sm leading-relaxed text-mida-muted">
        פרופיל לכל אחד — שלך, של בן/בת הזוג, של הילדים. בוחרים פרופיל, מודדים
        עליו, ואפשר לערוך בכל רגע.
      </p>

      {loaded && profiles.length === 0 && (
        <p className="rounded-2xl border border-mida-line bg-mida-surface p-4 text-sm text-mida-muted">
          עוד אין פרופילים — צרו את הראשון למטה.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {profiles.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors duration-200 ${
              p.id === activeId
                ? "border-mida-accent bg-mida-accent-soft/40"
                : "border-mida-line bg-mida-surface"
            }`}
          >
            <button
              type="button"
              onClick={() => select(p.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start"
            >
              {p.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.avatarUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full border border-mida-line object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mida-line font-display text-lg font-bold text-mida-muted">
                  {p.name.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-mida-ink">
                  {p.name}
                  {p.id === activeId && (
                    <span className="ps-2 text-xs font-medium text-mida-accent-deep">
                      פעיל
                    </span>
                  )}
                </span>
                <span className="block text-xs text-mida-muted">
                  {p.avatarStatus === "ready"
                    ? `מוכן למדידות${p.heightCm ? ` · ${p.heightCm} ס"מ` : ""}`
                    : "הפרופיל עוד לא הושלם"}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => editActive(p.id)}
              className="shrink-0 cursor-pointer rounded-full border border-mida-line px-4 py-2 text-sm font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent"
            >
              עריכה
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-mida-ink">
            פרופיל חדש — למי?
          </span>
          <input
            type="text"
            placeholder="למשל: גיל, אמא, דנה…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            maxLength={40}
            className="h-12 w-full rounded-xl border border-mida-line bg-mida-surface px-4 text-base text-mida-ink placeholder:text-mida-muted/60 focus:border-mida-accent focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={!newName.trim() || creating}
          onClick={create}
          className={primaryBtnCls}
        >
          יצירת פרופיל חדש
        </button>
      </div>
    </div>
  );
}
