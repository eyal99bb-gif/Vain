// Post-response try-on generation (after()) needs the function alive for the
// full Gemini call — Vercel Hobby caps at 60s.
export const maxDuration = 60;

import { z } from "zod";
import { readUid } from "@/lib/mida/uid";
import { getProfile } from "@/lib/mida/services/profile";
import { startTryOn, toTryOnView } from "@/lib/mida/services/tryon";

const bodySchema = z
  .object({
    productId: z.string().min(1).optional(),
    productIds: z.array(z.string().min(1)).min(1).max(3).optional(),
    productImageIndex: z.number().int().min(0).max(20).optional(),
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
  const profile = uid ? await getProfile(uid) : null;
  if (!profile) return Response.json({ error: "no_profile" }, { status: 400 });

  const result = await startTryOn(
    profile,
    parsed.data.productIds ?? [parsed.data.productId!],
    parsed.data.productImageIndex ?? 0
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(
    { tryon: await toTryOnView(result.tryon) },
    { status: 202 }
  );
}
