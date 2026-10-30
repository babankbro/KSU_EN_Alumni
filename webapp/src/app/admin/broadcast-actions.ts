"use server";

import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { enqueue } from "@/lib/server/notify";
import { audienceAccounts, parseAudience } from "@/lib/server/audience";
import type { FormState } from "@/lib/form-state";

/** FR-NOTI-05 broadcasts and FR-NOTI-04 data-confirmation rounds — admins only. */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

export async function sendBroadcastAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("admin");
  const title = str(fd, "title");
  const body = str(fd, "body");
  const link = str(fd, "link");
  const fe: Record<string, string> = {};
  if (title.length < 3 || title.length > 150) fe.title = "หัวข้อ 3–150 ตัวอักษร";
  if (body.length < 10 || body.length > 3000) fe.body = "ข้อความ 10–3,000 ตัวอักษร";
  if (link && !(link.startsWith("/") && !link.startsWith("//"))) fe.link = "ลิงก์ต้องเป็นหน้าในเว็บไซต์นี้ เช่น /events/1";
  if (fd.get("confirm") !== "on") fe.confirm = "ติ๊กยืนยันก่อนส่ง";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const filter = parseAudience((k) => str(fd, k));
  const ids = await audienceAccounts(filter);
  if (!ids.length) return { error: "ไม่มีผู้รับในกลุ่มนี้" };
  const [row] = await query<{ id: number }>(
    `INSERT INTO broadcast (title, body, link, filter, recipient_count, created_by) VALUES ($1, $2, NULLIF($3, ''), $4::jsonb, $5, $6) RETURNING id`,
    [title, body, link, JSON.stringify(filter), ids.length, session.id],
  );
  // Each person's own preferences (channel, weekly digest, off) still apply.
  const queued = await enqueue("broadcast", ids, { title, body, link: link || undefined, dedupeKey: `broadcast:${row.id}` });
  await audit(session, "broadcast.send", "broadcast", row.id, { recipients: ids.length, queued });
  return { ok: `ส่งถึง ${ids.length.toLocaleString("th-TH")} บัญชีแล้ว (ตามการตั้งค่าการแจ้งเตือนของแต่ละคน)` };
}

export async function startDataConfirmRoundAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("admin");
  const months = Number(str(fd, "months"));
  if (!Number.isInteger(months) || months < 3 || months > 60) return { fieldErrors: { months: "3–60 เดือน" } };
  if (fd.get("confirm") !== "on") return { fieldErrors: { confirm: "ติ๊กยืนยันก่อนส่ง" } };

  const ids = (
    await query<{ id: string }>(
      `SELECT ac.id FROM account ac JOIN alumni a ON a.id = ac.alumni_id
       WHERE ac.is_active AND a.claim_status = 'verified' AND a.anonymized_at IS NULL
         AND a.profile_updated_at < now() - make_interval(months => $1)`,
      [months],
    )
  ).map((r) => r.id);
  if (!ids.length) return { ok: `ไม่มีใครที่ข้อมูลเก่ากว่า ${months} เดือน` };
  const [row] = await query<{ id: number }>(
    `INSERT INTO data_confirm_round (stale_months, recipient_count, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [months, ids.length, session.id],
  );
  await enqueue("data_confirm", ids, {
    title: "ช่วยตรวจสอบข้อมูลศิษย์เก่าของคุณ",
    body: "ข้อมูลของคุณไม่ได้อัปเดตมานาน ใช้เวลาไม่ถึงนาที — ถ้ายังถูกต้อง กด “ข้อมูลยังถูกต้อง” ได้เลย",
    link: "/me",
    dedupeKey: `data-confirm:${row.id}`,
  });
  await audit(session, "data_confirm.start", "data_confirm_round", row.id, { months, recipients: ids.length });
  return { ok: `ส่งคำเชิญยืนยันข้อมูลถึง ${ids.length.toLocaleString("th-TH")} คนแล้ว` };
}
