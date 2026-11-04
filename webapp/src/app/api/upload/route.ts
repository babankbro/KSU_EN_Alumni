import { NextResponse } from "next/server";
import { storeUpload, UploadError, type StoredPurpose } from "@/lib/server/files";
import { clientIpFrom } from "@/lib/server/client-ip";
import { foreignOrigin } from "@/lib/server/same-origin";
import { hit, LIMITS } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

// The public endpoint only ever accepts what the registration form sends.
// Site and news images go through the authenticated admin actions instead.
const PUBLIC_UPLOAD_PURPOSES: StoredPurpose[] = ["profile_photo"];

/**
 * POST /api/upload  (multipart: file, purpose)
 *
 * Stores the object in the private MinIO bucket and records it in
 * file_object. Returns the row id; the registration request references that,
 * never a raw key, so a client cannot point at someone else's object.
 */
export async function POST(req: Request) {
  if (foreignOrigin(req)) return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  // Anyone may upload here, so cap it; unused uploads are pruned by cron.
  const ip = clientIpFrom(req.headers);
  if (ip ? await hit(LIMITS.uploadPerIp, ip) : await hit(LIMITS.uploadGlobal, "all")) {
    return NextResponse.json({ error: "อัปโหลดถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" }, { status: 429 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const purpose = String(form.get("purpose") ?? "profile_photo") as StoredPurpose;
  if (!PUBLIC_UPLOAD_PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: "ประเภทไฟล์ที่ร้องขอไม่รองรับ" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }

  try {
    const stored = await storeUpload(file, purpose, { uploadedBy: "registration" });
    return NextResponse.json({ fileId: stored.id, size: stored.size });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/upload]", err);
    return NextResponse.json({ error: "บันทึกไฟล์ไม่สำเร็จ" }, { status: 503 });
  }
}
