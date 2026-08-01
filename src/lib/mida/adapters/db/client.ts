// Shared postgres.js client + one-time schema init, reused by both the
// Drizzle repos and the Postgres-backed storage adapter. Stashed on
// globalThis so a single pool survives Turbopack HMR and serverless reuse.
import postgres from "postgres";
import { midaEnv } from "../../env";

// Idempotent DDL matching schema.ts (+ mida_files for image storage), applied
// on first use so deployments (e.g. Vercel + Neon) work without a manual
// `drizzle-kit push` step.
const ENSURE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS mida_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid text NOT NULL UNIQUE,
  height_cm real,
  weight_kg real,
  chest_cm real,
  waist_cm real,
  hips_cm real,
  inseam_cm real,
  shoulders_cm real,
  fit_preference text NOT NULL DEFAULT 'regular',
  photo_keys jsonb NOT NULL DEFAULT '[]',
  avatar_key text,
  avatar_status text NOT NULL DEFAULT 'none',
  avatar_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mida_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  url_hash text NOT NULL UNIQUE,
  store text NOT NULL,
  title text NOT NULL,
  price real,
  currency text,
  images jsonb NOT NULL DEFAULT '[]',
  colors jsonb NOT NULL DEFAULT '[]',
  garment_type text NOT NULL DEFAULT 'unknown',
  size_chart jsonb,
  size_chart_source text NOT NULL DEFAULT 'none',
  warnings jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mida_tryons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES mida_profiles(id),
  product_id uuid NOT NULL REFERENCES mida_products(id),
  product_ids jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending',
  product_image_index integer NOT NULL DEFAULT 0,
  result_key text,
  error text,
  size_rec jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mida_files (
  key text PRIMARY KEY,
  content_type text NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mida_tryons ADD COLUMN IF NOT EXISTS product_ids jsonb NOT NULL DEFAULT '[]';
`;

const GLOBAL_KEY = "__midaPg";

type Sql = ReturnType<typeof postgres>;
type GlobalWithPg = typeof globalThis & {
  [GLOBAL_KEY]?: { sql: Sql; ready: Promise<void> };
};

function init(): { sql: Sql; ready: Promise<void> } {
  const g = globalThis as GlobalWithPg;
  if (!g[GLOBAL_KEY]) {
    const sql = postgres(midaEnv.DATABASE_URL!, { max: 5 });
    g[GLOBAL_KEY] = { sql, ready: sql.unsafe(ENSURE_SCHEMA_SQL).then(() => {}) };
  }
  return g[GLOBAL_KEY];
}

/** The raw postgres.js client, after the schema has been ensured. */
export async function getSql(): Promise<Sql> {
  const { sql, ready } = init();
  await ready;
  return sql;
}
