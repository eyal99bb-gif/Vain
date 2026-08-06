// Central image handling: real format detection, normalization, and
// downscaling. Every byte that reaches Gemini goes through here — model
// input is billed by pixels, so this is a direct cost control as well as
// the trust boundary for user uploads.
import sharp from "sharp";

export type ImageFormat = "jpeg" | "png" | "webp" | "heic" | "unknown";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Long edge sent to Gemini. Bigger buys no visible quality, only tokens. */
const MAX_EDGE = 1024;

/**
 * Detect the real format from magic bytes. Never trust the client's
 * Content-Type — it is attacker-controlled and decides how we later serve
 * the bytes back.
 */
export function detectFormat(buf: Buffer): ImageFormat {
  if (buf.length < 12) return "unknown";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  // ISO-BMFF container: ....ftyp<brand>
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return "heic";
  }
  return "unknown";
}

export interface NormalizedImage {
  data: Buffer;
  mimeType: string;
  ext: string;
}

/**
 * Validate, strip metadata (EXIF can carry GPS coordinates of where a body
 * photo was taken), downscale, and re-encode to JPEG. Throws a Hebrew-safe
 * error key when the bytes are not a supported image.
 */
export async function normalizeImage(
  input: Buffer,
  maxEdge = MAX_EDGE
): Promise<NormalizedImage> {
  const format = detectFormat(input);
  if (format === "unknown") throw new Error("unsupported_image");

  const data = await sharp(input, { failOn: "error" })
    .rotate() // honour EXIF orientation before it is stripped
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return { data, mimeType: "image/jpeg", ext: ".jpg" };
}

/** Extension for a stored object, derived from verified bytes. */
export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};
