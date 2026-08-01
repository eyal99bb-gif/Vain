// Serves stored objects in local-storage mode (and for private S3 buckets
// without a public URL). Keys are namespaced by uid, which is unguessable.
import { getStorage } from "@/lib/mida/adapters/storage";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/files/[...key]">
) {
  const { key } = await ctx.params;
  const storage = await getStorage();

  let object: Awaited<ReturnType<typeof storage.get>>;
  try {
    object = await storage.get(key.join("/"));
  } catch {
    object = null;
  }
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(object.data), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
