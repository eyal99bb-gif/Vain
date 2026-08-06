// Local-disk storage for demo/dev. Objects are served via /api/files/[...key].
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { midaEnv } from "../../env";
import type { StorageAdapter } from "./types";

const EXT_TO_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".svg": "image/svg+xml",
};

function baseDir(): string {
  return path.join(process.cwd(), midaEnv.MIDA_DATA_DIR, "uploads");
}

/** Resolve a key inside the uploads dir, rejecting path traversal. */
function safePath(key: string): string {
  const resolved = path.resolve(baseDir(), key);
  if (!resolved.startsWith(baseDir() + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return resolved;
}

export function createLocalStorage(): StorageAdapter {
  return {
    async put(key, data) {
      const file = safePath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
      return key;
    },
    async get(key) {
      try {
        const data = await readFile(safePath(key));
        const contentType =
          EXT_TO_TYPE[path.extname(key).toLowerCase()] ??
          "application/octet-stream";
        return { data, contentType };
      } catch {
        return null;
      }
    },
    url(key) {
      return `/api/files/${key}`;
    },
  };
}
