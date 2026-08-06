"use client";

import { Button } from "@/components/mida/ui";

export default function MidaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-mida-ink">
        משהו השתבש
      </h1>
      <p className="text-sm leading-relaxed text-mida-muted">
        נתקלנו בתקלה בטעינת העמוד. אפשר לנסות שוב — הנתונים שלך נשמרו.
      </p>
      {error.digest && (
        <p className="text-xs text-mida-muted">קוד שגיאה: {error.digest}</p>
      )}
      <Button onClick={reset}>ניסיון נוסף</Button>
    </div>
  );
}
