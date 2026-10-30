"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { enqueue } from "@/lib/server/notify";

/** Moderation of job posts (FR-JOB-02) and knowledge-base articles (FR-KB-02). */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
type Decision = "approve" | "changes" | "reject" | "hide";
const STATUS: Record<Decision, string> = { approve: "approved", changes: "changes_requested", reject: "rejected", hide: "hidden" };
const NOUN = { job: "ประกาศงาน", kb: "บทความ" };
const TEXT: Record<Decision, string> = {
  approve: "ของคุณผ่านการตรวจสอบและเผยแพร่แล้ว",
  changes: "ของคุณต้องแก้ไขก่อนเผยแพร่",
  reject: "ของคุณไม่ผ่านการตรวจสอบ",
  hide: "ของคุณถูกซ่อนจากหน้าเว็บ",
};

function back(fd: FormData, done: string): never {
  const tab = str(fd, "tab").replace(/[^a-z]/g, "") || "jobs";
  redirect(`/admin/moderation?tab=${tab}&done=${done}`);
}

async function moderate(kind: "job" | "kb", fd: FormData): Promise<void> {
  const session = await requireAdmin(["admin", "editor"]);
  const id = Number(fd.get("recordId"));
  const decision = str(fd, "decision") as Decision;
  const note = str(fd, "note").slice(0, 1000);
  if (!Number.isInteger(id) || !(decision in STATUS)) back(fd, "invalid");
  if (decision !== "approve" && !note) back(fd, "need_note");

  const table = kind === "job" ? "job_post" : "kb_article";
  const owner = kind === "job" ? "posted_by" : "author_id";
  const extra = kind === "job"
    ? `approved_at = CASE WHEN $2 = 'approved' THEN coalesce(approved_at, now()) ELSE approved_at END`
    : `published_at = CASE WHEN $2 = 'approved' THEN coalesce(published_at, now()) ELSE published_at END`;
  const [row] = await query<{ title: string; owner: string | null }>(
    `UPDATE ${table} SET moderation_status = $2::moderation_status, moderation_note = NULLIF($3, ''), moderated_by = $4, ${extra}
     WHERE id = $1 RETURNING title, ${owner} AS owner`,
    [id, STATUS[decision], note, session.id],
  );
  if (!row) back(fd, "missing");

  if (decision === "hide" || decision === "reject") {
    await query(
      `UPDATE content_report SET status = 'resolved', resolved_by = $3, resolved_at = now()
       WHERE target_type = $1 AND target_id = $2 AND status = 'open'`,
      [kind, id, session.id],
    );
  }
  await audit(session, `${kind}.${decision}`, table, id, { title: row.title, note: note || undefined });

  if (row.owner) {
    const accounts = (await query<{ id: string }>(`SELECT id FROM account WHERE alumni_id = $1 AND is_active`, [row.owner])).map((r) => r.id);
    await enqueue("moderation", accounts, {
      title: `${NOUN[kind]}${TEXT[decision]}`,
      body: `“${row.title}”${note ? ` — เหตุผล: ${note}` : ""}`,
      link: decision === "approve" ? (kind === "job" ? `/jobs/${id}` : `/kb/${id}`) : "/me/activity",
    });
  }
  // Job-match notifications (FR-JOB-06) follow from the cron task.

  revalidatePath(kind === "job" ? "/jobs" : "/kb");
  back(fd, decision);
}

export async function moderateJobAction(fd: FormData): Promise<void> {
  await moderate("job", fd);
}

export async function moderateKbAction(fd: FormData): Promise<void> {
  await moderate("kb", fd);
}
