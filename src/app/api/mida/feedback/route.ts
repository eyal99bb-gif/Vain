import { z } from "zod";
import { getRepos } from "@/lib/mida/adapters/db";
import { getActiveProfile } from "@/lib/mida/services/profile";
import { logError } from "@/lib/mida/log";

const bodySchema = z.object({
  tryonId: z.string().min(1),
  verdict: z.enum(["fit", "small", "large"]),
});

/** "Did the size fit?" — the signal that calibrates future recommendations. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const profile = await getActiveProfile();
  if (!profile) return Response.json({ error: "no_profile" }, { status: 400 });

  try {
    const repos = await getRepos();
    const tryon = await repos.tryons.getById(parsed.data.tryonId);
    if (!tryon || tryon.profileId !== profile.id) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const product = await repos.products.getById(tryon.productId);

    await repos.feedback.create({
      profileId: profile.id,
      productId: tryon.productId,
      tryonId: tryon.id,
      garmentType: product?.garmentType ?? "unknown",
      recommended: tryon.sizeRec?.size ?? "",
      verdict: parsed.data.verdict,
    });
    return Response.json({ ok: true });
  } catch (err) {
    const errorId = logError("feedback.create", err, { profileId: profile.id });
    return Response.json({ error: "save_failed", errorId }, { status: 500 });
  }
}
