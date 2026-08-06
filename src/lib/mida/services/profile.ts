import { cookies } from "next/headers";
import { getRepos } from "../adapters/db";
import { getStorage } from "../adapters/storage";
import { readUid } from "../uid";
import type { FitPreference, Profile } from "../types";

const ACTIVE_COOKIE = "mida_pid";
const ONE_YEAR = 60 * 60 * 24 * 365;

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

export async function listProfiles(uid: string): Promise<Profile[]> {
  const repos = await getRepos();
  return repos.profiles.listByUid(uid);
}

/**
 * The profile the user is currently acting as: the one selected via the
 * mida_pid cookie (when it belongs to this uid), else the oldest profile.
 */
export async function getActiveProfile(): Promise<Profile | null> {
  const uid = await readUid();
  if (!uid) return null;
  const repos = await getRepos();

  const pid = (await cookies()).get(ACTIVE_COOKIE)?.value;
  if (pid) {
    const profile = await repos.profiles.getById(pid);
    if (profile && profile.uid === uid) return profile;
  }
  const all = await repos.profiles.listByUid(uid);
  return all[0] ?? null;
}

/** Handlers only (cookie write). Verifies the profile belongs to this uid. */
export async function selectProfile(
  uid: string,
  profileId: string
): Promise<Profile | null> {
  const repos = await getRepos();
  const profile = await repos.profiles.getById(profileId);
  if (!profile || profile.uid !== uid) return null;
  (await cookies()).set(ACTIVE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return profile;
}

/** Create a new named profile and make it active. Handlers only. */
export async function createProfile(
  uid: string,
  name: string
): Promise<Profile> {
  const repos = await getRepos();
  const profile = await repos.profiles.create(uid, { name });
  await selectProfile(uid, profile.id);
  return profile;
}

export interface MeasurementsInput {
  name?: string;
  heightCm: number;
  weightKg: number;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  inseamCm?: number | null;
  shouldersCm?: number | null;
  fitPreference?: FitPreference;
}

/** Update the active profile's measurements (creating one on first use). */
export async function upsertMeasurements(
  uid: string,
  input: MeasurementsInput
): Promise<Profile> {
  const repos = await getRepos();
  const active = await getActiveProfile();

  const patch = {
    ...(input.name ? { name: input.name } : {}),
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    chestCm: input.chestCm ?? null,
    waistCm: input.waistCm ?? null,
    hipsCm: input.hipsCm ?? null,
    inseamCm: input.inseamCm ?? null,
    shouldersCm: input.shouldersCm ?? null,
    fitPreference: input.fitPreference ?? "regular",
  };

  if (active) {
    return (await repos.profiles.updateById(active.id, patch)) ?? active;
  }
  const created = await repos.profiles.create(uid, patch);
  await selectProfile(uid, created.id);
  return created;
}

export async function addPhotos(
  uid: string,
  photos: { data: Buffer; mimeType: string; ext: string }[]
): Promise<string[]> {
  const repos = await getRepos();
  const storage = await getStorage();

  const keys: string[] = [];
  for (const photo of photos) {
    const suggested = `${uid}/photos/${crypto.randomUUID()}${photo.ext}`;
    keys.push(await storage.put(suggested, photo.data, photo.mimeType));
  }

  let active = await getActiveProfile();
  if (!active) {
    active = await repos.profiles.create(uid, {});
    await selectProfile(uid, active.id);
  }
  // New photos replace the previous set; the first photo is the try-on base.
  await repos.profiles.updateById(active.id, {
    photoKeys: keys.slice(0, 3),
    avatarKey: keys[0] ?? null,
    avatarStatus: keys.length > 0 ? "ready" : "none",
  });
  return keys;
}
