// Ingestion can chain several Gemini URL-context calls plus page fetches.
export const maxDuration = 60;

import { z } from "zod";
import { ensureUid } from "@/lib/mida/uid";
import { ingestProduct } from "@/lib/mida/services/product";
import { getIngestQuota, quotaMessage } from "@/lib/mida/services/quota";
import { logError } from "@/lib/mida/log";

const bodySchema = z.object({
  url: z.string().url().max(2048),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_url" }, { status: 400 });
  }

  const uid = await ensureUid();
  const quota = await getIngestQuota(uid);
  if (!quota.allowed) {
    return Response.json(
      { error: "quota_exceeded", message: quotaMessage(quota), quota },
      { status: 429 }
    );
  }

  try {
    const product = await ingestProduct(parsed.data.url);
    return Response.json({ product });
  } catch (err) {
    // Blocked private addresses and unreachable stores land here too.
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("blocked_")) {
      return Response.json({ error: "blocked_url" }, { status: 400 });
    }
    const errorId = logError("products.ingest", err, { uid });
    return Response.json({ error: "ingest_failed", errorId }, { status: 500 });
  }
}
