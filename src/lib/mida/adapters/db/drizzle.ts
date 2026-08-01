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
type GlobalWithDb = typeof globalThis & { [GLOBAL_KEY]?: Db };

function getDb(): Db {
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    const client = postgres(midaEnv.DATABASE_URL!, { max: 5 });
    g[GLOBAL_KEY] = drizzle(client);
  }
  return g[GLOBAL_KEY];
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
  const db = getDb();
  return {
    profiles: {
      async getByUid(uid) {
        const rows = await db
          .select()
          .from(midaProfiles)
          .where(eq(midaProfiles.uid, uid))
          .limit(1);
        return rows[0] ? toProfile(rows[0]) : null;
      },
      async getById(id) {
        const rows = await db
          .select()
          .from(midaProfiles)
          .where(eq(midaProfiles.id, id))
          .limit(1);
        return rows[0] ? toProfile(rows[0]) : null;
      },
      async upsertByUid(uid, patch) {
        const values = { uid, ...patch, updatedAt: new Date() };
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
        const rows = await db
          .select()
          .from(midaProducts)
          .where(eq(midaProducts.urlHash, urlHash))
          .limit(1);
        return rows[0] ? toProduct(rows[0]) : null;
      },
      async getById(id) {
        const rows = await db
          .select()
          .from(midaProducts)
          .where(eq(midaProducts.id, id))
          .limit(1);
        return rows[0] ? toProduct(rows[0]) : null;
      },
      async create(product) {
        const rows = await db.insert(midaProducts).values(product).returning();
        return toProduct(rows[0]);
      },
    },
    tryons: {
      async getById(id) {
        const rows = await db
          .select()
          .from(midaTryons)
          .where(eq(midaTryons.id, id))
          .limit(1);
        return rows[0] ? toTryOn(rows[0]) : null;
      },
      async create(tryon) {
        const rows = await db.insert(midaTryons).values(tryon).returning();
        return toTryOn(rows[0]);
      },
      async update(id, patch) {
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
