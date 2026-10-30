import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import ActionForm from "@/components/forms/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { toggleAlbumAction, updatePhotoAction, uploadPhotosAction } from "../../../gallery-actions";

export const metadata = { title: "อัลบั้ม" };

export default async function AdminAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(["admin", "editor"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [album] = await query<{ title: string; description: string | null; is_published: boolean }>(
    `SELECT title, description, is_published FROM gallery_album WHERE id = $1`,
    [id],
  );
  if (!album) notFound();
  const photos = await query<{ id: number; file_id: string; caption: string | null }>(
    `SELECT id, file_id, caption FROM gallery_photo WHERE album_id = $1 ORDER BY sort, id`,
    [id],
  );

  return (
    <>
      <p className="small"><Link href="/admin/gallery">← อัลบั้มทั้งหมด</Link></p>
      <div className="admin-head">
        <div><h1>{album.title}</h1><p>{photos.length} รูป · {album.is_published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</p></div>
        <form action={toggleAlbumAction} className="inline-actions">
          <input type="hidden" name="albumId" value={id} />
          <button type="submit" className="btn btn-primary">{album.is_published ? "ยกเลิกเผยแพร่" : "เผยแพร่อัลบั้ม"}</button>
          {album.is_published ? <Link href={`/gallery/${id}`} className="btn btn-outline">ดูหน้าเว็บ</Link> : null}
        </form>
      </div>

      <ActionForm action={uploadPhotosAction} submitLabel="อัปโหลด" pendingLabel="กำลังอัปโหลด…" encType="multipart/form-data" resetOnSuccess>
        <input type="hidden" name="albumId" value={id} />
        <div className="field">
          <label htmlFor="photos">เพิ่มรูป (เลือกได้หลายไฟล์ ครั้งละไม่เกิน 30 รูป · JPG, PNG, WebP ไม่เกิน 8 MB ต่อรูป)</label>
          <input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" />
          <p className="field-hint">ภาพในแกลเลอรีเป็นสาธารณะ — หลีกเลี่ยงภาพที่เห็นข้อมูลส่วนบุคคลชัดเจน</p>
        </div>
      </ActionForm>

      <section className="admin-card">
        <h2>รูปในอัลบั้ม</h2>
        {photos.length === 0 ? <p className="muted">ยังไม่มีรูป</p> : (
          <div className="gallery-grid">
            {photos.map((p) => (
              <figure key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(p.file_id)} alt={p.caption ?? ""} loading="lazy" />
                <form action={updatePhotoAction} className="inline-actions" style={{ marginTop: 6 }}>
                  <input type="hidden" name="photoId" value={p.id} />
                  <label className="sr-only" htmlFor={`cap${p.id}`}>คำบรรยาย</label>
                  <input id={`cap${p.id}`} name="caption" defaultValue={p.caption ?? ""} placeholder="คำบรรยาย" maxLength={200} style={{ flex: 1, minWidth: 0 }} />
                  <button type="submit" name="intent" value="save" className="btn btn-outline btn-sm">บันทึก</button>
                  <button type="submit" name="intent" value="delete" className="link-danger">ลบ</button>
                </form>
              </figure>
            ))}
          </div>
        )}
      </section>

      <form action={toggleAlbumAction} className="admin-card danger-zone">
        <input type="hidden" name="albumId" value={id} />
        <input type="hidden" name="intent" value="delete" />
        <h2>ลบอัลบั้ม</h2>
        <ConfirmButton message="ลบอัลบั้มนี้และรูปทั้งหมด?" className="btn btn-danger btn-sm">ลบอัลบั้ม</ConfirmButton>
      </form>
    </>
  );
}
