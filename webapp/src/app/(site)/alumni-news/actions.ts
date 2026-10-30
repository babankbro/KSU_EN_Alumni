"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { getViewer, viewerAccount } from "@/lib/server/member-auth";
import { canInteract, getVisiblePost } from "@/lib/server/posts";
import { enqueue } from "@/lib/server/notify";
import { hit, LIMITS } from "@/lib/server/rate-limit";
import type { FormState } from "@/lib/form-state";
import { REPORT_REASONS } from "@/lib/moderation";
import { getLiveJob } from "@/lib/server/jobs";
import { getPublishedArticle } from "@/lib/server/kb";

/**
 * Reader-side interactions with alumni news (FR-ANEWS-11/16/17).
 * Each action re-checks that the post is published and visible to this
 * viewer, so a hidden or members-only post cannot be reached by id.
 */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

/** Only same-site relative paths, so a crafted form cannot redirect elsewhere. */
function backTo(fd: FormData, fallback: string): string {
  const b = str(fd, "back");
  return b.startsWith("/") && !b.startsWith("//") && !b.startsWith("/\\") ? b : fallback;
}

async function interactingViewer() {
  const viewer = await getViewer();
  const account = viewerAccount(viewer);
  if (!account) redirect("/login");
  if (!canInteract(viewer)) redirect("/me?need=verified");
  return { viewer, account };
}

export async function toggleReactionAction(fd: FormData): Promise<void> {
  const { viewer, account } = await interactingViewer();
  const postId = Number(fd.get("postId"));
  if (!Number.isInteger(postId) || !(await getVisiblePost(postId, viewer))) redirect("/alumni-news");

  const removed = await query(`DELETE FROM alumni_post_reaction WHERE post_id = $1 AND account_id = $2 RETURNING post_id`, [postId, account.id]);
  if (removed.length === 0) {
    await query(`INSERT INTO alumni_post_reaction (post_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, account.id]);
  }
  revalidatePath("/alumni-news");
  redirect(backTo(fd, `/alumni-news/${postId}`));
}

export async function addCommentAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { viewer, account } = await interactingViewer();
  const postId = Number(fd.get("postId"));
  const body = str(fd, "body");
  if (!body) return { fieldErrors: { body: "กรุณาพิมพ์ความคิดเห็น" } };
  if (body.length > 1000) return { fieldErrors: { body: "ความคิดเห็นยาวได้ไม่เกิน 1,000 ตัวอักษร" } };

  const post = Number.isInteger(postId) ? await getVisiblePost(postId, viewer) : null;
  if (!post) return { error: "ไม่พบข่าวนี้ หรือข่าวถูกซ่อนไปแล้ว" };
  if (await hit({ bucket: "comment", max: 20, windowSec: 600 }, account.id)) {
    return { error: "แสดงความคิดเห็นถี่เกินไป กรุณารอสักครู่" };
  }

  await query(`INSERT INTO alumni_post_comment (post_id, account_id, body) VALUES ($1, $2, $3)`, [postId, account.id, body]);

  // Tell the author, unless they commented on their own post.
  const [author] = await query<{ id: string }>(
    `SELECT ac.id FROM alumni_post p JOIN account ac ON ac.alumni_id = p.author_id WHERE p.id = $1 AND ac.id <> $2`,
    [postId, account.id],
  );
  if (author) {
    await enqueue("comment", [author.id], {
      title: `${account.displayName} แสดงความคิดเห็นในข่าวของคุณ`,
      body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
      link: `/alumni-news/${postId}#comments`,
    });
  }
  revalidatePath(`/alumni-news/${postId}`);
  return { ok: "ส่งความคิดเห็นแล้ว" };
}

export async function deleteCommentAction(fd: FormData): Promise<void> {
  const { account } = await interactingViewer();
  const id = Number(fd.get("commentId"));
  const [row] = await query<{ post_id: number }>(
    `DELETE FROM alumni_post_comment WHERE id = $1 AND account_id = $2 RETURNING post_id`,
    [id, account.id],
  );
  if (row) revalidatePath(`/alumni-news/${row.post_id}`);
  redirect(backTo(fd, row ? `/alumni-news/${row.post_id}#comments` : "/alumni-news"));
}

/** FR-ANEWS-11/17 (and jobs, articles) — reports go to the moderation queue. */
export async function reportAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { viewer, account } = await interactingViewer();
  const targetType = str(fd, "targetType");
  const targetId = Number(fd.get("targetId"));
  const reason = str(fd, "reason");
  const detail = str(fd, "detail").slice(0, 500);
  if (!["post", "comment", "job", "kb"].includes(targetType) || !Number.isInteger(targetId)) return { error: "ไม่พบเนื้อหาที่ต้องการรายงาน" };
  if (!REPORT_REASONS.includes(reason)) return { fieldErrors: { reason: "กรุณาเลือกเหตุผล" } };

  // The reported thing must be something this viewer can actually see.
  let visible = false;
  if (targetType === "job") visible = Boolean(await getLiveJob(targetId));
  else if (targetType === "kb") visible = Boolean(await getPublishedArticle(targetId));
  else {
    const postId = targetType === "post"
      ? targetId
      : (await query<{ post_id: number }>(`SELECT post_id FROM alumni_post_comment WHERE id = $1 AND moderation_status = 'approved'`, [targetId]))[0]?.post_id;
    visible = Boolean(postId && (await getVisiblePost(postId, viewer)));
  }
  if (!visible) return { error: "ไม่พบเนื้อหาที่ต้องการรายงาน" };

  if (await hit(LIMITS.report, account.id)) return { error: "ส่งรายงานถี่เกินไป กรุณารอสักครู่" };
  const [dup] = await query(
    `SELECT 1 FROM content_report WHERE target_type = $1 AND target_id = $2 AND reporter_account_id = $3 AND status = 'open'`,
    [targetType, targetId, account.id],
  );
  if (!dup) {
    await query(
      `INSERT INTO content_report (target_type, target_id, reporter_account_id, reason) VALUES ($1, $2, $3, $4)`,
      [targetType, targetId, account.id, detail ? `${reason} — ${detail}` : reason],
    );
  }
  return { ok: "ขอบคุณที่แจ้ง ผู้ตรวจสอบจะพิจารณาภายใน 1 วันทำการ" };
}
