"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { storeUpload, UploadError } from "@/lib/server/files";
import type { FormState } from "@/lib/form-state";

/** Event photo gallery (FR-NEWS-05): admins and content editors. */

const EDITORS = ["admin", "editor"] as const;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

export async function createAlbumAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin([...EDITORS]);
  const title = str(fd, "title");
  const description = str(fd, "description");
  const eventId = Number(str(fd, "eventId")) || null;
  if (title.length < 3 || title.length > 200) return { fieldErrors: { title: "ชื่ออัลบั้มต้องยาว 3–200 ตัวอักษร" } };
  const [row] = await query<{ id: number }>(
    `INSERT INTO gallery_album (title, description, event_id, created_by) VALUES ($1, NULLIF($2, ''), $3, $4) RETURNING id`,
    [title, description, eventId, session.id],
  );
  await audit(session, "gallery.create", "gallery_album", row.id, { title });
  redirect(`/admin/gallery/${row.id}`);
}

/** Several photos in one go; each file is validated on its own. */
export async function uploadPhotosAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin([...EDITORS]);
  const albumId = Number(str(fd, "albumId"));
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 30);
  if (!files.length) return { fieldErrors: { photos: "กรุณาเลือกรูปภาพ" } };
  const [album] = await query<{ id: number }>(`SELECT id FROM gallery_album WHERE id = $1`, [albumId]);
  if (!album) return { error: "ไม่พบอัลบั้มนี้" };

  const [{ next }] = await query<{ next: number }>(`SELECT coalesce(max(sort), 0) + 1 AS next FROM gallery_photo WHERE album_id = $1`, [albumId]);
  let ok = 0;
  const failed: string[] = [];
  for (const [i, f] of files.entries()) {
    try {
      const stored = await storeUpload(f, "gallery", { uploadedBy: session.id });
      await query(`INSERT INTO gallery_photo (album_id, file_id, sort) VALUES ($1, $2, $3)`, [albumId, stored.id, next + i]);
      ok++;
    } catch (err) {
      if (err instanceof UploadError) failed.push(`${f.name}: ${err.message}`);
      else throw err;
    }
  }
  await audit(session, "gallery.upload", "gallery_album", albumId, { ok, failed: failed.length });
  revalidatePath(`/admin/gallery/${albumId}`);
  revalidatePath(`/gallery/${albumId}`);
  return failed.length ? { ok: ok ? `อัปโหลด ${ok} รูปแล้ว` : undefined, error: `อัปโหลดไม่สำเร็จ ${failed.length} ไฟล์ — ${failed.join(" · ")}` } : { ok: `อัปโหลด ${ok} รูปแล้ว` };
}

export async function updatePhotoAction(fd: FormData): Promise<void> {
  await requireAdmin([...EDITORS]);
  const photoId = Number(str(fd, "photoId"));
  const [row] = fd.get("intent") === "delete"
    ? await query<{ album_id: number }>(`DELETE FROM gallery_photo WHERE id = $1 RETURNING album_id`, [photoId])
    : await query<{ album_id: number }>(`UPDATE gallery_photo SET caption = NULLIF($2, '') WHERE id = $1 RETURNING album_id`, [photoId, str(fd, "caption").slice(0, 200)]);
  if (row) revalidatePath(`/gallery/${row.album_id}`);
  redirect(row ? `/admin/gallery/${row.album_id}` : "/admin/gallery");
}

export async function toggleAlbumAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...EDITORS]);
  const albumId = Number(str(fd, "albumId"));
  if (fd.get("intent") === "delete") {
    await query(`DELETE FROM gallery_album WHERE id = $1`, [albumId]);
    await audit(session, "gallery.delete", "gallery_album", albumId);
    revalidatePath("/gallery");
    redirect("/admin/gallery");
  }
  const [row] = await query<{ is_published: boolean }>(
    `UPDATE gallery_album SET is_published = NOT is_published WHERE id = $1 RETURNING is_published`,
    [albumId],
  );
  if (row) await audit(session, row.is_published ? "gallery.publish" : "gallery.unpublish", "gallery_album", albumId);
  revalidatePath("/gallery");
  redirect(`/admin/gallery/${albumId}`);
}
