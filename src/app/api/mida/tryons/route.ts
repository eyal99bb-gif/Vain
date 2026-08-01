import { z } from "zod";
import { readUid } from "@/lib/mida/uid";
import { getProfile } from "@/lib/mida/services/profile";
import { startTryOn, toTryOnView } from "@/lib/mida/services/tryon";

const bodySchema = z.object({
  productId: z.string().min(1),
  productImageIndex: z.number().int().min(0).max(20).optional(),
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
    parsed.data.productId,
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
