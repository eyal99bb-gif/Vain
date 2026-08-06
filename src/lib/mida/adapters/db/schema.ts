import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

export const midaProfiles = pgTable("mida_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  uid: text("uid").notNull(),
  name: text("name").notNull().default("הפרופיל שלי"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  chestCm: real("chest_cm"),
  waistCm: real("waist_cm"),
  hipsCm: real("hips_cm"),
  inseamCm: real("inseam_cm"),
  shouldersCm: real("shoulders_cm"),
  fitPreference: text("fit_preference").notNull().default("regular"),
  photoKeys: jsonb("photo_keys").notNull().default([]),
  avatarKey: text("avatar_key"),
  avatarStatus: text("avatar_status").notNull().default("none"),
  avatarError: text("avatar_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const midaProducts = pgTable("mida_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  urlHash: text("url_hash").notNull().unique(),
  store: text("store").notNull(),
  title: text("title").notNull(),
  price: real("price"),
  currency: text("currency"),
  images: jsonb("images").notNull().default([]),
  colors: jsonb("colors").notNull().default([]),
  garmentType: text("garment_type").notNull().default("unknown"),
  sizeChart: jsonb("size_chart"),
  sizeChartSource: text("size_chart_source").notNull().default("none"),
  warnings: jsonb("warnings").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const midaTryons = pgTable("mida_tryons", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => midaProfiles.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => midaProducts.id),
  productIds: jsonb("product_ids").notNull().default([]),
  status: text("status").notNull().default("pending"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  processingStartedAt: timestamp("processing_started_at", {
    withTimezone: true,
  }),
  productImageIndex: integer("product_image_index").notNull().default(0),
  resultKey: text("result_key"),
  error: text("error"),
  sizeRec: jsonb("size_rec"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const midaFiles = pgTable("mida_files", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  data: customType<{ data: Buffer }>({ dataType: () => "bytea" })("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const midaSizeFeedback = pgTable("mida_size_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => midaProfiles.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => midaProducts.id, {
    onDelete: "set null",
  }),
  tryonId: uuid("tryon_id"),
  garmentType: text("garment_type").notNull().default("unknown"),
  recommended: text("recommended").notNull(),
  verdict: text("verdict").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
