import { ensureUid } from "@/lib/mida/uid";
import { createProductFromScreenshot } from "@/lib/mida/services/product";

// Screenshot classification calls Gemini — allow time on serverless hosts.
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "image_required" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return Response.json(
      { error: "unsupported_type", type: file.type },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 400 });
  }

  const rawUrl = form.get("url");
  const sourceUrl =
    typeof rawUrl === "string" && /^https?:\/\//.test(rawUrl) ? rawUrl : null;

  const uid = await ensureUid();
  try {
    const product = await createProductFromScreenshot(
      uid,
      { data: Buffer.from(await file.arrayBuffer()), mimeType: file.type, ext },
      sourceUrl
    );
    return Response.json({ product });
  } catch (err) {
    return Response.json(
      {
        error: "upload_failed",
        detail: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      },
      { status: 500 }
    );
  }
}
