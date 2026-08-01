import { cookies } from "next/headers";

const COOKIE_NAME = "mida_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Read the anonymous user id, if any. Safe in pages and handlers. */
export async function readUid(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Read-or-mint the anonymous user id. Setting cookies is only allowed in
 * Route Handlers / Server Functions — call this from mutating handlers only.
 * This is the auth seam: replace uid with a real user id when auth lands.
 */
export async function ensureUid(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const uid = crypto.randomUUID();
  store.set(COOKIE_NAME, uid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return uid;
}
