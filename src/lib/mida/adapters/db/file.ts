// JSON-file-backed repos for demo mode (no DATABASE_URL). The whole store
// lives in memory and is written through to disk atomically on every change.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { midaEnv } from "../../env";
import type { Product, Profile, TryOn } from "../../types";
import type { Repos } from "./types";

interface FileStore {
  profiles: Profile[];
  products: Product[];
  tryons: TryOn[];
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

  let store: FileStore = { profiles: [], products: [], tryons: [] };
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
      async getByUid(uid) {
        return loadStore().profiles.find((p) => p.uid === uid) ?? null;
      },
      async getById(id) {
        return loadStore().profiles.find((p) => p.id === id) ?? null;
      },
      async upsertByUid(uid, patch) {
        const store = loadStore();
        let profile = store.profiles.find((p) => p.uid === uid);
        if (profile) {
          Object.assign(profile, patch, { updatedAt: now() });
        } else {
          profile = {
            id: crypto.randomUUID(),
            uid,
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
        }
        persist(store);
        return profile;
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
    },
    tryons: {
      async getById(id) {
        return loadStore().tryons.find((t) => t.id === id) ?? null;
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
    },
  };
}
