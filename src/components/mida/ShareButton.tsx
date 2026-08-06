"use client";

import { useState } from "react";
import { Button } from "./ui";

/**
 * Adds a MIDA footer to the look before sharing — every share doubles as an
 * ad (the spec's viral loop). Drawn client-side so no server round-trip.
 */
async function brandImage(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());

    const footer = Math.round(bitmap.height * 0.11);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height + footer;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    ctx.fillStyle = "#2b2118";
    ctx.fillRect(0, bitmap.height, canvas.width, footer);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#faf6f1";
    ctx.font = `700 ${Math.round(footer * 0.38)}px system-ui, sans-serif`;
    ctx.fillText("MIDA", canvas.width / 2, bitmap.height + footer * 0.38);
    ctx.fillStyle = "#e8e0d5";
    ctx.font = `400 ${Math.round(footer * 0.24)}px system-ui, sans-serif`;
    ctx.fillText(
      "נמדד ב-MIDA · תמדוד. אל תנחש.",
      canvas.width / 2,
      bitmap.height + footer * 0.73
    );

    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
  } catch {
    return null;
  }
}

export default function ShareButton({
  resultUrl,
  label = "שיתוף הלוק",
}: {
  resultUrl: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setNote(null);
    try {
      const blob = (await brandImage(resultUrl)) ?? (await (await fetch(resultUrl)).blob());
      const file = new File([blob], "mida-look.jpg", { type: blob.type });

      // Sharing the file itself is what lands it in WhatsApp or a story.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "הלוק שלי ב-MIDA",
          text: "מדדתי את זה לפני שקניתי — ב-MIDA",
        });
        return;
      }

      // Fallback: a same-origin object URL, because the download attribute
      // is ignored for cross-origin URLs (CDN-backed storage).
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "mida-look.jpg";
      a.click();
      URL.revokeObjectURL(objectUrl);
      setNote("התמונה נשמרה במכשיר.");
    } catch (err) {
      // A user-cancelled share is not a failure.
      if ((err as Error)?.name !== "AbortError") {
        setNote("השיתוף נכשל — נסו שוב.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" loading={busy} onClick={share}>
        {label}
      </Button>
      {note && (
        <span role="status" className="text-center text-xs text-mida-muted">
          {note}
        </span>
      )}
    </div>
  );
}
