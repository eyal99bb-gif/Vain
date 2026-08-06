"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banner, Button, Card } from "./ui";
import ShareButton from "./ShareButton";

export interface ClosetLook {
  id: string;
  url: string;
  isFavorite: boolean;
  titles: string[];
  size: string | null;
  createdAt: string;
}

export default function Closet({ looks: initial }: { looks: ClosetLook[] }) {
  const [looks, setLooks] = useState(initial);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [open, setOpen] = useState<ClosetLook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/mida/closet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    return res.json();
  };

  const toggleFavorite = async (look: ClosetLook) => {
    const next = !look.isFavorite;
    // Optimistic: the tap should feel instant.
    setLooks((prev) =>
      prev.map((l) => (l.id === look.id ? { ...l, isFavorite: next } : l))
    );
    try {
      await patch({ tryonId: look.id, isFavorite: next });
    } catch {
      setLooks((prev) =>
        prev.map((l) => (l.id === look.id ? { ...l, isFavorite: !next } : l))
      );
      setError("לא הצלחנו לעדכן — נסו שוב.");
    }
  };

  const remove = async (look: ClosetLook) => {
    try {
      await patch({ tryonId: look.id, remove: true });
      setLooks((prev) => prev.filter((l) => l.id !== look.id));
      setOpen(null);
    } catch {
      setError("מחיקת הלוק נכשלה — נסו שוב.");
    }
  };

  const visible = onlyFavorites ? looks.filter((l) => l.isFavorite) : looks;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex gap-2">
        {[
          { key: false, label: `הכול (${looks.length})` },
          { key: true, label: `מועדפים (${looks.filter((l) => l.isFavorite).length})` },
        ].map((tab) => (
          <button
            key={String(tab.key)}
            type="button"
            aria-pressed={onlyFavorites === tab.key}
            onClick={() => setOnlyFavorites(tab.key)}
            className={`h-11 flex-1 cursor-pointer rounded-full border text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent ${
              onlyFavorites === tab.key
                ? "border-mida-accent bg-mida-accent-soft text-mida-accent-deep"
                : "border-mida-line bg-mida-surface text-mida-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-mida-muted">
            עוד לא סימנת מועדפים.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visible.map((look) => (
            <li key={look.id} className="relative">
              <button
                type="button"
                onClick={() => setOpen(look)}
                className="w-full cursor-pointer overflow-hidden rounded-2xl border border-mida-line bg-mida-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={look.url}
                  alt={look.titles.join(", ") || "לוק שמור"}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
                <span className="block truncate px-2 py-2 text-start text-xs text-mida-muted">
                  {look.titles[0] ?? "לוק"}
                  {look.size ? ` · ${look.size}` : ""}
                </span>
              </button>
              <button
                type="button"
                aria-label={
                  look.isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"
                }
                aria-pressed={look.isFavorite}
                onClick={() => toggleFavorite(look)}
                className="absolute end-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mida-ink/60">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill={look.isFavorite ? "#e11d48" : "none"}
                    stroke={look.isFavorite ? "#e11d48" : "white"}
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.5-7 9-7 9z" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="פרטי הלוק"
            className="fixed inset-0 z-30 flex items-end justify-center bg-mida-ink/60 p-4"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[88dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-3xl bg-mida-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={open.url}
                alt={open.titles.join(", ") || "לוק שמור"}
                className="w-full rounded-2xl border border-mida-line"
              />
              {open.titles.length > 0 && (
                <p className="text-sm text-mida-ink">
                  {open.titles.join(" · ")}
                  {open.size ? ` — מידה ${open.size}` : ""}
                </p>
              )}
              <ShareButton resultUrl={open.url} />
              <Button variant="secondary" onClick={() => setOpen(null)}>
                סגירה
              </Button>
              <button
                type="button"
                onClick={() => remove(open)}
                className="h-11 cursor-pointer text-sm font-medium text-mida-muted hover:text-mida-accent-deep"
              >
                מחיקת הלוק
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
