import { readUid } from "@/lib/mida/uid";
import { eraseProfile } from "@/lib/mida/services/erase";
import { logError } from "@/lib/mida/log";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/mida/profiles/[id]">
) {
  const { id } = await ctx.params;
  const uid = await readUid();
  if (!uid) return Response.json({ error: "not_found" }, { status: 404 });

  try {
    const erased = await eraseProfile(uid, id);
    if (!erased) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    const errorId = logError("profile.erase", err, { uid, profileId: id });
    return Response.json({ error: "delete_failed", errorId }, { status: 500 });
  }
}
