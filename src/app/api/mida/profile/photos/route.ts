import { ensureUid } from "@/lib/mida/uid";
import { addPhotos } from "@/lib/mida/services/profile";
import { MAX_UPLOAD_BYTES, normalizeImage } from "@/lib/mida/images";
import { logError } from "@/lib/mida/log";

// Photos are normalized with sharp, which is worth a longer budget.
export const maxDuration = 60;

const MAX_FILES = 3;

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
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "file_too_large" }, { status: 400 });
    }
    try {
      // Validated by magic bytes, EXIF stripped (body photos can carry GPS),
      // and downscaled before anything is stored or sent to the model.
      photos.push(await normalizeImage(Buffer.from(await file.arrayBuffer())));
    } catch {
      return Response.json({ error: "unsupported_image" }, { status: 400 });
    }
  }

  const uid = await ensureUid();
  try {
    const photoKeys = await addPhotos(uid, photos);
    return Response.json({ photoKeys });
  } catch (err) {
    const errorId = logError("profile.photos", err, { uid });
    return Response.json({ error: "upload_failed", errorId }, { status: 500 });
  }
}
