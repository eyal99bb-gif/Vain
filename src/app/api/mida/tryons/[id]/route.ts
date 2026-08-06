import { getRepos } from "@/lib/mida/adapters/db";
import { readUid } from "@/lib/mida/uid";
import { toTryOnView } from "@/lib/mida/services/tryon";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/mida/tryons/[id]">
) {
  const { id } = await ctx.params;
  const uid = await readUid();
  if (!uid) return Response.json({ error: "not_found" }, { status: 404 });

  const repos = await getRepos();
  const tryon = await repos.tryons.getById(id);
  if (!tryon) return Response.json({ error: "not_found" }, { status: 404 });

  // Ownership check: the try-on's profile must belong to this uid.
  const profile = await repos.profiles.getById(tryon.profileId);
  if (!profile || profile.uid !== uid) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ tryon: await toTryOnView(tryon) });
}
