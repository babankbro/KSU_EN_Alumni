import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDate } from "@/lib/server/members";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { createAlbumAction } from "../../gallery-actions";

export const metadata = { title: "แกลเลอรี" };

export default async function AdminGalleryPage() {
  await requireAdmin(["admin", "editor"]);
  const [albums, events] = await Promise.all([
    query<{ id: number; title: string; is_published: boolean; photos: string; created_at: Date; event: string | null }>(
      `SELECT g.id, g.title, g.is_published, g.created_at, e.title AS event,
              (SELECT count(*) FROM gallery_photo p WHERE p.album_id = g.id) AS photos
       FROM gallery_album g LEFT JOIN event e ON e.id = g.event_id ORDER BY g.created_at DESC`,
    ),
    query<{ id: number; title: string }>(`SELECT id, title FROM event ORDER BY starts_at DESC LIMIT 50`),
  ]);
  return (
    <>
      <div className="admin-head">
        <div><h1>แกลเลอรีภาพกิจกรรม</h1><p>อัลบั้มที่เผยแพร่แล้วแสดงที่หน้า “แกลเลอรี” สำหรับทุกคน</p></div>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">อัลบั้ม</th><th scope="col">กิจกรรม</th><th scope="col" className="num">รูป</th><th scope="col">สถานะ</th><th scope="col">สร้างเมื่อ</th></tr></thead>
          <tbody>
            {albums.length === 0 ? <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 32 }}>ยังไม่มีอัลบั้ม</td></tr> : albums.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/admin/gallery/${a.id}`}><strong>{a.title}</strong></Link></td>
                <td className="small">{a.event ?? "—"}</td>
                <td className="num">{a.photos}</td>
                <td><span className={`pill pill-${a.is_published ? "published" : "draft"}`}>{a.is_published ? "เผยแพร่" : "ฉบับร่าง"}</span></td>
                <td className="small">{thaiDate(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ActionForm action={createAlbumAction} submitLabel="+ สร้างอัลบั้ม">
        <h2 style={{ fontSize: 18, margin: 0 }}>อัลบั้มใหม่</h2>
        <Field name="title" label="ชื่ออัลบั้ม" maxLength={200} required />
        <Field as="textarea" name="description" label="คำอธิบาย" rows={2} maxLength={1000} />
        <Field as="select" name="eventId" label="เชื่อมกับกิจกรรม (ไม่บังคับ)" options={events.map((e) => ({ value: String(e.id), label: e.title }))} emptyLabel="— ไม่เชื่อม —" />
      </ActionForm>
    </>
  );
}
