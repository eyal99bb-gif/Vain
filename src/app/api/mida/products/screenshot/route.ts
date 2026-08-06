import { ensureUid } from "@/lib/mida/uid";
import { createProductFromScreenshot } from "@/lib/mida/services/product";
import { MAX_UPLOAD_BYTES, normalizeImage } from "@/lib/mida/images";
import { getIngestQuota, quotaMessage } from "@/lib/mida/services/quota";
import { logError } from "@/lib/mida/log";

// Screenshot classification calls Gemini — allow time on serverless hosts.
export const maxDuration = 60;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "image_required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 400 });
  }

  const uid = await ensureUid();
  const quota = await getIngestQuota(uid);
  if (!quota.allowed) {
    return Response.json(
      { error: "quota_exceeded", message: quotaMessage(quota), quota },
      { status: 429 }
    );
  }

  let image;
  try {
    image = await normalizeImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return Response.json({ error: "unsupported_image" }, { status: 400 });
  }

  const rawUrl = form.get("url");
  const sourceUrl =
    typeof rawUrl === "string" && /^https?:\/\//.test(rawUrl) ? rawUrl : null;

  try {
    const product = await createProductFromScreenshot(uid, image, sourceUrl);
    return Response.json({ product });
  } catch (err) {
    const errorId = logError("products.screenshot", err, { uid });
    return Response.json({ error: "upload_failed", errorId }, { status: 500 });
  }
}
