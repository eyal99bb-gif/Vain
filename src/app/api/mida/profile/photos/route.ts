import { ensureUid } from "@/lib/mida/uid";
import { addPhotos } from "@/lib/mida/services/profile";

const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File);

  if (files.length === 0 || files.length > MAX_FILES) {
    return Response.json({ error: "expected_1_to_3_photos" }, { status: 400 });
  }

  const photos = [];
  for (const file of files) {
    const ext = ALLOWED[file.type];
    if (!ext) {
      return Response.json(
        { error: "unsupported_type", type: file.type },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "file_too_large" }, { status: 400 });
    }
    photos.push({
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      ext,
    });
  }

  const uid = await ensureUid();
  const photoKeys = await addPhotos(uid, photos);
  return Response.json({ photoKeys });
}
