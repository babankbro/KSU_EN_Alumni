"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, query } from "@/lib/server/db";
import { requireMember } from "@/lib/server/member-auth";
import { JOB_TYPES } from "@/lib/server/jobs";
import { KB_CATEGORIES } from "@/lib/server/kb";
import { PROVINCES } from "@/lib/provinces";
import type { FormState } from "@/lib/form-state";

/**
 * Alumni-authored job posts (FR-JOB-01/02) and articles (FR-KB-01/02).
 * Both are always pre-moderated: a new post or any edit goes back to the queue.
 */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function author() {
  const acc = await requireMember({ alumni: true, verified: true });
  if (!acc.alumniId) redirect("/me?need=alumni");
  return { acc, alumniId: acc.alumniId };
}

async function log(accountId: string, action: string, table: string, id: number, title: string) {
  await query(
    `INSERT INTO audit_log (actor, action, target_table, target_id, detail) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [`account:${accountId}`, action, table, String(id), JSON.stringify({ title })],
  );
}

/* ================= jobs ================= */

export async function saveJobAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await author();
  const id = fd.get("recordId") ? Number(fd.get("recordId")) : null;
  const title = str(fd, "title");
  const organization = str(fd, "organization");
  const type = str(fd, "employmentType");
  const location = str(fd, "location");
  const province = str(fd, "province");
  const description = str(fd, "description");
  const closesAt = str(fd, "closesAt");
  const applyUrl = str(fd, "applyUrl");
  const contactEmail = str(fd, "contactEmail");
  const programs = fd.getAll("programs").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 30);
  const skillNames = str(fd, "skills").split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 15);

  const fe: Record<string, string> = {};
  if (title.length < 3 || title.length > 150) fe.title = "ชื่อตำแหน่งต้องยาว 3–150 ตัวอักษร";
  if (!organization || organization.length > 150) fe.organization = "กรุณาระบุหน่วยงาน";
  if (!(JOB_TYPES as readonly string[]).includes(type)) fe.employmentType = "กรุณาเลือกประเภท";
  if (province && !(PROVINCES as readonly string[]).includes(province)) fe.province = "กรุณาเลือกจังหวัดจากรายการ";
  if (description.length < 20 || description.length > 8000) fe.description = "รายละเอียดต้องยาว 20–8,000 ตัวอักษร";
  // Calendar dates in Bangkok, compared as YYYY-MM-DD strings.
  const bkkDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closesAt)) fe.closesAt = "กรุณาระบุวันปิดรับ";
  else if (closesAt < bkkDate(new Date())) fe.closesAt = "วันปิดรับต้องไม่ใช่วันที่ผ่านมาแล้ว";
  else if (closesAt > bkkDate(new Date(Date.now() + 120 * 86400_000))) fe.closesAt = "ประกาศอยู่ได้ไม่เกิน 120 วัน";
  if (applyUrl && !/^https:\/\/[^\s]+$/i.test(applyUrl)) fe.applyUrl = "ลิงก์ต้องขึ้นต้นด้วย https://";
  if (contactEmail && !EMAIL.test(contactEmail)) fe.contactEmail = "รูปแบบอีเมลไม่ถูกต้อง";
  if (!applyUrl && !contactEmail) fe.applyUrl = "ระบุลิงก์สมัครหรืออีเมลติดต่ออย่างน้อยหนึ่งช่องทาง";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const client = await getPool().connect();
  let jobId: number;
  try {
    await client.query("BEGIN");
    const vals = [title, organization, type, location || null, province || null, description, closesAt, applyUrl || null, contactEmail || null];
    if (id) {
      const { rows } = await client.query<{ id: number }>(
        `UPDATE job_post SET title = $1, organization = $2, employment_type = $3::employment_type, location = $4, province = $5,
                description = $6, closes_at = $7::date, apply_url = $8, contact_email = $9,
                moderation_status = 'pending', moderation_note = NULL, updated_at = now(), matched_notified_at = NULL
         WHERE id = $10 AND posted_by = $11 AND moderation_status <> 'hidden' RETURNING id`,
        [...vals, id, alumniId],
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return { error: "ไม่พบประกาศนี้ในบัญชีของคุณ หรือประกาศถูกซ่อนโดยผู้ตรวจสอบ" };
      }
      jobId = rows[0].id;
      await client.query(`DELETE FROM job_post_program WHERE job_post_id = $1`, [jobId]);
      await client.query(`DELETE FROM job_post_skill WHERE job_post_id = $1`, [jobId]);
    } else {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO job_post (posted_by, title, organization, employment_type, location, province, description, closes_at, apply_url, contact_email)
         VALUES ($10, $1, $2, $3::employment_type, $4, $5, $6, $7::date, $8, $9) RETURNING id`,
        [...vals, alumniId],
      );
      jobId = rows[0].id;
    }
    if (programs.length) {
      await client.query(
        `INSERT INTO job_post_program (job_post_id, program_id) SELECT $1, id FROM program WHERE id = ANY($2::int[]) ON CONFLICT DO NOTHING`,
        [jobId, programs],
      );
    }
    if (skillNames.length) {
      // Only skills already in the reference list (FR-ADM-05) — no free-form growth.
      await client.query(
        `INSERT INTO job_post_skill (job_post_id, skill_id) SELECT $1, id FROM skill WHERE lower(name) = ANY($2::text[]) ON CONFLICT DO NOTHING`,
        [jobId, skillNames.map((s) => s.toLowerCase())],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[me/jobs] save", err);
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  } finally {
    client.release();
  }
  await log(acc.id, id ? "job.update" : "job.create", "job_post", jobId, title);
  revalidatePath("/jobs");
  redirect("/me/activity?saved=job");
}

export async function deleteJobAction(fd: FormData): Promise<void> {
  const { acc, alumniId } = await author();
  const id = Number(fd.get("recordId"));
  const [row] = await query<{ title: string }>(`DELETE FROM job_post WHERE id = $1 AND posted_by = $2 RETURNING title`, [id, alumniId]);
  if (row) await log(acc.id, "job.delete", "job_post", id, row.title);
  revalidatePath("/jobs");
  redirect("/me/activity?saved=deleted");
}

/* ================= articles ================= */

export async function saveArticleAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await author();
  const id = fd.get("recordId") ? Number(fd.get("recordId")) : null;
  const title = str(fd, "title");
  const summary = str(fd, "summary");
  const body = str(fd, "body");
  const category = str(fd, "category");

  const fe: Record<string, string> = {};
  if (title.length < 5 || title.length > 150) fe.title = "หัวข้อต้องยาว 5–150 ตัวอักษร";
  if (summary.length > 300) fe.summary = "สรุปยาวได้ไม่เกิน 300 ตัวอักษร";
  if (body.length < 100 || body.length > 20000) fe.body = "เนื้อหาต้องยาว 100–20,000 ตัวอักษร";
  if (!(KB_CATEGORIES as readonly string[]).includes(category)) fe.category = "กรุณาเลือกหมวด";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  let articleId: number;
  if (id) {
    const [row] = await query<{ id: number }>(
      `UPDATE kb_article SET title = $1, summary = NULLIF($2, ''), body = $3, category = $4,
              moderation_status = 'pending', moderation_note = NULL, updated_at = now()
       WHERE id = $5 AND author_id = $6 AND moderation_status <> 'hidden' RETURNING id`,
      [title, summary, body, category, id, alumniId],
    );
    if (!row) return { error: "ไม่พบบทความนี้ในบัญชีของคุณ หรือบทความถูกซ่อนโดยผู้ตรวจสอบ" };
    articleId = row.id;
  } else {
    const [row] = await query<{ id: number }>(
      `INSERT INTO kb_article (author_id, title, summary, body, category) VALUES ($1, $2, NULLIF($3, ''), $4, $5) RETURNING id`,
      [alumniId, title, summary, body, category],
    );
    articleId = row.id;
  }
  await log(acc.id, id ? "kb.update" : "kb.create", "kb_article", articleId, title);
  revalidatePath("/kb");
  redirect("/me/activity?saved=kb");
}

export async function deleteArticleAction(fd: FormData): Promise<void> {
  const { acc, alumniId } = await author();
  const id = Number(fd.get("recordId"));
  const [row] = await query<{ title: string }>(`DELETE FROM kb_article WHERE id = $1 AND author_id = $2 RETURNING title`, [id, alumniId]);
  if (row) await log(acc.id, "kb.delete", "kb_article", id, row.title);
  revalidatePath("/kb");
  redirect("/me/activity?saved=deleted");
}
