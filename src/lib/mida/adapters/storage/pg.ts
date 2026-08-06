// Postgres-backed object storage (active when a database is configured but no
// Blob/S3 credentials are). Stores bytes in the mida_files table and serves
// them via /api/files/[...key]. Lets a Vercel deploy run on a single service
// (Neon Postgres) with no separate object store.
import { getSql } from "../db/client";
import type { StorageAdapter } from "./types";

export function createPgStorage(): StorageAdapter {
  return {
    async put(key, data, contentType) {
      const sql = await getSql();
      await sql`
        INSERT INTO mida_files (key, content_type, data)
        VALUES (${key}, ${contentType}, ${data})
        ON CONFLICT (key) DO UPDATE
          SET content_type = EXCLUDED.content_type, data = EXCLUDED.data
      `;
      return key;
    },
    async get(key) {
      const sql = await getSql();
      const rows = await sql<{ content_type: string; data: Buffer }[]>`
        SELECT content_type, data FROM mida_files WHERE key = ${key} LIMIT 1
      `;
      if (rows.length === 0) return null;
      return { data: Buffer.from(rows[0].data), contentType: rows[0].content_type };
    },
    url(key) {
      return `/api/files/${key}`;
    },
  };
}
