import type { Product, Profile, TryOn } from "../../types";

export type ProfilePatch = Partial<
  Omit<Profile, "id" | "uid" | "createdAt" | "updatedAt">
>;

export interface ProfileRepo {
  listByUid(uid: string): Promise<Profile[]>;
  getById(id: string): Promise<Profile | null>;
  create(uid: string, patch: ProfilePatch): Promise<Profile>;
  updateById(id: string, patch: ProfilePatch): Promise<Profile | null>;
}

export interface ProductRepo {
  getByUrlHash(urlHash: string): Promise<Product | null>;
  getById(id: string): Promise<Product | null>;
  create(product: Omit<Product, "id" | "createdAt">): Promise<Product>;
  update(
    id: string,
    patch: Partial<Omit<Product, "id" | "urlHash" | "createdAt">>
  ): Promise<Product | null>;
}

export interface TryOnRepo {
  getById(id: string): Promise<TryOn | null>;
  listByProfile(profileId: string, limit: number): Promise<TryOn[]>;
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
