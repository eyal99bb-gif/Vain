import { getAi } from "../adapters/ai";
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import { runJob } from "../jobs";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

/**
 * Flip the profile to pending and schedule avatar generation after the
 * response. Returns an error string (Hebrew keys are mapped client-side).
 */
export async function startAvatarGeneration(
  uid: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const repos = await getRepos();
  const profile = await repos.profiles.getByUid(uid);

  if (!profile) return { ok: false, error: "no_profile" };
  if (profile.photoKeys.length === 0) return { ok: false, error: "no_photos" };
  if (!profile.heightCm || !profile.weightKg) {
    return { ok: false, error: "no_measurements" };
  }
  if (profile.avatarStatus === "pending") return { ok: true };

  await repos.profiles.upsertByUid(uid, {
    avatarStatus: "pending",
    avatarError: null,
  });

  runJob(`avatar:${uid}`, async () => {
    try {
      const storage = await getStorage();
      const ai = await getAi();

      const photos = [];
      for (const key of profile.photoKeys) {
        const obj = await storage.get(key);
        if (obj) photos.push({ data: obj.data, mimeType: obj.contentType });
      }
      if (photos.length === 0) throw new Error("photos missing from storage");

      const result = await ai.generateAvatar(photos, {
        heightCm: profile.heightCm!,
        weightKg: profile.weightKg!,
        chestCm: profile.chestCm ?? undefined,
        waistCm: profile.waistCm ?? undefined,
        hipsCm: profile.hipsCm ?? undefined,
        inseamCm: profile.inseamCm ?? undefined,
        shouldersCm: profile.shouldersCm ?? undefined,
      });

      const ext = MIME_TO_EXT[result.mimeType] ?? ".png";
      const avatarKey = `${uid}/avatar/${crypto.randomUUID()}${ext}`;
      await storage.put(avatarKey, result.data, result.mimeType);

      await repos.profiles.upsertByUid(uid, {
        avatarKey,
        avatarStatus: "ready",
        avatarError: null,
      });
    } catch (err) {
      await repos.profiles.upsertByUid(uid, {
        avatarStatus: "failed",
        avatarError: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  return { ok: true };
}
