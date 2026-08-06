import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { midaEnv } from "./env";

const COOKIE_NAME = "mida_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function sign(uid: string): string {
  return createHmac("sha256", midaEnv.MIDA_SECRET)
    .update(uid)
    .digest("base64url");
}

/**
 * Storage keys and image URLs embed the uid (/api/files/<uid>/...), so a
 * leaked URL exposes it. Signing the cookie means a bare uid can't be pasted
 * back as a session — the attacker would also need the server secret.
 */
function verify(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const uid = value.slice(0, dot);
  const provided = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(uid));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? uid : null;
}

/**
 * Read the anonymous user id. Only a validly signed cookie counts: an
 * unsigned value is indistinguishable from a uid an attacker lifted out of
 * an image URL, so accepting one would reopen the takeover this closes.
 * Sessions predating signing are simply treated as new users.
 */
export async function readUid(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  return raw ? verify(raw) : null;
}

/**
 * Read-or-mint the anonymous user id, always leaving a signed cookie behind.
 * Setting cookies is only allowed in Route Handlers / Server Functions — call
 * this from mutating handlers only. This is the auth seam: replace uid with a
 * real user id when auth lands.
 */
export async function ensureUid(): Promise<string> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;

  const existing = raw ? verify(raw) : null;
  const uid = existing ?? randomUUID();

  if (!existing) {
    store.set(COOKIE_NAME, `${uid}.${sign(uid)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }
  return uid;
}
