import { z } from "zod";
import { ensureUid, readUid } from "@/lib/mida/uid";
import {
  getProfile,
  toView,
  upsertMeasurements,
} from "@/lib/mida/services/profile";

export async function GET() {
  const uid = await readUid();
  if (!uid) return Response.json({ profile: null });
  const profile = await getProfile(uid);
  return Response.json({ profile: profile ? await toView(profile) : null });
}

const measurementsSchema = z.object({
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(25).max(300),
  chestCm: z.number().min(50).max(200).nullish(),
  waistCm: z.number().min(40).max(200).nullish(),
  hipsCm: z.number().min(50).max(200).nullish(),
  inseamCm: z.number().min(40).max(120).nullish(),
  shouldersCm: z.number().min(25).max(80).nullish(),
  fitPreference: z.enum(["slim", "regular", "loose"]).optional(),
});

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = measurementsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const uid = await ensureUid();
  const profile = await upsertMeasurements(uid, parsed.data);
  return Response.json({ profile: await toView(profile) });
}
