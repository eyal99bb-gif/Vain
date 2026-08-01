import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import type { FitPreference, Profile } from "../types";

export interface ProfileView extends Omit<Profile, "photoKeys" | "avatarKey"> {
  photoCount: number;
  avatarUrl: string | null;
}

export async function toView(profile: Profile): Promise<ProfileView> {
  const storage = await getStorage();
  const { photoKeys, avatarKey, ...rest } = profile;
  return {
    ...rest,
    photoCount: photoKeys.length,
    avatarUrl: avatarKey ? storage.url(avatarKey) : null,
  };
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const repos = await getRepos();
  return repos.profiles.getByUid(uid);
}

export interface MeasurementsInput {
  heightCm: number;
  weightKg: number;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  inseamCm?: number | null;
  shouldersCm?: number | null;
  fitPreference?: FitPreference;
}

export async function upsertMeasurements(
  uid: string,
  input: MeasurementsInput
): Promise<Profile> {
  const repos = await getRepos();
  return repos.profiles.upsertByUid(uid, {
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    chestCm: input.chestCm ?? null,
    waistCm: input.waistCm ?? null,
    hipsCm: input.hipsCm ?? null,
    inseamCm: input.inseamCm ?? null,
    shouldersCm: input.shouldersCm ?? null,
    fitPreference: input.fitPreference ?? "regular",
  });
}

export async function addPhotos(
  uid: string,
  photos: { data: Buffer; mimeType: string; ext: string }[]
): Promise<string[]> {
  const repos = await getRepos();
  const storage = await getStorage();

  const keys: string[] = [];
  for (const photo of photos) {
    const key = `${uid}/photos/${crypto.randomUUID()}${photo.ext}`;
    await storage.put(key, photo.data, photo.mimeType);
    keys.push(key);
  }

  const existing = await repos.profiles.getByUid(uid);
  await repos.profiles.upsertByUid(uid, {
    photoKeys: [...(existing?.photoKeys ?? []), ...keys].slice(-3),
  });
  return keys;
}
