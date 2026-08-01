// Postgres-backed repos via Drizzle (active when DATABASE_URL is set).
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { midaEnv } from "../../env";
import type {
  AvatarStatus,
  FitPreference,
  GarmentType,
  NormalizedSizeChart,
  Product,
  Profile,
  SizeChartSource,
  SizeRecommendation,
  TryOn,
  TryOnStatus,
} from "../../types";
import { midaProducts, midaProfiles, midaTryons } from "./schema";
import type { Repos } from "./types";

const GLOBAL_KEY = "__midaDrizzle";

type Db = ReturnType<typeof drizzle>;
type GlobalWithDb = typeof globalThis & {
  [GLOBAL_KEY]?: { db: Db; ready: Promise<void> };
};

// Idempotent DDL matching schema.ts, applied on first use so deployments
// (e.g. Vercel + Neon) work without a manual `drizzle-kit push` step.
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
  status text NOT NULL DEFAULT 'pending',
  product_image_index integer NOT NULL DEFAULT 0,
  result_key text,
  error text,
  size_rec jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

async function getDb(): Promise<Db> {
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    const client = postgres(midaEnv.DATABASE_URL!, { max: 5 });
    const db = drizzle(client);
    g[GLOBAL_KEY] = { db, ready: client.unsafe(ENSURE_SCHEMA_SQL).then(() => {}) };
  }
  await g[GLOBAL_KEY].ready;
  return g[GLOBAL_KEY].db;
}

type ProfileRow = typeof midaProfiles.$inferSelect;
type ProductRow = typeof midaProducts.$inferSelect;
type TryOnRow = typeof midaTryons.$inferSelect;

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    uid: row.uid,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    chestCm: row.chestCm,
    waistCm: row.waistCm,
    hipsCm: row.hipsCm,
    inseamCm: row.inseamCm,
    shouldersCm: row.shouldersCm,
    fitPreference: row.fitPreference as FitPreference,
    photoKeys: (row.photoKeys as string[]) ?? [],
    avatarKey: row.avatarKey,
    avatarStatus: row.avatarStatus as AvatarStatus,
    avatarError: row.avatarError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    url: row.url,
    urlHash: row.urlHash,
    store: row.store,
    title: row.title,
    price: row.price,
    currency: row.currency,
    images: (row.images as string[]) ?? [],
    colors: (row.colors as string[]) ?? [],
    garmentType: row.garmentType as GarmentType,
    sizeChart: row.sizeChart as NormalizedSizeChart | null,
    sizeChartSource: row.sizeChartSource as SizeChartSource,
    warnings: (row.warnings as string[]) ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

function toTryOn(row: TryOnRow): TryOn {
  return {
    id: row.id,
    profileId: row.profileId,
    productId: row.productId,
    status: row.status as TryOnStatus,
    productImageIndex: row.productImageIndex,
    resultKey: row.resultKey,
    error: row.error,
    sizeRec: row.sizeRec as SizeRecommendation | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createDrizzleRepos(): Repos {
  const dbPromise = () => getDb();
  return {
    profiles: {
      async getByUid(uid) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaProfiles)
          .where(eq(midaProfiles.uid, uid))
          .limit(1);
        return rows[0] ? toProfile(rows[0]) : null;
      },
      async getById(id) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaProfiles)
          .where(eq(midaProfiles.id, id))
          .limit(1);
        return rows[0] ? toProfile(rows[0]) : null;
      },
      async upsertByUid(uid, patch) {
        const values = { uid, ...patch, updatedAt: new Date() };
        const db = await dbPromise();
        const rows = await db
          .insert(midaProfiles)
          .values(values)
          .onConflictDoUpdate({ target: midaProfiles.uid, set: values })
          .returning();
        return toProfile(rows[0]);
      },
    },
    products: {
      async getByUrlHash(urlHash) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaProducts)
          .where(eq(midaProducts.urlHash, urlHash))
          .limit(1);
        return rows[0] ? toProduct(rows[0]) : null;
      },
      async getById(id) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaProducts)
          .where(eq(midaProducts.id, id))
          .limit(1);
        return rows[0] ? toProduct(rows[0]) : null;
      },
      async create(product) {
        const db = await dbPromise();
        const rows = await db.insert(midaProducts).values(product).returning();
        return toProduct(rows[0]);
      },
    },
    tryons: {
      async getById(id) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaTryons)
          .where(eq(midaTryons.id, id))
          .limit(1);
        return rows[0] ? toTryOn(rows[0]) : null;
      },
      async create(tryon) {
        const db = await dbPromise();
        const rows = await db.insert(midaTryons).values(tryon).returning();
        return toTryOn(rows[0]);
      },
      async update(id, patch) {
        const db = await dbPromise();
        const rows = await db
          .update(midaTryons)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(midaTryons.id, id))
          .returning();
        return rows[0] ? toTryOn(rows[0]) : null;
      },
    },
  };
}
