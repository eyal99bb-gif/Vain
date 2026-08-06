import { z } from "zod";
import { getRepos } from "@/lib/mida/adapters/db";
import { getActiveProfile } from "@/lib/mida/services/profile";
import { getStorage } from "@/lib/mida/adapters/storage";
import { logError } from "@/lib/mida/log";

const patchSchema = z.object({
  tryonId: z.string().min(1),
  isFavorite: z.boolean().optional(),
  remove: z.boolean().optional(),
});

/** Toggle a look's favourite flag, or delete it (with its image). */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
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

    if (parsed.data.remove) {
      if (tryon.resultKey) {
        const storage = await getStorage();
        await storage.delete(tryon.resultKey).catch(() => {});
      }
      await repos.tryons.deleteById(tryon.id);
      return Response.json({ ok: true, removed: true });
    }

    const updated = await repos.tryons.update(tryon.id, {
      isFavorite: parsed.data.isFavorite ?? tryon.isFavorite,
    });
    return Response.json({ ok: true, isFavorite: updated?.isFavorite ?? false });
  } catch (err) {
    const errorId = logError("closet.patch", err, { profileId: profile.id });
    return Response.json({ error: "update_failed", errorId }, { status: 500 });
  }
}
