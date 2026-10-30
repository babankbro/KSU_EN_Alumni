"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, query } from "@/lib/server/db";
import { requireMember } from "@/lib/server/member-auth";
import { storeUpload, UploadError } from "@/lib/server/files";
import { MEMORIAL, POST_TYPES, notifyPublished, type PostVisibility } from "@/lib/server/posts";
import type { FormState } from "@/lib/form-state";

/**
 * Author-side alumni news (FR-ANEWS-01 … 10, 13). The author is always taken
 * from the session; a post id in the form only selects among the author's
 * own posts.
 */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITIES: PostVisibility[] = ["public", "members", "cohort"];

async function author() {
  const acc = await requireMember({ alumni: true, verified: true });
  if (!acc.alumniId) redirect("/me?need=alumni");
  return { acc, alumniId: acc.alumniId };
}

export async function savePostAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await author();
  const id = fd.get("recordId") ? Number(fd.get("recordId")) : null;
  const draft = fd.get("intent") === "draft";
  const type = str(fd, "type");
  const title = str(fd, "title");
  const body = str(fd, "body");
  const visibility = str(fd, "visibility") as PostVisibility;
  const tags = [...new Set(fd.getAll("tags").map(String).filter((t) => UUID.test(t) && t !== alumniId))];
  const image = fd.get("image");
  const removeImage = fd.get("removeImage") === "on";

  const fe: Record<string, string> = {};
  if (!(POST_TYPES as readonly string[]).includes(type)) fe.type = "กรุณาเลือกประเภทข่าว";
  if (title.length < 5 || title.length > 150) fe.title = "หัวข้อต้องยาว 5–150 ตัวอักษร";
  if (!draft && (body.length < 20 || body.length > 5000)) fe.body = "เนื้อหาต้องยาว 20–5,000 ตัวอักษร";
  if (draft && body.length > 5000) fe.body = "เนื้อหายาวได้ไม่เกิน 5,000 ตัวอักษร";
  if (!VISIBILITIES.includes(visibility)) fe.visibility = "กรุณาเลือกขอบเขตการมองเห็น";
  if (tags.length > 20) fe.tags = "แท็กได้ไม่เกิน 20 คน";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  let existing: { id: number; moderation_status: string; image_file_id: string | null } | undefined;
  if (id !== null) {
    [existing] = await query<{ id: number; moderation_status: string; image_file_id: string | null }>(
      `SELECT id, moderation_status::text AS moderation_status, image_file_id FROM alumni_post WHERE id = $1 AND author_id = $2`,
      [id, alumniId],
    );
    if (!existing) return { error: "ไม่พบข่าวนี้ในบัญชีของคุณ" };
    // A post hidden by a moderator stays as the moderator left it.
    if (existing.moderation_status === "hidden") return { error: "ข่าวนี้ถูกผู้ตรวจสอบซ่อนไว้ จึงแก้ไขไม่ได้ ติดต่อคณะหากต้องการสอบถาม" };
  }

  let imageId = removeImage ? null : (existing?.image_file_id ?? null);
  if (image instanceof File && image.size > 0) {
    try {
      imageId = (await storeUpload(image, "post_image", { uploadedBy: `account:${acc.id}`, ownerAlumniId: alumniId })).id;
    } catch (err) {
      if (err instanceof UploadError) return { fieldErrors: { image: err.message } };
      console.error("[me/posts] upload", err);
      return { error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
    }
  }

  // Tagged people must be listed in the directory — the same set the picker offers.
  const allowedTags = tags.length
    ? (await query<{ id: string }>(`SELECT id FROM directory_public WHERE id = ANY($1::uuid[])`, [tags])).map((r) => r.id)
    : [];

  // FR-ANEWS-08/10/13: trusted posters publish straight away, except memorials.
  const autoPublish = !draft && acc.isTrustedPoster && type !== MEMORIAL;
  const status = draft ? "pending" : autoPublish ? "approved" : "pending";

  const client = await getPool().connect();
  let postId: number;
  try {
    await client.query("BEGIN");
    const params = [type, title, body, visibility, imageId, draft, status, autoPublish];
    if (existing) {
      await client.query(
        `UPDATE alumni_post SET type = $1::alumni_news_type, title = $2, body = $3, visibility = $4::post_visibility,
                image_file_id = $5, is_draft = $6, moderation_status = $7::moderation_status,
                moderation_note = CASE WHEN $6 THEN moderation_note ELSE NULL END,
                moderated_by = CASE WHEN $8 THEN 'auto:trusted' ELSE NULL END,
                moderated_at = CASE WHEN $8 THEN now() ELSE NULL END,
                published_at = CASE WHEN $8 THEN coalesce(published_at, now()) ELSE published_at END,
                submitted_at = CASE WHEN $6 THEN submitted_at ELSE now() END,
                updated_at = now()
         WHERE id = $9`,
        [...params, existing.id],
      );
      postId = existing.id;
      // Keep declined tags declined; drop the others that were removed.
      await client.query(
        `DELETE FROM alumni_post_tag WHERE post_id = $1 AND NOT declined AND NOT (alumni_id = ANY($2::uuid[]))`,
        [postId, allowedTags],
      );
    } else {
      const [row] = (
        await client.query<{ id: number }>(
          `INSERT INTO alumni_post (author_id, type, title, body, visibility, image_file_id, is_draft, moderation_status,
                                    moderated_by, moderated_at, published_at, submitted_at)
           VALUES ($9, $1::alumni_news_type, $2, $3, $4::post_visibility, $5, $6, $7::moderation_status,
                   CASE WHEN $8 THEN 'auto:trusted' END, CASE WHEN $8 THEN now() END, CASE WHEN $8 THEN now() END,
                   CASE WHEN $6 THEN NULL ELSE now() END)
           RETURNING id`,
          [...params, alumniId],
        )
      ).rows;
      postId = row.id;
    }
    if (allowedTags.length) {
      await client.query(
        `INSERT INTO alumni_post_tag (post_id, alumni_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [postId, allowedTags],
      );
    }
    await client.query(
      `INSERT INTO audit_log (actor, action, target_table, target_id, detail) VALUES ($1, $2, 'alumni_post', $3, $4::jsonb)`,
      [`account:${acc.id}`, existing ? "post.update" : "post.create", String(postId), JSON.stringify({ title, draft, status })],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[me/posts] save", err);
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  } finally {
    client.release();
  }

  if (autoPublish) await notifyPublished(postId);
  revalidatePath("/me/posts");
  revalidatePath("/alumni-news");
  redirect(`/me/posts?saved=${draft ? "draft" : autoPublish ? "published" : "submitted"}`);
}

export async function deletePostAction(fd: FormData): Promise<void> {
  const { acc, alumniId } = await author();
  const id = Number(fd.get("recordId"));
  const [row] = await query<{ title: string }>(
    `DELETE FROM alumni_post WHERE id = $1 AND author_id = $2 RETURNING title`,
    [id, alumniId],
  );
  if (row) {
    await query(
      `INSERT INTO audit_log (actor, action, target_table, target_id, detail) VALUES ($1, 'post.delete', 'alumni_post', $2, $3::jsonb)`,
      [`account:${acc.id}`, String(id), JSON.stringify({ title: row.title })],
    );
  }
  revalidatePath("/alumni-news");
  redirect("/me/posts?saved=deleted");
}

/** FR-ANEWS-04 — the tagged person removes their own name from a post. */
export async function declineTagAction(fd: FormData): Promise<void> {
  const acc = await requireMember({ alumni: true });
  const postId = Number(fd.get("postId"));
  if (acc.alumniId && Number.isInteger(postId)) {
    await query(`UPDATE alumni_post_tag SET declined = true WHERE post_id = $1 AND alumni_id = $2`, [postId, acc.alumniId]);
    revalidatePath(`/alumni-news/${postId}`);
  }
  redirect("/me/posts?saved=untagged");
}
