// S3-compatible storage (Cloudflare R2 etc.), active when S3_* env vars are set.
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { midaEnv } from "../../env";
import type { StorageAdapter } from "./types";

export function createS3Storage(): StorageAdapter {
  const client = new S3Client({
    region: "auto",
    endpoint: midaEnv.S3_ENDPOINT,
    credentials: {
      accessKeyId: midaEnv.S3_ACCESS_KEY_ID!,
      secretAccessKey: midaEnv.S3_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = midaEnv.S3_BUCKET!;

  return {
    async put(key, data, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        })
      );
    },
    async get(key) {
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        if (!res.Body) return null;
        const data = Buffer.from(await res.Body.transformToByteArray());
        return {
          data,
          contentType: res.ContentType ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
    url(key) {
      if (midaEnv.S3_PUBLIC_URL) {
        return `${midaEnv.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
      }
      // Without a public base URL, serve through the app (works for private buckets).
      return `/api/files/${key}`;
    },
  };
}
