import { z } from "zod";
import { ensureUid } from "@/lib/mida/uid";
import {
  createProfile,
  selectProfile,
  toView,
} from "@/lib/mida/services/profile";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

/** Create a new named profile (becomes the active one). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const uid = await ensureUid();
  const profile = await createProfile(uid, parsed.data.name);
  return Response.json({ profile: await toView(profile) }, { status: 201 });
}

const selectSchema = z.object({
  profileId: z.string().min(1),
});

/** Switch the active profile. */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = selectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const uid = await ensureUid();
  const profile = await selectProfile(uid, parsed.data.profileId);
  if (!profile) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ profile: await toView(profile) });
}
