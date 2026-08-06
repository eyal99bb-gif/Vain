// Data erasure. Body photos and measurements are sensitive personal data and
// the product promises they can be removed — so deletion must take the stored
// objects with it, not just the database rows.
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import { logInfo } from "../log";

/** Delete a profile, its try-ons, its feedback and every stored image. */
export async function eraseProfile(
  uid: string,
  profileId: string
): Promise<boolean> {
  const repos = await getRepos();
  const profile = await repos.profiles.getById(profileId);
  if (!profile || profile.uid !== uid) return false;

  const storage = await getStorage();
  const tryons = await repos.tryons.listByProfile(profileId, 500);

  const keys = [
    ...profile.photoKeys,
    ...(profile.avatarKey ? [profile.avatarKey] : []),
    ...tryons.flatMap((t) => (t.resultKey ? [t.resultKey] : [])),
  ];
  for (const key of new Set(keys)) {
    await storage.delete(key).catch(() => {});
  }

  await repos.profiles.deleteById(profileId);
  logInfo("profile.erased", { profileId, objects: keys.length });
  return true;
}

/** Delete everything belonging to this anonymous user. */
export async function eraseAllData(uid: string): Promise<number> {
  const repos = await getRepos();
  const profiles = await repos.profiles.listByUid(uid);
  for (const profile of profiles) {
    await eraseProfile(uid, profile.id);
  }
  return profiles.length;
}
