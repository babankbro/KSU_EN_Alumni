import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { query } from "./db";
import { appUrl, sign, verify } from "./tokens";

/**
 * Notifications (FR-NOTI-01 … 06).
 *
 * enqueue() writes one row per enabled channel into `notification`; the cron
 * task (/api/internal/cron) delivers email and LINE rows. In-app rows are the
 * inbox at /me/notifications. Nothing sends inline with a page request, so a
 * slow mail server never slows the site down.
 */

export type NotifType =
  | "account"        // password reset, account status — always email, cannot be disabled
  | "moderation"     // your post / job / article was approved or needs changes
  | "tag"            // someone tagged you (FR-ANEWS-03)
  | "comment"        // comment on your post
  | "cohort_news"    // new post from your cohort (FR-ANEWS-21)
  | "event_reminder" // FR-EVT-05
  | "job_match"      // FR-JOB-06
  | "data_confirm"   // FR-NOTI-04
  | "broadcast";     // FR-NOTI-05

export const NOTIF_TYPES: { type: NotifType; label: string; lockable: boolean }[] = [
  { type: "moderation", label: "ผลการตรวจข่าว/ประกาศ/บทความของฉัน", lockable: false },
  { type: "tag", label: "มีคนแท็กฉันในข่าว", lockable: false },
  { type: "comment", label: "มีความคิดเห็นในข่าวของฉัน", lockable: false },
  { type: "cohort_news", label: "ข่าวใหม่จากรุ่นเดียวกัน", lockable: false },
  { type: "event_reminder", label: "แจ้งเตือนก่อนวันกิจกรรมที่ลงทะเบียน", lockable: false },
  { type: "job_match", label: "ประกาศงานที่ตรงกับสาขา/ทักษะของฉัน", lockable: false },
  { type: "data_confirm", label: "คำเชิญให้ยืนยันข้อมูลประจำปี", lockable: false },
  { type: "broadcast", label: "ประกาศจากคณะ", lockable: false },
];

interface Pref {
  in_app: boolean;
  email: boolean;
  line: boolean;
  frequency: "immediate" | "weekly" | "off";
}

const DEFAULT_PREF: Pref = { in_app: true, email: true, line: false, frequency: "immediate" };

export interface Message {
  title: string;
  body: string;
  /** site-relative path */
  link?: string;
  /** prevents duplicates, e.g. "event-reminder:12:<account>" */
  dedupeKey?: string;
}

export async function enqueue(type: NotifType, accountIds: string[], msg: Message): Promise<number> {
  if (accountIds.length === 0) return 0;

  const prefs = await query<{ account_id: string } & Pref & { has_line: boolean }>(
    `SELECT a.id AS account_id,
            coalesce(p.in_app, true) AS in_app, coalesce(p.email, true) AS email,
            coalesce(p.line, false) AS line, coalesce(p.frequency, 'immediate') AS frequency,
            a.line_user_id IS NOT NULL AS has_line
     FROM account a
     LEFT JOIN notification_pref p ON p.account_id = a.id AND p.type = $2
     WHERE a.id = ANY($1::uuid[]) AND a.is_active`,
    [accountIds, type],
  );

  let created = 0;
  for (const p of prefs) {
    const pref = type === "account" ? { ...DEFAULT_PREF, frequency: "immediate" as const } : p;
    if (pref.frequency === "off") continue;
    const channels: string[] = [];
    if (pref.in_app) channels.push("in_app");
    // Weekly digests go out by email from the cron task instead of one-by-one.
    if (pref.email && pref.frequency === "immediate") channels.push("email");
    if (pref.line && p.has_line && pref.frequency === "immediate") channels.push("line");

    for (const ch of channels) {
      const rows = await query<{ id: string }>(
        `INSERT INTO notification (account_id, type, channel, title, body, link, dedupe_key, status)
         VALUES ($1, $2, $3::notif_channel, $4, $5, $6, $7, CASE WHEN $3 = 'in_app' THEN 'sent'::notif_status ELSE 'pending' END)
         ON CONFLICT (dedupe_key, channel) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          p.account_id,
          type,
          ch,
          msg.title,
          msg.body,
          msg.link ?? null,
          msg.dedupeKey ? `${msg.dedupeKey}:${p.account_id}` : null,
        ],
      );
      created += rows.length;
    }
  }
  return created;
}

/* ---------------- unsubscribe (FR-NOTI-06) ---------------- */

export function unsubscribeUrl(accountId: string, type: string): string {
  return appUrl(`/unsubscribe?t=${encodeURIComponent(sign({ a: accountId, ty: type }))}`);
}

export function parseUnsubscribe(token: string): { accountId: string; type: string } | null {
  const v = verify<{ a: string; ty: string }>(token);
  return v?.a && v?.ty ? { accountId: v.a, type: v.ty } : null;
}

export async function unsubscribe(accountId: string, type: string): Promise<void> {
  await query(
    `INSERT INTO notification_pref (account_id, type, in_app, email, line, frequency)
     VALUES ($1, $2, true, false, false, 'immediate')
     ON CONFLICT (account_id, type) DO UPDATE SET email = false, line = false`,
    [accountId, type],
  );
}

/* ---------------- delivery ---------------- */

let transport: Transporter | null = null;

function mailer(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    });
  }
  return transport;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const t = mailer();
  if (!t) throw new Error("SMTP_HOST not configured");
  await t.sendMail({ from: process.env.MAIL_FROM ?? "no-reply@localhost", to, subject, text, html });
}

async function pushLine(lineUserId: string, text: string): Promise<void> {
  const tokenValue = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!tokenValue) throw new Error("LINE_MESSAGING_ACCESS_TOKEN not configured");
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenValue}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) throw new Error(`LINE push ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Delivers pending email/LINE rows. Called by cron; returns counts. */
export async function deliverPending(limit = 100): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await query<{
    id: string; channel: "email" | "line"; title: string; body: string; link: string | null;
    type: string; account_id: string; email: string; line_user_id: string | null; attempts: number;
  }>(
    `SELECT n.id, n.channel::text AS channel, n.title, n.body, n.link, n.type, n.account_id,
            a.email, a.line_user_id, n.attempts
     FROM notification n JOIN account a ON a.id = n.account_id
     WHERE n.status = 'pending' AND n.channel IN ('email', 'line') AND n.attempts < 5
     ORDER BY n.created_at LIMIT $1`,
    // Single cron caller, so no row locking. Running several cron workers
    // would need this inside a transaction with FOR UPDATE SKIP LOCKED.
    [limit],
  );

  let sent = 0, failed = 0, skipped = 0;
  for (const r of rows) {
    const link = r.link ? appUrl(r.link) : null;
    const unsub = r.type === "account" ? null : unsubscribeUrl(r.account_id, r.type);
    try {
      if (r.channel === "email") {
        if (!process.env.SMTP_HOST) {
          await query(`UPDATE notification SET status = 'skipped', last_error = 'SMTP not configured' WHERE id = $1`, [r.id]);
          skipped++;
          continue;
        }
        const text = [r.body, link ? `\n${link}` : "", unsub ? `\n\nยกเลิกการรับอีเมลประเภทนี้: ${unsub}` : ""].join("");
        const html = `<div style="font-family:sans-serif;line-height:1.6">
          <h2 style="color:#730018">${escapeHtml(r.title)}</h2>
          <p style="white-space:pre-line">${escapeHtml(r.body)}</p>
          ${link ? `<p><a href="${escapeHtml(link)}" style="color:#8b1028">เปิดดูบนเว็บไซต์ →</a></p>` : ""}
          ${unsub ? `<hr><p style="font-size:12px;color:#6b6670">ไม่ต้องการรับอีเมลประเภทนี้? <a href="${escapeHtml(unsub)}">ยกเลิกการรับ</a></p>` : ""}
        </div>`;
        await sendEmail(r.email, r.title, text, html);
      } else {
        if (!r.line_user_id || !process.env.LINE_MESSAGING_ACCESS_TOKEN) {
          await query(`UPDATE notification SET status = 'skipped', last_error = 'LINE not linked/configured' WHERE id = $1`, [r.id]);
          skipped++;
          continue;
        }
        await pushLine(r.line_user_id, `${r.title}\n\n${r.body}${link ? `\n${link}` : ""}${unsub ? `\n\nยกเลิก: ${unsub}` : ""}`);
      }
      await query(`UPDATE notification SET status = 'sent', sent_at = now(), attempts = attempts + 1 WHERE id = $1`, [r.id]);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await query(
        `UPDATE notification SET attempts = attempts + 1, last_error = $2,
                status = CASE WHEN attempts + 1 >= 5 THEN 'failed'::notif_status ELSE status END
         WHERE id = $1`,
        [r.id, msg.slice(0, 500)],
      );
      failed++;
    }
  }
  return { sent, failed, skipped };
}

/** Weekly digest for accounts whose preference is "weekly" (FR-ANEWS-21). */
export async function sendWeeklyDigests(): Promise<number> {
  const rows = await query<{ account_id: string; email: string; items: { title: string; link: string | null }[] }>(
    `SELECT a.id AS account_id, a.email,
            json_agg(json_build_object('title', n.title, 'link', n.link) ORDER BY n.created_at) AS items
     FROM notification n
     JOIN account a ON a.id = n.account_id
     JOIN notification_pref p ON p.account_id = a.id AND p.type = n.type AND p.frequency = 'weekly' AND p.email
     WHERE n.channel = 'in_app' AND n.created_at > now() - interval '7 days'
     GROUP BY a.id, a.email`,
  );
  let n = 0;
  for (const r of rows) {
    const lines = r.items.map((i) => `• ${i.title}${i.link ? ` — ${appUrl(i.link)}` : ""}`).join("\n");
    try {
      await sendEmail(r.email, "สรุปข่าวศิษย์เก่าประจำสัปดาห์", `${lines}\n\nปรับการแจ้งเตือนได้ที่ ${appUrl("/me/notifications")}`);
      n++;
    } catch (err) {
      console.error("[notify] digest failed", err);
    }
  }
  return n;
}
