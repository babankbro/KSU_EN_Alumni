"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { enqueue } from "@/lib/server/notify";
import { MEMORIAL, notifyPublished } from "@/lib/server/posts";

/**
 * Moderation queue actions (FR-ANEWS-08 … 13, 20, FR-ADM-06, FR-JOB-02,
 * FR-KB-02). Moderators are admins and editors; trusting a poster is an
 * admin decision. Every decision is written to the audit log with its reason.
 *
 * Hidden inputs are named `recordId`, never `id`: an input named "id" shadows
 * `form.id`, and React then drops the clicked button's name/value (decision).
 */

const MODERATORS = ["admin", "editor"] as const;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

function back(fd: FormData, done: string): never {
  const tab = str(fd, "tab").replace(/[^a-z]/g, "") || "posts";
  redirect(`/admin/moderation?tab=${tab}&done=${done}`);
}

/** The account of whoever owns an alumni record, for "your post was …" messages. */
async function accountsOfAlumni(alumniId: string): Promise<string[]> {
  return (await query<{ id: string }>(`SELECT id FROM account WHERE alumni_id = $1 AND is_active`, [alumniId])).map((r) => r.id);
}

type Decision = "approve" | "changes" | "reject" | "hide" | "unhide" | "delete";
const NEEDS_NOTE: Decision[] = ["changes", "reject", "hide", "delete"];
const STATUS: Record<Exclude<Decision, "delete" | "unhide">, string> = {
  approve: "approved",
  changes: "changes_requested",
  reject: "rejected",
  hide: "hidden",
};

/* ================= alumni posts ================= */

export async function moderatePostAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...MODERATORS]);
  const id = Number(fd.get("recordId"));
  const decision = str(fd, "decision") as Decision;
  const note = str(fd, "note").slice(0, 1000);
  if (!Number.isInteger(id) || !["approve", "changes", "reject", "hide", "unhide", "delete"].includes(decision)) back(fd, "invalid");
  if (NEEDS_NOTE.includes(decision) && !note) back(fd, "need_note");

  const [post] = await query<{ author_id: string; title: string; type: string; moderation_status: string }>(
    `SELECT author_id, title, type::text AS type, moderation_status::text AS moderation_status FROM alumni_post WHERE id = $1`,
    [id],
  );
  if (!post) back(fd, "missing");

  // FR-ANEWS-13: a memorial is approved only after the moderator confirms it was checked.
  if (decision === "approve" && post.type === MEMORIAL && fd.get("memorialChecked") !== "on") back(fd, "need_memorial_check");

  if (decision === "delete") {
    await query(`DELETE FROM alumni_post WHERE id = $1`, [id]);
  } else if (decision === "unhide") {
    await query(
      `UPDATE alumni_post SET moderation_status = 'approved', moderated_by = $2, moderated_at = now(), moderation_note = NULL WHERE id = $1`,
      [id, session.id],
    );
  } else {
    await query(
      `UPDATE alumni_post SET moderation_status = $2::moderation_status, moderated_by = $3, moderated_at = now(),
              moderation_note = NULLIF($4, ''),
              published_at = CASE WHEN $2 = 'approved' THEN coalesce(published_at, now()) ELSE published_at END
       WHERE id = $1`,
      [id, STATUS[decision], session.id, note],
    );
  }
  if (["hide", "delete", "reject"].includes(decision)) await closeReportsFor("post", id, session.id);
  await audit(session, `post.${decision}`, "alumni_post", id, { title: post.title, note: note || undefined, from: post.moderation_status });

  const text: Record<Decision, string> = {
    approve: "ข่าวของคุณผ่านการตรวจสอบและเผยแพร่แล้ว",
    changes: "ผู้ตรวจสอบขอให้แก้ไขข่าวของคุณก่อนเผยแพร่",
    reject: "ข่าวของคุณไม่ผ่านการตรวจสอบ",
    hide: "ข่าวของคุณถูกซ่อนจากหน้าเว็บ",
    unhide: "ข่าวของคุณกลับมาแสดงบนหน้าเว็บแล้ว",
    delete: "ข่าวของคุณถูกลบโดยผู้ตรวจสอบ",
  };
  await enqueue("moderation", await accountsOfAlumni(post.author_id), {
    title: text[decision],
    body: `“${post.title}”${note ? ` — เหตุผล: ${note}` : ""}`,
    link: decision === "delete" ? "/me/posts" : decision === "approve" || decision === "unhide" ? `/alumni-news/${id}` : `/me/posts/${id}`,
  });
  if (decision === "approve") await notifyPublished(id);

  revalidatePath("/alumni-news");
  back(fd, decision);
}

/** FR-ANEWS-20 */
export async function togglePinAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...MODERATORS]);
  const id = Number(fd.get("recordId"));
  const [row] = await query<{ is_pinned: boolean }>(
    `UPDATE alumni_post SET is_pinned = NOT is_pinned WHERE id = $1 AND moderation_status = 'approved' RETURNING is_pinned`,
    [id],
  );
  if (row) await audit(session, row.is_pinned ? "post.pin" : "post.unpin", "alumni_post", id);
  revalidatePath("/alumni-news");
  back(fd, row?.is_pinned ? "pin" : "unpin");
}

/** FR-ANEWS-10 — admins only: let a poster with a good record skip pre-moderation. */
export async function setTrustedPosterAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const alumniId = str(fd, "alumniId");
  const trusted = fd.get("trusted") === "1";
  const rows = await query<{ id: string }>(
    `UPDATE account SET is_trusted_poster = $2 WHERE alumni_id = $1 RETURNING id`,
    [alumniId, trusted],
  );
  if (rows.length) await audit(session, trusted ? "account.trust" : "account.untrust", "alumni", alumniId);
  back(fd, trusted ? "trusted" : "untrusted");
}

/* ================= comments ================= */

export async function hideCommentAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...MODERATORS]);
  const id = Number(fd.get("recordId"));
  const note = str(fd, "note").slice(0, 1000);
  if (!note) back(fd, "need_note");
  const [row] = await query<{ post_id: number; body: string }>(
    `UPDATE alumni_post_comment SET moderation_status = 'hidden', moderation_note = $2 WHERE id = $1 RETURNING post_id, body`,
    [id, note],
  );
  if (row) {
    await audit(session, "comment.hide", "alumni_post_comment", id, { note, body: row.body.slice(0, 200) });
    await query(
      `UPDATE content_report SET status = 'resolved', resolved_by = $2, resolved_at = now()
       WHERE target_type = 'comment' AND target_id = $1 AND status = 'open'`,
      [id, session.id],
    );
    revalidatePath(`/alumni-news/${row.post_id}`);
  }
  back(fd, "hide");
}

/* ================= reports ================= */

/**
 * Closes every open report on one target. "dismiss" leaves the content as it
 * is; hiding goes through moderatePostAction / hideCommentAction (and the
 * job and article equivalents), which also close the reports.
 */
export async function dismissReportsAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...MODERATORS]);
  const targetType = str(fd, "targetType");
  const targetId = Number(fd.get("targetId"));
  const n = await query(
    `UPDATE content_report SET status = 'dismissed', resolved_by = $3, resolved_at = now()
     WHERE target_type = $1 AND target_id = $2 AND status = 'open' RETURNING id`,
    [targetType, targetId, session.id],
  );
  if (n.length) await audit(session, "report.dismiss", "content_report", `${targetType}:${targetId}`, { reports: n.length });
  back(fd, "dismiss");
}

// Not exported: every export of a "use server" file is a callable endpoint.
async function closeReportsFor(targetType: string, targetId: number, adminId: string): Promise<void> {
  await query(
    `UPDATE content_report SET status = 'resolved', resolved_by = $3, resolved_at = now()
     WHERE target_type = $1 AND target_id = $2 AND status = 'open'`,
    [targetType, targetId, adminId],
  );
}
