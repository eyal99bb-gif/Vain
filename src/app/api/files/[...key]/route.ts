// Serves stored objects. Keys are namespaced `<uid>/<kind>/<file>`, and the
// requester must own that namespace — the uid appears in image URLs, so
// without this check a leaked link would expose someone's body photos.
import { getStorage } from "@/lib/mida/adapters/storage";
import { readUid } from "@/lib/mida/uid";

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/files/[...key]">
) {
  const { key } = await ctx.params;
  const uid = await readUid();
  if (!uid || key[0] !== uid) return notFound();

  const storage = await getStorage();
  let object: Awaited<ReturnType<typeof storage.get>>;
  try {
    object = await storage.get(key.join("/"));
  } catch {
    object = null;
  }
  if (!object) return notFound();

  // Never serve SVG from our own origin — it executes script.
  const contentType = object.contentType.includes("svg")
    ? "application/octet-stream"
    : object.contentType;

  return new Response(new Uint8Array(object.data), {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
