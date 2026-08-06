import { getActiveProfile } from "@/lib/mida/services/profile";
import { startAvatarGeneration } from "@/lib/mida/services/avatar";
import { getStorage } from "@/lib/mida/adapters/storage";

export async function GET() {
  const profile = await getActiveProfile();
  if (!profile) {
    return Response.json({ status: "none", avatarUrl: null, error: null });
  }
  const storage = await getStorage();
  return Response.json({
    status: profile.avatarStatus,
    avatarUrl: profile.avatarKey ? storage.url(profile.avatarKey) : null,
    error: profile.avatarError,
  });
}

export async function POST() {
  const result = await startAvatarGeneration();
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ status: "pending" }, { status: 202 });
}
