"use client";

import { useState } from "react";
import { Card } from "./ui";

const OPTIONS = [
  { verdict: "small", label: "יצאה קטנה" },
  { verdict: "fit", label: "התאימה" },
  { verdict: "large", label: "יצאה גדולה" },
] as const;

/**
 * The learning loop: each report shifts this profile's future size targets,
 * so the recommendation gets more personal with use.
 */
export default function FitFeedback({
  tryonId,
  size,
}: {
  tryonId: string;
  size: string;
}) {
  const [sent, setSent] = useState<string | null>(null);

  const send = async (verdict: string) => {
    setSent(verdict);
    await fetch("/api/mida/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tryonId, verdict }),
    }).catch(() => {});
  };

  if (sent) {
    return (
      <Card>
        <p role="status" className="text-center text-sm text-mida-muted">
          תודה! נכייל את ההמלצות הבאות בשבילך.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="pb-2 text-sm font-medium text-mida-ink">
        קנית? ספר לנו איך מידה {size} התאימה — וההמלצות הבאות יהיו מדויקות יותר.
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.verdict}
            type="button"
            onClick={() => send(o.verdict)}
            className="h-11 flex-1 cursor-pointer rounded-full border border-mida-line text-xs font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
          >
            {o.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
