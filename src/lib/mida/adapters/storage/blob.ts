// Vercel Blob storage, active when BLOB_READ_WRITE_TOKEN is set (the token
// Vercel injects after creating a Blob store in the dashboard). Canonical
// keys are the blobs' public URLs, so url() and get() work from any instance.
import { put } from "@vercel/blob";
import type { StorageAdapter } from "./types";

export function createBlobStorage(): StorageAdapter {
  return {
    async put(key, data, contentType) {
      const blob = await put(key, data, {
        access: "public",
        contentType,
        addRandomSuffix: true,
      });
      return blob.url;
    },
    async get(key) {
      try {
        const res = await fetch(key, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return null;
        return {
          data: Buffer.from(await res.arrayBuffer()),
          contentType:
            res.headers.get("content-type") ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
    url(key) {
      return key;
    },
  };
}
