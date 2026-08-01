import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_IMAGE_MODEL: z.string().default("gemini-2.5-flash-image"),
  GEMINI_TEXT_MODEL: z.string().default("gemini-flash-latest"),
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_URL: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_PUBLIC_URL: z.string().min(1).optional(),
  MIDA_DATA_DIR: z.string().default(".data"),
});

const parsed = envSchema.parse(process.env);

const hasS3 =
  !!parsed.S3_ENDPOINT &&
  !!parsed.S3_ACCESS_KEY_ID &&
  !!parsed.S3_SECRET_ACCESS_KEY &&
  !!parsed.S3_BUCKET;

// Vercel's Neon/Postgres integrations set POSTGRES_URL; self-managed setups
// set DATABASE_URL. Either activates Postgres mode.
const databaseUrl = parsed.DATABASE_URL ?? parsed.POSTGRES_URL;

export const midaEnv = Object.freeze({
  ...parsed,
  DATABASE_URL: databaseUrl,
  aiMode: (parsed.GEMINI_API_KEY ? "real" : "demo") as "real" | "demo",
  dbMode: (databaseUrl ? "postgres" : "file") as "postgres" | "file",
  storageMode: (parsed.BLOB_READ_WRITE_TOKEN
    ? "blob"
    : hasS3
      ? "s3"
      : "local") as "blob" | "s3" | "local",
});

export type MidaEnv = typeof midaEnv;
