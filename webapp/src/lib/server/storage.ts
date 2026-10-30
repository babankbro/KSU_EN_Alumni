import "server-only";
import { Client } from "minio";
import { randomUUID } from "node:crypto";

/**
 * MinIO (S3-compatible) object storage for photos and documents.
 *
 * The bucket is private: files are served to browsers only through
 * short-lived presigned URLs, never by a public bucket policy.
 */
const globalForMinio = globalThis as unknown as { __alumniMinio?: Client };

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — see .env.example`);
  return v;
}

export function getBucket(): string {
  return process.env.MINIO_BUCKET ?? "alumni-files";
}

export function getStorage(): Client {
  if (!globalForMinio.__alumniMinio) {
    globalForMinio.__alumniMinio = new Client({
      endPoint: required("MINIO_ENDPOINT"),
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: required("MINIO_ACCESS_KEY"),
      secretKey: required("MINIO_SECRET_KEY"),
    });
  }
  return globalForMinio.__alumniMinio;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Builds a key like `profiles/2569/10/<uuid>.jpg` — never from the user's filename. */
export function buildObjectKey(prefix: string, contentType: string): string {
  const ext = EXT_BY_TYPE[contentType] ?? "bin";
  const now = new Date();
  const yearBe = now.getFullYear() + 543;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${prefix}/${yearBe}/${month}/${randomUUID()}.${ext}`;
}

let bucketReady: Promise<void> | null = null;

/**
 * Creates the private bucket on first use. Idempotent and memoised, so the
 * check runs once per process rather than on every upload. Doing this in the
 * app (instead of a one-shot `mc` container) keeps the compose file to the
 * three services that actually run, and means the app works against any
 * S3-compatible store the operator points it at.
 */
export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = getStorage();
      const bucket = getBucket();
      if (!(await client.bucketExists(bucket))) {
        await client.makeBucket(bucket);
      }
    })().catch((err) => {
      bucketReady = null; // allow a retry on the next call
      throw err;
    });
  }
  return bucketReady;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  await getStorage().putObject(getBucket(), key, body, body.length, {
    "Content-Type": contentType,
  });
}

/**
 * Presigned GET for the browser. The client is configured with the internal
 * hostname (docker network), so the URL is rewritten to the public one.
 */
export async function presignedGetUrl(key: string, expirySeconds = 900): Promise<string> {
  const url = await getStorage().presignedGetObject(getBucket(), key, expirySeconds);
  const publicHost = process.env.MINIO_PUBLIC_ENDPOINT;
  if (!publicHost) return url;

  const u = new URL(url);
  u.hostname = publicHost;
  u.port = process.env.MINIO_PUBLIC_PORT ?? u.port;
  return u.toString();
}

export async function storageReachable(): Promise<boolean> {
  try {
    await getStorage().bucketExists(getBucket());
    return true;
  } catch {
    return false;
  }
}
