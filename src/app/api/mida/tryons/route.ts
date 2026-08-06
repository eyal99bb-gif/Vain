// Post-response try-on generation (after()) needs the function alive for the
// full Gemini call — Vercel Hobby caps at 60s.
export const maxDuration = 60;

import { z } from "zod";
import { getActiveProfile } from "@/lib/mida/services/profile";
import { startTryOn, toTryOnView } from "@/lib/mida/services/tryon";
import { getTryOnQuota, quotaMessage } from "@/lib/mida/services/quota";
import { getRepos } from "@/lib/mida/adapters/db";
import { readUid } from "@/lib/mida/uid";

const bodySchema = z
  .object({
    productId: z.string().min(1).optional(),
    productIds: z.array(z.string().min(1)).min(1).max(3).optional(),
    productImageIndex: z.number().int().min(0).max(20).optional(),
    baseTryOnId: z.string().min(1).optional(),
  })
  .refine((b) => b.productId || b.productIds?.length, {
    message: "productId or productIds required",
  });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const uid = await readUid();
  const profile = await getActiveProfile();
  if (!uid || !profile) {
    return Response.json({ error: "no_profile" }, { status: 400 });
  }

  // Every try-on is a paid image generation: refuse before spending.
  const quota = await getTryOnQuota(uid);
  if (!quota.allowed) {
    return Response.json(
      { error: "quota_exceeded", message: quotaMessage(quota), quota },
      { status: 429 }
    );
  }

  const result = await startTryOn(
    profile,
    parsed.data.productIds ?? [parsed.data.productId!],
    parsed.data.productImageIndex ?? 0,
    parsed.data.baseTryOnId
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(
    {
      tryon: await toTryOnView(result.tryon),
      quota: { ...quota, used: quota.used + 1 },
    },
    { status: 202 }
  );
}

/** Recent ready try-ons for the active profile (the look history). */
export async function GET() {
  const uid = await readUid();
  const profile = await getActiveProfile();
  if (!uid || !profile) return Response.json({ tryons: [], quota: null });

  const repos = await getRepos();
  const recent = await repos.tryons.listByProfile(profile.id, 24);
  const ready = recent.filter((t) => t.status === "ready");
  return Response.json({
    tryons: await Promise.all(ready.map(toTryOnView)),
    quota: await getTryOnQuota(uid),
  });
}
