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
import {
  midaProducts,
  midaProfiles,
  midaSizeFeedback,
  midaTryons,
} from "./schema";
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
    isFavorite: row.isFavorite,
    processingStartedAt: row.processingStartedAt?.toISOString() ?? null,
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
      async deleteById(id) {
        const db = await dbPromise();
        // Try-ons and feedback cascade (see ENSURE_SCHEMA_SQL).
        await db.delete(midaProfiles).where(eq(midaProfiles.id, id));
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
        const { processingStartedAt, ...rest } = tryon;
        const rows = await db
          .insert(midaTryons)
          .values({
            ...rest,
            processingStartedAt: processingStartedAt
              ? new Date(processingStartedAt)
              : null,
          })
          .returning();
        return toTryOn(rows[0]);
      },
      async update(id, patch) {
        const db = await dbPromise();
        const { processingStartedAt, ...rest } = patch;
        const rows = await db
          .update(midaTryons)
          .set({
            ...rest,
            ...(processingStartedAt !== undefined
              ? {
                  processingStartedAt: processingStartedAt
                    ? new Date(processingStartedAt)
                    : null,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(midaTryons.id, id))
          .returning();
        return rows[0] ? toTryOn(rows[0]) : null;
      },
      async deleteById(id) {
        const db = await dbPromise();
        await db.delete(midaTryons).where(eq(midaTryons.id, id));
      },
    },
    feedback: {
      async listByProfile(profileId) {
        const db = await dbPromise();
        const rows = await db
          .select()
          .from(midaSizeFeedback)
          .where(eq(midaSizeFeedback.profileId, profileId))
          .orderBy(desc(midaSizeFeedback.createdAt));
        return rows.map((row) => ({
          id: row.id,
          profileId: row.profileId,
          productId: row.productId,
          tryonId: row.tryonId,
          garmentType: row.garmentType,
          recommended: row.recommended,
          verdict: row.verdict as "fit" | "small" | "large",
          createdAt: row.createdAt.toISOString(),
        }));
      },
      async create(feedback) {
        const db = await dbPromise();
        const rows = await db
          .insert(midaSizeFeedback)
          .values(feedback)
          .returning();
        return {
          id: rows[0].id,
          profileId: rows[0].profileId,
          productId: rows[0].productId,
          tryonId: rows[0].tryonId,
          garmentType: rows[0].garmentType,
          recommended: rows[0].recommended,
          verdict: rows[0].verdict as "fit" | "small" | "large",
          createdAt: rows[0].createdAt.toISOString(),
        };
      },
    },
  };
}
