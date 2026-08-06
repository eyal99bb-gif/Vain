import { createHash } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_IMAGE_MODEL: z.string().default("gemini-2.5-flash-image"),
  GEMINI_TEXT_MODEL: z.string().default("gemini-flash-latest"),
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_URL: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_PUBLIC_URL: z.string().min(1).optional(),
  MIDA_DATA_DIR: z.string().default(".data"),
  /** Signs the anonymous identity cookie. */
  MIDA_SECRET: z.string().min(1).optional(),
  /** Paid Gemini image generations allowed per user per day. */
  MIDA_DAILY_TRYON_LIMIT: z.coerce.number().int().min(1).default(10),
  /** Product ingests (Gemini text calls) allowed per user per day. */
  MIDA_DAILY_INGEST_LIMIT: z.coerce.number().int().min(1).default(40),
  /** Dev-only: allow fetching private addresses (local test stores). */
  MIDA_ALLOW_PRIVATE_URLS: z.coerce.boolean().default(false),
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

/**
 * Cookie-signing secret. Explicit MIDA_SECRET is preferred; without it we
 * derive a stable per-deployment secret from the database URL so sessions
 * survive restarts. Local dev with no database falls back to a constant —
 * fine there, and production always has one of the two.
 */
const secret =
  parsed.MIDA_SECRET ??
  (databaseUrl
    ? createHash("sha256").update(`mida:${databaseUrl}`).digest("hex")
    : "mida-development-secret");

export const midaEnv = Object.freeze({
  ...parsed,
  // Can never be switched on in production, whatever the env says.
  allowPrivateUrls:
    parsed.MIDA_ALLOW_PRIVATE_URLS && process.env.NODE_ENV !== "production",
  DATABASE_URL: databaseUrl,
  MIDA_SECRET: secret,
  aiMode: (parsed.GEMINI_API_KEY ? "real" : "demo") as "real" | "demo",
  dbMode: (databaseUrl ? "postgres" : "file") as "postgres" | "file",
  storageMode: (hasS3 ? "s3" : databaseUrl ? "pg" : "local") as
    | "s3"
    | "pg"
    | "local",
});

export type MidaEnv = typeof midaEnv;
