import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { buildObjectKey, getBucket, putObject } from "@/lib/server/storage";
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES } from "@/lib/registration";

export const dynamic = "force-dynamic";

// Same sniffing the browser's dropzone cannot be trusted to have done:
// check the first bytes, not just the declared MIME type.
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  "application/pdf": (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
};

const ACCEPT: Record<string, { types: string[]; prefix: string; purpose: string }> = {
  profile_photo: { types: PHOTO_ACCEPT, prefix: "profiles", purpose: "profile_photo" },
  document: { types: ["application/pdf"], prefix: "documents", purpose: "document" },
};

/**
 * POST /api/upload  (multipart: file, purpose)
 *
 * Stores the object in the private MinIO bucket and records it in
 * file_object. Returns the row id; the registration request references that,
 * never a raw key, so a client cannot point at someone else's object.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const purposeKey = String(form.get("purpose") ?? "profile_photo");
  const rule = ACCEPT[purposeKey];
  if (!rule) {
    return NextResponse.json({ error: "ประเภทไฟล์ที่ร้องขอไม่รองรับ" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }
  if (!rule.types.includes(file.type)) {
    return NextResponse.json({ error: `ชนิดไฟล์ ${file.type || "ไม่ทราบ"} ไม่รองรับ` }, { status: 415 });
  }
  if (file.size === 0 || file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "ขนาดไฟล์ต้องมากกว่า 0 และไม่เกิน 5 MB" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniff = MAGIC[file.type];
  if (sniff && !sniff(buffer)) {
    return NextResponse.json({ error: "เนื้อหาไฟล์ไม่ตรงกับชนิดที่ระบุ" }, { status: 415 });
  }

  const key = buildObjectKey(rule.prefix, file.type);

  try {
    await putObject(key, buffer, file.type);
    const [row] = await query<{ id: string }>(
      `INSERT INTO file_object (bucket, object_key, content_type, size_bytes, purpose, uploaded_by)
       VALUES ($1, $2, $3, $4, $5::file_purpose, $6)
       RETURNING id`,
      [getBucket(), key, file.type, buffer.length, rule.purpose, "registration"],
    );
    return NextResponse.json({ fileId: row.id, objectKey: key, size: buffer.length });
  } catch (err) {
    console.error("[api/upload]", err);
    return NextResponse.json({ error: "บันทึกไฟล์ไม่สำเร็จ" }, { status: 503 });
  }
}
