import { getRepos } from "../adapters/db";

/**
 * "Avatar" is the user's own first uploaded photo, untouched. Try-ons dress
 * the garment directly onto the original photo, so nothing about the person
 * or scene is regenerated. No AI call, so this completes instantly — the
 * client's existing polling sees 'ready' on its first poll.
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

  await repos.profiles.upsertByUid(uid, {
    avatarKey: profile.photoKeys[0],
    avatarStatus: "ready",
    avatarError: null,
  });

  return { ok: true };
}
