// JSON-file-backed repos for demo mode (no DATABASE_URL). The whole store
// lives in memory and is written through to disk atomically on every change.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { midaEnv } from "../../env";
import type { Product, Profile, TryOn } from "../../types";
import type { SizeFeedback } from "./types";
import type { Repos } from "./types";

interface FileStore {
  profiles: Profile[];
  products: Product[];
  tryons: TryOn[];
  feedback: SizeFeedback[];
}

// Stashed on globalThis so the store survives Turbopack HMR module
// re-evaluation in dev — otherwise every edit silently drops all data.
const GLOBAL_KEY = "__midaFileStore";

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_KEY]?: FileStore;
};

function storePath(): string {
  return path.join(process.cwd(), midaEnv.MIDA_DATA_DIR, "mida-db.json");
}

function loadStore(): FileStore {
  const g = globalThis as GlobalWithStore;
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY];

  let store: FileStore = { profiles: [], products: [], tryons: [], feedback: [] };
  const file = storePath();
  if (existsSync(file)) {
    try {
      store = { ...store, ...JSON.parse(readFileSync(file, "utf8")) };
    } catch {
      // Corrupt store: start fresh rather than crash the demo.
    }
  }
  g[GLOBAL_KEY] = store;
  return store;
}

function persist(store: FileStore): void {
  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  renameSync(tmp, file);
}

const now = () => new Date().toISOString();

export function createFileRepos(): Repos {
  return {
    profiles: {
      async listByUid(uid) {
        return loadStore()
          .profiles.filter((p) => p.uid === uid)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      },
      async getById(id) {
        return loadStore().profiles.find((p) => p.id === id) ?? null;
      },
      async create(uid, patch) {
        const store = loadStore();
        const profile: Profile = {
          id: crypto.randomUUID(),
          uid,
          name: "הפרופיל שלי",
          heightCm: null,
          weightKg: null,
          chestCm: null,
          waistCm: null,
          hipsCm: null,
          inseamCm: null,
          shouldersCm: null,
          fitPreference: "regular",
          photoKeys: [],
          avatarKey: null,
          avatarStatus: "none",
          avatarError: null,
          ...patch,
          createdAt: now(),
          updatedAt: now(),
        };
        store.profiles.push(profile);
        persist(store);
        return profile;
      },
      async updateById(id, patch) {
        const store = loadStore();
        const profile = store.profiles.find((p) => p.id === id);
        if (!profile) return null;
        Object.assign(profile, patch, { updatedAt: now() });
        persist(store);
        return profile;
      },
      async deleteById(id) {
        const store = loadStore();
        store.profiles = store.profiles.filter((p) => p.id !== id);
        store.tryons = store.tryons.filter((t) => t.profileId !== id);
        store.feedback = store.feedback.filter((f) => f.profileId !== id);
        persist(store);
      },
    },
    products: {
      async getByUrlHash(urlHash) {
        return loadStore().products.find((p) => p.urlHash === urlHash) ?? null;
      },
      async getById(id) {
        return loadStore().products.find((p) => p.id === id) ?? null;
      },
      async create(product) {
        const store = loadStore();
        const created: Product = {
          ...product,
          id: crypto.randomUUID(),
          createdAt: now(),
        };
        store.products.push(created);
        persist(store);
        return created;
      },
      async update(id, patch) {
        const store = loadStore();
        const product = store.products.find((p) => p.id === id);
        if (!product) return null;
        Object.assign(product, patch);
        persist(store);
        return product;
      },
    },
    tryons: {
      async getById(id) {
        return loadStore().tryons.find((t) => t.id === id) ?? null;
      },
      async listByProfile(profileId, limit) {
        return loadStore()
          .tryons.filter((t) => t.profileId === profileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit);
      },
      async create(tryon) {
        const store = loadStore();
        const created: TryOn = {
          ...tryon,
          id: crypto.randomUUID(),
          createdAt: now(),
          updatedAt: now(),
        };
        store.tryons.push(created);
        persist(store);
        return created;
      },
      async update(id, patch) {
        const store = loadStore();
        const tryon = store.tryons.find((t) => t.id === id);
        if (!tryon) return null;
        Object.assign(tryon, patch, { updatedAt: now() });
        persist(store);
        return tryon;
      },
      async deleteById(id) {
        const store = loadStore();
        store.tryons = store.tryons.filter((t) => t.id !== id);
        persist(store);
      },
    },
    feedback: {
      async listByProfile(profileId) {
        return loadStore()
          .feedback.filter((f) => f.profileId === profileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async create(feedback) {
        const store = loadStore();
        const created: SizeFeedback = {
          ...feedback,
          id: crypto.randomUUID(),
          createdAt: now(),
        };
        store.feedback.push(created);
        persist(store);
        return created;
      },
    },
  };
}
