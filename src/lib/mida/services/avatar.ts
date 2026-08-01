import { getRepos } from "../adapters/db";
import { getActiveProfile } from "./profile";

/**
 * "Avatar" is the profile's own first uploaded photo, untouched. Try-ons
 * dress the garment directly onto the original photo, so nothing about the
 * person or scene is regenerated. No AI call — completes instantly, and the
 * client's existing polling sees 'ready' on its first poll.
 */
export async function startAvatarGeneration(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const repos = await getRepos();
  const profile = await getActiveProfile();

  if (!profile) return { ok: false, error: "no_profile" };
  if (profile.photoKeys.length === 0) return { ok: false, error: "no_photos" };
  if (!profile.heightCm || !profile.weightKg) {
    return { ok: false, error: "no_measurements" };
  }

  await repos.profiles.updateById(profile.id, {
    avatarKey: profile.photoKeys[0],
    avatarStatus: "ready",
    avatarError: null,
  });

  return { ok: true };
}
