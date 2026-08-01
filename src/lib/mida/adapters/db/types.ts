import type { Product, Profile, TryOn } from "../../types";

export interface ProfileRepo {
  getByUid(uid: string): Promise<Profile | null>;
  getById(id: string): Promise<Profile | null>;
  upsertByUid(
    uid: string,
    patch: Partial<Omit<Profile, "id" | "uid" | "createdAt" | "updatedAt">>
  ): Promise<Profile>;
}

export interface ProductRepo {
  getByUrlHash(urlHash: string): Promise<Product | null>;
  getById(id: string): Promise<Product | null>;
  create(product: Omit<Product, "id" | "createdAt">): Promise<Product>;
}

export interface TryOnRepo {
  getById(id: string): Promise<TryOn | null>;
  create(
    tryon: Omit<TryOn, "id" | "createdAt" | "updatedAt">
  ): Promise<TryOn>;
  update(
    id: string,
    patch: Partial<Omit<TryOn, "id" | "createdAt" | "updatedAt">>
  ): Promise<TryOn | null>;
}

export interface Repos {
  profiles: ProfileRepo;
  products: ProductRepo;
  tryons: TryOnRepo;
}
