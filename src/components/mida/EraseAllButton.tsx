"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EraseAllButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const erase = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/mida/erase", { method: "POST" });
      if (!res.ok) throw new Error();
      setDone(true);
      router.refresh();
    } catch {
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        הכול נמחק — הפרופילים, המדידות והתמונות.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-mida-line bg-mida-surface text-base font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
      >
        מחיקת כל הנתונים שלי
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-mida-accent bg-mida-accent-soft/40 p-4">
      <p className="text-sm font-medium text-mida-ink">
        למחוק את כל הפרופילים, המדידות והתמונות? הפעולה בלתי הפיכה.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={erase}
          className="h-11 flex-1 cursor-pointer rounded-full bg-mida-accent text-sm font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep disabled:opacity-50"
        >
          {busy ? "מוחקים…" : "כן, למחוק הכול"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-11 flex-1 cursor-pointer rounded-full border border-mida-line bg-mida-surface text-sm font-medium text-mida-ink"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
