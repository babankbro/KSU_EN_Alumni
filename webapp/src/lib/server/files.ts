import "server-only";
import { query } from "./db";
import { buildObjectKey, getBucket, putObject } from "./storage";

/**
 * Shared file intake for every upload path — public registration and the
 * admin back office alike — so the safety checks cannot drift apart.
 */

export type StoredPurpose = "profile_photo" | "document" | "news_image" | "site_image";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface PurposeRule {
  types: string[];
  maxBytes: number;
  prefix: string;
}

const MB = 1024 * 1024;

export const PURPOSE_RULES: Record<StoredPurpose, PurposeRule> = {
  profile_photo: { types: IMAGE_TYPES, maxBytes: 5 * MB, prefix: "profiles" },
  document: { types: ["application/pdf"], maxBytes: 10 * MB, prefix: "documents" },
  news_image: { types: IMAGE_TYPES, maxBytes: 8 * MB, prefix: "news" },
  site_image: { types: IMAGE_TYPES, maxBytes: 8 * MB, prefix: "site" },
};

/** Purposes whose files may be served to anonymous visitors. */
export const PUBLIC_PURPOSES: StoredPurpose[] = ["news_image", "site_image"];

// Check the first bytes, not just the declared MIME type: a renamed text file
// must not pass as an image.
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) =>
    b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  "application/pdf": (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
};

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

/**
 * Validates and stores one file. Throws UploadError with a Thai message and
 * an HTTP status on rejection; returns the new file_object id on success.
 */
export async function storeUpload(
  file: File,
  purpose: StoredPurpose,
  opts: { uploadedBy: string; ownerAlumniId?: string | null } = { uploadedBy: "anonymous" },
): Promise<{ id: string; objectKey: string; size: number }> {
  const rule = PURPOSE_RULES[purpose];

  if (!rule.types.includes(file.type)) {
    throw new UploadError(`ชนิดไฟล์ ${file.type || "ไม่ทราบ"} ไม่รองรับ`, 415);
  }
  if (file.size === 0 || file.size > rule.maxBytes) {
    throw new UploadError(`ขนาดไฟล์ต้องมากกว่า 0 และไม่เกิน ${formatMb(rule.maxBytes)}`, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniff = MAGIC[file.type];
  if (sniff && !sniff(buffer)) {
    throw new UploadError("เนื้อหาไฟล์ไม่ตรงกับชนิดที่ระบุ", 415);
  }

  // Keys come from a UUID, never from the uploader's filename.
  const key = buildObjectKey(rule.prefix, file.type);
  await putObject(key, buffer, file.type);

  const [row] = await query<{ id: string }>(
    `INSERT INTO file_object (bucket, object_key, content_type, size_bytes, purpose, uploaded_by, owner_alumni_id)
     VALUES ($1, $2, $3, $4, $5::file_purpose, $6, $7)
     RETURNING id`,
    [getBucket(), key, file.type, buffer.length, purpose, opts.uploadedBy, opts.ownerAlumniId ?? null],
  );
  return { id: row.id, objectKey: key, size: buffer.length };
}

/** URL the browser uses for a stored file; served by /api/files/[id]. */
export function fileUrl(id: string): string {
  return `/api/files/${id}`;
}
