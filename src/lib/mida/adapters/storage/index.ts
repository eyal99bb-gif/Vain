import { midaEnv } from "../../env";
import type { StorageAdapter } from "./types";

let storage: StorageAdapter | null = null;

export async function getStorage(): Promise<StorageAdapter> {
  if (!storage) {
    if (midaEnv.storageMode === "blob") {
      const { createBlobStorage } = await import("./blob");
      storage = createBlobStorage();
    } else if (midaEnv.storageMode === "s3") {
      const { createS3Storage } = await import("./s3");
      storage = createS3Storage();
    } else if (midaEnv.storageMode === "pg") {
      const { createPgStorage } = await import("./pg");
      storage = createPgStorage();
    } else {
      const { createLocalStorage } = await import("./local");
      storage = createLocalStorage();
    }
  }
  return storage;
}

export type { StorageAdapter } from "./types";
