"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, query } from "@/lib/server/db";
import { audit, login, logout, requireAdmin } from "@/lib/server/auth";
import { storeUpload, UploadError } from "@/lib/server/files";
import { enqueue } from "@/lib/server/notify";

/**
 * Back-office mutations. Every action re-checks the session itself:
 * middleware only looks for a cookie, and server actions are public HTTP
 * endpoints that can be called directly.
 */

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: string;
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function fileOrNull(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}

/* ================= session ================= */

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const result = await login(email, password);
  if (!result.ok) return { error: result.error };
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}

/* ================= news (FR-ADM-13 … FR-ADM-15) ================= */

const NEWS_LIMITS = { title: 200, summary: 400, body: 20000, category: 60 };

export async function saveNewsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();

  const id = Number(str(fd, "recordId")) || null;
  const title = str(fd, "title");
  const summary = str(fd, "summary");
  const body = typeof fd.get("body") === "string" ? (fd.get("body") as string).trim() : "";
  const category = str(fd, "category") || "ข่าวคณะ";
  const publishMode = str(fd, "publishMode"); // draft | now | schedule
  const publishAt = str(fd, "publishAt"); // datetime-local, Bangkok time
  const isPinned = fd.get("isPinned") === "on";
  const removeCover = fd.get("removeCover") === "on";
  const cover = fileOrNull(fd, "cover");

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "กรุณากรอกหัวข้อข่าว";
  if (title.length > NEWS_LIMITS.title) fieldErrors.title = `หัวข้อยาวเกิน ${NEWS_LIMITS.title} ตัวอักษร`;
  if (summary.length > NEWS_LIMITS.summary) fieldErrors.summary = `สรุปยาวเกิน ${NEWS_LIMITS.summary} ตัวอักษร`;
  if (body.length > NEWS_LIMITS.body) fieldErrors.body = `เนื้อหายาวเกิน ${NEWS_LIMITS.body} ตัวอักษร`;
  if (category.length > NEWS_LIMITS.category) fieldErrors.category = "ชื่อหมวดยาวเกินไป";
  if (!["draft", "now", "schedule"].includes(publishMode)) fieldErrors.publishMode = "กรุณาเลือกสถานะการเผยแพร่";
  if (publishMode === "schedule" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(publishAt)) {
    fieldErrors.publishAt = "กรุณาระบุวันเวลาที่จะเผยแพร่";
  }
  if (Object.keys(fieldErrors).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors };

  let coverId: string | null = null;
  if (cover) {
    try {
      coverId = (await storeUpload(cover, "news_image", { uploadedBy: session.id })).id;
    } catch (err) {
      if (err instanceof UploadError) return { error: err.message, fieldErrors: { cover: err.message } };
      throw err;
    }
  }

  // The date input carries no zone; it is entered in Bangkok time.
  const scheduledAt = publishMode === "schedule" ? `${publishAt}:00+07` : null;

  let newsId: number;
  if (id) {
    const rows = await query<{ id: number }>(
      `UPDATE news SET
         title = $1, summary = $2, body = $3, category = $4, is_pinned = $5,
         updated_by = $6, updated_at = now(),
         cover_file_id = CASE WHEN $7::uuid IS NOT NULL THEN $7::uuid
                              WHEN $8::boolean THEN NULL
                              ELSE cover_file_id END,
         -- "publish now" on an already-published item keeps its original date
         published_at = CASE $9::text WHEN 'draft' THEN NULL
                                      WHEN 'now' THEN COALESCE(published_at, now())
                                      ELSE $10::timestamptz END
       WHERE id = $11 RETURNING id`,
      [title, summary, body, category, isPinned, session.id, coverId, removeCover, publishMode, scheduledAt, id],
    );
    if (!rows[0]) return { error: "ไม่พบข่าวที่ต้องการแก้ไข" };
    newsId = rows[0].id;
  } else {
    const rows = await query<{ id: number }>(
      `INSERT INTO news (title, summary, body, category, is_pinned, author_id, updated_by, created_by,
                         cover_file_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8,
               CASE $9::text WHEN 'draft' THEN NULL WHEN 'now' THEN now() ELSE $10::timestamptz END)
       RETURNING id`,
      [title, summary, body, category, isPinned, session.id, session.displayName, coverId, publishMode, scheduledAt],
    );
    newsId = rows[0].id;
  }

  await audit(session, id ? "news.update" : "news.create", "news", newsId, {
    title,
    publishMode,
    coverChanged: Boolean(coverId) || removeCover,
  });
  revalidatePath("/");
  revalidatePath("/news");
  redirect(`/admin/news?saved=${newsId}`);
}

export async function deleteNewsAction(fd: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = Number(str(fd, "recordId"));
  if (!Number.isInteger(id) || id <= 0) return;

  const rows = await query<{ title: string }>(`DELETE FROM news WHERE id = $1 RETURNING title`, [id]);
  if (rows[0]) await audit(session, "news.delete", "news", id, { title: rows[0].title });
  revalidatePath("/");
  revalidatePath("/news");
  redirect("/admin/news?deleted=1");
}

export async function togglePublishAction(fd: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = Number(str(fd, "recordId"));
  if (!Number.isInteger(id) || id <= 0) return;

  const rows = await query<{ published: boolean }>(
    `UPDATE news SET published_at = CASE WHEN published_at IS NULL THEN now() ELSE NULL END,
            updated_at = now(), updated_by = $2
     WHERE id = $1 RETURNING published_at IS NOT NULL AS published`,
    [id, session.id],
  );
  if (rows[0]) await audit(session, rows[0].published ? "news.publish" : "news.unpublish", "news", id);
  revalidatePath("/");
  revalidatePath("/news");
  redirect("/admin/news");
}

/* ================= site content (FR-ADM-16 … FR-ADM-17) ================= */

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();

  const defs = await query<{ key: string; label: string; kind: string; value: string; max_length: number }>(
    `SELECT key, label, kind, value, max_length FROM site_setting`,
  );

  const fieldErrors: Record<string, string> = {};
  const changes: { key: string; value: string }[] = [];

  for (const d of defs) {
    const raw = fd.get(`s:${d.key}`);
    if (typeof raw !== "string") continue; // field not on this form
    const value = d.kind === "textarea" ? raw.replace(/\r\n/g, "\n").trim() : raw.trim();

    if (value.length > d.max_length) {
      fieldErrors[d.key] = `ยาวเกิน ${d.max_length} ตัวอักษร`;
    } else if (d.kind === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      fieldErrors[d.key] = "รูปแบบอีเมลไม่ถูกต้อง";
    } else if (d.kind === "phone" && value && !/^[\d\s+()-]{6,20}$/.test(value)) {
      fieldErrors[d.key] = "รูปแบบเบอร์โทรไม่ถูกต้อง";
    } else if (d.kind === "url" && value && !/^https:\/\/[^\s]+$/i.test(value)) {
      // https only: these become links on every public page.
      fieldErrors[d.key] = "ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https://";
    } else if (["hero.title", "hero.titleEm", "contact.unit"].includes(d.key) && !value) {
      fieldErrors[d.key] = "ช่องนี้ห้ามว่าง";
    }

    if (!fieldErrors[d.key] && value !== d.value) changes.push({ key: d.key, value });
  }

  if (Object.keys(fieldErrors).length) {
    return { error: `กรุณาแก้ไข ${Object.keys(fieldErrors).length} ช่องที่ไม่ถูกต้อง — ยังไม่ได้บันทึก`, fieldErrors };
  }
  if (changes.length === 0) return { ok: "ไม่มีการเปลี่ยนแปลง" };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const c of changes) {
      await client.query(
        `UPDATE site_setting SET value = $2, updated_at = now(), updated_by = $3 WHERE key = $1`,
        [c.key, c.value, session.id],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  await audit(session, "content.update", "site_setting", changes.map((c) => c.key).join(","), {
    keys: changes.map((c) => c.key),
  });
  revalidatePath("/", "layout");
  return { ok: `บันทึกแล้ว ${changes.length} รายการ` };
}

export async function replaceImageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const slot = str(fd, "slot");
  const file = fileOrNull(fd, "file");
  const alt = str(fd, "alt");

  const [def] = await query<{ slot: string }>(`SELECT slot FROM site_image WHERE slot = $1`, [slot]);
  if (!def) return { error: "ไม่พบตำแหน่งรูปภาพนี้" };
  if (!file && !alt) return { error: "กรุณาเลือกไฟล์รูปภาพ" };
  if (alt.length > 200) return { error: "คำอธิบายรูปยาวเกิน 200 ตัวอักษร" };

  let fileId: string | null = null;
  if (file) {
    try {
      fileId = (await storeUpload(file, "site_image", { uploadedBy: session.id })).id;
    } catch (err) {
      if (err instanceof UploadError) return { error: err.message };
      throw err;
    }
  }

  await query(
    `UPDATE site_image SET
       file_id = COALESCE($2, file_id),
       alt_text = CASE WHEN $3 = '' THEN alt_text ELSE $3 END,
       updated_at = now(), updated_by = $4
     WHERE slot = $1`,
    [slot, fileId, alt, session.id],
  );
  await audit(session, "content.image", "site_image", slot, { fileId, altChanged: Boolean(alt) });
  revalidatePath("/", "layout");
  return { ok: file ? "เปลี่ยนรูปเรียบร้อย" : "บันทึกคำอธิบายรูปแล้ว" };
}

export async function resetImageAction(fd: FormData): Promise<void> {
  const session = await requireAdmin();
  const slot = str(fd, "slot");
  await query(`UPDATE site_image SET file_id = NULL, updated_at = now(), updated_by = $2 WHERE slot = $1`, [
    slot,
    session.id,
  ]);
  await audit(session, "content.image_reset", "site_image", slot);
  revalidatePath("/", "layout");
  redirect("/admin/content?reset=1#images");
}

/* ================= members (FR-ADM-18 … FR-ADM-21) ================= */

/**
 * Approve or reject a pending member. Approval verifies the alumni row;
 * rejection of a claim returns the imported record to 'unclaimed' (the real
 * owner may still claim it), while a rejected self-registration is kept as
 * 'rejected' so the decision stays on record.
 */
export async function reviewMemberAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const alumniId = str(fd, "alumniId");
  const decision = str(fd, "decision");
  const note = str(fd, "note").slice(0, 500) || null;
  if (!/^[0-9a-f-]{36}$/i.test(alumniId) || !["approve", "reject"].includes(decision)) return;

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const [a] = (
      await client.query<{ claim_status: string; has_code: boolean; imported: boolean }>(
        `SELECT a.claim_status::text,
                a.student_code IS NOT NULL AS has_code,
                EXISTS (SELECT 1 FROM registration_request r WHERE r.alumni_id = a.id AND r.path = 'claim') AS imported
         FROM alumni a WHERE a.id = $1 FOR UPDATE`,
        [alumniId],
      )
    ).rows;
    if (!a || a.claim_status !== "pending") {
      await client.query("ROLLBACK");
      redirect(`/admin/members/${alumniId}?stale=1`);
    }

    if (decision === "approve") {
      await client.query(
        `UPDATE alumni SET claim_status = 'verified', claimed_at = now(), profile_updated_at = now() WHERE id = $1`,
        [alumniId],
      );
    } else {
      await client.query(`UPDATE alumni SET claim_status = $2::claim_status WHERE id = $1`, [
        alumniId,
        a.imported ? "unclaimed" : "rejected",
      ]);
    }
    await client.query(
      `UPDATE registration_request
       SET status = $2::registration_status, reviewed_by = $3, reviewed_at = now(),
           review_note = COALESCE($4, review_note)
       WHERE alumni_id = $1 AND status IN ('submitted', 'matched')`,
      [alumniId, decision === "approve" ? "approved" : "rejected", session.email, note],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  await audit(session, decision === "approve" ? "member.approve" : "member.reject", "alumni", alumniId, { note });

  // Tell the applicant — before accounts existed they had no way to learn the outcome.
  const accounts = await query<{ id: string }>(`SELECT id FROM account WHERE alumni_id = $1`, [alumniId]);
  await enqueue(
    "account",
    accounts.map((a) => a.id),
    decision === "approve"
      ? {
          title: "ยืนยันตัวตนศิษย์เก่าเรียบร้อย",
          body: "เจ้าหน้าที่ยืนยันข้อมูลของคุณแล้ว ตอนนี้คุณปรากฏในทำเนียบศิษย์เก่า (ถ้ายินยอม) ดูข้อมูลติดต่อเพื่อนร่วมรุ่น ส่งข่าว และลงทะเบียนกิจกรรมได้",
          link: "/me",
        }
      : {
          title: "ใบสมัครศิษย์เก่ายังไม่ผ่านการตรวจสอบ",
          body: `เจ้าหน้าที่ไม่สามารถยืนยันข้อมูลของคุณได้${note ? `\nหมายเหตุ: ${note}` : ""}\nกรุณาติดต่องานศิษย์เก่าสัมพันธ์`,
          link: "/me",
        },
  );
  revalidatePath("/admin/members");
  redirect(`/admin/members/${alumniId}?reviewed=${decision}`);
}
