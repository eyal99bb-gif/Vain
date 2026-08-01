// Postgres-backed repos via Drizzle (active when DATABASE_URL is set).
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq } from "drizzle-orm";
import { getSql } from "./client";
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

async function getDb(): Promise<ReturnType<typeof drizzle>> {
  // getSql() ensures the schema (including mida_files) before first query.
  return drizzle(await getSql());
}

type ProfileRow = typeof midaProfiles.$inferSelect;
type ProductRow = typeof midaProducts.$inferSelect;
type TryOnRow = typeof midaTryons.$inferSelect;

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
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
    productIds: (row.productIds as string[]) ?? [row.productId],
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
      async listByUid(uid) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaProfiles)
          .where(eq(midaProfiles.uid, uid))
          .orderBy(midaProfiles.createdAt);
        return rows.map(toProfile);
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
      async create(uid, patch) {
        const db = await dbPromise();
        const rows = await db
          .insert(midaProfiles)
          .values({ uid, ...patch })
          .returning();
        return toProfile(rows[0]);
      },
      async updateById(id, patch) {
        const db = await dbPromise();
        const rows = await db
          .update(midaProfiles)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(midaProfiles.id, id))
          .returning();
        return rows[0] ? toProfile(rows[0]) : null;
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
      async update(id, patch) {
        const db = await dbPromise();
        const rows = await db
          .update(midaProducts)
          .set(patch)
          .where(eq(midaProducts.id, id))
          .returning();
        return rows[0] ? toProduct(rows[0]) : null;
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
      async listByProfile(profileId, limit) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaTryons)
          .where(eq(midaTryons.profileId, profileId))
          .orderBy(desc(midaTryons.createdAt))
          .limit(limit);
        return rows.map(toTryOn);
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
