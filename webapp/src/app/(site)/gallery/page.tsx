import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import { formatThaiDateOnly } from "@/lib/server/format-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "แกลเลอรีภาพกิจกรรม", description: "ภาพบรรยากาศกิจกรรมศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์" };

/** FR-NEWS-05 — published albums, newest first. */
export default async function GalleryPage() {
  const albums = await query<{ id: number; title: string; description: string | null; created_at: Date; cover: string | null; photos: string }>(
    `SELECT g.id, g.title, g.description, g.created_at,
            (SELECT p.file_id FROM gallery_photo p WHERE p.album_id = g.id ORDER BY p.sort, p.id LIMIT 1) AS cover,
            (SELECT count(*) FROM gallery_photo p WHERE p.album_id = g.id) AS photos
     FROM gallery_album g WHERE g.is_published ORDER BY g.created_at DESC`,
  );
  return (
    <>
      <PageHead crumb="แกลเลอรี" title="แกลเลอรีภาพกิจกรรม" lead="บรรยากาศงานคืนสู่เหย้า กิจกรรมรุ่น และงานของคณะ" />
      <section className="section">
        <div className="wrap">
          {albums.length === 0 ? (
            <div className="empty-state"><p style={{ marginBottom: 0 }}>ยังไม่มีอัลบั้มภาพ</p></div>
          ) : (
            <div className="grid grid-3">
              {albums.map((a) => (
                <article key={a.id} className="card">
                  {a.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(a.cover)} alt="" className="post-image" style={{ margin: 0, borderRadius: "10px 10px 0 0", aspectRatio: "4 / 3" }} loading="lazy" />
                  ) : null}
                  <div className="card-body">
                    <h3><Link href={`/gallery/${a.id}`}>{a.title}</Link></h3>
                    <p className="small muted">{a.photos} รูป · {formatThaiDateOnly(a.created_at)}</p>
                    {a.description ? <p>{a.description}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
